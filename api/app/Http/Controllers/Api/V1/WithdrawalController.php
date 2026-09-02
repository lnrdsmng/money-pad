<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\WithdrawalRequest;
use App\Services\WithdrawalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WithdrawalController extends Controller
{
    public function __construct(
        protected WithdrawalService $withdrawalService
    ) {}

    /**
     * Get withdrawal policy.
     */
    public function policy(): JsonResponse
    {
        return response()->json($this->withdrawalService->getPolicy());
    }

    /**
     * Check eligibility and create automatic withdrawal if eligible (idempotent compatibility endpoint).
     */
    public function checkEligibility(Request $request): JsonResponse
    {
        $user = $request->user();
        $created = $this->withdrawalService->evaluateAndCreate($user);

        return response()->json([
            'success' => true,
            'triggered' => $created !== null,
            'withdrawal' => $created,
        ]);
    }

    /**
     * Get user's withdrawal history.
     */
    public function index(Request $request, string $userId): JsonResponse
    {
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $requests = WithdrawalRequest::where('userId', $userId)
            ->orderByDesc('created_at')
            ->get();

        return response()->json($requests);
    }

    /**
     * Complete a fee-waiver task (ad watch).
     */
    public function watchAd(Request $request, string $id): JsonResponse
    {
        $req = WithdrawalRequest::findOrFail($id);
        $result = $this->withdrawalService->recordWaiverTask($req, $request->user());

        return response()->json($result);
    }

    /**
     * Skip fee waiver tasks and accept platform fee.
     */
    public function skipAds(Request $request, string $id): JsonResponse
    {
        $req = WithdrawalRequest::findOrFail($id);
        $result = $this->withdrawalService->skipWaiverTask($req, $request->user());

        return response()->json($result);
    }
}
