<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PublicationNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_followers_are_notified_only_when_a_story_becomes_published(): void
    {
        [$author, $follower] = $this->followedAuthor();
        $story = Story::factory()->create([
            'authorId' => $author->id,
            'authorName' => $author->username,
            'isPublished' => false,
        ]);

        $this->actingAs($author)->postJson("/api/v1/stories/{$story->id}/publish")->assertOk();
        $this->actingAs($author)->postJson("/api/v1/stories/{$story->id}/publish")->assertOk();

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', [
            'userId' => $follower->id,
            'actorId' => $author->id,
            'storyId' => $story->id,
            'type' => 'NEW_STORY',
        ]);
    }

    public function test_publishing_a_chapter_in_a_public_story_notifies_followers(): void
    {
        [$author, $follower] = $this->followedAuthor();
        $story = Story::factory()->create([
            'authorId' => $author->id,
            'authorName' => $author->username,
            'isPublished' => true,
        ]);
        $part = StoryPart::factory()->create(['storyId' => $story->id, 'isPublished' => false, 'revision' => 0]);

        $this->actingAs($author)->putJson("/api/v1/parts/{$part->id}", [
            'isPublished' => true,
            'revision' => 0,
        ])->assertOk();

        $this->assertDatabaseHas('notifications', [
            'userId' => $follower->id,
            'actorId' => $author->id,
            'storyId' => $story->id,
            'partId' => $part->id,
            'type' => 'NEW_PART',
        ]);
    }

    private function followedAuthor(): array
    {
        $author = User::factory()->create();
        $follower = User::factory()->create();
        DB::table('follows')->insert(['followerId' => $follower->id, 'followedId' => $author->id]);

        return [$author, $follower];
    }
}
