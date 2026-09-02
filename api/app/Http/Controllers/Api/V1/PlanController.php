<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreatePlanCheckoutRequest;
use App\Models\PlanPurchase;
use App\Models\UserPlan;
use App\PlanPurchaseStatus;
use App\PlanType;
use App\Services\PayMongoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Throwable;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = collect(config('moneypad.plans'))
            ->map(fn (array $plan, string $id): array => ['id' => $id, ...$plan])
            ->values();

        return response()->json(['data' => $plans]);
    }

    public function checkout(
        CreatePlanCheckoutRequest $request,
        PayMongoService $payMongoService,
    ): JsonResponse {
        $user = $request->user();
        $planType = PlanType::from($request->validated('plan_type'));

        if ($user->plan === $planType) {
            return response()->json(['message' => 'This plan is already active.'], 422);
        }

        $purchase = PlanPurchase::create([
            'id' => Str::uuid()->toString(),
            'userId' => $user->id,
            'plan_type' => $planType,
            'amount' => $planType->price(),
            'currency' => config('moneypad.currency'),
            'provider' => 'paymongo',
            'reference_number' => 'MP-'.Str::upper(Str::random(20)),
            'status' => PlanPurchaseStatus::Pending,
        ]);

        try {
            $checkout = $payMongoService->createCheckoutSession($purchase);
        } catch (Throwable $exception) {
            report($exception);
            $purchase->update([
                'status' => PlanPurchaseStatus::Failed,
                'failure_reason' => 'Unable to create checkout session.',
            ]);

            return response()->json([
                'message' => 'Payment checkout is temporarily unavailable.',
            ], 502);
        }

        $purchase->update([
            'provider_checkout_id' => $checkout['id'],
            'checkout_url' => $checkout['checkout_url'],
        ]);

        return response()->json([
            'purchase_id' => $purchase->id,
            'checkout_url' => $checkout['checkout_url'],
        ], 201);
    }

    public function current(Request $request, string $userId): JsonResponse
    {
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $plan = UserPlan::where('userId', $userId)->where('is_active', true)->first();

        return response()->json([
            'plan' => $request->user()->plan,
            'purchase' => $plan,
        ]);
    }
}
