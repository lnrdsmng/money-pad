<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateReadingClaimRequest;
use App\Models\ReadingReward;
use App\Models\ReadingRewardClaim;
use App\ReadingRewardClaimStatus;
use App\ReadingRewardStatus;
use App\Services\ReadingRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EarningsController extends Controller
{
    public function income(Request $request, ReadingRewardService $readingRewardService): JsonResponse
    {
        $user = $request->user();
        $readingRewardService->expirePendingRewards($user);

        $rewards = ReadingReward::query()
            ->where('userId', $user->id)
            ->where('status', ReadingRewardStatus::Pending)
            ->where('expires_at', '>', now())
            ->with(['story:id,title', 'storyPart:id,title'])
            ->orderBy('earned_at')
            ->get();

        return response()->json([
            'data' => $rewards,
            'pending_total' => number_format((float) $rewards->sum('amount'), 3, '.', ''),
            'nearest_expiration' => $rewards->min('expires_at')?->toIso8601String(),
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function claimed(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'range' => ['sometimes', 'in:7d,30d'],
        ]);
        $range = $validated['range'] ?? '7d';
        $days = $range === '30d'
            ? (int) config('moneypad.reading.claimed_history_days')
            : 7;

        $claims = ReadingRewardClaim::query()
            ->where('userId', $request->user()->id)
            ->where('status', ReadingRewardClaimStatus::Completed)
            ->where('claimed_at', '>=', now()->subDays($days))
            ->with([
                'rewards' => fn ($query) => $query
                    ->select(['id', 'claim_id', 'storyId', 'partId', 'amount', 'earned_at'])
                    ->with(['story:id,title', 'storyPart:id,title']),
            ])
            ->orderByDesc('claimed_at')
            ->orderByDesc('id')
            ->paginate(30);

        return response()->json($claims);
    }

    public function createClaim(Request $request, ReadingRewardService $readingRewardService): JsonResponse
    {
        $result = $readingRewardService->createClaim($request->user());

        return response()->json($result, 201);
    }

    public function completeClaim(
        CreateReadingClaimRequest $request,
        ReadingRewardClaim $claim,
        ReadingRewardService $readingRewardService,
    ): JsonResponse {
        $result = $readingRewardService->completeClaim(
            $request->user(),
            $claim,
            $request->validated('mock_ad_token'),
        );

        return response()->json(['success' => true, ...$result]);
    }

    public function cancelClaim(
        Request $request,
        ReadingRewardClaim $claim,
        ReadingRewardService $readingRewardService,
    ): JsonResponse {
        $readingRewardService->cancelClaim($request->user(), $claim);

        return response()->json(status: 204);
    }
}
