<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdWatchTaskTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_fetch_ad_watch_status(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/transactions/ad-watch/status')
            ->assertOk()
            ->assertJson([
                'reward_coins' => 2.0,
                'cooldown_seconds' => 60,
                'cooldown_remaining' => 0,
                'can_watch' => true,
            ]);
    }

    public function test_user_earns_two_coins_and_initiates_cooldown(): void
    {
        $user = User::factory()->create(['readerCoins' => 5.0]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/transactions/ad-watch', [
                'watchedAt' => time() * 1000,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'rewardCoins' => 2.0,
                'newCoins' => 7.0,
                'cooldown_remaining' => 60,
            ]);

        $this->assertEquals(7.0, (float) $user->fresh()->readerCoins);

        // Immediate second call should be throttled by 60s cooldown
        $this->actingAs($user)
            ->postJson('/api/v1/transactions/ad-watch', [
                'watchedAt' => time() * 1000,
            ])
            ->assertStatus(429)
            ->assertJsonStructure(['message', 'cooldown_remaining']);
    }
}
