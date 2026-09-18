<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\ReferralMilestoneClaim;
use App\Models\ReferralMilestoneProgress;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReferralService
{
    public function claimWelcome(User $user, string $code): User
    {
        return DB::transaction(function () use ($user, $code) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if ($user->referrer_id || $user->referredBy || $user->isReferralRewardClaimed) {
                throw ValidationException::withMessages(['referral_code' => 'A referral has already been linked to this account.']);
            }
            $signup = $user->created_at?->timestamp ?: (int) ($user->signupTimestamp / 1000);
            if (! $signup || now()->timestamp - $signup > 86400) {
                throw ValidationException::withMessages(['referral_code' => 'Welcome bonus grace period (24 hours from registration) has expired.']);
            }
            $trimmedCode = trim($code);
            if (preg_match('/[?&]ref=([^&#\s]+)/i', $trimmedCode, $matches)) {
                $trimmedCode = rtrim(urldecode($matches[1]), '/#');
            }
            $referrer = User::where('username', $trimmedCode)->orWhere('id', $trimmedCode)->first();
            if (! $referrer) {
                throw ValidationException::withMessages(['referral_code' => "The referral username '{$trimmedCode}' does not exist."]);
            }
            if ($referrer->id === $user->id) {
                throw ValidationException::withMessages(['referral_code' => 'You cannot claim your own referral code.']);
            }
            $user->referrer_id = $referrer->id;
            $user->referredBy = $referrer->username;
            $user->isReferralRewardClaimed = true;
            $user->readerCoins = CoinAmount::add($user->readerCoins, 10);
            $user->totalReaderCoins = CoinAmount::add($user->totalReaderCoins, 10);
            $user->save();
            $referrer->increment('referralCount');
            Notification::create([
                'id' => (string) Str::uuid(), 'userId' => $referrer->id, 'type' => 'REFERRAL_REWARD',
                'actorId' => $user->id, 'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl, 'isActorVerified' => $user->isVerified,
                'content' => $user->username.' registered using your referral code!', 'timestamp' => now()->valueOf(),
            ]);

            $this->ensureProgressRow($referrer->id, $user->id, 1);

            return $user->fresh();
        }, 3);
    }

    public function linkReferrer(User $user, string $code): User
    {
        return DB::transaction(function () use ($user, $code) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if ($user->referrer_id || $user->referredBy) {
                throw ValidationException::withMessages(['referral_code' => 'A referral has already been linked to this account.']);
            }

            $trimmedCode = trim($code);
            if (preg_match('/[?&]ref=([^&#\s]+)/i', $trimmedCode, $matches)) {
                $trimmedCode = rtrim(urldecode($matches[1]), '/#');
            }
            $referrer = User::where('username', $trimmedCode)->orWhere('id', $trimmedCode)->first();
            if (! $referrer) {
                throw ValidationException::withMessages(['referral_code' => "The referral username '{$trimmedCode}' does not exist."]);
            }
            if ($referrer->id === $user->id) {
                throw ValidationException::withMessages(['referral_code' => 'You cannot claim your own referral code.']);
            }

            $signup = $user->created_at?->timestamp ?: (int) ($user->signupTimestamp / 1000);
            $awardBonus = $signup && (now()->timestamp - $signup <= 86400) && ! $user->isReferralRewardClaimed;

            $user->referrer_id = $referrer->id;
            $user->referredBy = $referrer->username;
            if ($awardBonus) {
                $user->isReferralRewardClaimed = true;
                $user->readerCoins = CoinAmount::add($user->readerCoins, 10);
                $user->totalReaderCoins = CoinAmount::add($user->totalReaderCoins, 10);
            }
            $user->save();
            $referrer->increment('referralCount');

            Notification::create([
                'id' => (string) Str::uuid(),
                'userId' => $referrer->id,
                'type' => 'REFERRAL_REWARD',
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'isActorVerified' => $user->isVerified,
                'content' => $user->username.' registered using your referral code!',
                'timestamp' => now()->valueOf(),
            ]);

            $this->ensureProgressRow($referrer->id, $user->id, 1);

            return $user->fresh();
        }, 3);
    }

    public function getActiveTierForReferee(string $referrerId, string $refereeId): int
    {
        $claimedTiers = ReferralMilestoneClaim::where('referrer_id', $referrerId)
            ->where('referred_user_id', $refereeId)
            ->pluck('tier_index')
            ->all();

        for ($tier = 1; $tier <= 6; $tier++) {
            if (! in_array($tier, $claimedTiers, true)) {
                return $tier;
            }
        }

        return 7;
    }

    public function ensureProgressRow(string $referrerId, string $refereeId, int $tierIndex): ReferralMilestoneProgress
    {
        return ReferralMilestoneProgress::firstOrCreate(
            [
                'referrer_id' => $referrerId,
                'referred_user_id' => $refereeId,
                'tier_index' => $tierIndex,
            ],
            [
                'id' => (string) Str::uuid(),
                'chapters_read' => 0,
                'ads_watched' => 0,
                'is_completed' => false,
            ]
        );
    }

    public function getProgressForTier(string $referrerId, string $refereeId, int $tierIndex): ?ReferralMilestoneProgress
    {
        return ReferralMilestoneProgress::where('referrer_id', $referrerId)
            ->where('referred_user_id', $refereeId)
            ->where('tier_index', $tierIndex)
            ->first();
    }

    /**
     * Record an incremental chapter read for the active tier.
     * Only the active tier accepts progress; locked subsequent tiers cannot advance.
     */
    public function recordChapterRead(string $userId): void
    {
        $referrerId = User::whereKey($userId)->value('referrer_id');
        if (! $referrerId) {
            return;
        }

        DB::transaction(function () use ($referrerId, $userId) {
            $activeTier = $this->getActiveTierForReferee($referrerId, $userId);
            if ($activeTier > 6) {
                return;
            }

            $tierConfig = config("moneypad.referral_milestones.{$activeTier}");
            if (! $tierConfig) {
                return;
            }

            $progress = ReferralMilestoneProgress::where('referrer_id', $referrerId)
                ->where('referred_user_id', $userId)
                ->where('tier_index', $activeTier)
                ->lockForUpdate()
                ->first();

            if (! $progress) {
                $progress = ReferralMilestoneProgress::create([
                    'id' => (string) Str::uuid(),
                    'referrer_id' => $referrerId,
                    'referred_user_id' => $userId,
                    'tier_index' => $activeTier,
                    'chapters_read' => 0,
                    'ads_watched' => 0,
                    'is_completed' => false,
                ]);
            }

            if ($progress->chapters_read < $tierConfig['chapters']) {
                $progress->increment('chapters_read');
                $progress->refresh();

                if ($progress->chapters_read >= $tierConfig['chapters'] && $progress->ads_watched >= $tierConfig['ads']) {
                    $progress->update([
                        'is_completed' => true,
                        'completed_at' => now(),
                    ]);
                }
            }
        }, 3);
    }

    /** Count a completed rewarded task inside the ad consumption transaction. */
    public function recordCompletedAd(User $user): void
    {
        $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
        if (! $user->referrer_id) {
            return;
        }

        $activeTier = $this->getActiveTierForReferee($user->referrer_id, $user->id);
        $tierConfig = config("moneypad.referral_milestones.{$activeTier}");
        if (! $tierConfig) {
            return;
        }

        $progress = $this->ensureProgressRow($user->referrer_id, $user->id, $activeTier);
        $progress = ReferralMilestoneProgress::whereKey($progress->id)->lockForUpdate()->firstOrFail();
        if ($progress->ads_watched >= $tierConfig['ads']) {
            return;
        }

        $progress->increment('ads_watched');
        $progress->refresh();

        if ($progress->chapters_read >= $tierConfig['chapters'] && $progress->ads_watched >= $tierConfig['ads']) {
            $progress->update([
                'is_completed' => true,
                'completed_at' => now(),
            ]);
        }
    }

    /**
     * Record an ad watched by the referred user for their active referral tier.
     * Tier ads only advance tier progress and do not pay the flat 2 coins.
     */
    public function recordTierAd(User $user, int $tierIndex, string $adEventId): array
    {
        return DB::transaction(function () use ($user, $tierIndex, $adEventId) {
            $referee = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            abort_unless($referee->referrer_id, 422, 'No referral linked to this account.');

            $activeTier = $this->getActiveTierForReferee($referee->referrer_id, $referee->id);
            abort_if($tierIndex !== $activeTier, 422, 'This tier is not currently active for ad watching.');

            $tierConfig = config("moneypad.referral_milestones.{$tierIndex}");
            abort_unless($tierConfig, 422, 'Invalid milestone tier.');

            $progress = ReferralMilestoneProgress::where('referrer_id', $referee->referrer_id)
                ->where('referred_user_id', $referee->id)
                ->where('tier_index', $tierIndex)
                ->lockForUpdate()
                ->first();

            if (! $progress) {
                $progress = ReferralMilestoneProgress::create([
                    'id' => (string) Str::uuid(),
                    'referrer_id' => $referee->referrer_id,
                    'referred_user_id' => $referee->id,
                    'tier_index' => $tierIndex,
                    'chapters_read' => 0,
                    'ads_watched' => 0,
                    'is_completed' => false,
                ]);
            }

            abort_if($progress->ads_watched >= $tierConfig['ads'], 422, 'All required ads for this tier have already been watched.');

            $consumed = app(RewardedAdService::class)->consume($referee, $adEventId, 'referral_tier', (string) $tierIndex);
            if (! $consumed) {
                throw ValidationException::withMessages(['ad_event_id' => 'Ad has already been consumed.']);
            }

            $progress->increment('ads_watched');
            $progress->refresh();

            if ($progress->chapters_read >= $tierConfig['chapters'] && $progress->ads_watched >= $tierConfig['ads']) {
                $progress->update([
                    'is_completed' => true,
                    'completed_at' => now(),
                ]);
            }

            return [
                'success' => true,
                'message' => "Tier {$tierIndex} ad progress recorded!",
                'tier' => $tierIndex,
                'ads_watched' => $progress->ads_watched,
                'target_ads' => $tierConfig['ads'],
                'is_completed' => (bool) $progress->is_completed,
            ];
        }, 3);
    }

    public function milestones(User $user): array
    {
        $tierConfigs = config('moneypad.referral_milestones');
        $referees = User::where('referrer_id', $user->id)->orderByDesc('created_at')->get();

        $referralList = [];
        $totalChapters = 0;
        $totalAds = 0;

        foreach ($referees as $referee) {
            $activeTier = $this->getActiveTierForReferee($user->id, $referee->id);
            $claims = ReferralMilestoneClaim::where('referrer_id', $user->id)
                ->where('referred_user_id', $referee->id)
                ->pluck('tier_index')
                ->all();

            $progressMap = ReferralMilestoneProgress::where('referrer_id', $user->id)
                ->where('referred_user_id', $referee->id)
                ->get()
                ->keyBy('tier_index');

            // Fallback for unmigrated test seed data if no progress row exists
            if ($progressMap->isEmpty() && $activeTier === 1) {
                $rawChapters = DB::table('user_read_parts')->where('userId', $referee->id)->count();
                $rawAds = DB::table('ad_watch_events')->where('userId', $referee->id)->count();
                if ($rawChapters > 0 || $rawAds > 0) {
                    $seeded = ReferralMilestoneProgress::create([
                        'id' => (string) Str::uuid(),
                        'referrer_id' => $user->id,
                        'referred_user_id' => $referee->id,
                        'tier_index' => 1,
                        'chapters_read' => min($rawChapters, $tierConfigs[1]['chapters']),
                        'ads_watched' => min($rawAds, $tierConfigs[1]['ads']),
                        'is_completed' => ($rawChapters >= $tierConfigs[1]['chapters'] && $rawAds >= $tierConfigs[1]['ads']),
                    ]);
                    $progressMap->put(1, $seeded);
                }
            }

            $tiers = [];
            foreach ($tierConfigs as $index => $cfg) {
                $p = $progressMap->get($index);
                $curCh = $p ? (int) $p->chapters_read : 0;
                $curAds = $p ? (int) $p->ads_watched : 0;
                $totalChapters += $curCh;
                $totalAds += $curAds;

                $isClaimed = in_array($index, $claims, true);
                $isCompleted = ($curCh >= $cfg['chapters'] && $curAds >= $cfg['ads']) || $isClaimed;
                $precedingClaimed = ($index === 1) || in_array($index - 1, $claims, true);
                $isLocked = ! $precedingClaimed;
                $canClaim = $isCompleted && ! $isClaimed && $precedingClaimed;

                $tiers[] = [
                    'tier' => $index,
                    'targetChapters' => $cfg['chapters'],
                    'currentChapters' => min($curCh, $cfg['chapters']),
                    'targetAds' => $cfg['ads'],
                    'currentAds' => min($curAds, $cfg['ads']),
                    'coins' => $cfg['coins'],
                    'isCompleted' => $isCompleted,
                    'isClaimed' => $isClaimed,
                    'canClaim' => $canClaim,
                    'isLocked' => $isLocked,
                ];
            }

            $referralList[] = [
                'id' => $referee->id,
                'username' => $referee->username,
                'profileImageUrl' => $referee->profileImageUrl,
                'isVerified' => (bool) $referee->isVerified,
                'joinedAt' => $referee->created_at?->toISOString(),
                'activeTier' => min(6, $activeTier),
                'tiers' => $tiers,
            ];
        }

        $supporting = null;
        if ($user->referrer_id) {
            $inviter = User::find($user->referrer_id);
            if ($inviter) {
                $activeTier = $this->getActiveTierForReferee($inviter->id, $user->id);
                $claims = ReferralMilestoneClaim::where('referrer_id', $inviter->id)
                    ->where('referred_user_id', $user->id)
                    ->pluck('tier_index')
                    ->all();

                $progressMap = ReferralMilestoneProgress::where('referrer_id', $inviter->id)
                    ->where('referred_user_id', $user->id)
                    ->get()
                    ->keyBy('tier_index');

                if ($progressMap->isEmpty() && $activeTier === 1) {
                    $rawChapters = DB::table('user_read_parts')->where('userId', $user->id)->count();
                    $rawAds = DB::table('ad_watch_events')->where('userId', $user->id)->count();
                    if ($rawChapters > 0 || $rawAds > 0) {
                        $seeded = ReferralMilestoneProgress::create([
                            'id' => (string) Str::uuid(),
                            'referrer_id' => $inviter->id,
                            'referred_user_id' => $user->id,
                            'tier_index' => 1,
                            'chapters_read' => min($rawChapters, $tierConfigs[1]['chapters']),
                            'ads_watched' => min($rawAds, $tierConfigs[1]['ads']),
                            'is_completed' => ($rawChapters >= $tierConfigs[1]['chapters'] && $rawAds >= $tierConfigs[1]['ads']),
                        ]);
                        $progressMap->put(1, $seeded);
                    }
                }

                $tiers = [];
                foreach ($tierConfigs as $index => $cfg) {
                    $p = $progressMap->get($index);
                    $curCh = $p ? (int) $p->chapters_read : 0;
                    $curAds = $p ? (int) $p->ads_watched : 0;

                    $isClaimed = in_array($index, $claims, true);
                    $isCompleted = ($curCh >= $cfg['chapters'] && $curAds >= $cfg['ads']) || $isClaimed;
                    $precedingClaimed = ($index === 1) || in_array($index - 1, $claims, true);
                    $isLocked = ! $precedingClaimed;

                    $tiers[] = [
                        'tier' => $index,
                        'targetChapters' => $cfg['chapters'],
                        'currentChapters' => min($curCh, $cfg['chapters']),
                        'targetAds' => $cfg['ads'],
                        'currentAds' => min($curAds, $cfg['ads']),
                        'coins' => $cfg['coins'],
                        'isCompleted' => $isCompleted,
                        'isClaimed' => $isClaimed,
                        'canClaim' => false,
                        'isLocked' => $isLocked,
                        'canWatchAd' => ($index === $activeTier) && ($curAds < $cfg['ads']),
                    ];
                }

                $supporting = [
                    'referrerId' => $inviter->id,
                    'referrerUsername' => $inviter->username,
                    'activeTier' => min(6, $activeTier),
                    'tiers' => $tiers,
                ];
            }
        }

        $defaultTiers = $referralList[0]['tiers'] ?? ($supporting['tiers'] ?? []);
        if (empty($defaultTiers)) {
            foreach ($tierConfigs as $index => $cfg) {
                $defaultTiers[] = [
                    'tier' => $index,
                    'targetChapters' => $cfg['chapters'],
                    'currentChapters' => 0,
                    'targetAds' => $cfg['ads'],
                    'currentAds' => 0,
                    'coins' => $cfg['coins'],
                    'isCompleted' => false,
                    'isClaimed' => false,
                    'canClaim' => false,
                    'isLocked' => $index > 1,
                ];
            }
        }

        return [
            'referralCode' => $user->username,
            'referralCount' => $user->referralCount,
            'totalChaptersRead' => $totalChapters,
            'totalAdsWatched' => $totalAds,
            'referrals' => $referralList,
            'supporting' => $supporting,
            'tiers' => $defaultTiers,
        ];
    }

    public function claimMilestone(User $user, ?string $referredUserId, int $tierIndex): User
    {
        return DB::transaction(function () use ($user, $referredUserId, $tierIndex) {
            $referrer = User::whereKey($user->id)->lockForUpdate()->firstOrFail();

            if (! $referredUserId) {
                $candidateIds = User::where('referrer_id', $referrer->id)->pluck('id');
                if ($candidateIds->count() === 1) {
                    $referredUserId = $candidateIds->first();
                } else {
                    $candidateProgress = ReferralMilestoneProgress::where('referrer_id', $referrer->id)
                        ->where('tier_index', $tierIndex)
                        ->where('is_completed', true)
                        ->first();
                    if ($candidateProgress) {
                        $referredUserId = $candidateProgress->referred_user_id;
                    }
                }
            }

            if (! $referredUserId) {
                throw ValidationException::withMessages(['referred_user_id' => 'Referred user is required.']);
            }

            User::whereKey($referredUserId)->where('referrer_id', $referrer->id)->firstOrFail();

            if ($tierIndex > 1) {
                $precedingClaimed = ReferralMilestoneClaim::where('referrer_id', $referrer->id)
                    ->where('referred_user_id', $referredUserId)
                    ->where('tier_index', $tierIndex - 1)
                    ->exists();
                if (! $precedingClaimed) {
                    throw ValidationException::withMessages(['tier_index' => 'Previous milestone tier must be claimed first.']);
                }
            }

            $alreadyClaimed = ReferralMilestoneClaim::where('referrer_id', $referrer->id)
                ->where('referred_user_id', $referredUserId)
                ->where('tier_index', $tierIndex)
                ->exists();
            if ($alreadyClaimed) {
                throw ValidationException::withMessages(['tier_index' => 'Milestone already claimed.']);
            }

            $tierConfig = config("moneypad.referral_milestones.{$tierIndex}");
            if (! $tierConfig) {
                throw ValidationException::withMessages(['tier_index' => 'Invalid tier.']);
            }

            $progress = ReferralMilestoneProgress::where('referrer_id', $referrer->id)
                ->where('referred_user_id', $referredUserId)
                ->where('tier_index', $tierIndex)
                ->first();

            if (! $progress || $progress->chapters_read < $tierConfig['chapters'] || $progress->ads_watched < $tierConfig['ads']) {
                throw ValidationException::withMessages(['tier_index' => 'Milestone requirements not yet reached.']);
            }

            $coins = (float) $tierConfig['coins'];
            $referrer->readerCoins = CoinAmount::add($referrer->readerCoins, $coins);
            $referrer->totalReaderCoins = CoinAmount::add($referrer->totalReaderCoins, $coins);
            $referrer->save();

            ReferralMilestoneClaim::create([
                'id' => (string) Str::uuid(),
                'referrer_id' => $referrer->id,
                'referred_user_id' => $referredUserId,
                'tier_index' => $tierIndex,
                'coins_awarded' => $coins,
            ]);

            if ($tierIndex < 6) {
                $this->ensureProgressRow($referrer->id, $referredUserId, $tierIndex + 1);
            }

            return $referrer->fresh();
        }, 3);
    }
}
