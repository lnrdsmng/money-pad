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
}
