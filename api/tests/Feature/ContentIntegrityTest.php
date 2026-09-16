<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ContentIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_stale_editor_save_cannot_overwrite_a_newer_revision(): void
    {
        $user = User::factory()->create();
        $story = Story::factory()->create(['authorId' => $user->id]);
        $part = StoryPart::factory()->create(['storyId' => $story->id]);
        $this->actingAs($user)->putJson("/api/v1/parts/{$part->id}", ['content' => '<p>New</p>', 'revision' => 0])
            ->assertOk()->assertJsonPath('revision', 1);
        $this->putJson("/api/v1/parts/{$part->id}", ['content' => '<p>Old</p>', 'revision' => 0])->assertStatus(409);
        $this->assertSame('<p>New</p>', $part->fresh()->content);
    }

    public function test_story_pages_are_bounded_and_chapter_lists_omit_content(): void
    {
        Story::factory()->count(32)->create(['isPublished' => true]);
        $first = $this->getJson('/api/v1/stories')->assertOk()->assertJsonCount(30)->assertHeader('X-Next-Page', '2');
        $second = $this->getJson('/api/v1/stories?page=2')->assertOk()->assertJsonCount(2);
        $this->assertEmpty(array_intersect(array_column($first->json(), 'id'), array_column($second->json(), 'id')));
        $part = StoryPart::factory()->create(['storyId' => $first->json('0.id'), 'isPublished' => true]);
        $response = $this->getJson("/api/v1/stories/{$part->storyId}/parts")->assertOk();
        $this->assertArrayNotHasKey('content', $response->json('0'));
    }

    public function test_chapter_completion_increments_both_chapter_and_story_read_count_once_for_first_completion(): void
    {
        $author = User::factory()->create();
        $reader = User::factory()->create();

        $story = Story::factory()->create([
            'authorId' => $author->id,
            'isPublished' => true,
            'readCount' => 0,
        ]);

        $part1 = StoryPart::factory()->create([
            'storyId' => $story->id,
            'isPublished' => true,
            'readCount' => 0,
            'order' => 1,
        ]);

        $part2 = StoryPart::factory()->create([
            'storyId' => $story->id,
            'isPublished' => true,
            'readCount' => 0,
            'order' => 2,
        ]);

        // First completion of Part 1
        $res1 = $this->actingAs($reader)->postJson("/api/v1/parts/{$part1->id}/read");
        $res1->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('alreadyCompleted', false)
            ->assertJsonPath('partReadCount', 1)
            ->assertJsonPath('storyReadCount', 1);

        $this->assertEquals(1, $part1->fresh()->readCount);
        $this->assertEquals(1, $story->fresh()->readCount);

        // Re-read of Part 1 (idempotent, must not increment counts)
        $resRetry = $this->actingAs($reader)->postJson("/api/v1/parts/{$part1->id}/read");
        $resRetry->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('alreadyCompleted', true)
            ->assertJsonPath('partReadCount', 1)
            ->assertJsonPath('storyReadCount', 1);

        $this->assertEquals(1, $part1->fresh()->readCount);
        $this->assertEquals(1, $story->fresh()->readCount);

        // First completion of Part 2 (increments Part 2 to 1 and parent Story to 2)
        $res2 = $this->actingAs($reader)->postJson("/api/v1/parts/{$part2->id}/read");
        $res2->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('alreadyCompleted', false)
            ->assertJsonPath('partReadCount', 1)
            ->assertJsonPath('storyReadCount', 2);

        $this->assertEquals(1, $part2->fresh()->readCount);
        $this->assertEquals(2, $story->fresh()->readCount);
    }
}

