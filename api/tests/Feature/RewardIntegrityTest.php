<?php

namespace Tests\Feature;

use App\Models\RewardedAdEvent;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\Services\WithdrawalService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class RewardIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function event(User $user): RewardedAdEvent
    {
        config(['moneypad.rewarded_ads.provider' => 'mock', 'moneypad.rewarded_ads.mock_enabled' => true]);

        return RewardedAdEvent::create(['id' => (string) Str::uuid(), 'user_id' => $user->id,
            'purpose' => 'coins', 'provider' => 'mock', 'verified_at' => now(), 'expires_at' => now()->addMinutes(10)]);
    }

    public function test_backdated_client_events_cannot_mint_coins(): void
    {
        $user = User::factory()->create(['readerCoins' => 0]);
        for ($i = 0; $i < 3; $i++) {
            $this->actingAs($user)->postJson('/api/v1/transactions/ad-watch', ['watchedAt' => 1])
                ->assertUnprocessable()->assertJsonValidationErrors('ad_event_id');
        }
        $this->assertSame('0.000', $user->fresh()->readerCoins);
        $this->assertDatabaseCount('ad_watch_events', 0);
    }

    public function test_verified_event_is_consumed_once_and_cooldown_uses_server_time(): void
    {
        $user = User::factory()->create(['readerCoins' => 0]);
        $event = $this->event($user);
        $this->actingAs($user)->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $event->id, 'watchedAt' => 1])->assertOk();
        $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $event->id])->assertOk()->assertJsonPath('rewardCoins', 0);
        $second = $this->event($user);
        $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $second->id])->assertStatus(429);
        $this->assertNull($second->fresh()->consumed_at);
        $this->assertSame('2.000', $user->fresh()->readerCoins);
        $this->assertDatabaseCount('ad_watch_events', 1);
    }

    public function test_unverified_expired_and_foreign_events_are_rejected(): void
    {
        $inviter = User::factory()->create();
        $user = User::factory()->create(['readerCoins' => 0, 'referrer_id' => $inviter->id]);
        $other = User::factory()->create();
        $foreign = $this->event($other);
        $this->actingAs($user)->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $foreign->id])->assertNotFound();
        $event = $this->event($user);
        $event->update(['verified_at' => null]);
        $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $event->id])->assertUnprocessable();
        $event->update(['verified_at' => now(), 'expires_at' => now()->subSecond()]);
        $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $event->id])->assertUnprocessable();
        $this->assertSame('0.000', $user->fresh()->readerCoins);
        $this->assertDatabaseMissing('referral_milestone_progress', [
            'referrer_id' => $inviter->id,
            'referred_user_id' => $user->id,
            'ads_watched' => 1,
        ]);
    }

    public function test_production_rejects_mock_rewards_even_if_misconfigured(): void
    {
        $user = User::factory()->create(['readerCoins' => 0]);
        $event = $this->event($user);
        $this->app->instance('env', 'production');
        $this->actingAs($user)->getJson('/api/v1/transactions/ad-watch/status')->assertOk()->assertJsonPath('available', false);
        $this->postJson('/api/v1/rewarded-ads', ['purpose' => 'coins'])->assertStatus(503);
        $this->postJson('/api/v1/transactions/ad-watch', ['ad_event_id' => $event->id])->assertUnprocessable();
        $this->assertSame('0.000', $user->fresh()->readerCoins);
    }

    public function test_fractional_withdrawal_and_refund_conserve_coins(): void
    {
        $user = User::factory()->create(['readerCoins' => '1000.600', 'payment_method' => 'GCash', 'payment_account_info' => '09171234567']);
        $service = app(WithdrawalService::class);
        $withdrawal = $service->evaluateAndCreate($user);
        $this->assertSame('10.00', $withdrawal->gross_amount);
        $this->assertSame('1000.000', $withdrawal->coins_deducted);
        $this->assertSame('0.600', $user->fresh()->readerCoins);
        $service->reject($withdrawal, 'Test refund');
        $this->assertSame('1000.600', $user->fresh()->readerCoins);
    }

    public function test_renaming_referrer_does_not_transfer_referrals_to_a_reused_username(): void
    {
        $referrer = User::factory()->create(['username' => 'original']);
        $reader = User::factory()->create(['readerCoins' => 0]);
        $this->actingAs($reader)->postJson('/api/v1/referrals/claim-welcome', ['referral_code' => 'original'])->assertOk();
        $this->actingAs($referrer)->putJson('/api/v1/users/settings', ['username' => 'renamed'])->assertOk();
        $impostor = User::factory()->create(['username' => 'original']);
        $this->assertSame($referrer->id, $reader->fresh()->referrer_id);
        $reader->update(['readerCoins' => 1000, 'payment_method' => 'GCash', 'payment_account_info' => '09171234567']);
        $before = $referrer->fresh()->readerCoins;
        $withdrawal = app(WithdrawalService::class)->evaluateAndCreate($reader);
        app(WithdrawalService::class)->complete($withdrawal);
        $this->assertEquals((float) $before + 1000, (float) $referrer->fresh()->readerCoins);
        $this->assertSame('0.000', $impostor->fresh()->readerCoins);
    }

    public function test_replaced_reading_session_cannot_continue_earning(): void
    {
        $reader = User::factory()->create();
        $story = Story::factory()->create(['isPublished' => true]);
        $part = StoryPart::factory()->create(['storyId' => $story->id, 'isPublished' => true]);
        $payload = ['storyId' => $story->id, 'partId' => $part->id];
        $first = $this->actingAs($reader)->postJson('/api/v1/reading/start', $payload)->assertOk()->json('id');
        $second = $this->postJson('/api/v1/reading/start', $payload)->assertOk()->json('id');
        $this->travel(61)->seconds();
        $this->postJson('/api/v1/reading/heartbeat', ['sessionId' => $first])->assertUnprocessable();
        $this->postJson('/api/v1/reading/heartbeat', ['sessionId' => $second])->assertOk();
        $this->assertDatabaseCount('active_reading_sessions', 1);
        $this->assertDatabaseCount('reading_rewards', 1);
    }
}
