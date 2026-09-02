<?php

namespace App\Services;

use App\Models\DailyLoginRewardClaim;
use App\Models\NewAccountRewardEnrollment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DailyLoginRewardService
{
    public function enroll(User $user): NewAccountRewardEnrollment
    {
        $timezone = (string) config('moneypad.rewards.new_account_timezone');

        return NewAccountRewardEnrollment::firstOrCreate(
            ['userId' => $user->id],
            [
                'id' => (string) Str::uuid(),
                'starts_on' => now($timezone)->toDateString(),
                'timezone' => $timezone,
            ],
        );
    }

    /** @return array{eligible: bool, days: array<int, array<string, mixed>>, server_date: string, coin_to_php_rate: float} */
    public function status(User $user): array
    {
        $enrollment = NewAccountRewardEnrollment::query()
            ->where('userId', $user->id)
            ->with('claims')
            ->first();

        $coinToPhpRate = (float) config('moneypad.conversion.coins_to_cash_ratio');
        if ($enrollment === null) {
            return [
                'eligible' => false,
                'days' => [],
                'server_date' => now((string) config('moneypad.rewards.new_account_timezone'))->toDateString(),
                'coin_to_php_rate' => $coinToPhpRate,
            ];
        }

        $today = CarbonImmutable::now($enrollment->timezone)->startOfDay();
        $startsOn = CarbonImmutable::parse($enrollment->starts_on->toDateString(), $enrollment->timezone);
        $claimsByDay = $enrollment->claims->keyBy('day_number');
        $amounts = config('moneypad.rewards.new_account_daily_coins');

        $days = collect($amounts)->values()->map(function (int|float $amount, int $index) use (
            $claimsByDay,
            $startsOn,
            $today,
        ): array {
            $dayNumber = $index + 1;
            $rewardDate = $startsOn->addDays($index);
            $claim = $claimsByDay->get($dayNumber);
            $status = match (true) {
                $claim !== null => 'claimed',
                $rewardDate->isBefore($today) => 'missed',
                $rewardDate->isSameDay($today) => 'available',
                default => 'upcoming',
            };

            return [
                'day' => $dayNumber,
                'date' => $rewardDate->toDateString(),
                'amount' => number_format((float) $amount, 3, '.', ''),
                'status' => $status,
                'claimed_at' => $claim?->claimed_at?->toIso8601String(),
            ];
        })->all();

        return [
            'eligible' => true,
            'days' => $days,
            'server_date' => $today->toDateString(),
            'coin_to_php_rate' => $coinToPhpRate,
        ];
    }

    /** @return array{claim: DailyLoginRewardClaim, user: User, created: bool} */
    public function claim(User $user): array
    {
        return DB::transaction(function () use ($user): array {
            $enrollment = NewAccountRewardEnrollment::query()
                ->where('userId', $user->id)
                ->lockForUpdate()
                ->first();

            if ($enrollment === null) {
                throw ValidationException::withMessages([
                    'reward' => 'This account is not eligible for the new-account reward.',
                ]);
            }

            $today = CarbonImmutable::now($enrollment->timezone)->startOfDay();
            $startsOn = CarbonImmutable::parse($enrollment->starts_on->toDateString(), $enrollment->timezone);

            if ($today->isBefore($startsOn) || $today->isAfter($startsOn->addDays(6))) {
                throw ValidationException::withMessages([
                    'reward' => 'There is no new-account reward available today.',
                ]);
            }

            $dayNumber = (int) $startsOn->diffInDays($today) + 1;
            $existingClaim = DailyLoginRewardClaim::query()
                ->where('enrollment_id', $enrollment->id)
                ->where('day_number', $dayNumber)
                ->first();

            if ($existingClaim !== null) {
                return [
                    'claim' => $existingClaim,
                    'user' => $user->fresh(),
                    'created' => false,
                ];
            }

            $amount = (float) config('moneypad.rewards.new_account_daily_coins.'.($dayNumber - 1));
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $lockedUser->readerCoins = $this->formatCoins((float) $lockedUser->readerCoins + $amount);
            $lockedUser->totalReaderCoins = $this->formatCoins((float) $lockedUser->totalReaderCoins + $amount);
            $lockedUser->save();

            $claim = DailyLoginRewardClaim::create([
                'id' => (string) Str::uuid(),
                'enrollment_id' => $enrollment->id,
                'userId' => $lockedUser->id,
                'day_number' => $dayNumber,
                'reward_date' => $today->toDateString(),
                'amount' => $this->formatCoins($amount),
                'claimed_at' => now(),
            ]);

            if ($dayNumber === 7) {
                $enrollment->update(['completed_at' => now()]);
            }

            return ['claim' => $claim, 'user' => $lockedUser->fresh(), 'created' => true];
        }, 3);
    }

    private function formatCoins(float $amount): string
    {
        return number_format($amount, 3, '.', '');
    }
}
