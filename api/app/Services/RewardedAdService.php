<?php

namespace App\Services;

use App\Models\AuthorReferralCommission;
use App\Models\RewardedAdEvent;
use App\Models\User;
use App\Models\WithdrawalRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RewardedAdService
{
    /**
     * Create a new class instance.
     */
    public function mockEnabled(): bool
    {
        return app()->environment(['local', 'testing'])
            && config('moneypad.rewarded_ads.provider') === 'mock'
            && (bool) config('moneypad.rewarded_ads.mock_enabled');
    }

    public function available(): bool
    {
        // Monetag website placements have no supported rewarded postback protocol.
        return $this->mockEnabled();
    }

    public function cooldown(User $user): int
    {
        $last = DB::table('ad_watch_events')->where('userId', $user->id)->max('watchedAt');
        if ($last === null) {
            return 0;
        }
        $seconds = $last > 10000000000 ? intdiv((int) $last, 1000) : (int) $last;

        return max(0, (int) config('moneypad.rewards.ad_watch_cooldown_seconds') - (now()->timestamp - $seconds));
    }

    public function start(User $user, string $purpose, ?string $target): RewardedAdEvent
    {
        abort_unless($this->available(), 503, 'Rewarded ads are currently unavailable.');

        return DB::transaction(function () use ($user, $purpose, $target) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if ($purpose === 'coins') {
                abort_if($this->cooldown($user) > 0, 429, 'Ad watch cooldown active.');
                $target = null;
            } elseif ($purpose === 'withdrawal') {
                $withdrawal = WithdrawalRequest::whereKey($target)->where('userId', $user->id)->firstOrFail();
                abort_if($withdrawal->fee_waived, 422, 'The platform fee is already waived.');
            } elseif ($purpose === 'author_commission') {
                $commission = AuthorReferralCommission::whereKey($target)->where('referrer_id', $user->id)->firstOrFail();
                abort_if($commission->status === 'claimed', 422, 'The commission has already been claimed.');
                abort_if($commission->ads_watched >= $commission->required_ads, 422, 'All required ads have already been watched.');
            } elseif ($purpose === 'referral_tier') {
                abort_unless($user->referrer_id, 422, 'No referral linked to this account.');
                $tierIndex = (int) $target;
                $tierConfig = config("moneypad.referral_milestones.{$tierIndex}");
                abort_unless($tierConfig, 422, 'Invalid milestone tier.');

                $activeTier = app(ReferralService::class)->getActiveTierForReferee($user->referrer_id, $user->id);
                abort_if($tierIndex !== $activeTier, 422, 'This tier is not currently active for ad watching.');

                $progress = app(ReferralService::class)->getProgressForTier($user->referrer_id, $user->id, $tierIndex);
                abort_if($progress && $progress->ads_watched >= $tierConfig['ads'], 422, 'All required ads for this tier have already been watched.');
            }
            $existing = RewardedAdEvent::where('user_id', $user->id)->where('purpose', $purpose)
                ->where('target_id', $target)->whereNull('consumed_at')->where('expires_at', '>', now())->first();

            return $existing ?? RewardedAdEvent::create([
                'id' => (string) Str::uuid(), 'user_id' => $user->id, 'purpose' => $purpose,
                'target_id' => $target, 'provider' => 'mock', 'expires_at' => now()->addMinutes(10),
            ]);
        }, 3);
    }

    public function verifyMock(User $user, string $eventId): void
    {
        abort_unless($this->mockEnabled(), 404);
        DB::transaction(function () use ($user, $eventId) {
            $event = RewardedAdEvent::whereKey($eventId)->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            abort_unless($event->provider === 'mock' && $event->expires_at->isFuture(), 422);
            abort_if($event->created_at->diffInSeconds(now()) < 5, 429, 'The development ad has not completed.');
            if ($event->verified_at === null) {
                $event->update(['verified_at' => now()]);
            }
        });
    }

    /** Must be called inside the transaction that applies the reward. */
    public function consume(User $user, string $id, string $purpose, ?string $target = null): bool
    {
        $event = RewardedAdEvent::whereKey($id)->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
        if ($event->purpose !== $purpose || $event->target_id !== $target || ! $event->verified_at
            || ($event->provider === 'mock' && ! $this->mockEnabled())) {
            throw ValidationException::withMessages(['ad_event_id' => 'The ad reward has not been verified for this action.']);
        }
        if ($event->consumed_at) {
            return false;
        }
        if ($event->expires_at->isPast()) {
            throw ValidationException::withMessages(['ad_event_id' => 'The ad reward has expired.']);
        }
        $event->update(['consumed_at' => now()]);

        return true;
    }

    public function creditCoins(User $user, string $eventId): array
    {
        return DB::transaction(function () use ($user, $eventId) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $credited = $this->consume($user, $eventId, 'coins');
            $reward = config('moneypad.rewards.ad_watch_coins');
            if ($credited) {
                abort_if($this->cooldown($user) > 0, 429, 'Ad watch cooldown active.');
                DB::table('ad_watch_events')->insert([
                    'id' => $eventId, 'userId' => $user->id, 'rewardCoins' => $reward, 'watchedAt' => now()->valueOf(),
                ]);
                $user->readerCoins = CoinAmount::add($user->readerCoins, $reward);
                $user->totalReaderCoins = CoinAmount::add($user->totalReaderCoins, $reward);
                $user->save();
                app(WithdrawalService::class)->evaluateAndCreate($user);
            }

            return ['success' => true, 'rewardCoins' => $credited ? $reward : 0,
                'newCoins' => $user->fresh()->readerCoins, 'cooldown_remaining' => $this->cooldown($user), 'user' => $user->fresh()];
        }, 3);
    }
}
