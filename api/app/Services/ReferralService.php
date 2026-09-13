<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\ReferralMilestoneClaim;
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

            return $user->fresh();
        }, 3);
    }

    /** @return array{chapters: int, ads: int} */
    private function progress(User $user): array
    {
        $referees = User::select('id')->where('referrer_id', $user->id);

        return [
            'chapters' => DB::table('user_read_parts')->whereIn('userId', clone $referees)->count(),
            'ads' => DB::table('ad_watch_events')->whereIn('userId', clone $referees)->count(),
        ];
    }

    public function milestones(User $user): array
    {
        $progress = $this->progress($user);
        $claimed = ReferralMilestoneClaim::where('referrer_id', $user->id)->pluck('tier_index')->all();
        $tiers = [];
        foreach (config('moneypad.referral_milestones') as $index => $tier) {
            $complete = $progress['chapters'] >= $tier['chapters'] && $progress['ads'] >= $tier['ads'];
            $isClaimed = in_array($index, $claimed);
            $tiers[] = [
                'tier' => $index, 'targetChapters' => $tier['chapters'], 'currentChapters' => min($progress['chapters'], $tier['chapters']),
                'targetAds' => $tier['ads'], 'currentAds' => min($progress['ads'], $tier['ads']), 'coins' => $tier['coins'],
                'isCompleted' => $complete, 'isClaimed' => $isClaimed, 'canClaim' => $complete && ! $isClaimed,
            ];
        }

        return ['referralCode' => $user->username, 'referralCount' => $user->referralCount,
            'totalChaptersRead' => $progress['chapters'], 'totalAdsWatched' => $progress['ads'], 'tiers' => $tiers];
    }

    public function claimMilestone(User $user, int $tierIndex): User
    {
        return DB::transaction(function () use ($user, $tierIndex) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if (ReferralMilestoneClaim::where('referrer_id', $user->id)->where('tier_index', $tierIndex)->exists()) {
                throw ValidationException::withMessages(['tier_index' => 'Milestone already claimed.']);
            }
            $tier = config('moneypad.referral_milestones.'.$tierIndex);
            $progress = $this->progress($user);
            if (! $tier || $progress['chapters'] < $tier['chapters'] || $progress['ads'] < $tier['ads']) {
                throw ValidationException::withMessages(['tier_index' => 'Milestone requirements not yet reached.']);
            }
            $user->readerCoins = CoinAmount::add($user->readerCoins, $tier['coins']);
            $user->totalReaderCoins = CoinAmount::add($user->totalReaderCoins, $tier['coins']);
            $user->save();
            ReferralMilestoneClaim::create(['id' => (string) Str::uuid(), 'referrer_id' => $user->id,
                'tier_index' => $tierIndex, 'coins_awarded' => $tier['coins']]);

            return $user->fresh();
        }, 3);
    }
}
