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

    public function linkReferrer(Request $request): JsonResponse
    {
        $data = $request->validate(['referral_code' => 'required|string|max:255']);
        $user = $this->referrals->linkReferrer($request->user(), $data['referral_code']);
        $message = $user->isReferralRewardClaimed
            ? 'Referral linked and 10 bonus coins claimed!'
            : 'Referral linked successfully! You can now watch ads and read stories to support your inviter.';

        return response()->json(['success' => true, 'message' => $message, 'readerCoins' => $user->readerCoins, 'user' => $user]);
    }

    public function milestones(Request $request): JsonResponse
    {
        return response()->json($this->referrals->milestones($request->user()));
    }

    public function claimMilestone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'tier_index' => 'required|integer|min:1|max:6',
            'referred_user_id' => 'nullable|string|max:50',
        ]);
        $user = $this->referrals->claimMilestone($request->user(), $data['referred_user_id'] ?? null, (int) $data['tier_index']);

        return response()->json(['success' => true, 'message' => 'Milestone claimed successfully.', 'readerCoins' => $user->readerCoins]);
    }

    public function watchTierAd(Request $request, int $tierIndex): JsonResponse
    {
        $data = $request->validate(['ad_event_id' => 'required|string|max:50']);
        $result = $this->referrals->recordTierAd($request->user(), $tierIndex, $data['ad_event_id']);

        return response()->json($result);
    }
}
