<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReadingListTest extends TestCase
{
    use RefreshDatabase;

    public function test_owner_can_create_a_list_and_save_a_story(): void
    {
        $owner = User::factory()->create();
        $story = Story::factory()->create();

        $created = $this->actingAs($owner)->postJson('/api/v1/reading-lists', ['name' => 'Favorites']);
        $created->assertCreated()->assertJsonPath('name', 'Favorites');
        $listId = $created->json('id');

        $this->actingAs($owner)
            ->postJson("/api/v1/reading-lists/{$listId}/stories/{$story->id}")
            ->assertOk();

        $this->getJson("/api/v1/users/{$owner->id}/reading-lists")
            ->assertOk()
            ->assertJsonPath('0.storyCount', 1)
            ->assertJsonPath('0.stories.0.id', $story->id);
    }

    public function test_public_lists_hide_unpublished_stories_and_other_users_cannot_modify_them(): void
    {
        $owner = User::factory()->create();
        $visitor = User::factory()->create();
        $published = Story::factory()->create();
        $draft = Story::factory()->create(['authorId' => $owner->id, 'isPublished' => false]);

        $created = $this->actingAs($owner)->postJson('/api/v1/reading-lists', ['name' => 'Public picks']);
        $listId = $created->json('id');
        $this->actingAs($owner)->postJson("/api/v1/reading-lists/{$listId}/stories/{$published->id}");
        $this->actingAs($owner)->postJson("/api/v1/reading-lists/{$listId}/stories/{$draft->id}");

        $this->actingAs($visitor)
            ->postJson("/api/v1/reading-lists/{$listId}/stories/{$published->id}")
            ->assertForbidden();

        $this->getJson("/api/v1/users/{$owner->id}/reading-lists")
            ->assertOk()
            ->assertJsonPath('0.storyCount', 1)
            ->assertJsonMissing(['id' => $draft->id]);
    }
}
