<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use App\Services\RewardedAdService;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function index(Request $request, $userId)
    {
        abort_unless($request->user()->id === $userId, 403);

        $transactions = Transaction::where('userId', $userId)->orderByDesc('timestamp')->get();

        return response()->json($transactions);
    }

    public function withdraw(Request $request)
    {
        // Legacy withdraw, can be deprecated or merged with WithdrawalController
        // We will just return an error to force usage of new endpoints
        return response()->json(['message' => 'Please use the new withdrawal flow from the dashboard'], 400);
    }

    public function adWatchStatus(Request $request, RewardedAdService $ads)
    {
        $remaining = $ads->cooldown($request->user());

        return response()->json([
            'reward_coins' => config('moneypad.rewards.ad_watch_coins'),
            'cooldown_seconds' => config('moneypad.rewards.ad_watch_cooldown_seconds'),
            'cooldown_remaining' => $remaining,
            'cooldown_ends_at' => $remaining > 0 ? now()->addSeconds($remaining)->valueOf() : null,
            'available' => $ads->available(), 'provider' => config('moneypad.rewarded_ads.provider'),
            'can_watch' => $ads->available() && $remaining === 0,
        ]);
    }

    public function adWatch(Request $request, RewardedAdService $ads)
    {
        $data = $request->validate(['ad_event_id' => 'required|uuid']);

        return response()->json($ads->creditCoins($request->user(), $data['ad_event_id']));
    }

    public function referralStats($username)
    {
        $user = User::where('username', $username)->firstOrFail();

        return response()->json([
            'count' => $user->referralCount,
            'claimed' => $user->isReferralRewardClaimed,
            'earnings' => $user->referralCount * 50.0, // Example logic
        ]);
    }
}
