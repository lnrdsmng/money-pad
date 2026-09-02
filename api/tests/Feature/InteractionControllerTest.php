<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InteractionControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_follow_another_user(): void
    {
        $follower = User::factory()->create();
        $followed = User::factory()->create();

        $this->actingAs($follower)
            ->postJson("/api/v1/users/{$follower->id}/follow", ['followedId' => $followed->id])
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->assertDatabaseHas('follows', [
            'followerId' => $follower->id,
            'followedId' => $followed->id,
        ]);
    }

    public function test_authenticated_user_can_unfollow_another_user(): void
    {
        $follower = User::factory()->create();
        $followed = User::factory()->create();
        DB::table('follows')->insert([
            'followerId' => $follower->id,
            'followedId' => $followed->id,
        ]);

        $this->actingAs($follower)
            ->postJson("/api/v1/users/{$follower->id}/unfollow", ['followedId' => $followed->id])
            ->assertOk()
            ->assertJsonPath('success', true);
        $this->assertDatabaseMissing('follows', [
            'followerId' => $follower->id,
            'followedId' => $followed->id,
        ]);
    }

    public function test_returns_401_when_follow_request_is_unauthenticated(): void
    {
        $follower = User::factory()->create();
        $followed = User::factory()->create();

        $this->postJson("/api/v1/users/{$follower->id}/follow", ['followedId' => $followed->id])
            ->assertUnauthorized();

        $this->assertDatabaseMissing('follows', [
            'followerId' => $follower->id,
            'followedId' => $followed->id,
        ]);
    }

    public function test_returns_403_when_user_id_does_not_match_authenticated_user(): void
    {
        $authenticatedUser = User::factory()->create();
        $differentFollower = User::factory()->create();
        $followed = User::factory()->create();

        $this->actingAs($authenticatedUser)
            ->postJson("/api/v1/users/{$differentFollower->id}/follow", ['followedId' => $followed->id])
            ->assertForbidden()
            ->assertJsonPath('message', 'Unauthorized');

        $this->assertDatabaseMissing('follows', [
            'followerId' => $differentFollower->id,
            'followedId' => $followed->id,
        ]);
    }

    public function test_returns_422_when_followed_user_id_is_missing(): void
    {
        $follower = User::factory()->create();

        $this->actingAs($follower)
            ->postJson("/api/v1/users/{$follower->id}/follow")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('followedId')
            ->assertJsonPath('errors.followedId.0', 'The followed id field is required.');
    }
}
