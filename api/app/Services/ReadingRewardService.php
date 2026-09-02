<?php

namespace App\Services;

use App\Models\ReadingReward;
use App\Models\ReadingRewardClaim;
use App\Models\ReadingSession;
use App\Models\User;
use App\ReadingRewardClaimStatus;
use App\ReadingRewardStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ReadingRewardService
{
    /** @return array{rewarded_minutes: int, amount_awarded: string, pending_total: string, stale: bool} */
    public function recordHeartbeat(User $user, string $sessionId): array
    {
        return DB::transaction(function () use ($user, $sessionId): array {
            $session = ReadingSession::query()
                ->where('id', $sessionId)
                ->where('userId', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            if (! $session->is_active) {
                throw ValidationException::withMessages([
                    'sessionId' => 'This reading session is no longer active.',
                ]);
            }

            $now = now();
            $elapsedSeconds = (int) floor($session->last_active_at->diffInSeconds($now));
            $maximumSeconds = (int) config('moneypad.reading.maximum_heartbeat_seconds');

            if ($elapsedSeconds < 30) {
                throw ValidationException::withMessages([
                    'sessionId' => 'Heartbeat was sent too soon.',
                ])->status(429);
            }

            if ($elapsedSeconds > $maximumSeconds) {
                $session->update(['last_active_at' => $now]);

                return [
                    'rewarded_minutes' => 0,
                    'amount_awarded' => '0.000',
                    'pending_total' => $this->pendingTotal($user),
                    'stale' => true,
                ];
            }

            $session->duration_seconds += $elapsedSeconds;
            $completedMinutes = intdiv($session->duration_seconds, 60);
            $newRewardCount = max(0, $completedMinutes - $session->rewarded_minutes);
            $rate = $user->earningRatePerMinute();

            for ($offset = 1; $offset <= $newRewardCount; $offset++) {
                $minuteIndex = $session->rewarded_minutes + $offset;
                $earnedAt = $now->copy()->subSeconds(($newRewardCount - $offset) * 60);

                ReadingReward::create([
                    'id' => (string) Str::uuid(),
                    'userId' => $user->id,
                    'reading_session_id' => $session->id,
                    'storyId' => $session->storyId,
                    'partId' => $session->partId,
                    'minute_index' => $minuteIndex,
                    'plan_type' => $user->plan,
                    'rate_per_minute' => $rate,
                    'amount' => $rate,
                    'status' => ReadingRewardStatus::Pending,
                    'earned_at' => $earnedAt,
                    'expires_at' => $earnedAt->copy()->addHours(
                        (int) config('moneypad.reading.reward_expiration_hours'),
                    ),
                ]);
            }

            $awardedAmount = $this->formatAmount((float) $rate * $newRewardCount);
            $session->rewarded_minutes += $newRewardCount;
            $session->coins_earned = $this->formatAmount((float) $session->coins_earned + (float) $awardedAmount);
            $session->last_active_at = $now;
            $session->save();

            return [
                'rewarded_minutes' => $newRewardCount,
                'amount_awarded' => $awardedAmount,
                'pending_total' => $this->pendingTotal($user),
                'stale' => false,
            ];
        }, 3);
    }

    /** @return array{claim: ReadingRewardClaim, mock_ad_token: ?string, completed: bool, user: ?User} */
    public function createClaim(User $user): array
    {
        return DB::transaction(function () use ($user): array {
            $this->expirePendingRewards($user);
            $this->cancelAwaitingClaims($user);

            $rewards = ReadingReward::query()
                ->where('userId', $user->id)
                ->where('status', ReadingRewardStatus::Pending)
                ->whereNull('claim_id')
                ->where('expires_at', '>', now())
                ->orderBy('earned_at')
                ->lockForUpdate()
                ->get();

            if ($rewards->isEmpty()) {
                throw ValidationException::withMessages([
                    'income' => 'There is no available income to claim.',
                ]);
            }

            $adRequired = $user->requiresClaimAd();
            $mockToken = null;

            if ($adRequired && config('moneypad.rewarded_ads.provider') === 'mock') {
                if (! config('moneypad.rewarded_ads.mock_enabled')) {
                    throw ValidationException::withMessages([
                        'ad' => 'Rewarded ads are not configured.',
                    ]);
                }

                $mockToken = Str::random(64);
            }

            $claim = ReadingRewardClaim::create([
                'id' => (string) Str::uuid(),
                'userId' => $user->id,
                'amount' => $this->formatAmount((float) $rewards->sum('amount')),
                'reward_count' => $rewards->count(),
                'status' => ReadingRewardClaimStatus::AwaitingAd,
                'ad_required' => $adRequired,
                'ad_provider' => $adRequired ? config('moneypad.rewarded_ads.provider') : null,
                'mock_token_hash' => $mockToken ? hash('sha256', $mockToken) : null,
            ]);

            ReadingReward::query()
                ->whereKey($rewards->modelKeys())
                ->update(['claim_id' => $claim->id]);

            if (! $adRequired) {
                $result = $this->completeLockedClaim($user, $claim);

                return [
                    'claim' => $result['claim'],
                    'mock_ad_token' => null,
                    'completed' => true,
                    'user' => $result['user'],
                ];
            }

            return [
                'claim' => $claim,
                'mock_ad_token' => $mockToken,
                'completed' => false,
                'user' => null,
            ];
        }, 3);
    }

    /** @return array{claim: ReadingRewardClaim, user: User} */
    public function completeClaim(User $user, ReadingRewardClaim $claim, ?string $mockAdToken): array
    {
        return DB::transaction(function () use ($user, $claim, $mockAdToken): array {
            $lockedClaim = ReadingRewardClaim::query()
                ->whereKey($claim->id)
                ->where('userId', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedClaim->status === ReadingRewardClaimStatus::Completed) {
                return ['claim' => $lockedClaim, 'user' => $user->fresh()];
            }

            if ($lockedClaim->status !== ReadingRewardClaimStatus::AwaitingAd) {
                throw ValidationException::withMessages([
                    'claim' => 'This claim can no longer be completed.',
                ]);
            }

            if ($lockedClaim->ad_required && $lockedClaim->ad_verified_at === null) {
                $this->verifyMockAd($lockedClaim, $mockAdToken);
                $lockedClaim->ad_verified_at = now();
                $lockedClaim->save();
            }

            return $this->completeLockedClaim($user, $lockedClaim);
        }, 3);
    }

    public function cancelClaim(User $user, ReadingRewardClaim $claim): void
    {
        DB::transaction(function () use ($user, $claim): void {
            $lockedClaim = ReadingRewardClaim::query()
                ->whereKey($claim->id)
                ->where('userId', $user->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($lockedClaim->status !== ReadingRewardClaimStatus::AwaitingAd) {
                return;
            }

            ReadingReward::query()
                ->where('claim_id', $lockedClaim->id)
                ->where('status', ReadingRewardStatus::Pending)
                ->update(['claim_id' => null]);

            $lockedClaim->update(['status' => ReadingRewardClaimStatus::Cancelled]);
            $this->expirePendingRewards($user);
        }, 3);
    }

    public function expirePendingRewards(User $user): int
    {
        return ReadingReward::query()
            ->where('userId', $user->id)
            ->where('status', ReadingRewardStatus::Pending)
            ->where('expires_at', '<=', now())
            ->update([
                'status' => ReadingRewardStatus::Expired,
                'claim_id' => null,
            ]);
    }

    private function cancelAwaitingClaims(User $user): void
    {
        $claimIds = ReadingRewardClaim::query()
            ->where('userId', $user->id)
            ->where('status', ReadingRewardClaimStatus::AwaitingAd)
            ->lockForUpdate()
            ->pluck('id');

        if ($claimIds->isEmpty()) {
            return;
        }

        ReadingReward::query()
            ->whereIn('claim_id', $claimIds)
            ->where('status', ReadingRewardStatus::Pending)
            ->update(['claim_id' => null]);

        ReadingRewardClaim::query()
            ->whereKey($claimIds)
            ->update(['status' => ReadingRewardClaimStatus::Cancelled]);
    }

    /** @return array{claim: ReadingRewardClaim, user: User} */
    private function completeLockedClaim(User $user, ReadingRewardClaim $claim): array
    {
        ReadingReward::query()
            ->where('claim_id', $claim->id)
            ->where('status', ReadingRewardStatus::Pending)
            ->where('expires_at', '<=', now())
            ->update([
                'status' => ReadingRewardStatus::Expired,
                'claim_id' => null,
            ]);

        $rewards = ReadingReward::query()
            ->where('claim_id', $claim->id)
            ->where('status', ReadingRewardStatus::Pending)
            ->where('expires_at', '>', now())
            ->lockForUpdate()
            ->get();

        if ($rewards->isEmpty()) {
            $claim->update(['status' => ReadingRewardClaimStatus::Cancelled]);

            throw ValidationException::withMessages([
                'income' => 'The income in this claim has expired.',
            ]);
        }

        $amount = $this->formatAmount((float) $rewards->sum('amount'));
        $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
        $lockedUser->readerCoins = $this->formatAmount((float) $lockedUser->readerCoins + (float) $amount);
        $lockedUser->totalReaderCoins = $this->formatAmount(
            (float) $lockedUser->totalReaderCoins + (float) $amount,
        );
        $lockedUser->save();

        $claimedAt = now();
        ReadingReward::query()->whereKey($rewards->modelKeys())->update([
            'status' => ReadingRewardStatus::Claimed,
            'claimed_at' => $claimedAt,
        ]);

        $claim->update([
            'amount' => $amount,
            'reward_count' => $rewards->count(),
            'status' => ReadingRewardClaimStatus::Completed,
            'claimed_at' => $claimedAt,
        ]);

        app(\App\Services\WithdrawalService::class)->evaluateAndCreate($lockedUser);

        return ['claim' => $claim->fresh(), 'user' => $lockedUser->fresh()];
    }

    private function verifyMockAd(ReadingRewardClaim $claim, ?string $mockAdToken): void
    {
        if ($claim->ad_provider !== 'mock' || ! config('moneypad.rewarded_ads.mock_enabled')) {
            throw ValidationException::withMessages([
                'ad' => 'The rewarded ad has not been verified.',
            ]);
        }

        $providedHash = hash('sha256', (string) $mockAdToken);
        if ($claim->mock_token_hash === null || ! hash_equals($claim->mock_token_hash, $providedHash)) {
            throw ValidationException::withMessages([
                'ad' => 'The rewarded ad completion token is invalid.',
            ]);
        }
    }

    private function pendingTotal(User $user): string
    {
        $total = ReadingReward::query()
            ->where('userId', $user->id)
            ->where('status', ReadingRewardStatus::Pending)
            ->where('expires_at', '>', now())
            ->sum('amount');

        return $this->formatAmount((float) $total);
    }

    private function formatAmount(float $amount): string
    {
        return number_format($amount, 3, '.', '');
    }
}
