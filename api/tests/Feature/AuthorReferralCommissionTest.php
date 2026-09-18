<?php

namespace Tests\Feature;

use App\Models\AuthorReferralCommission;
use App\Models\RewardedAdEvent;
use App\Models\Story;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\WithdrawalService;
use App\WithdrawalStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthorReferralCommissionTest extends TestCase
{
    use RefreshDatabase;

    public function test_author_withdrawal_approval_creates_pending_commission_with_dynamic_ads(): void
    {
        $referrer = User::factory()->create(['username' => 'agent_smith', 'balance' => 0.0]);
        $author = User::factory()->create([
            'username' => 'writer_neo',
            'referrer_id' => $referrer->id,
            'referredBy' => $referrer->username,
            'isVerified' => true,
        ]);

        Story::factory()->create(['authorId' => $author->id]);

        $withdrawal = WithdrawalRequest::create([
            'id' => (string) Str::uuid(),
            'userId' => $author->id,
            'amount' => 500.00,
            'gross_amount' => 500.00,
            'net_amount' => 497.00,
            'source' => 'AUTHOR',
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
            'status' => WithdrawalStatus::PendingReview->value,
        ]);

        $service = app(WithdrawalService::class);
        $service->approve($withdrawal);

        $commission = AuthorReferralCommission::where('withdrawal_request_id', $withdrawal->id)->first();
        $this->assertNotNull($commission);
        $this->assertEquals($referrer->id, $commission->referrer_id);
        $this->assertEquals($author->id, $commission->author_id);
        $this->assertEquals(25.00, (float) $commission->commission_amount); // 5% of 500
        $this->assertEquals(5, $commission->required_ads); // > 100 => 5 ads
        $this->assertEquals(0, $commission->ads_watched);
        $this->assertEquals('pending', $commission->status);

        // Check referrer notification
        $this->assertDatabaseHas('notifications', [
            'userId' => $referrer->id,
            'type' => 'AUTHOR_COMMISSION_AVAILABLE',
        ]);
    }

    public function test_dynamic_ad_tiers_scale_correctly(): void
    {
        $this->assertEquals(1, WithdrawalService::calculateRequiredAdsForCommission(10.0));
        $this->assertEquals(1, WithdrawalService::calculateRequiredAdsForCommission(5.0));
        $this->assertEquals(2, WithdrawalService::calculateRequiredAdsForCommission(15.0));
        $this->assertEquals(2, WithdrawalService::calculateRequiredAdsForCommission(25.0));
        $this->assertEquals(3, WithdrawalService::calculateRequiredAdsForCommission(30.0));
        $this->assertEquals(3, WithdrawalService::calculateRequiredAdsForCommission(50.0));
        $this->assertEquals(4, WithdrawalService::calculateRequiredAdsForCommission(75.0));
        $this->assertEquals(4, WithdrawalService::calculateRequiredAdsForCommission(100.0));
        $this->assertEquals(5, WithdrawalService::calculateRequiredAdsForCommission(150.0));
        $this->assertEquals(5, WithdrawalService::calculateRequiredAdsForCommission(1000.0));
    }

    public function test_referrer_can_watch_ads_and_claim_commission_to_php_balance(): void
    {
        $inviter = User::factory()->create(['username' => 'senior_promoter']);
        $referrer = User::factory()->create([
            'username' => 'promoter',
            'balance' => 10.00,
            'referrer_id' => $inviter->id,
            'referredBy' => $inviter->username,
        ]);
        $author = User::factory()->create(['username' => 'storyteller', 'referrer_id' => $referrer->id]);

        $withdrawal = WithdrawalRequest::create([
            'id' => (string) Str::uuid(),
            'userId' => $author->id,
            'amount' => 20.00,
            'gross_amount' => 20.00,
            'net_amount' => 17.00,
            'source' => 'AUTHOR',
            'payment_method' => 'GCash',
            'payment_account_info' => '09170000000',
            'status' => WithdrawalStatus::Approved->value,
        ]);

        $commission = AuthorReferralCommission::create([
            'id' => (string) Str::uuid(),
            'referrer_id' => $referrer->id,
            'author_id' => $author->id,
            'withdrawal_request_id' => $withdrawal->id,
            'withdrawal_amount' => 20.00,
            'commission_amount' => 1.00, // 5% of 20
            'required_ads' => 2,
            'ads_watched' => 0,
            'status' => 'pending',
        ]);

        // List commissions
        $listRes = $this->actingAs($referrer)->getJson('/api/v1/referrals/author-commissions');
        $listRes->assertOk()
            ->assertJsonCount(1, 'commissions')
            ->assertJsonPath('summary.total_pending', 1);

        // Attempt to claim before watching required ads -> should fail
        $prematureClaimRes = $this->actingAs($referrer)->postJson("/api/v1/referrals/author-commissions/{$commission->id}/claim");
        $prematureClaimRes->assertStatus(422);

        // Watch Ad 1
        $adEvent1 = RewardedAdEvent::create([
            'id' => (string) Str::uuid(),
            'user_id' => $referrer->id,
            'purpose' => 'author_commission',
            'target_id' => $commission->id,
            'provider' => 'mock',
            'verified_at' => now(),
            'expires_at' => now()->addMinutes(10),
        ]);

        $watch1Res = $this->actingAs($referrer)->postJson("/api/v1/referrals/author-commissions/{$commission->id}/watch-ad", [
            'ad_event_id' => $adEvent1->id,
        ]);
        $watch1Res->assertOk()
            ->assertJsonPath('commission.ads_watched', 1)
            ->assertJsonPath('commission.status', 'pending');

        // Watch Ad 2
        $adEvent2 = RewardedAdEvent::create([
            'id' => (string) Str::uuid(),
            'user_id' => $referrer->id,
            'purpose' => 'author_commission',
            'target_id' => $commission->id,
            'provider' => 'mock',
            'verified_at' => now(),
            'expires_at' => now()->addMinutes(10),
        ]);

        $watch2Res = $this->actingAs($referrer)->postJson("/api/v1/referrals/author-commissions/{$commission->id}/watch-ad", [
            'ad_event_id' => $adEvent2->id,
        ]);
        $watch2Res->assertOk()
            ->assertJsonPath('commission.ads_watched', 2)
            ->assertJsonPath('commission.status', 'ready_to_claim');

        $this->assertDatabaseHas('referral_milestone_progress', [
            'referrer_id' => $inviter->id,
            'referred_user_id' => $referrer->id,
            'tier_index' => 1,
            'ads_watched' => 2,
        ]);

        // Claim commission to PHP balance
        $claimRes = $this->actingAs($referrer)->postJson("/api/v1/referrals/author-commissions/{$commission->id}/claim");
        $claimRes->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('commission.status', 'claimed');

        $referrer->refresh();
        $this->assertEquals(11.00, (float) $referrer->balance); // 10.00 + 1.00 PHP balance

        // Attempting to claim again fails
        $doubleClaimRes = $this->actingAs($referrer)->postJson("/api/v1/referrals/author-commissions/{$commission->id}/claim");
        $doubleClaimRes->assertStatus(422);
    }
}
