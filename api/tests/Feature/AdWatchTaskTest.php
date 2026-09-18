<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\ReferralService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdWatchTaskTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['moneypad.rewarded_ads.provider' => 'mock', 'moneypad.rewarded_ads.mock_enabled' => true]);
    }

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

        $event = $this->actingAs($user)->postJson('/api/v1/rewarded-ads', ['purpose' => 'coins'])->assertCreated()->json('id');
        $this->travel(6)->seconds();
        $this->postJson("/api/v1/rewarded-ads/{$event}/mock-verify")->assertOk();
        $response = $this->actingAs($user)
            ->postJson('/api/v1/transactions/ad-watch', [
                'ad_event_id' => $event,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'rewardCoins' => 2.0,
                'newCoins' => 7.0,
                'cooldown_remaining' => 60,
            ]);

        $this->assertEquals(7.0, (float) $user->fresh()->readerCoins);

        // A second reward cannot start during the cooldown.
        $this->postJson('/api/v1/rewarded-ads', ['purpose' => 'coins'])->assertStatus(429);
    }

    public function test_coin_ads_advance_only_the_referees_active_tier_and_cannot_be_replayed(): void
    {
        $inviter = User::factory()->create();
        $referee = User::factory()->create(['referrer_id' => $inviter->id, 'referredBy' => $inviter->username]);
        $other = User::factory()->create(['referrer_id' => $inviter->id, 'referredBy' => $inviter->username]);
        $referrals = app(ReferralService::class);

        for ($chapter = 0; $chapter < 5; $chapter++) {
            $referrals->recordChapterRead($referee->id);
        }

        for ($ad = 1; $ad <= 4; $ad++) {
            $eventId = $this->actingAs($referee)
                ->postJson('/api/v1/rewarded-ads', ['purpose' => 'coins'])
                ->assertCreated()->json('id');
            $this->travel(6)->seconds();
            $this->postJson("/api/v1/rewarded-ads/{$eventId}/mock-verify")->assertOk();
            $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $eventId])
                ->assertOk()->assertJsonPath('rewardCoins', 2);
            $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $eventId])
                ->assertOk()->assertJsonPath('rewardCoins', 0);

            if ($ad < 4) {
                $this->travel(61)->seconds();
            }
        }

        $progress = $referrals->milestones($inviter);
        $refereeProgress = collect($progress['referrals'])->firstWhere('id', $referee->id);
        $otherProgress = collect($progress['referrals'])->firstWhere('id', $other->id);
        $this->assertSame(3, $refereeProgress['tiers'][0]['currentAds']);
        $this->assertTrue($refereeProgress['tiers'][0]['canClaim']);
        $this->assertSame(0, $otherProgress['tiers'][0]['currentAds']);
        $this->assertSame('8.000', $referee->fresh()->readerCoins);

        $this->actingAs($inviter)->postJson('/api/v1/referrals/claim-milestone', [
            'referred_user_id' => $referee->id,
            'tier_index' => 1,
        ])->assertOk();
        $this->assertSame('5.000', $inviter->fresh()->readerCoins);

        $this->travel(61)->seconds();
        $nextEventId = $this->actingAs($referee)
            ->postJson('/api/v1/rewarded-ads', ['purpose' => 'coins'])
            ->assertCreated()->json('id');
        $this->travel(6)->seconds();
        $this->postJson("/api/v1/rewarded-ads/{$nextEventId}/mock-verify")->assertOk();
        $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $nextEventId])->assertOk();

        $nextProgress = collect($referrals->milestones($inviter)['referrals'])->firstWhere('id', $referee->id);
        $this->assertSame(3, $nextProgress['tiers'][0]['currentAds']);
        $this->assertSame(1, $nextProgress['tiers'][1]['currentAds']);
    }
}
