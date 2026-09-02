<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_can_view_the_four_monthly_plans_in_coins(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('coin_to_php_rate', 0.01)
            ->assertJsonPath('data.0.id', 'free')
            ->assertJsonPath('data.0.rate_per_minute', '1.000')
            ->assertJsonPath('data.1.id', 'standard')
            ->assertJsonPath('data.1.price', '85.00')
            ->assertJsonPath('data.1.rate_per_minute', '2.500')
            ->assertJsonPath('data.1.duration_months', 1)
            ->assertJsonPath('data.2.rate_per_minute', '4.500')
            ->assertJsonPath('data.3.rate_per_minute', '6.000')
            ->assertJsonPath('data.3.ads', false);
    }
}
