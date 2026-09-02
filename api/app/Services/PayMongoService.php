<?php

namespace App\Services;

use App\Models\PlanPurchase;
use App\Models\SystemMessage;
use App\Models\User;
use App\Models\UserPlan;
use App\PlanPurchaseStatus;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class PayMongoService
{
    /** @return array{id: string, checkout_url: string} */
    public function createCheckoutSession(PlanPurchase $purchase): array
    {
        $response = $this->client()
            ->withHeader('Idempotency-Key', $purchase->id)
            ->post('/checkout_sessions', [
                'data' => [
                    'attributes' => [
                        'line_items' => [[
                            'name' => config("moneypad.plans.{$purchase->plan_type->value}.name").' Plan',
                            'amount' => (int) round((float) $purchase->amount * 100),
                            'currency' => $purchase->currency,
                            'quantity' => 1,
                        ]],
                        'payment_method_types' => ['card', 'gcash', 'paymaya', 'qrph'],
                        'success_url' => $this->frontendUrl('/earnings?plan_payment=success'),
                        'cancel_url' => $this->frontendUrl('/earnings?plan_payment=cancelled'),
                        'reference_number' => $purchase->reference_number,
                        'description' => 'MoneyPad one-time plan purchase',
                        'metadata' => [
                            'purchase_id' => $purchase->id,
                            'user_id' => $purchase->userId,
                            'plan_type' => $purchase->plan_type->value,
                        ],
                    ],
                ],
            ])
            ->throw();

        $checkoutId = $response->json('data.id');
        $checkoutUrl = $response->json('data.attributes.checkout_url');

        if (! is_string($checkoutId) || ! is_string($checkoutUrl)) {
            throw new RuntimeException('PayMongo returned an incomplete checkout session.');
        }

        return ['id' => $checkoutId, 'checkout_url' => $checkoutUrl];
    }

    public function verifyWebhookSignature(string $payload, ?string $signatureHeader): bool
    {
        $secret = (string) config('services.paymongo.webhook_secret');
        if ($secret === '' || $signatureHeader === null) {
            return false;
        }

        $parts = collect(explode(',', $signatureHeader))
            ->mapWithKeys(function (string $part): array {
                [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');

                return [$key => $value];
            });

        $timestamp = $parts->get('t');
        $signatureKey = config('services.paymongo.mode') === 'live' ? 'li' : 'te';
        $providedSignature = $parts->get($signatureKey);

        if (! is_string($timestamp) || ! ctype_digit($timestamp) || ! is_string($providedSignature)) {
            return false;
        }

        $tolerance = (int) config('services.paymongo.signature_tolerance_seconds');
        if (abs(now()->timestamp - (int) $timestamp) > $tolerance) {
            return false;
        }

        $expectedSignature = hash_hmac('sha256', $timestamp.'.'.$payload, $secret);

        return hash_equals($expectedSignature, $providedSignature);
    }

    /** @param array<string, mixed> $payload */
    public function processWebhook(array $payload): void
    {
        $eventType = data_get($payload, 'data.attributes.type');
        if ($eventType !== 'checkout_session.payment.paid') {
            return;
        }

        $checkoutId = data_get($payload, 'data.attributes.data.id');
        $referenceNumber = data_get($payload, 'data.attributes.data.attributes.reference_number');

        if ((! is_string($checkoutId) || $checkoutId === '')
            && (! is_string($referenceNumber) || $referenceNumber === '')) {
            return;
        }

        DB::transaction(function () use ($checkoutId, $referenceNumber): void {
            $purchase = PlanPurchase::query()
                ->where(function ($query) use ($checkoutId, $referenceNumber): void {
                    if (is_string($checkoutId)) {
                        $query->where('provider_checkout_id', $checkoutId);
                    }

                    if (is_string($referenceNumber)) {
                        $method = is_string($checkoutId) ? 'orWhere' : 'where';
                        $query->{$method}('reference_number', $referenceNumber);
                    }
                })
                ->lockForUpdate()
                ->first();

            if ($purchase === null || $purchase->status !== PlanPurchaseStatus::Pending) {
                return;
            }

            $user = User::query()->whereKey($purchase->userId)->lockForUpdate()->firstOrFail();
            UserPlan::query()->where('userId', $user->id)->where('is_active', true)->update(['is_active' => false]);

            UserPlan::create([
                'id' => (string) Str::uuid(),
                'userId' => $user->id,
                'plan_type' => $purchase->plan_type,
                'multiplier' => config("moneypad.plans.{$purchase->plan_type->value}.multiplier"),
                'is_active' => true,
                'expires_at' => null,
            ]);

            $user->update(['plan' => $purchase->plan_type]);
            $purchase->update([
                'status' => PlanPurchaseStatus::Paid,
                'paid_at' => now(),
            ]);

            SystemMessage::create([
                'id' => (string) Str::uuid(),
                'userId' => $user->id,
                'type' => 'custom',
                'title' => 'Plan activated',
                'content' => config("moneypad.plans.{$purchase->plan_type->value}.name").' is now active on your account.',
                'action_type' => 'info',
                'is_pinned' => true,
                'is_read' => false,
            ]);
        }, 3);
    }

    private function client(): PendingRequest
    {
        $secretKey = (string) config('services.paymongo.secret_key');
        if ($secretKey === '') {
            throw new RuntimeException('PayMongo is not configured.');
        }

        return Http::baseUrl((string) config('services.paymongo.base_url'))
            ->withBasicAuth($secretKey, '')
            ->acceptJson()
            ->connectTimeout(5)
            ->timeout(15);
    }

    private function frontendUrl(string $path): string
    {
        return rtrim((string) config('services.paymongo.frontend_url'), '/').$path;
    }
}
