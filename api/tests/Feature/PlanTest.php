<?php

namespace Tests\Feature;

use App\Models\PlanPurchase;
use App\Models\User;
use App\Models\UserPlan;
use App\PlanPurchaseStatus;
use App\PlanType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PlanTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_can_view_the_four_one_time_plans(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/plans')
            ->assertOk()
            ->assertJsonCount(4, 'data')
            ->assertJsonPath('data.0.id', 'free')
            ->assertJsonPath('data.0.price', '0.00')
            ->assertJsonPath('data.0.rate_per_minute', '0.010')
            ->assertJsonPath('data.1.id', 'standard')
            ->assertJsonPath('data.1.price', '85.00')
            ->assertJsonPath('data.1.rate_per_minute', '0.025')
            ->assertJsonPath('data.2.id', 'mega_premium')
            ->assertJsonPath('data.2.price', '199.00')
            ->assertJsonPath('data.2.rate_per_minute', '0.045')
            ->assertJsonPath('data.3.id', 'ultimate_premium')
            ->assertJsonPath('data.3.price', '449.00')
            ->assertJsonPath('data.3.rate_per_minute', '0.060')
            ->assertJsonPath('data.3.ads', false);
    }

    public function test_checkout_does_not_activate_a_plan_before_a_verified_webhook(): void
    {
        config([
            'services.paymongo.secret_key' => 'sk_test_example',
            'services.paymongo.webhook_secret' => 'whsec_example',
            'services.paymongo.mode' => 'test',
        ]);
        Http::fake([
            'https://api.paymongo.com/v2/checkout_sessions' => Http::response([
                'data' => [
                    'id' => 'cs_test_123',
                    'attributes' => ['checkout_url' => 'https://checkout.paymongo.test/cs_test_123'],
                ],
            ]),
        ]);
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/v1/plans/checkout', ['plan_type' => PlanType::MegaPremium->value])
            ->assertCreated()
            ->assertJsonPath('checkout_url', 'https://checkout.paymongo.test/cs_test_123');

        $purchase = PlanPurchase::query()->sole();
        $this->assertSame(PlanType::Free, $user->fresh()->plan);
        $this->assertSame(PlanPurchaseStatus::Pending, $purchase->status);

        $payload = json_encode([
            'data' => [
                'attributes' => [
                    'type' => 'checkout_session.payment.paid',
                    'data' => [
                        'id' => 'cs_test_123',
                        'attributes' => ['reference_number' => $purchase->reference_number],
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR);
        $timestamp = (string) now()->timestamp;
        $signature = hash_hmac('sha256', $timestamp.'.'.$payload, 'whsec_example');

        $this->call(
            'POST',
            '/api/v1/webhooks/paymongo',
            server: [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_PAYMONGO_SIGNATURE' => "t={$timestamp},te={$signature}",
            ],
            content: $payload,
        )->assertOk();

        $this->assertSame(PlanType::MegaPremium, $user->fresh()->plan);
        $this->assertSame(PlanPurchaseStatus::Paid, $purchase->fresh()->status);
        $this->assertDatabaseHas('user_plans', [
            'userId' => $user->id,
            'plan_type' => PlanType::MegaPremium->value,
            'is_active' => true,
        ]);

        $this->call(
            'POST',
            '/api/v1/webhooks/paymongo',
            server: [
                'CONTENT_TYPE' => 'application/json',
                'HTTP_PAYMONGO_SIGNATURE' => "t={$timestamp},te={$signature}",
            ],
            content: $payload,
        )->assertOk();
        $this->assertSame(1, UserPlan::query()->where('userId', $user->id)->count());
    }

    public function test_webhook_rejects_an_invalid_signature(): void
    {
        config(['services.paymongo.webhook_secret' => 'whsec_example']);

        $this->withHeader('Paymongo-Signature', 't=1,te=invalid')
            ->postJson('/api/v1/webhooks/paymongo', ['data' => []])
            ->assertUnauthorized();

        $this->assertDatabaseEmpty('plan_purchases');
    }
}
