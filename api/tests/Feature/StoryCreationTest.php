<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoryCreationTest extends TestCase
{
    use RefreshDatabase;

    public function test_story_project_can_be_created_with_an_initial_draft_chapter(): void
    {
        $author = User::factory()->create();

        $response = $this->actingAs($author)->postJson('/api/v1/stories', [
            'title' => 'A New Story',
            'overview' => 'A synopsis for the new story.',
            'genres' => 'Fantasy',
            'language' => 'en',
            'isMature' => false,
            'createInitialChapter' => true,
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['id', 'initialPartId']);

        $story = Story::findOrFail($response->json('id'));
        $part = StoryPart::findOrFail($response->json('initialPartId'));

        $this->assertSame($story->id, $part->storyId);
        $this->assertSame('Untitled Chapter', $part->title);
        $this->assertSame(1, $part->order);
        $this->assertFalse($part->isPublished);
        $this->assertFalse($story->isPublished);
    }

    public function test_existing_story_creation_contract_does_not_create_a_chapter_by_default(): void
    {
        $author = User::factory()->create();

        $response = $this->actingAs($author)->postJson('/api/v1/stories', [
            'title' => 'Metadata Only',
            'overview' => 'Created by an existing API client.',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['id'])
            ->assertJsonMissingPath('initialPartId');

        $this->assertDatabaseCount('stories', 1);
        $this->assertDatabaseCount('story_parts', 0);
    }
}
