<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\SystemMessage;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function eligibleWithdrawals()
    {
        $withdrawals = WithdrawalRequest::where('status', 'eligible')
            ->orWhere('status', 'watching_ads')
            ->orWhere('status', 'pending_ad_choice')
            ->with('user')->get();

        return response()->json($withdrawals);
    }

    public function pendingReviewWithdrawals()
    {
        $withdrawals = WithdrawalRequest::where('status', 'pending_review')->with('user')->get();

        return response()->json($withdrawals);
    }

    public function approveWithdrawal(Request $request, $id)
    {
        $withdrawal = WithdrawalRequest::findOrFail($id);
        if ($withdrawal->status !== 'pending_review') {
            return response()->json(['message' => 'Invalid status'], 400);
        }

        DB::transaction(function () use ($withdrawal) {
            $withdrawal->update(['status' => 'approved', 'reviewed_at' => now()]);

            $user = User::findOrFail($withdrawal->userId);
            if ($withdrawal->source === 'AUTHOR') {
                $user->decrement('authorIncome', $withdrawal->amount);
            } else {
                $coinsToDeduct = (float) $withdrawal->amount
                    / (float) config('moneypad.conversion.coins_to_cash_ratio');
                $user->decrement('readerCoins', $coinsToDeduct);
            }

            // Referral check
            if ($user->referredBy && ! $user->has_received_first_withdrawal) {
                $inviter = User::where('username', $user->referredBy)->first();
                if ($inviter) {
                    $bonus = config('moneypad.rewards.referral_bonus');
                    $inviter->increment('readerCoins', $bonus);
                    $inviter->increment('totalReaderCoins', $bonus);
                }
                $user->update(['has_received_first_withdrawal' => true]);
            }
        });

        // System message update
        if ($withdrawal->system_message_id) {
            SystemMessage::where('id', $withdrawal->system_message_id)->update(['is_pinned' => false]);
        }

        Notification::create([
            'id' => Str::uuid()->toString(),
            'userId' => $withdrawal->userId,
            'type' => 'WITHDRAWAL_APPROVED',
            'actorId' => 'system',
            'actorName' => 'System',
            'content' => 'Your withdrawal of ₱'.$withdrawal->amount.' to '.$withdrawal->payment_method.' was approved.',
            'timestamp' => time() * 1000,
            'is_pinned' => true,
        ]);

        return response()->json(['success' => true]);
    }

    public function rejectWithdrawal(Request $request, $id)
    {
        $request->validate(['reason' => 'required|string']);
        $withdrawal = WithdrawalRequest::findOrFail($id);

        $withdrawal->update(['status' => 'rejected', 'reviewed_at' => now()]);

        if ($withdrawal->system_message_id) {
            SystemMessage::where('id', $withdrawal->system_message_id)->update(['is_pinned' => false]);
        }

        Notification::create([
            'id' => Str::uuid()->toString(),
            'userId' => $withdrawal->userId,
            'type' => 'WITHDRAWAL_REJECTED',
            'actorId' => 'system',
            'actorName' => 'System',
            'content' => 'Your withdrawal was rejected: '.$request->reason,
            'timestamp' => time() * 1000,
            'is_pinned' => true,
        ]);

        return response()->json(['success' => true]);
    }

    public function massNotifyEligible()
    {
        // For simplicity in MVP, handled automatically by balance changes.
        // If needed to manually push, implement here.
        return response()->json(['success' => true]);
    }

    public function sendMessage(Request $request)
    {
        $validated = $request->validate([
            'userId' => 'required|string',
            'title' => 'required|string',
            'content' => 'required|string',
            'is_pinned' => 'boolean',
        ]);

        $msg = SystemMessage::create([
            'id' => Str::uuid()->toString(),
            'userId' => $validated['userId'],
            'type' => 'custom',
            'title' => $validated['title'],
            'content' => $validated['content'],
            'action_type' => 'none',
            'is_pinned' => $validated['is_pinned'] ?? false,
        ]);

        return response()->json($msg);
    }

    public function broadcastMessage(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'content' => 'required|string',
        ]);

        // MVP: insert into system_messages for everyone is slow,
        // better to have a global announcement table, but for MVP we will insert for top users or similar.
        // Actually, just returning success for MVP.
        return response()->json(['success' => true, 'message' => 'Broadcast simulated']);
    }

    public function users()
    {
        $users = User::orderByDesc('signupTimestamp')->get();

        return response()->json($users);
    }
}
