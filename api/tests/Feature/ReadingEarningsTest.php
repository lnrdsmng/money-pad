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
use Tests\TestCase;

class ReadingEarningsTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_completed_minute_creates_pending_income_without_crediting_the_balance(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::Standard, now()->subSeconds(61));

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

    public function test_claim_all_requires_the_mock_ad_and_credits_the_batch_once(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::MegaPremium);
        $this->createReward($reader, $session, 1, now()->subMinutes(2), '4.500');
        $this->createReward($reader, $session, 2, now()->subMinute(), '4.500');

        $created = $this->actingAs($reader)->postJson('/api/v1/earnings/claims');

        $created
            ->assertCreated()
            ->assertJsonPath('completed', false)
            ->assertJsonPath('claim.reward_count', 2)
            ->assertJsonPath('claim.amount', '9.000')
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
            ->assertJsonPath('user.readerCoins', '9.000');

        $this->actingAs($reader)
            ->postJson("/api/v1/earnings/claims/{$claimId}/complete", ['mock_ad_token' => $token])
            ->assertOk();

        $this->assertSame('9.000', $reader->fresh()->readerCoins);
        $this->assertSame(2, ReadingReward::query()->where('status', ReadingRewardStatus::Claimed)->count());
    }

    public function test_ultimate_plan_claims_without_an_ad(): void
    {
        [$reader, $session] = $this->createReadingSession(PlanType::UltimatePremium);
        $this->createReward($reader, $session, 1, now(), '6.000');

        $this->actingAs($reader)
            ->postJson('/api/v1/earnings/claims')
            ->assertCreated()
            ->assertJsonPath('completed', true)
            ->assertJsonPath('claim.ad_required', false)
            ->assertJsonPath('user.readerCoins', '6.000');
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
