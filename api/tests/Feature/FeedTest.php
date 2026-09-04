<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\Models\UserReadPart;
use App\Models\UserReadingProgress;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeedTest extends TestCase
{
    use RefreshDatabase;

    public function test_continue_reading_and_recommended_feeds(): void
    {
        $user = User::factory()->create([
            'preferredGenres' => 'Romance,Fantasy',
        ]);

        $author = User::factory()->create(['username' => 'authorA']);

        $story = Story::create([
            'id' => 'story_rec_1',
            'authorId' => $author->id,
            'authorName' => $author->username,
            'title' => 'A Romantic Fantasy',
            'overview' => 'Lovely story',
            'genres' => 'Romance, Fantasy',
            'isPublished' => true,
        ]);

        $part1 = StoryPart::create([
            'id' => 'part_rec_1',
            'storyId' => $story->id,
            'title' => 'Chapter 1',
            'content' => 'Text',
            'order' => 1,
            'isPublished' => true,
        ]);

        $part2 = StoryPart::create([
            'id' => 'part_rec_2',
            'storyId' => $story->id,
            'title' => 'Chapter 2',
            'content' => 'Text',
            'order' => 2,
            'isPublished' => true,
        ]);

        // User reads part 1
        UserReadPart::create([
            'userId' => $user->id,
            'partId' => $part1->id,
            'storyId' => $story->id,
            'readAt' => time(),
        ]);

        UserReadingProgress::create([
            'userId' => $user->id,
            'storyId' => $story->id,
            'last_part_id' => $part1->id,
            'last_scroll_position' => 0.5,
        ]);

        // Test continue reading
        $continueRes = $this->actingAs($user)->getJson('/api/v1/stories/continue-reading');
        $continueRes->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.story.id', $story->id)
            ->assertJsonPath('0.completed_percentage', 50);

        // Test recommended
        $recRes = $this->actingAs($user)->getJson('/api/v1/stories/recommended');
        $recRes->assertOk();
        $this->assertTrue(collect($recRes->json())->pluck('id')->contains($story->id));
    }
}
