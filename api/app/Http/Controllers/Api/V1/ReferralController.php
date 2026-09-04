<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\ReferralMilestoneClaim;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ReferralController extends Controller
{
    protected array $milestonesConfig = [
        1 => ['tier' => 1, 'chapters' => 5, 'ads' => 3, 'coins' => 10],
        2 => ['tier' => 2, 'chapters' => 15, 'ads' => 5, 'coins' => 30],
        3 => ['tier' => 3, 'chapters' => 25, 'ads' => 7, 'coins' => 50],
        4 => ['tier' => 4, 'chapters' => 40, 'ads' => 10, 'coins' => 80],
        5 => ['tier' => 5, 'chapters' => 80, 'ads' => 15, 'coins' => 160],
        6 => ['tier' => 6, 'chapters' => 110, 'ads' => 20, 'coins' => 220],
    ];

    public function claimWelcome(Request $request)
    {
        $validated = $request->validate([
            'referral_code' => 'required|string',
        ]);

        $user = $request->user();

        // 1. Reject if referredBy is already set (prevents re-claiming)
        if (!empty($user->referredBy)) {
            return response()->json([
                'message' => 'A referral has already been linked to this account.',
            ], 422);
        }

        if ($user->isReferralRewardClaimed) {
            return response()->json([
                'message' => 'Welcome referral reward has already been claimed.',
            ], 422);
        }

        // 2. Validate 24-hour grace period using server-side timestamp
        $signupTime = ($user->created_at && $user->created_at->timestamp > 0)
            ? $user->created_at->timestamp
            : (($user->signupTimestamp && $user->signupTimestamp > 0)
                ? (int)($user->signupTimestamp / 1000)
                : null);

        if (!$signupTime || (time() - $signupTime) > 86400) {
            return response()->json([
                'message' => 'Welcome bonus grace period (24 hours from registration) has expired.',
            ], 422);
        }

        $code = trim($validated['referral_code']);
        $referrer = User::where('username', $code)->orWhere('id', $code)->first();

        if (!$referrer) {
            return response()->json([
                'message' => 'Referrer with this code was not found.',
            ], 404);
        }

        if ($referrer->id === $user->id) {
            return response()->json([
                'message' => 'You cannot claim your own referral code.',
            ], 422);
        }

        DB::transaction(function () use ($user, $referrer) {
            $user->referredBy = $referrer->username;
            $user->isReferralRewardClaimed = true;
            $user->readerCoins = (float)$user->readerCoins + 10;
            $user->totalReaderCoins = (float)$user->totalReaderCoins + 10;
            $user->save();

            $referrer->increment('referralCount');

            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $referrer->id,
                'type' => 'REFERRAL_REWARD',
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'content' => $user->username . ' registered using your referral code!',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool)$user->isVerified,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Welcome bonus of 10 reader coins claimed successfully!',
            'readerCoins' => $user->fresh()->readerCoins,
            'user' => $user->fresh(),
        ]);
    }

    public function milestones(Request $request)
    {
        $user = $request->user();

        $referredUserIds = [];
        if (!empty($user->username) || !empty($user->id)) {
            $referredUserIds = User::where(function ($q) use ($user) {
                if (!empty($user->username)) {
                    $q->where('referredBy', $user->username);
                }
                if (!empty($user->id)) {
                    $q->orWhere('referredBy', $user->id);
                }
            })
            ->where('referredBy', '!=', '')
            ->pluck('id')
            ->toArray();
        }

        $totalChaptersRead = 0;
        $totalAdsWatched = 0;

        if (!empty($referredUserIds)) {
            $totalChaptersRead = DB::table('user_read_parts')
                ->whereIn('userId', $referredUserIds)
                ->count();

            $totalAdsWatched = DB::table('ad_watch_events')
                ->whereIn('userId', $referredUserIds)
                ->count();
        }

        $claimedTiers = ReferralMilestoneClaim::where('referrer_id', $user->id)
            ->pluck('tier_index')
            ->toArray();

        $tiers = [];
        foreach ($this->milestonesConfig as $index => $cfg) {
            $isCompleted = ($totalChaptersRead >= $cfg['chapters'] && $totalAdsWatched >= $cfg['ads']);
            $isClaimed = in_array($index, $claimedTiers);

            $tiers[] = [
                'tier' => $index,
                'targetChapters' => $cfg['chapters'],
                'currentChapters' => min($totalChaptersRead, $cfg['chapters']),
                'targetAds' => $cfg['ads'],
                'currentAds' => min($totalAdsWatched, $cfg['ads']),
                'coins' => $cfg['coins'],
                'isCompleted' => $isCompleted,
                'isClaimed' => $isClaimed,
                'canClaim' => $isCompleted && !$isClaimed,
            ];
        }

        return response()->json([
            'referralCode' => $user->username,
            'referralCount' => $user->referralCount,
            'totalChaptersRead' => $totalChaptersRead,
            'totalAdsWatched' => $totalAdsWatched,
            'tiers' => $tiers,
        ]);
    }

    public function claimMilestone(Request $request)
    {
        $validated = $request->validate([
            'tier_index' => 'required|integer|min:1|max:6',
        ]);

        $user = $request->user();
        $tierIndex = (int)$validated['tier_index'];
        $cfg = $this->milestonesConfig[$tierIndex] ?? null;

        if (!$cfg) {
            return response()->json(['message' => 'Invalid milestone tier.'], 422);
        }

        try {
            return DB::transaction(function () use ($request, $tierIndex, $cfg) {
                $user = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();

                $alreadyClaimed = ReferralMilestoneClaim::where('referrer_id', $user->id)
                    ->where('tier_index', $tierIndex)
                    ->exists();

                if ($alreadyClaimed) {
                    return response()->json(['message' => 'Milestone already claimed.'], 422);
                }

                $referredUserIds = [];
                if (!empty($user->username) || !empty($user->id)) {
                    $referredUserIds = User::where(function ($q) use ($user) {
                        if (!empty($user->username)) {
                            $q->where('referredBy', $user->username);
                        }
                        if (!empty($user->id)) {
                            $q->orWhere('referredBy', $user->id);
                        }
                    })
                    ->where('referredBy', '!=', '')
                    ->pluck('id')
                    ->toArray();
                }

                $totalChaptersRead = 0;
                $totalAdsWatched = 0;

                if (!empty($referredUserIds)) {
                    $totalChaptersRead = DB::table('user_read_parts')
                        ->whereIn('userId', $referredUserIds)
                        ->count();

                    $totalAdsWatched = DB::table('ad_watch_events')
                        ->whereIn('userId', $referredUserIds)
                        ->count();
                }

                if ($totalChaptersRead < $cfg['chapters'] || $totalAdsWatched < $cfg['ads']) {
                    return response()->json([
                        'message' => 'Milestone requirements not yet reached.',
                    ], 422);
                }

                $user->readerCoins = (float)$user->readerCoins + $cfg['coins'];
                $user->totalReaderCoins = (float)$user->totalReaderCoins + $cfg['coins'];
                $user->save();

                ReferralMilestoneClaim::create([
                    'id' => Str::uuid()->toString(),
                    'referrer_id' => $user->id,
                    'tier_index' => $tierIndex,
                    'coins_awarded' => $cfg['coins'],
                ]);

                return response()->json([
                    'success' => true,
                    'message' => "Successfully claimed {$cfg['coins']} reader coins for Milestone Tier {$tierIndex}!",
                    'readerCoins' => $user->fresh()->readerCoins,
                ]);
            }, 3);
        } catch (\Illuminate\Database\QueryException) {
            return response()->json(['message' => 'Milestone already claimed.'], 422);
        }
    }
}
