<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use Illuminate\Support\Str;

class TransactionController extends Controller
{
    public function index($userId)
    {
        $transactions = Transaction::where('userId', $userId)->orderByDesc('timestamp')->get();

        return response()->json($transactions);
    }

    public function withdraw(Request $request)
    {
        // Legacy withdraw, can be deprecated or merged with WithdrawalController
        // We will just return an error to force usage of new endpoints
        return response()->json(['message' => 'Please use the new withdrawal flow from the dashboard'], 400);
    }

    public function adWatchStatus(Request $request)
    {
        $user = $request->user();
        $cooldownSeconds = (int) config('moneypad.rewards.ad_watch_cooldown_seconds', 60);
        $rewardCoins = (float) config('moneypad.rewards.ad_watch_coins', 2.0);

        $lastEvent = DB::table('ad_watch_events')
            ->where('userId', $user->id)
            ->orderByDesc('watchedAt')
            ->first();

        $remaining = 0;
        if ($lastEvent) {
            $lastWatchedAtSec = $lastEvent->watchedAt > 10000000000 ? (int) ($lastEvent->watchedAt / 1000) : (int) $lastEvent->watchedAt;
            $elapsed = time() - $lastWatchedAtSec;
            if ($elapsed < $cooldownSeconds && $elapsed >= 0) {
                $remaining = $cooldownSeconds - $elapsed;
            }
        }

        return response()->json([
            'reward_coins' => $rewardCoins,
            'cooldown_seconds' => $cooldownSeconds,
            'cooldown_remaining' => $remaining,
            'can_watch' => $remaining === 0,
        ]);
    }

    public function adWatch(Request $request)
    {
        $validated = $request->validate([
            'id' => 'nullable|string',
            'userId' => 'nullable|string',
            'watchedAt' => 'nullable|numeric',
        ]);

        $user = $request->user();
        if (! empty($validated['userId']) && $validated['userId'] !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $cooldownSeconds = (int) config('moneypad.rewards.ad_watch_cooldown_seconds', 60);
        $rewardCoins = (float) config('moneypad.rewards.ad_watch_coins', 2.0);

        $lastEvent = DB::table('ad_watch_events')
            ->where('userId', $user->id)
            ->orderByDesc('watchedAt')
            ->first();

        if ($lastEvent) {
            $lastWatchedAtSec = $lastEvent->watchedAt > 10000000000 ? (int) ($lastEvent->watchedAt / 1000) : (int) $lastEvent->watchedAt;
            $elapsed = time() - $lastWatchedAtSec;
            if ($elapsed < $cooldownSeconds && $elapsed >= 0) {
                $remaining = $cooldownSeconds - $elapsed;

                return response()->json([
                    'message' => "Ad watch cooldown active. Please wait {$remaining} seconds.",
                    'cooldown_remaining' => $remaining,
                ], 429);
            }
        }

        $id = $validated['id'] ?? (string) Str::uuid();
        $watchedAt = (int) ($validated['watchedAt'] ?? round(microtime(true) * 1000));

        DB::table('ad_watch_events')->insert([
            'id' => $id,
            'userId' => $user->id,
            'rewardCoins' => $rewardCoins,
            'watchedAt' => $watchedAt,
        ]);

        $user->increment('readerCoins', $rewardCoins);
        $user->increment('totalReaderCoins', $rewardCoins);

        app(\App\Services\WithdrawalService::class)->evaluateAndCreate($user->fresh());

        return response()->json([
            'success' => true,
            'rewardCoins' => $rewardCoins,
            'newCoins' => $user->fresh()->readerCoins,
            'cooldown_remaining' => $cooldownSeconds,
            'user' => $user->fresh(),
        ]);
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
