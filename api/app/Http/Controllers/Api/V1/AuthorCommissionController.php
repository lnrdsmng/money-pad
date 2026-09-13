<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuthorReferralCommission;
use App\Models\User;
use App\Services\RewardedAdService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthorCommissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $commissions = AuthorReferralCommission::with(['author:id,username,profileImageUrl,isVerified'])
            ->where('referrer_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        $totalClaimed = (float) $commissions->where('status', 'claimed')->sum('commission_amount');
        $totalPending = (float) $commissions->whereIn('status', ['pending', 'ready_to_claim'])->sum('commission_amount');
        $totalReadyToClaim = (float) $commissions->where('status', 'ready_to_claim')->sum('commission_amount');

        return response()->json([
            'commissions' => $commissions,
            'summary' => [
                'total_claimed' => round($totalClaimed, 2),
                'total_pending' => round($totalPending, 2),
                'total_ready_to_claim' => round($totalReadyToClaim, 2),
                'total_count' => $commissions->count(),
            ],
        ]);
    }

    public function watchAd(Request $request, string $id, RewardedAdService $ads): JsonResponse
    {
        $data = $request->validate([
            'ad_event_id' => 'required|string',
        ]);

        $user = $request->user();

        $commission = DB::transaction(function () use ($user, $id, $data, $ads) {
            $commission = AuthorReferralCommission::whereKey($id)
                ->where('referrer_id', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($commission->status === 'claimed') {
                throw ValidationException::withMessages(['commission' => 'This commission has already been claimed.']);
            }

            if ($commission->status === 'cancelled') {
                throw ValidationException::withMessages(['commission' => 'This commission was cancelled.']);
            }

            if ($commission->ads_watched >= $commission->required_ads) {
                throw ValidationException::withMessages(['commission' => 'All required ads for this commission have already been watched.']);
            }

            $consumed = $ads->consume($user, $data['ad_event_id'], 'author_commission', $commission->id);
            if (! $consumed) {
                throw ValidationException::withMessages(['ad_event_id' => 'Ad has already been consumed.']);
            }

            $commission->ads_watched += 1;
            if ($commission->ads_watched >= $commission->required_ads) {
                $commission->status = 'ready_to_claim';
            }
            $commission->save();

            // Record into ad_watch_events
            DB::table('ad_watch_events')->insert([
                'id' => (string) Str::uuid(),
                'userId' => $user->id,
                'rewardCoins' => 0,
                'watchedAt' => now()->valueOf(),
            ]);

            return $commission->load(['author:id,username,profileImageUrl,isVerified']);
        }, 3);

        return response()->json([
            'success' => true,
            'message' => $commission->status === 'ready_to_claim'
                ? 'All required ads watched! Commission is now ready to claim.'
                : "Ad watched successfully! ({$commission->ads_watched}/{$commission->required_ads} watched)",
            'commission' => $commission,
        ]);
    }

    public function claim(Request $request, string $id): JsonResponse
    {
        $user = $request->user();

        $result = DB::transaction(function () use ($user, $id) {
            $lockedUser = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $commission = AuthorReferralCommission::whereKey($id)
                ->where('referrer_id', $lockedUser->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($commission->status === 'claimed') {
                throw ValidationException::withMessages(['commission' => 'This commission has already been claimed.']);
            }

            if ($commission->ads_watched < $commission->required_ads) {
                throw ValidationException::withMessages(['commission' => 'You must watch all required ads before claiming.']);
            }

            $commissionAmount = (float) $commission->commission_amount;
            $lockedUser->balance = round((float) $lockedUser->balance + $commissionAmount, 2);
            $lockedUser->save();

            $commission->status = 'claimed';
            $commission->claimed_at = now();
            $commission->save();

            return [
                'user' => $lockedUser->fresh(),
                'commission' => $commission->fresh(['author:id,username,profileImageUrl,isVerified']),
            ];
        }, 3);

        return response()->json([
            'success' => true,
            'message' => "₱{$result['commission']->commission_amount} has been added to your PHP balance!",
            'user' => $result['user'],
            'commission' => $result['commission'],
        ]);
    }
}
