<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class VerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_author_verification_eligibility_and_balance_deduction(): void
    {
        $author = User::factory()->create([
            'username' => 'writer1',
            'isVerified' => false,
            'authorIncome' => 200.00,
        ]);

        // Create 2 stories with 10 published parts each
        for ($s = 1; $s <= 2; $s++) {
            $story = Story::create([
                'id' => 'story_' . $s,
                'authorId' => $author->id,
                'authorName' => $author->username,
                'title' => 'Story ' . $s,
                'overview' => 'Overview ' . $s,
                'isPublished' => true,
            ]);

            for ($p = 1; $p <= 10; $p++) {
                StoryPart::create([
                    'id' => "part_{$s}_{$p}",
                    'storyId' => $story->id,
                    'title' => "Part {$p}",
                    'content' => 'Content...',
                    'order' => $p,
                    'isPublished' => true,
                ]);
            }
        }

        // Check status
        $statusRes = $this->actingAs($author)->getJson('/api/v1/authors/verification-status');
        $statusRes->assertOk()
            ->assertJsonPath('isEligible', true)
            ->assertJsonPath('qualifyingStoriesCount', 2)
            ->assertJsonPath('isVerified', false);

        // Apply via balance deduction (149 PHP)
        $applyRes = $this->actingAs($author)->postJson('/api/v1/authors/verify', [
            'payment_method' => 'balance',
        ]);

        $applyRes->assertOk()->assertJsonPath('isVerified', true);

        $author->refresh();
        $this->assertTrue($author->isVerified);
        $this->assertEquals(51.00, (float)$author->authorIncome);

        // Verify stories updated to verified
        $this->assertTrue(Story::find('story_1')->isAuthorVerified);
    }

    public function test_author_verification_via_receipt_upload(): void
    {
        Storage::fake('payment_proofs');

        $author = User::factory()->create([
            'username' => 'writer2',
            'isVerified' => false,
            'authorIncome' => 10.00,
        ]);

        // Create 2 stories with 10 published parts each
        for ($s = 1; $s <= 2; $s++) {
            $story = Story::create([
                'id' => 'story_b_' . $s,
                'authorId' => $author->id,
                'authorName' => $author->username,
                'title' => 'Story B ' . $s,
                'overview' => 'Overview',
                'isPublished' => true,
            ]);

            for ($p = 1; $p <= 10; $p++) {
                StoryPart::create([
                    'id' => "part_b_{$s}_{$p}",
                    'storyId' => $story->id,
                    'title' => "Part {$p}",
                    'content' => 'Content',
                    'order' => $p,
                    'isPublished' => true,
                ]);
            }
        }

        $file = UploadedFile::fake()->create('receipt.jpg', 100, 'image/jpeg');

        $response = $this->actingAs($author)->post('/api/v1/authors/verify', [
            'payment_method' => 'gcash',
            'payment_reference' => 'GCASH123456',
            'payment_proof' => $file,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('author_verification_requests', [
            'user_id' => $author->id,
            'payment_method' => 'gcash',
            'status' => 'pending',
        ]);

        // Assert PlanPurchase is created for unified admin review
        $this->assertDatabaseHas('plan_purchases', [
            'userId' => $author->id,
            'plan_type' => 'author_verification',
            'payment_method' => 'gcash',
            'status' => 'pending_review',
        ]);

        // Admin approves via standard plan payments admin endpoint
        $admin = User::factory()->create(['role' => 'admin']);
        $purchase = \App\Models\PlanPurchase::where('userId', $author->id)->first();

        $approveRes = $this->actingAs($admin)->postJson("/api/v1/admin/plan-purchases/{$purchase->id}/approve");
        $approveRes->assertOk();

        $author->refresh();
        $this->assertTrue($author->isVerified);
        $this->assertTrue(Story::find('story_b_1')->isAuthorVerified);
    }

    public function test_verified_author_creates_story_inherits_verified_badge(): void
    {
        $verifiedAuthor = User::factory()->create([
            'username' => 'verified_pro',
            'isVerified' => true,
        ]);

        $res = $this->actingAs($verifiedAuthor)->postJson('/api/v1/stories', [
            'title' => 'Brand New Novel',
            'overview' => 'An epic adventure.',
            'genres' => 'Fantasy',
        ]);

        $res->assertStatus(201);
        $storyId = $res->json('id');

        $story = Story::findOrFail($storyId);
        $this->assertTrue($story->isAuthorVerified);

        // Publish story so it appears in search
        $story->update(['isPublished' => true]);

        // Search selects author_is_verified
        $searchRes = $this->actingAs($verifiedAuthor)->getJson('/api/v1/stories/search?query=Brand+New+Novel');
        $searchRes->assertOk();
        $this->assertTrue((bool)$searchRes->json('0.author_is_verified'));
    }
}
