<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemMessage;
use App\Models\WithdrawalRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class WithdrawalController extends Controller
{
    public function checkEligibility(Request $request)
    {
        $user = $request->user();

        $minGcash = config('moneypad.withdrawals.min_gcash_maya');

        // Simple check for Reader Coins (MVP limit)
        if ($user->readerCoins >= $minGcash) {
            $existing = WithdrawalRequest::where('userId', $user->id)
                ->whereIn('status', ['eligible', 'pending_ad_choice', 'watching_ads', 'pending_review'])
                ->first();

            if (! $existing) {
                // Must have payment method set
                if ($user->payment_method && $user->payment_account_info) {
                    $fee = config('moneypad.withdrawals.platform_fee');

                    $bankFee = $user->payment_method === 'Bank Transfer' ? config('moneypad.withdrawals.bank_processing_fee') : 0;

                    $req = WithdrawalRequest::create([
                        'id' => Str::uuid()->toString(),
                        'userId' => $user->id,
                        'amount' => $user->readerCoins, // Withdraw all
                        'source' => 'READER',
                        'payment_method' => $user->payment_method,
                        'payment_account_info' => $user->payment_account_info,
                        'bank_name' => $user->bank_name,
                        'platform_fee' => $fee,
                        'bank_fee' => $bankFee,
                        'fee_waived' => $fee == 0,
                        'status' => $fee > 0 ? 'pending_ad_choice' : 'pending_review',
                    ]);

                    if ($fee > 0) {
                        $msg = SystemMessage::create([
                            'id' => Str::uuid()->toString(),
                            'userId' => $user->id,
                            'type' => 'withdrawal_eligible',
                            'title' => 'Congratulations! Eligible for withdrawal',
                            'content' => 'You are eligible to withdraw ₱'.$req->amount.'. Platform fee is ₱'.$fee.'. Watch 10 ads to remove it?',
                            'action_type' => 'watch_ads_prompt',
                            'action_payload' => ['withdrawal_request_id' => $req->id],
                            'is_pinned' => true,
                            'withdrawal_request_id' => $req->id,
                        ]);
                        $req->update(['system_message_id' => $msg->id]);
                    } else {
                        SystemMessage::create([
                            'id' => Str::uuid()->toString(),
                            'userId' => $user->id,
                            'type' => 'custom',
                            'title' => 'Withdrawal processing',
                            'content' => 'Your withdrawal is pending review.',
                            'action_type' => 'none',
                            'is_pinned' => true,
                        ]);
                    }
                }
            }
        }

        return response()->json(['success' => true]);
    }

    public function index(Request $request, $userId)
    {
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $reqs = WithdrawalRequest::where('userId', $userId)->orderByDesc('created_at')->get();

        return response()->json($reqs);
    }

    public function watchAd(Request $request, $id)
    {
        $req = WithdrawalRequest::findOrFail($id);
        if ($req->userId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($req->status !== 'pending_ad_choice' && $req->status !== 'watching_ads') {
            return response()->json(['message' => 'Invalid status'], 400);
        }

        $req->increment('ads_watched_count');
        $req->status = 'watching_ads';

        $target = config('moneypad.withdrawals.ads_to_waive_fee');
        if ($req->ads_watched_count >= $target) {
            $req->fee_waived = true;
            $req->status = 'pending_review';
        }
        $req->save();

        return response()->json(['success' => true, 'count' => $req->ads_watched_count, 'status' => $req->status]);
    }

    public function skipAds(Request $request, $id)
    {
        $req = WithdrawalRequest::findOrFail($id);
        if ($req->userId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $req->update([
            'fee_waived' => false,
            'status' => 'pending_review',
        ]);

        return response()->json(['success' => true]);
    }
}
