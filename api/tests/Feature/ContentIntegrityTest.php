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
}
