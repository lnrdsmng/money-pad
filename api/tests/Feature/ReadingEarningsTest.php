<?php

namespace Tests\Feature;

use App\Models\ReadingReward;
use App\Models\ReadingRewardClaim;
use App\Models\ReadingSession;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\PlanType;
use App\ReadingRewardClaimStatus;
use App\ReadingRewardStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReadingEarningsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['moneypad.rewarded_ads.provider' => 'mock', 'moneypad.rewarded_ads.mock_enabled' => true]);
    }

    public function test_a_completed_minute_creates_pending_income_without_crediting_the_balance(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::Standard, now()->subSeconds(60));

        $response = $this->actingAs($reader)->postJson('/api/v1/reading/heartbeat', [
            'sessionId' => $session->id,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('rewarded_minutes', 1)
            ->assertJsonPath('amount_awarded', '2.500')
            ->assertJsonPath('pending_total', '2.500');

        $reader->refresh();
        $reward = ReadingReward::query()->sole();

        $this->assertSame('0.000', $reader->readerCoins);
        $this->assertSame('2.500', $reward->amount);
        $this->assertSame(ReadingRewardStatus::Pending, $reward->status);
        $this->assertSame(24, (int) $reward->earned_at->diffInHours($reward->expires_at));
    }

    public function test_starting_a_session_includes_the_additive_reading_policy(): void
    {
        $this->travelTo(now()->addYear());
        $reader = User::factory()->create();
        $story = Story::factory()->create();
        $part = StoryPart::factory()->create(['storyId' => $story->id]);

        $this->actingAs($reader)->postJson('/api/v1/reading/start', [
            'storyId' => $story->id,
            'partId' => $part->id,
        ])->assertOk()
            ->assertJsonPath('storyId', $story->id)
            ->assertJsonPath('partId', $part->id)
            ->assertJsonPath('reading_policy.heartbeat_interval_seconds', 60)
            ->assertJsonPath('reading_policy.idle_timeout_seconds', 120);

        $session = ReadingSession::query()->sole();
        $this->assertTrue($session->started_at->isSameSecond(now()));
        $this->assertTrue($session->last_active_at->isSameSecond(now()));
    }

    public function test_a_future_database_timestamp_does_not_block_a_completed_minute(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::Free, now()->addHours(8));
        DB::table('reading_sessions')->where('id', $session->id)->update([
            'created_at' => now()->subSeconds(60),
        ]);

        $this->actingAs($reader)->postJson('/api/v1/reading/heartbeat', [
            'sessionId' => $session->id,
        ])->assertOk()
            ->assertJsonPath('rewarded_minutes', 1)
            ->assertJsonPath('amount_awarded', '1.000');

        $this->assertDatabaseCount('reading_rewards', 1);
    }

    public function test_reading_claim_triggers_automatic_withdrawal(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::UltimatePremium);
        $reader->update([
            'readerCoins' => '995.000',
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
        ]);
        $reward = $this->createReward($reader, $session, 1, now(), '6.000');

        $this->actingAs($reader)->postJson('/api/v1/earnings/claims', ['reward_id' => $reward->id])
            ->assertCreated()
            ->assertJsonPath('completed', true);

        $this->assertDatabaseHas('withdrawal_requests', [
            'userId' => $reader->id,
            'amount' => '10.01',
            'gross_amount' => '10.01',
            'platform_fee' => '3.00',
            'net_amount' => '7.01',
            'status' => 'pending_ad_choice',
        ]);
    }

    public function test_claiming_one_reward_requires_the_mock_ad_and_credits_only_that_reward_once(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::MegaPremium);
        $selectedReward = $this->createReward($reader, $session, 1, now()->subMinutes(2), '4.500');
        $remainingReward = $this->createReward($reader, $session, 2, now()->subMinute(), '4.500');

        $created = $this->actingAs($reader)->postJson('/api/v1/earnings/claims', [
            'reward_id' => $selectedReward->id,
        ]);

        $created
            ->assertCreated()
            ->assertJsonPath('completed', false)
            ->assertJsonPath('claim.reward_count', 1)
            ->assertJsonPath('claim.amount', '4.500')
            ->assertJsonPath('claim.ad_provider', 'mock');

        $claimId = $created->json('claim.id');
        $token = $created->json('mock_ad_token');
        $this->assertIsString($token);

        $this->actingAs($reader)
            ->postJson("/api/v1/earnings/claims/{$claimId}/complete", ['mock_ad_token' => 'invalid'])
            ->assertUnprocessable();

        $completed = $this->actingAs($reader)
            ->postJson("/api/v1/earnings/claims/{$claimId}/complete", ['mock_ad_token' => $token]);

        $completed
            ->assertOk()
            ->assertJsonPath('claim.status', ReadingRewardClaimStatus::Completed->value)
            ->assertJsonPath('user.readerCoins', '4.500');

        $this->actingAs($reader)
            ->postJson("/api/v1/earnings/claims/{$claimId}/complete", ['mock_ad_token' => $token])
            ->assertOk();

        $this->assertSame('4.500', $reader->fresh()->readerCoins);
        $this->assertSame(ReadingRewardStatus::Claimed, $selectedReward->fresh()->status);
        $this->assertSame(ReadingRewardStatus::Pending, $remainingReward->fresh()->status);
        $this->assertNull($remainingReward->fresh()->claim_id);
    }

    public function test_ultimate_plan_claims_without_an_ad(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::UltimatePremium);
        $reward = $this->createReward($reader, $session, 1, now(), '6.000');

        $this->actingAs($reader)
            ->postJson('/api/v1/earnings/claims', ['reward_id' => $reward->id])
            ->assertCreated()
            ->assertJsonPath('completed', true)
            ->assertJsonPath('claim.ad_required', false)
            ->assertJsonPath('user.readerCoins', '6.000');
    }

    public function test_a_reader_cannot_claim_another_users_reward(): void
    {
        [$owner, $session] = $this->createReadingSession();
        $reward = $this->createReward($owner, $session, 1, now(), '1.000');
        $otherReader = User::factory()->create();

        $this->actingAs($otherReader)->postJson('/api/v1/earnings/claims', [
            'reward_id' => $reward->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('reward_id');

        $this->assertSame(ReadingRewardStatus::Pending, $reward->fresh()->status);
        $this->assertNull($reward->fresh()->claim_id);
    }

    public function test_expired_income_vanishes_and_claim_history_supports_seven_and_thirty_days(): void
    {
        [$reader, $session] = $this->createReadingSession();
        $expired = $this->createReward($reader, $session, 1, now()->subHours(25), '1.000');
        $expired->update(['expires_at' => now()->subHour()]);

        $this->actingAs($reader)
            ->getJson('/api/v1/earnings/income')
            ->assertOk()
            ->assertJsonPath('pending_total', '0.000')
            ->assertJsonCount(0, 'data');

        $this->assertSame(ReadingRewardStatus::Expired, $expired->fresh()->status);

        foreach ([5, 20, 31] as $daysAgo) {
            ReadingRewardClaim::factory()->create([
                'userId' => $reader->id,
                'status' => ReadingRewardClaimStatus::Completed,
                'claimed_at' => now()->subDays($daysAgo),
            ]);
        }

        $this->actingAs($reader)
            ->getJson('/api/v1/earnings/claimed?range=7d')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAs($reader)
            ->getJson('/api/v1/earnings/claimed?range=30d')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $staleReward = $this->createReward($reader, $session, 2, now()->subDays(32), '1.000');
        $staleReward->update(['expires_at' => now()->subDays(31)]);

        $this->assertSame(1, ReadingRewardClaim::query()->first()->prunable()->count());
        $this->assertSame(1, $staleReward->prunable()->count());
    }

    /** @return array{User, ReadingSession} */
    private function createReadingSession(
        PlanType $plan = PlanType::Free,
        mixed $lastActiveAt = null,
    ): array {
        $reader = User::factory()->onPlan($plan)->create();
        $story = Story::factory()->create();
        $part = StoryPart::factory()->create(['storyId' => $story->id]);
        $session = ReadingSession::factory()->create([
            'userId' => $reader->id,
            'storyId' => $story->id,
            'partId' => $part->id,
            'last_active_at' => $lastActiveAt ?? now(),
        ]);

        DB::table('active_reading_sessions')->insert(['user_id' => $reader->id, 'session_id' => $session->id]);

        return [$reader, $session];
    }

    private function createReward(
        User $reader,
        ReadingSession $session,
        int $minute,
        mixed $earnedAt,
        string $amount,
    ): ReadingReward {
        return ReadingReward::factory()->create([
            'userId' => $reader->id,
            'reading_session_id' => $session->id,
            'storyId' => $session->storyId,
            'partId' => $session->partId,
            'minute_index' => $minute,
            'plan_type' => $reader->plan,
            'rate_per_minute' => $amount,
            'amount' => $amount,
            'earned_at' => $earnedAt,
            'expires_at' => $earnedAt->copy()->addDay(),
        ]);
    }
}
