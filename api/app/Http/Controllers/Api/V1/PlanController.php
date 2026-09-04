<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PlanPurchase;
use App\Models\UserPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = collect(config('moneypad.plans'))
            ->reject(fn (array $plan, string $id): bool => $id === 'author_verification')
            ->map(fn (array $plan, string $id): array => [
                'id' => $id,
                ...$plan,
                'duration_months' => $id === 'free' ? null : 1,
            ])
            ->values();

        return response()->json([
            'data' => $plans,
            'coin_to_php_rate' => config('moneypad.conversion.coins_to_cash_ratio'),
        ]);
    }

    public function current(Request $request, string $userId): JsonResponse
    {
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $plan = UserPlan::where('userId', $userId)->where('is_active', true)->first();
        $latestPurchase = PlanPurchase::query()
            ->where('userId', $userId)
            ->latest('submitted_at')
            ->latest('id')
            ->first();

        return response()->json([
            'plan' => $request->user()->plan,
            'active_plan' => $plan,
            'latest_purchase' => $latestPurchase,
        ]);
    }
}
