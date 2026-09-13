<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ReferralService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferralController extends Controller
{
    public function __construct(private ReferralService $referrals) {}

    public function claimWelcome(Request $request): JsonResponse
    {
        $data = $request->validate(['referral_code' => 'required|string|max:255']);
        $user = $this->referrals->claimWelcome($request->user(), $data['referral_code']);

        return response()->json(['success' => true, 'message' => 'Welcome bonus of 10 reader coins claimed successfully!', 'readerCoins' => $user->readerCoins, 'user' => $user]);
    }

    public function milestones(Request $request): JsonResponse
    {
        return response()->json($this->referrals->milestones($request->user()));
    }

    public function claimMilestone(Request $request): JsonResponse
    {
        $data = $request->validate(['tier_index' => 'required|integer|min:1|max:6']);
        $user = $this->referrals->claimMilestone($request->user(), (int) $data['tier_index']);

        return response()->json(['success' => true, 'message' => 'Milestone claimed successfully.', 'readerCoins' => $user->readerCoins]);
    }
}
