<?php

namespace Tests\Feature;

use App\Models\DailyLoginRewardClaim;
use App\Models\NewAccountRewardEnrollment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DailyLoginRewardTest extends TestCase
{
    use RefreshDatabase;

    public function test_signup_enrolls_account_and_day_one_requires_explicit_claim(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-09-02 10:00:00', 'Asia/Manila')->utc());

        $response = $this->postJson('/api/v1/auth/signup', [
            'username' => 'newreader',
            'email' => 'newreader@example.test',
            'password' => 'Password123',
        ])->assertOk();

        $user = User::query()->findOrFail($response->json('user.id'));
        $this->assertDatabaseHas('new_account_reward_enrollments', [
            'userId' => $user->id,
            'starts_on' => '2026-09-02 00:00:00',
        ]);
        $this->assertSame('0.000', $user->readerCoins);

        $this->actingAs($user)->getJson('/api/v1/daily-login-reward')
            ->assertOk()
            ->assertJsonPath('days.0.status', 'available')
            ->assertJsonPath('days.0.amount', '1.000');

        $this->actingAs($user)->postJson('/api/v1/daily-login-reward/claim')
            ->assertCreated()
            ->assertJsonPath('claim.day_number', 1)
            ->assertJsonPath('user.readerCoins', '1.000');
    }

    public function test_missed_reward_expires_and_current_day_claim_is_idempotent(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-09-02 10:00:00', 'Asia/Manila')->utc());
        $user = User::factory()->create();
        NewAccountRewardEnrollment::factory()->create([
            'userId' => $user->id,
            'starts_on' => '2026-09-02',
            'timezone' => 'Asia/Manila',
        ]);

        $this->travelTo(CarbonImmutable::parse('2026-09-03 10:00:00', 'Asia/Manila')->utc());
        $this->actingAs($user)->getJson('/api/v1/daily-login-reward')
            ->assertJsonPath('days.0.status', 'missed')
            ->assertJsonPath('days.1.status', 'available');

        $this->actingAs($user)->postJson('/api/v1/daily-login-reward/claim')
            ->assertCreated()
            ->assertJsonPath('claim.amount', '2.000');
        $this->actingAs($user)->postJson('/api/v1/daily-login-reward/claim')->assertOk();

        $this->assertSame('2.000', $user->fresh()->readerCoins);
        $this->assertSame(1, DailyLoginRewardClaim::query()->count());
    }

    public function test_accounts_outside_the_first_seven_days_cannot_claim(): void
    {
        $user = User::factory()->create();
        NewAccountRewardEnrollment::factory()->create([
            'userId' => $user->id,
            'starts_on' => '2026-09-02',
            'timezone' => 'Asia/Manila',
        ]);
        $this->travelTo(CarbonImmutable::parse('2026-09-09 00:01:00', 'Asia/Manila')->utc());

        $this->actingAs($user)->postJson('/api/v1/daily-login-reward/claim')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('reward');
    }

    public function test_existing_account_without_enrollment_is_not_eligible(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/v1/daily-login-reward')
            ->assertOk()
            ->assertJsonPath('eligible', false)
            ->assertJsonCount(0, 'days');
    }

    public function test_daily_login_claim_triggers_automatic_withdrawal_when_threshold_reached(): void
    {
        $user = User::factory()->create([
            'readerCoins' => 995,
            'payment_method' => 'Maya',
            'payment_account_info' => '09191234567',
        ]);
        NewAccountRewardEnrollment::factory()->create([
            'userId' => $user->id,
            'starts_on' => '2026-09-02',
            'timezone' => 'Asia/Manila',
        ]);
        // Day 6 reward is 5 coins -> 995 + 5 = 1000 coins (₱10.00)
        $this->travelTo(CarbonImmutable::parse('2026-09-07 10:00:00', 'Asia/Manila')->utc());

        $this->actingAs($user)->postJson('/api/v1/daily-login-reward/claim')
            ->assertCreated()
            ->assertJsonPath('claim.amount', '5.000');

        $this->assertDatabaseHas('withdrawal_requests', [
            'userId' => $user->id,
            'amount' => '10.00',
            'gross_amount' => '10.00',
            'platform_fee' => '3.00',
            'net_amount' => '7.00',
            'status' => 'pending_review',
        ]);
        $this->assertEquals('0.000', $user->fresh()->readerCoins);
    }
}
