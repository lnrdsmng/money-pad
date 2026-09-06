<?php

namespace Tests\Feature;

use App\Models\ReadingSession;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReadingProgressTest extends TestCase
{
    use RefreshDatabase;

    public function test_completing_a_chapter_is_idempotent_and_prevents_another_earning_session(): void
    {
        $reader = User::factory()->create();
        $story = Story::factory()->create();
        $part = StoryPart::factory()->create([
            'storyId' => $story->id,
            'readCount' => 7,
        ]);
        $payload = ['storyId' => $story->id, 'partId' => $part->id];

        $this->actingAs($reader)
            ->getJson("/api/v1/parts/{$part->id}")
            ->assertOk()
            ->assertJsonPath('isCompletedByCurrentUser', false);

        $sessionId = $this->postJson('/api/v1/reading/start', $payload)
            ->assertOk()
            ->json('id');

        $this->postJson("/api/v1/parts/{$part->id}/read")
            ->assertOk()
            ->assertJsonPath('alreadyCompleted', false);

        $this->postJson("/api/v1/parts/{$part->id}/read")
            ->assertOk()
            ->assertJsonPath('alreadyCompleted', true);

        $this->assertDatabaseHas('user_read_parts', [
            'userId' => $reader->id,
            'partId' => $part->id,
            'storyId' => $story->id,
        ]);
        $this->assertSame(8, $part->fresh()->readCount);
        $this->assertFalse(ReadingSession::findOrFail($sessionId)->is_active);
        $this->assertDatabaseMissing('active_reading_sessions', ['session_id' => $sessionId]);

        $this->getJson("/api/v1/parts/{$part->id}")
            ->assertOk()
            ->assertJsonPath('isCompletedByCurrentUser', true);

        $this->postJson('/api/v1/reading/start', $payload)
            ->assertConflict()
            ->assertJsonPath('completed', true);
        $this->assertDatabaseCount('reading_sessions', 1);
    }

    public function test_latest_chapter_selection_replaces_the_previous_resume_target(): void
    {
        $reader = User::factory()->create();
        $story = Story::factory()->create();
        $firstPart = StoryPart::factory()->create(['storyId' => $story->id, 'order' => 1]);
        $secondPart = StoryPart::factory()->create(['storyId' => $story->id, 'order' => 2]);

        $this->actingAs($reader)->postJson("/api/v1/users/{$reader->id}/reading-progress", [
            'storyId' => $story->id,
            'last_part_id' => $firstPart->id,
            'last_scroll_position' => 1,
        ])->assertOk();

        $this->postJson("/api/v1/users/{$reader->id}/reading-progress", [
            'storyId' => $story->id,
            'last_part_id' => $secondPart->id,
            'last_scroll_position' => 0,
        ])->assertOk();

        $this->getJson("/api/v1/users/{$reader->id}/reading-progress/{$story->id}")
            ->assertOk()
            ->assertJsonPath('last_part_id', $secondPart->id)
            ->assertJsonPath('last_scroll_position', 0);
    }
}
