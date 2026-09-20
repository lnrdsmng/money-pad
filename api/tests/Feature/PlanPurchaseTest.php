<?php

namespace Tests\Feature;

use App\Models\PlanPurchase;
use App\Models\User;
use App\Models\UserPlan;
use App\PlanPurchaseStatus;
use App\PlanType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class PlanPurchaseTest extends TestCase
{
    use RefreshDatabase;

    public function test_additional_payment_methods_are_available_for_purchase_flows(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/payment-methods')->assertOk();

        $methodIds = collect($response->json('data'))->pluck('id');
        $this->assertTrue($methodIds->contains('coins-ph'));
        $this->assertTrue($methodIds->contains('gotyme-bank'));
        $this->assertTrue($methodIds->contains('maribank'));
        $this->assertTrue($methodIds->contains('bpi'));
    }

    public function test_user_submits_private_payment_proof_without_activating_the_plan(): void
    {
        Storage::fake('payment_proofs');
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/api/v1/plan-purchases', [
            'plan_type' => PlanType::MegaPremium->value,
            'payment_method' => 'gcash',
            'payment_reference' => '6789',
            'payment_proof' => $this->paymentProof(),
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('purchase.status', PlanPurchaseStatus::PendingReview->value)
            ->assertJsonPath('purchase.payment_reference', '6789')
            ->assertJsonMissingPath('purchase.payment_proof_path');

        $purchase = PlanPurchase::query()->sole();
        Storage::disk('payment_proofs')->assertExists($purchase->getRawOriginal('payment_proof_path'));
        $this->assertSame(PlanType::Free, $user->fresh()->plan);
        $this->assertDatabaseEmpty('user_plans');
    }

    public function test_submission_requires_a_valid_image_reference_and_has_one_pending_limit(): void
    {
        Storage::fake('payment_proofs');
        $user = User::factory()->create();

        $this->actingAs($user)->withHeader('Accept', 'application/json')->post('/api/v1/plan-purchases', [
            'plan_type' => PlanType::Standard->value,
            'payment_method' => 'gcash',
            'payment_proof' => UploadedFile::fake()->create('receipt.pdf', 100, 'application/pdf'),
        ])->assertUnprocessable()->assertJsonValidationErrors(['payment_proof']);

        PlanPurchase::factory()->create(['userId' => $user->id]);

        $this->actingAs($user)->withHeader('Accept', 'application/json')->post('/api/v1/plan-purchases', [
            'plan_type' => PlanType::Standard->value,
            'payment_method' => 'gcash',
            'payment_reference' => '2222',
            'payment_proof' => $this->paymentProof(),
        ])->assertUnprocessable()->assertJsonValidationErrors('purchase');
    }

    public function test_admin_approves_requested_plan_for_one_calendar_month_idempotently(): void
    {
        $this->travelTo('2026-01-31 12:00:00');
        $user = User::factory()->create();
        $admin = User::factory()->admin()->create();
        $purchase = PlanPurchase::factory()->create([
            'userId' => $user->id,
            'plan_type' => PlanType::MegaPremium,
            'amount' => '199.00',
        ]);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/plan-purchases/{$purchase->id}/approve")
            ->assertOk()
            ->assertJsonPath('purchase.status', PlanPurchaseStatus::Approved->value);

        $this->assertSame(PlanType::MegaPremium, $user->fresh()->plan);
        $plan = UserPlan::query()->sole();
        $this->assertNull($plan->expires_at);
        $this->assertSame($admin->id, $purchase->fresh()->reviewed_by);

        $this->actingAs($admin)->postJson("/api/v1/admin/plan-purchases/{$purchase->id}/approve")->assertOk();
        $this->assertSame(1, UserPlan::query()->count());
    }

    public function test_admin_can_reject_and_edit_payment_destinations(): void
    {
        $user = User::factory()->create();
        $admin = User::factory()->admin()->create();
        $purchase = PlanPurchase::factory()->create(['userId' => $user->id]);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/plan-purchases/{$purchase->id}/reject", ['reason' => 'Reference does not match.'])
            ->assertOk()
            ->assertJsonPath('purchase.status', PlanPurchaseStatus::Rejected->value)
            ->assertJsonPath('purchase.rejection_reason', 'Reference does not match.');

        $this->assertSame(PlanType::Free, $user->fresh()->plan);

        $this->actingAs($admin)->putJson('/api/v1/admin/payment-methods/paypal', [
            'label' => 'PayPal',
            'account_name' => 'MoneyPad Billing',
            'account_identifier' => 'billing@example.test',
            'instructions' => 'Include your username.',
            'is_active' => true,
        ])->assertOk()->assertJsonPath('payment_method.account_identifier', 'billing@example.test');

        $this->actingAs($user)->getJson('/api/v1/payment-methods')
            ->assertOk()
            ->assertJsonFragment(['account_identifier' => 'billing@example.test']);
    }

    public function test_non_admin_cannot_review_payments(): void
    {
        $user = User::factory()->create();
        $purchase = PlanPurchase::factory()->create();

        $this->actingAs($user)
            ->postJson("/api/v1/admin/plan-purchases/{$purchase->id}/approve")
            ->assertForbidden();
    }

    public function test_only_admin_can_view_private_proof_and_old_reviewed_proof_is_pruned(): void
    {
        Storage::fake('payment_proofs');
        $user = User::factory()->create();
        $admin = User::factory()->admin()->create();
        Storage::disk('payment_proofs')->put('proofs/receipt.png', 'private-image');
        $purchase = PlanPurchase::factory()->create([
            'userId' => $user->id,
            'payment_proof_path' => 'proofs/receipt.png',
            'status' => PlanPurchaseStatus::Approved,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now()->subDays(181),
        ]);

        $this->actingAs($user)
            ->get("/api/v1/admin/plan-purchases/{$purchase->id}/proof")
            ->assertForbidden();
        $this->actingAs($admin)
            ->get("/api/v1/admin/plan-purchases/{$purchase->id}/proof")
            ->assertOk();

        $this->artisan('moneypad:prune-payment-proofs')->assertSuccessful();

        Storage::disk('payment_proofs')->assertMissing('proofs/receipt.png');
        $this->assertNull($purchase->fresh()->getRawOriginal('payment_proof_path'));
    }

    public function test_expired_paid_plan_returns_to_free_on_authenticated_visit(): void
    {
        $user = User::factory()->onPlan(PlanType::Standard)->create();
        UserPlan::query()->create([
            'id' => (string) Str::uuid(),
            'userId' => $user->id,
            'plan_type' => PlanType::Standard,
            'multiplier' => '2.5',
            'started_at' => now()->subMonths(2),
            'expires_at' => now()->subMinute(),
            'is_active' => true,
        ]);

        $this->actingAs($user)
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('plan', PlanType::Free->value);

        $this->assertFalse(UserPlan::query()->sole()->is_active);
    }

    public function test_multiple_users_can_submit_same_last_four_digits_reference(): void
    {
        Storage::fake('payment_proofs');
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        $res1 = $this->actingAs($user1)->post('/api/v1/plan-purchases', [
            'plan_type' => PlanType::MegaPremium->value,
            'payment_method' => 'gcash',
            'payment_reference' => '4829',
            'payment_proof' => $this->paymentProof(),
        ]);
        $res1->assertCreated()
            ->assertJsonPath('purchase.payment_reference', '4829');

        $res2 = $this->actingAs($user2)->post('/api/v1/plan-purchases', [
            'plan_type' => PlanType::Standard->value,
            'payment_method' => 'gcash',
            'payment_reference' => '4829',
            'payment_proof' => $this->paymentProof(),
        ]);
        $res2->assertCreated()
            ->assertJsonPath('purchase.payment_reference', '4829');

        $this->assertSame(2, PlanPurchase::where('payment_reference', '4829')->count());
    }

    public function test_admin_can_search_plan_purchases_by_last_four_digits_reference(): void
    {
        $admin = User::factory()->admin()->create();
        $user1 = User::factory()->create(['username' => 'buyer_one']);
        $user2 = User::factory()->create(['username' => 'buyer_two']);

        $purchase1 = PlanPurchase::factory()->create([
            'userId' => $user1->id,
            'payment_reference' => '8899',
            'status' => PlanPurchaseStatus::PendingReview,
        ]);

        $purchase2 = PlanPurchase::factory()->create([
            'userId' => $user2->id,
            'payment_reference' => '1122',
            'status' => PlanPurchaseStatus::PendingReview,
        ]);

        $res = $this->actingAs($admin)->getJson('/api/v1/admin/plan-purchases?search=8899');
        $res->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $purchase1->id)
            ->assertJsonPath('data.0.payment_reference', '8899');
    }

    public function test_admin_search_escapes_sql_wildcards(): void
    {
        $admin = User::factory()->admin()->create();
        $user1 = User::factory()->create();
        $user2 = User::factory()->create();

        PlanPurchase::factory()->create([
            'userId' => $user1->id,
            'payment_reference' => '1234',
            'status' => PlanPurchaseStatus::PendingReview,
        ]);
        PlanPurchase::factory()->create([
            'userId' => $user2->id,
            'payment_reference' => '5678',
            'status' => PlanPurchaseStatus::PendingReview,
        ]);

        // Search for "%" should return 0 results since neither has literal "%"
        $res = $this->actingAs($admin)->getJson('/api/v1/admin/plan-purchases?search=%25');
        $res->assertOk()->assertJsonCount(0, 'data');
    }

    private function paymentProof(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            'receipt.png',
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true),
        );
    }
}
