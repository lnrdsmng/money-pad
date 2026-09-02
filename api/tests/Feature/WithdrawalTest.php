<?php

namespace Tests\Feature;

use App\Models\ReadingReward;
use App\Models\ReadingRewardClaim;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\ReadingRewardClaimStatus;
use App\ReadingRewardStatus;
use App\Services\WithdrawalService;
use App\WithdrawalStatus;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WithdrawalTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_fetch_withdrawal_policy(): void
    {
        $response = $this->getJson('/api/v1/withdrawals/policy');

        $response->assertOk()
            ->assertJson([
                'min_gcash_maya' => 10.0,
                'min_bank' => 20.0,
                'platform_fee' => 3.0,
                'bank_fee' => 10.0,
                'ads_to_waive_fee' => 10,
                'coin_to_php_rate' => 0.01,
                'processing_days_label' => 'Monday–Saturday',
                'processing_turnaround_label' => '1–7 business days',
                'sunday_deferred' => true,
            ]);
    }

    public function test_gcash_threshold_boundary(): void
    {
        $service = app(WithdrawalService::class);

        // 999 coins = ₱9.99 (below ₱10.00 min)
        $user1 = User::factory()->create([
            'readerCoins' => 999,
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
        ]);
        $res1 = $service->evaluateAndCreate($user1);
        $this->assertNull($res1);
        $this->assertEquals('999.000', $user1->fresh()->readerCoins);

        // 1000 coins = ₱10.00 (meets ₱10.00 min)
        $user2 = User::factory()->create([
            'readerCoins' => 1000,
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
        ]);
        $res2 = $service->evaluateAndCreate($user2);
        $this->assertNotNull($res2);
        $this->assertEquals('10.00', $res2->gross_amount);
        $this->assertEquals('3.00', $res2->platform_fee);
        $this->assertEquals('0.00', $res2->bank_fee);
        $this->assertEquals('7.00', $res2->net_amount);
        $this->assertEquals('0.000', $user2->fresh()->readerCoins);
    }

    public function test_bank_threshold_boundary(): void
    {
        $service = app(WithdrawalService::class);

        // 1999 coins = ₱19.99 (below ₱20.00 bank min)
        $user1 = User::factory()->create([
            'readerCoins' => 1999,
            'payment_method' => 'Bank Transfer',
            'payment_account_info' => '1234567890',
            'bank_name' => 'BDO',
        ]);
        $res1 = $service->evaluateAndCreate($user1);
        $this->assertNull($res1);

        // 2000 coins = ₱20.00 (meets ₱20.00 bank min)
        $user2 = User::factory()->create([
            'readerCoins' => 2000,
            'payment_method' => 'Bank Transfer',
            'payment_account_info' => '1234567890',
            'bank_name' => 'BDO',
        ]);
        $res2 = $service->evaluateAndCreate($user2);
        $this->assertNotNull($res2);
        $this->assertEquals('20.00', $res2->gross_amount);
        $this->assertEquals('3.00', $res2->platform_fee);
        $this->assertEquals('10.00', $res2->bank_fee);
        $this->assertEquals('7.00', $res2->net_amount);
        $this->assertEquals('0.000', $user2->fresh()->readerCoins);
    }

    public function test_automatic_withdrawal_triggered_when_payment_profile_is_saved(): void
    {
        $user = User::factory()->create([
            'readerCoins' => 1500,
            'payment_method' => null,
            'payment_account_info' => null,
        ]);

        $this->actingAs($user)->putJson("/api/v1/users/{$user->id}/profile", [
            'payment_method' => 'GCash',
            'payment_account_info' => '09181234567',
        ])->assertOk();

        $this->assertDatabaseHas('withdrawal_requests', [
            'userId' => $user->id,
            'amount' => '15.00',
            'gross_amount' => '15.00',
            'platform_fee' => '3.00',
            'net_amount' => '12.00',
            'status' => 'pending_review',
        ]);
        $this->assertEquals('0.000', $user->fresh()->readerCoins);
    }

    public function test_automatic_withdrawal_triggered_on_ad_watch(): void
    {
        $user = User::factory()->create([
            'readerCoins' => 950,
            'payment_method' => 'Maya',
            'payment_account_info' => '09191234567',
        ]);

        $this->actingAs($user)->postJson('/api/v1/transactions/ad-watch', [
            'id' => 'ad_event_1',
            'userId' => $user->id,
            'watchedAt' => time() * 1000,
        ])->assertOk();

        // 950 + 100 = 1050 coins -> triggers ₱10.50 withdrawal
        $this->assertDatabaseHas('withdrawal_requests', [
            'userId' => $user->id,
            'amount' => '10.50',
            'net_amount' => '7.50',
        ]);
        $this->assertEquals('0.000', $user->fresh()->readerCoins);
    }

    public function test_fee_waiver_tasks_and_net_payout_recalculation(): void
    {
        $user = User::factory()->create([
            'readerCoins' => 1000,
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
        ]);
        $service = app(WithdrawalService::class);
        $req = $service->evaluateAndCreate($user);

        $this->assertEquals('7.00', $req->net_amount);
        $this->assertFalse($req->fee_waived);

        for ($i = 1; $i <= 9; $i++) {
            $this->actingAs($user)->postJson("/api/v1/withdrawal-requests/{$req->id}/watch-ad")
                ->assertOk()
                ->assertJson(['count' => $i, 'fee_waived' => false]);
        }

        // 10th ad waives fee
        $res = $this->actingAs($user)->postJson("/api/v1/withdrawal-requests/{$req->id}/watch-ad")
            ->assertOk()
            ->assertJson([
                'count' => 10,
                'fee_waived' => true,
                'net_amount' => '10.00',
            ]);

        $this->assertTrue($req->fresh()->fee_waived);
        $this->assertEquals('10.00', $req->fresh()->net_amount);
    }

    public function test_bank_fee_is_never_waived(): void
    {
        $user = User::factory()->create([
            'readerCoins' => 2000,
            'payment_method' => 'Bank Transfer',
            'payment_account_info' => '1234567890',
            'bank_name' => 'BPI',
        ]);
        $service = app(WithdrawalService::class);
        $req = $service->evaluateAndCreate($user);

        $this->assertEquals('7.00', $req->net_amount); // 20 - 3 (platform) - 10 (bank) = 7

        // Watch 10 ads to waive platform fee
        for ($i = 1; $i <= 10; $i++) {
            $this->actingAs($user)->postJson("/api/v1/withdrawal-requests/{$req->id}/watch-ad");
        }

        $fresh = $req->fresh();
        $this->assertTrue($fresh->fee_waived);
        $this->assertEquals('10.00', $fresh->net_amount); // 20 - 0 - 10 = 10 (bank fee still deducted)
    }

    public function test_sunday_schedule_deferral_and_business_days(): void
    {
        $service = app(WithdrawalService::class);

        // Sunday test: 2026-09-06 is Sunday
        $sunday = CarbonImmutable::parse('2026-09-06 14:00:00', 'Asia/Manila');
        $schedule = $service->calculateSchedule($sunday);

        $this->assertEquals('2026-09-07', $schedule['earliest_review_at']->toDateString()); // Monday
        // 7 business days from Monday Sep 7 (Mon 7, Tue 8, Wed 9, Thu 10, Fri 11, Sat 12, skip Sun 13, Mon 14)
        $this->assertEquals('2026-09-15', $schedule['estimated_deadline_at']->toDateString());
    }

    public function test_admin_approve_and_complete_workflow_with_referral(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $inviter = User::factory()->create(['username' => 'super_referrer', 'readerCoins' => 0]);
        $user = User::factory()->create([
            'referredBy' => 'super_referrer',
            'has_received_first_withdrawal' => false,
            'readerCoins' => 1000,
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
        ]);

        $service = app(WithdrawalService::class);
        $req = $service->evaluateAndCreate($user);

        // Approve
        $this->actingAs($admin)->postJson("/api/v1/admin/withdrawals/{$req->id}/approve")
            ->assertOk();

        $this->assertEquals('approved', $req->fresh()->status->value);
        $this->assertEquals(1000.0, (float) $inviter->fresh()->readerCoins);
        $this->assertTrue($user->fresh()->has_received_first_withdrawal);

        // Complete
        $this->actingAs($admin)->postJson("/api/v1/admin/withdrawals/{$req->id}/complete", [
            'payout_reference' => 'GCASH-TX-98765',
        ])->assertOk();

        $this->assertEquals('completed', $req->fresh()->status->value);
        $this->assertEquals('GCASH-TX-98765', $req->fresh()->payout_reference);
    }

    public function test_admin_reject_refunds_coins(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create([
            'readerCoins' => 1200,
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
        ]);

        $service = app(WithdrawalService::class);
        $req = $service->evaluateAndCreate($user);
        $this->assertEquals('0.000', $user->fresh()->readerCoins);

        $this->actingAs($admin)->postJson("/api/v1/admin/withdrawals/{$req->id}/reject", [
            'reason' => 'Invalid mobile number format',
        ])->assertOk();

        $this->assertEquals('rejected', $req->fresh()->status->value);
        $this->assertEquals('Invalid mobile number format', $req->fresh()->rejection_reason);
        $this->assertEquals('1200.000', $user->fresh()->readerCoins);
    }

    public function test_reconcile_console_command(): void
    {
        $user = User::factory()->create([
            'readerCoins' => 1000,
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
        ]);

        $this->artisan('withdrawals:reconcile')
            ->assertSuccessful();

        $this->assertDatabaseHas('withdrawal_requests', [
            'userId' => $user->id,
            'amount' => '10.00',
        ]);
        $this->assertEquals('0.000', $user->fresh()->readerCoins);
    }
}
