<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

    // claimReferral is removed, handled automatically in AdminController approveWithdrawal

    public function adWatch(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|string',
            'userId' => 'required|string',
            'watchedAt' => 'required|numeric',
        ]);

        if ($validated['userId'] !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = $request->user();

        DB::table('ad_watch_events')->insert([
            'id' => $validated['id'],
            'userId' => $user->id,
            'rewardCoins' => 1.0,
            'watchedAt' => $validated['watchedAt'],
        ]);

        $user->increment('readerCoins', 1.0);
        $user->increment('totalReaderCoins', 1.0);

        return response()->json(['success' => true, 'newCoins' => $user->readerCoins]);
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
