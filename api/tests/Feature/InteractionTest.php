<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Notification;
use App\Models\PlanPurchase;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\PlanPurchaseStatus;
use App\PlanType;
use App\Services\PlanPurchaseReviewService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InteractionTest extends TestCase
{
    use RefreshDatabase;

    public function test_story_likes_toggle_and_notification(): void
    {
        $author = User::factory()->create(['username' => 'author1']);
        $reader = User::factory()->create(['username' => 'reader1']);

        $story = Story::create([
            'id' => 'story_test_1',
            'authorId' => $author->id,
            'authorName' => $author->username,
            'title' => 'Test Story',
            'overview' => 'Overview',
            'isPublished' => true,
            'likes' => 0,
        ]);

        // Like story
        $res = $this->actingAs($reader)->postJson("/api/v1/stories/{$story->id}/like", [
            'userId' => $reader->id,
        ]);
        $res->assertOk()->assertJsonPath('newLikes', 1);

        $story->refresh();
        $this->assertEquals(1, $story->likes);

        // Check author received LIKE notification
        $this->assertDatabaseHas('notifications', [
            'userId' => $author->id,
            'type' => 'LIKE',
            'actorId' => $reader->id,
            'storyId' => $story->id,
        ]);

        // Check isLiked
        $isLikedRes = $this->actingAs($reader)->getJson("/api/v1/stories/{$story->id}/is-liked?userId={$reader->id}");
        $isLikedRes->assertOk()->assertJsonPath('isLiked', true);

        // Unlike story
        $unlikeRes = $this->actingAs($reader)->postJson("/api/v1/stories/{$story->id}/like", [
            'userId' => $reader->id,
        ]);
        $unlikeRes->assertOk()->assertJsonPath('newLikes', 0);
        $story->refresh();
        $this->assertEquals(0, $story->likes);
    }

    public function test_story_reviews_submission_and_notification(): void
    {
        $author = User::factory()->create(['username' => 'author2']);
        $reader = User::factory()->create(['username' => 'reader2']);

        $story = Story::create([
            'id' => 'story_test_2',
            'authorId' => $author->id,
            'authorName' => $author->username,
            'title' => 'Great Novel',
            'overview' => 'Overview',
            'isPublished' => true,
        ]);

        $res = $this->actingAs($reader)->postJson("/api/v1/stories/{$story->id}/reviews", [
            'userId' => $reader->id,
            'rating' => 5,
            'comment' => 'Astonishing read! Highly recommended.',
        ]);
        $res->assertOk()->assertJsonPath('success', true);

        // Review exists
        $this->assertDatabaseHas('reviews', [
            'storyId' => $story->id,
            'userId' => $reader->id,
            'rating' => 5,
        ]);

        // Author notified
        $this->assertDatabaseHas('notifications', [
            'userId' => $author->id,
            'type' => 'REVIEW',
            'actorId' => $reader->id,
        ]);
    }

    public function test_follow_unfollow_counters_and_notifications(): void
    {
        $userA = User::factory()->create(['username' => 'userA', 'followers' => 0, 'following' => 0]);
        $userB = User::factory()->create(['username' => 'userB', 'followers' => 0, 'following' => 0]);

        // A follows B
        $res = $this->actingAs($userA)->postJson("/api/v1/users/{$userA->id}/follow", [
            'followedId' => $userB->id,
        ]);
        $res->assertOk()->assertJsonPath('success', true);

        $userA->refresh();
        $userB->refresh();
        $this->assertEquals(1, $userA->following);
        $this->assertEquals(1, $userB->followers);

        $this->assertDatabaseHas('notifications', [
            'userId' => $userB->id,
            'type' => 'FOLLOW',
            'actorId' => $userA->id,
        ]);

        // A unfollows B
        $unfollowRes = $this->actingAs($userA)->postJson("/api/v1/users/{$userA->id}/unfollow", [
            'followedId' => $userB->id,
        ]);
        $unfollowRes->assertOk()->assertJsonPath('success', true);

        $userA->refresh();
        $userB->refresh();
        $this->assertEquals(0, $userA->following);
        $this->assertEquals(0, $userB->followers);
    }

    public function test_author_wall_conversations_replies_and_mentions(): void
    {
        $author = User::factory()->create(['username' => 'novelist']);
        $fan = User::factory()->create(['username' => 'fan1']);
        $friend = User::factory()->create(['username' => 'friend2']);

        // Fan posts on author wall with @mention of friend2
        $postRes = $this->actingAs($fan)->postJson('/api/v1/conversations', [
            'authorId' => $author->id,
            'message' => 'Hello @novelist! Check out with @friend2 too!',
        ]);
        $postRes->assertOk()->assertJsonPath('success', true);

        // Wall author notified
        $this->assertDatabaseHas('notifications', [
            'userId' => $author->id,
            'type' => 'CONVERSATION',
            'actorId' => $fan->id,
        ]);

        // Mentioned friend notified
        $this->assertDatabaseHas('notifications', [
            'userId' => $friend->id,
            'type' => 'MENTION',
            'actorId' => $fan->id,
        ]);

        $conv = Conversation::first();

        // Author replies
        $replyRes = $this->actingAs($author)->postJson('/api/v1/conversations', [
            'authorId' => $author->id,
            'message' => 'Thank you for stopping by!',
            'parentId' => $conv->id,
        ]);
        $replyRes->assertOk()->assertJsonPath('success', true);

        // Fan received REPLY notification
        $this->assertDatabaseHas('notifications', [
            'userId' => $fan->id,
            'type' => 'REPLY',
            'actorId' => $author->id,
        ]);
    }

    public function test_chapter_text_annotations_storage(): void
    {
        $author = User::factory()->create(['username' => 'writer_ann']);
        $reader = User::factory()->create(['username' => 'reader_ann']);

        $story = Story::create([
            'id' => 'story_ann_1',
            'authorId' => $author->id,
            'authorName' => $author->username,
            'title' => 'Story with Annotations',
            'overview' => 'Overview',
            'isPublished' => true,
        ]);

        $part = StoryPart::create([
            'id' => 'part_ann_1',
            'storyId' => $story->id,
            'title' => 'Chapter 1',
            'content' => 'The moon shone bright across the midnight sky.',
            'order' => 1,
            'isPublished' => true,
        ]);

        $annRes = $this->actingAs($reader)->postJson("/api/v1/parts/{$part->id}/annotations", [
            'userId' => $reader->id,
            'selectedText' => 'The moon shone bright',
            'startIndex' => 0,
            'endIndex' => 20,
            'type' => 'COMMENT',
            'content' => 'Beautiful opening line!',
        ]);
        $annRes->assertOk()->assertJsonPath('success', true);

        $this->assertDatabaseHas('part_annotations', [
            'partId' => $part->id,
            'userId' => $reader->id,
            'selectedText' => 'The moon shone bright',
            'type' => 'COMMENT',
        ]);

        // Get annotations
        $getRes = $this->actingAs($reader)->getJson("/api/v1/parts/{$part->id}/annotations");
        $getRes->assertOk()->assertJsonCount(1);
    }

    public function test_plan_purchase_review_service_author_verification(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'username' => 'admin1']);
        $author = User::factory()->create(['username' => 'pro_writer', 'isVerified' => false]);

        $story = Story::create([
            'id' => 'story_pro_1',
            'authorId' => $author->id,
            'authorName' => $author->username,
            'title' => 'Pro Story',
            'overview' => 'Overview',
            'isPublished' => true,
            'isAuthorVerified' => false,
        ]);

        $purchase = PlanPurchase::create([
            'id' => 'purchase_verif_1',
            'userId' => $author->id,
            'plan_type' => PlanType::AuthorVerification,
            'amount' => 149.00,
            'currency' => 'PHP',
            'provider' => 'manual',
            'payment_method' => 'gcash',
            'reference_number' => 'MP-VERIF-12345678',
            'payment_reference' => 'GCASH987654',
            'payment_proof_path' => 'proofs/test.jpg',
            'status' => PlanPurchaseStatus::PendingReview,
            'submitted_at' => now(),
        ]);

        $reviewService = app(PlanPurchaseReviewService::class);
        $reviewed = $reviewService->approve($purchase, $admin);

        $this->assertEquals(PlanPurchaseStatus::Approved, $reviewed->status);

        $author->refresh();
        $this->assertTrue($author->isVerified);

        $story->refresh();
        $this->assertTrue($story->isAuthorVerified);

        // Verification notification sent
        $this->assertDatabaseHas('notifications', [
            'userId' => $author->id,
            'type' => 'VERIFIED',
        ]);
    }

    public function test_user_cannot_follow_themselves(): void
    {
        $user = User::factory()->create();

        $res = $this->actingAs($user)->postJson("/api/v1/users/{$user->id}/follow", [
            'followedId' => $user->id,
        ]);

        $res->assertStatus(422)
            ->assertJsonPath('message', 'You cannot follow yourself.');
    }

    public function test_user_cannot_submit_duplicate_review(): void
    {
        $author = User::factory()->create(['username' => 'author_rev']);
        $reader = User::factory()->create(['username' => 'reader_rev']);

        $story = Story::create([
            'id' => 'story_rev_dup',
            'authorId' => $author->id,
            'authorName' => $author->username,
            'title' => 'Story with Reviews',
            'overview' => 'Overview',
            'isPublished' => true,
        ]);

        $res1 = $this->actingAs($reader)->postJson("/api/v1/stories/{$story->id}/reviews", [
            'userId' => $reader->id,
            'rating' => 4,
            'comment' => 'First review!',
        ]);
        $res1->assertOk();

        // Attempt duplicate review
        $res2 = $this->actingAs($reader)->postJson("/api/v1/stories/{$story->id}/reviews", [
            'userId' => $reader->id,
            'rating' => 5,
            'comment' => 'Second review!',
        ]);
        $res2->assertStatus(422)
            ->assertJsonPath('message', 'You have already reviewed this story.');
    }
}
