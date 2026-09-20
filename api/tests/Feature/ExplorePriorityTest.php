<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExplorePriorityTest extends TestCase
{
    use RefreshDatabase;

    public function test_verified_author_stories_are_prioritized_on_explore(): void
    {
        $verifiedAuthor = User::factory()->create(['isVerified' => true]);
        $standardAuthor = User::factory()->create(['isVerified' => false]);
        $standardStory = Story::factory()->create([
            'authorId' => $standardAuthor->id,
            'authorName' => $standardAuthor->username,
            'title' => 'New standard story',
            'lastUpdatedAt' => 2000,
        ]);
        $verifiedStory = Story::factory()->create([
            'authorId' => $verifiedAuthor->id,
            'authorName' => $verifiedAuthor->username,
            'title' => 'Older verified story',
            'lastUpdatedAt' => 1000,
            'isAuthorVerified' => false,
        ]);

        $response = $this->getJson('/api/v1/stories');

        $response->assertOk()
            ->assertJsonPath('0.id', $verifiedStory->id)
            ->assertJsonPath('1.id', $standardStory->id);
    }
}
