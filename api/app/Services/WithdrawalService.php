<?php

namespace App\Services;

use App\Models\AuthorReferralCommission;
use App\Models\Notification;
use App\Models\Story;
use App\Models\SystemMessage;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\WithdrawalStatus;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WithdrawalService
{
    /**
     * Get the single-source-of-truth withdrawal policy.
     *
     * @return array<string, mixed>
     */
    public function getPolicy(): array
    {
        $automaticWithdrawalsAvailable = $this->automaticWithdrawalsAvailable();

        return [
            'min_gcash_maya' => (float) config('moneypad.withdrawals.min_gcash_maya', 10.0),
            'min_bank' => (float) config('moneypad.withdrawals.min_bank', 20.0),
            'platform_fee' => (float) config('moneypad.withdrawals.platform_fee', 3.0),
            'bank_fee' => (float) config('moneypad.withdrawals.bank_processing_fee', 10.0),
            'rewarded_ads_available' => app(RewardedAdService::class)->available(),
            'ads_to_waive_fee' => (int) config('moneypad.withdrawals.ads_to_waive_fee', 10),
            'coin_to_php_rate' => (float) config('moneypad.conversion.coins_to_cash_ratio', 0.01),
            'author_verified_minimum' => (float) config('moneypad.author_earnings.verified_minimum_php', 10.0),
            'author_standard_minimum' => (float) config('moneypad.author_earnings.standard_minimum_php', 40.0),
            'author_views_per_batch' => (int) config('moneypad.author_earnings.views_per_batch', 50),
            'author_verified_usd_per_batch' => (float) config('moneypad.author_earnings.verified_usd_per_batch', 0.10),
            'author_standard_usd_per_batch' => (float) config('moneypad.author_earnings.standard_usd_per_batch', 0.05),
            'timezone' => (string) config('moneypad.withdrawals.timezone', 'Asia/Manila'),
            'processing_days' => config('moneypad.withdrawals.processing_days', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
            'processing_days_label' => 'Monday–Saturday',
            'processing_turnaround_label' => '1–7 business days',
            'sunday_deferred' => false,
            'automatic_withdrawals_available' => $automaticWithdrawalsAvailable,
            'automatic_withdrawals_paused_reason' => $automaticWithdrawalsAvailable
                ? null
                : 'Automatic withdrawals are paused on Sunday and resume on Monday.',
            'ad_cooldown_seconds' => (int) config('moneypad.withdrawals.ad_cooldown_seconds', 3),
            'auto_withdrawal_description' => 'Withdrawals are processed automatically once you meet the minimum balance and configure complete payout details.',
        ];
    }

    public function automaticWithdrawalsAvailable(?CarbonInterface $at = null): bool
    {
        $timezone = (string) config('moneypad.withdrawals.timezone', 'Asia/Manila');
        $date = $at
            ? CarbonImmutable::parse($at)->setTimezone($timezone)
            : CarbonImmutable::now($timezone);

        return ! $date->isSunday();
    }

    /**
     * Get threshold for the given payout method.
     */
    public function getThresholdForMethod(?string $method): float
    {
        if ($method === 'Bank Transfer') {
            return (float) config('moneypad.withdrawals.min_bank', 20.0);
        }

        return (float) config('moneypad.withdrawals.min_gcash_maya', 10.0);
    }

    /**
     * Check if user has complete payout details.
     */
    public function hasCompletePayoutDetails(User $user): bool
    {
        if ($user->payout_account_conflict) {
            return false;
        }
        if (empty($user->payment_method) || empty($user->payment_account_info)) {
            return false;
        }

        if (! in_array($user->payment_method, ['GCash', 'Maya', 'Bank Transfer'], true)) {
            return false;
        }

        if ($user->payment_method === 'Bank Transfer' && empty($user->bank_name)) {
            return false;
        }

        return true;
    }

    /**
     * Calculate schedule: triggered_at, earliest_review_at (Sunday deferred to Monday), and estimated_deadline_at (7 business days skipping Sundays).
     *
     * @return array{triggered_at: CarbonImmutable, earliest_review_at: CarbonImmutable, estimated_deadline_at: CarbonImmutable}
     */
    public function calculateSchedule(?CarbonInterface $from = null): array
    {
        $timezone = (string) config('moneypad.withdrawals.timezone', 'Asia/Manila');
        $now = $from
            ? CarbonImmutable::parse($from)->setTimezone($timezone)
            : CarbonImmutable::now($timezone);

        $isSunday = $now->isSunday();
        $earliestReview = $isSunday
            ? $now->next(CarbonImmutable::MONDAY)->startOfDay()
            : $now;

        // 7 business days (Mon-Sat, skip Sun)
        $count = 0;
        $cursor = $earliestReview->copy();
        while ($count < 7) {
            $cursor = $cursor->addDay();
            if (! $cursor->isSunday()) {
                $count++;
            }
        }
        $estimatedDeadline = $cursor;

        return [
            'triggered_at' => $now,
            'earliest_review_at' => $earliestReview,
            'estimated_deadline_at' => $estimatedDeadline,
        ];
    }

    /**
     * Centralized automatic evaluation and creation.
     */
    public function evaluateAndCreate(User $user): ?WithdrawalRequest
    {
        if (! $this->automaticWithdrawalsAvailable()) {
            return null;
        }

        $readerWithdrawal = DB::transaction(function () use ($user): ?WithdrawalRequest {
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->first();
            if (! $lockedUser) {
                return null;
            }

            // Must not have an active withdrawal
            $hasActive = WithdrawalRequest::query()
                ->where('userId', $lockedUser->id)
                ->where('source', 'READER')
                ->whereIn('status', [
                    WithdrawalStatus::Eligible->value,
                    WithdrawalStatus::PendingAdChoice->value,
                    WithdrawalStatus::WatchingAds->value,
                    WithdrawalStatus::PendingReview->value,
                    WithdrawalStatus::Approved->value,
                ])
                ->exists();

            if ($hasActive) {
                return null;
            }

            if (! $this->hasCompletePayoutDetails($lockedUser)) {
                return null;
            }

            $coinToPhpRate = (float) config('moneypad.conversion.coins_to_cash_ratio', 0.01);
            $units = CoinAmount::units($lockedUser->readerCoins);
            $centavosPerThousandCoins = (int) round($coinToPhpRate * 100 * 1000);
            if ($centavosPerThousandCoins <= 0) {
                return null;
            }
            $centavos = intdiv($units * $centavosPerThousandCoins, 1_000_000);
            $pesoBalance = $centavos / 100;

            $threshold = $this->getThresholdForMethod($lockedUser->payment_method);
            if ($pesoBalance < $threshold) {
                return null;
            }

            // Reserve/deduct balance atomically
            $grossAmount = number_format($pesoBalance, 2, '.', '');
            $unitsToDeduct = intdiv($centavos * 1_000_000 + $centavosPerThousandCoins - 1, $centavosPerThousandCoins);
            $coinsToDeduct = CoinAmount::format($unitsToDeduct);

            $lockedUser->readerCoins = CoinAmount::format($units - $unitsToDeduct);
            $lockedUser->save();

            $platformFee = (float) config('moneypad.withdrawals.platform_fee', 3.0);
            $isBank = $lockedUser->payment_method === 'Bank Transfer';
            $bankFee = $isBank ? (float) config('moneypad.withdrawals.bank_processing_fee', 10.0) : 0.0;
            $feeWaived = false;

            $netAmount = max(0, (float) $grossAmount - ($feeWaived ? 0.0 : $platformFee) - $bankFee);

            $schedule = $this->calculateSchedule();

            $accountSnapshot = [
                'payment_method' => $lockedUser->payment_method,
                'payment_account_name' => $lockedUser->payment_account_name,
                'payment_account_info' => $lockedUser->payment_account_info,
                'bank_name' => $lockedUser->bank_name,
                'username' => $lockedUser->username,
                'email' => $lockedUser->email,
                'captured_at' => $schedule['triggered_at']->toIso8601String(),
            ];

            $req = WithdrawalRequest::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'amount' => $grossAmount,
                'gross_amount' => $grossAmount,
                'net_amount' => number_format($netAmount, 2, '.', ''),
                'coins_deducted' => number_format($coinsToDeduct, 3, '.', ''),
                'source' => 'READER',
                'payment_method' => $lockedUser->payment_method,
                'payment_account_info' => $lockedUser->payment_account_info,
                'bank_name' => $lockedUser->bank_name,
                'account_snapshot' => $accountSnapshot,
                'platform_fee' => number_format($platformFee, 2, '.', ''),
                'bank_fee' => number_format($bankFee, 2, '.', ''),
                'ads_watched_count' => 0,
                'fee_waived' => $feeWaived,
                'status' => WithdrawalStatus::PendingAdChoice->value,
                'triggered_at' => $schedule['triggered_at'],
                'earliest_review_at' => $schedule['earliest_review_at'],
                'estimated_deadline_at' => $schedule['estimated_deadline_at'],
            ]);

            $msg = SystemMessage::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'type' => 'withdrawal_eligible',
                'title' => 'Automatic Payout Processing',
                'content' => 'You reached the minimum balance. Choose whether to complete tasks or accept the platform fee before this payout is sent for review.',
                'action_type' => 'watch_ads_prompt',
                'action_payload' => ['withdrawal_request_id' => $req->id],
                'is_pinned' => true,
                'withdrawal_request_id' => $req->id,
            ]);

            $req->update(['system_message_id' => $msg->id]);

            Notification::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'type' => 'WITHDRAWAL_AUTO_TRIGGERED',
                'actorId' => 'system',
                'actorName' => 'System',
                'content' => 'Your automatic payout of ₱'.$grossAmount.' is waiting for your fee preference.',
                'timestamp' => (int) (now()->valueOf()),
                'is_pinned' => true,
            ]);

            return $req->fresh();
        }, 3);

        $authorWithdrawal = $this->evaluateAuthorBalance($user);

        return $readerWithdrawal ?? $authorWithdrawal;
    }

    private function evaluateAuthorBalance(User $user): ?WithdrawalRequest
    {
        return DB::transaction(function () use ($user): ?WithdrawalRequest {
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->first();
            if (! $lockedUser || ! $this->hasCompletePayoutDetails($lockedUser)) {
                return null;
            }

            $hasActive = WithdrawalRequest::query()
                ->where('userId', $lockedUser->id)
                ->where('source', 'AUTHOR')
                ->whereIn('status', [
                    WithdrawalStatus::Eligible->value,
                    WithdrawalStatus::PendingAdChoice->value,
                    WithdrawalStatus::WatchingAds->value,
                    WithdrawalStatus::PendingReview->value,
                    WithdrawalStatus::Approved->value,
                ])
                ->exists();

            if ($hasActive) {
                return null;
            }

            $authorMinimum = $lockedUser->isVerified
                ? (float) config('moneypad.author_earnings.verified_minimum_php', 10.0)
                : (float) config('moneypad.author_earnings.standard_minimum_php', 40.0);
            $threshold = max($authorMinimum, $this->getThresholdForMethod($lockedUser->payment_method));
            $grossCentavos = (int) floor(((float) $lockedUser->authorIncome + 0.000001) * 100);
            $grossAmount = $grossCentavos / 100;

            if ($grossAmount < $threshold) {
                return null;
            }

            $gross = number_format($grossAmount, 2, '.', '');
            $lockedUser->authorIncome = number_format(
                max(0, (float) $lockedUser->authorIncome - $grossAmount),
                4,
                '.',
                '',
            );
            $lockedUser->save();

            $platformFee = (float) config('moneypad.withdrawals.platform_fee', 3.0);
            $bankFee = $lockedUser->payment_method === 'Bank Transfer'
                ? (float) config('moneypad.withdrawals.bank_processing_fee', 10.0)
                : 0.0;
            $netAmount = max(0, $grossAmount - $platformFee - $bankFee);
            $schedule = $this->calculateSchedule();
            $accountSnapshot = [
                'payment_method' => $lockedUser->payment_method,
                'payment_account_name' => $lockedUser->payment_account_name,
                'payment_account_info' => $lockedUser->payment_account_info,
                'bank_name' => $lockedUser->bank_name,
                'username' => $lockedUser->username,
                'email' => $lockedUser->email,
                'captured_at' => $schedule['triggered_at']->toIso8601String(),
            ];

            $withdrawal = WithdrawalRequest::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'amount' => $gross,
                'gross_amount' => $gross,
                'net_amount' => number_format($netAmount, 2, '.', ''),
                'coins_deducted' => null,
                'source' => 'AUTHOR',
                'payment_method' => $lockedUser->payment_method,
                'payment_account_info' => $lockedUser->payment_account_info,
                'bank_name' => $lockedUser->bank_name,
                'account_snapshot' => $accountSnapshot,
                'platform_fee' => number_format($platformFee, 2, '.', ''),
                'bank_fee' => number_format($bankFee, 2, '.', ''),
                'ads_watched_count' => 0,
                'fee_waived' => false,
                'status' => WithdrawalStatus::PendingAdChoice->value,
                'triggered_at' => $schedule['triggered_at'],
                'earliest_review_at' => $schedule['earliest_review_at'],
                'estimated_deadline_at' => $schedule['estimated_deadline_at'],
            ]);

            $message = SystemMessage::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'type' => 'withdrawal_eligible',
                'title' => 'Automatic Author Payout',
                'content' => 'Your author income reached its minimum. Choose whether to complete tasks or accept the platform fee before this payout is sent for review.',
                'action_type' => 'watch_ads_prompt',
                'action_payload' => ['withdrawal_request_id' => $withdrawal->id],
                'is_pinned' => true,
                'withdrawal_request_id' => $withdrawal->id,
            ]);

            $withdrawal->update(['system_message_id' => $message->id]);

            Notification::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'type' => 'WITHDRAWAL_AUTO_TRIGGERED',
                'actorId' => 'system',
                'actorName' => 'System',
                'content' => 'Your automatic author payout of ₱'.$gross.' is waiting for your fee preference.',
                'timestamp' => (int) now()->valueOf(),
                'is_pinned' => true,
            ]);

            return $withdrawal->fresh();
        }, 3);
    }

    /**
     * Record progress on the fee-waiver tasks.
     *
     * @return array<string, mixed>
     */
    public function recordWaiverTask(WithdrawalRequest $req, User $user, string $eventId): array
    {
        return DB::transaction(function () use ($req, $user, $eventId) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $req = WithdrawalRequest::whereKey($req->id)->lockForUpdate()->firstOrFail();
            if ($req->userId !== $user->id) {
                throw ValidationException::withMessages(['user' => 'Unauthorized']);
            }

            $statusStr = $req->status instanceof WithdrawalStatus ? $req->status->value : (string) $req->status;
            if (! in_array($statusStr, [
                WithdrawalStatus::PendingAdChoice->value,
                WithdrawalStatus::WatchingAds->value,
            ], true)) {
                throw ValidationException::withMessages(['status' => 'Fee waiver is no longer editable for this withdrawal.']);
            }

            if (app(RewardedAdService::class)->withdrawalCooldown($user, $req->id) > 0) {
                throw ValidationException::withMessages(['ad_event_id' => 'Please wait before completing the next ad.']);
            }

            if (app(RewardedAdService::class)->consume($user, $eventId, 'withdrawal', $req->id)) {
                $req->increment('ads_watched_count');
            }
            $target = (int) config('moneypad.withdrawals.ads_to_waive_fee', 10);

            if ($req->ads_watched_count >= $target) {
                $req->fee_waived = true;
                $gross = (float) ($req->gross_amount ?? $req->amount);
                $bankFee = (float) $req->bank_fee;
                $req->net_amount = number_format(max(0, $gross - $bankFee), 2, '.', '');
                $req->status = WithdrawalStatus::PendingReview->value;
            } else {
                $req->status = WithdrawalStatus::WatchingAds->value;
            }

            $req->save();

            return [
                'success' => true,
                'count' => $req->ads_watched_count,
                'fee_waived' => (bool) $req->fee_waived,
                'net_amount' => $req->net_amount,
                'status' => $req->status instanceof WithdrawalStatus ? $req->status->value : (string) $req->status,
                'cooldown_remaining' => (int) config('moneypad.withdrawals.ad_cooldown_seconds', 3),
            ];
        }, 3);
    }

    /**
     * Skip fee waiver tasks and accept platform fee.
     *
     * @return array<string, mixed>
     */
    public function skipWaiverTask(WithdrawalRequest $req, User $user): array
    {
        if ($req->userId !== $user->id) {
            throw ValidationException::withMessages(['user' => 'Unauthorized']);
        }

        $status = $req->status instanceof WithdrawalStatus ? $req->status->value : (string) $req->status;
        if (! in_array($status, [WithdrawalStatus::PendingAdChoice->value, WithdrawalStatus::WatchingAds->value], true)) {
            throw ValidationException::withMessages(['status' => 'The fee preference can no longer be changed.']);
        }

        $gross = (float) ($req->gross_amount ?? $req->amount);
        $platformFee = (float) $req->platform_fee;
        $bankFee = (float) $req->bank_fee;

        $req->update([
            'fee_waived' => false,
            'net_amount' => number_format(max(0, $gross - $platformFee - $bankFee), 2, '.', ''),
            'status' => WithdrawalStatus::PendingReview->value,
        ]);

        return [
            'success' => true,
            'fee_waived' => false,
            'net_amount' => $req->net_amount,
            'status' => WithdrawalStatus::PendingReview->value,
        ];
    }

    /**
     * Approve a pending withdrawal.
     */
    public function approve(WithdrawalRequest $withdrawal): void
    {
        DB::transaction(function () use ($withdrawal) {
            $locked = WithdrawalRequest::whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();

            $statusStr = $locked->status instanceof WithdrawalStatus ? $locked->status->value : (string) $locked->status;
            if ($statusStr !== WithdrawalStatus::PendingReview->value) {
                throw ValidationException::withMessages(['status' => 'Withdrawal cannot be approved from its current status.']);
            }

            $locked->update([
                'status' => WithdrawalStatus::Approved->value,
                'reviewed_at' => now(),
            ]);

            $user = User::findOrFail($locked->userId);

            // Handle referral bonus
            if ($user->referrer_id && ! $user->has_received_first_withdrawal) {
                $inviter = User::find($user->referrer_id);
                if ($inviter) {
                    $bonus = (float) config('moneypad.rewards.referral_bonus', 1000.0);
                    $inviter->increment('readerCoins', $bonus);
                    $inviter->increment('totalReaderCoins', $bonus);
                }
                $user->update(['has_received_first_withdrawal' => true]);
            }

            $this->createAuthorCommissionIfEligible($locked, $user);

            if ($locked->system_message_id) {
                SystemMessage::where('id', $locked->system_message_id)->update(['is_pinned' => false]);
            }

            Notification::create([
                'id' => (string) Str::uuid(),
                'userId' => $locked->userId,
                'type' => 'WITHDRAWAL_APPROVED',
                'actorId' => 'system',
                'actorName' => 'System',
                'content' => 'Your withdrawal of ₱'.$locked->amount.' (Net: ₱'.($locked->net_amount ?? $locked->amount).') to '.$locked->payment_method.' was approved.',
                'timestamp' => (int) (now()->valueOf()),
                'is_pinned' => true,
            ]);
        });
    }

    /**
     * Mark a withdrawal as completed with optional payout reference.
     */
    public function complete(WithdrawalRequest $withdrawal, ?string $payoutReference = null): void
    {
        DB::transaction(function () use ($withdrawal, $payoutReference) {
            $locked = WithdrawalRequest::whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();

            $statusStr = $locked->status instanceof WithdrawalStatus ? $locked->status->value : (string) $locked->status;
            if ($statusStr !== WithdrawalStatus::Approved->value) {
                throw ValidationException::withMessages(['status' => 'Withdrawal cannot be completed from its current status.']);
            }

            $user = User::findOrFail($locked->userId);
            if ($user->referrer_id && ! $user->has_received_first_withdrawal) {
                $inviter = User::find($user->referrer_id);
                if ($inviter) {
                    $bonus = (float) config('moneypad.rewards.referral_bonus', 1000.0);
                    $inviter->increment('readerCoins', $bonus);
                    $inviter->increment('totalReaderCoins', $bonus);
                }
                $user->update(['has_received_first_withdrawal' => true]);
            }

            $this->createAuthorCommissionIfEligible($locked, $user);

            $locked->update([
                'status' => WithdrawalStatus::Completed->value,
                'reviewed_at' => $locked->reviewed_at ?? now(),
                'completed_at' => now(),
                'payout_reference' => $payoutReference,
            ]);

            if ($locked->system_message_id) {
                SystemMessage::where('id', $locked->system_message_id)->update(['is_pinned' => false]);
            }

            Notification::create([
                'id' => (string) Str::uuid(),
                'userId' => $locked->userId,
                'type' => 'WITHDRAWAL_COMPLETED',
                'actorId' => 'system',
                'actorName' => 'System',
                'content' => 'Your payout of ₱'.($locked->net_amount ?? $locked->amount).' has been sent to your '.$locked->payment_method.($payoutReference ? ' (Ref: '.$payoutReference.')' : '').'.',
                'timestamp' => (int) (now()->valueOf()),
                'is_pinned' => true,
            ]);
        });
    }

    /**
     * Reject a withdrawal, refunding the reserved balance to the user.
     */
    public function reject(WithdrawalRequest $withdrawal, string $reason): void
    {
        DB::transaction(function () use ($withdrawal, $reason) {
            $locked = WithdrawalRequest::whereKey($withdrawal->id)->lockForUpdate()->firstOrFail();

            $statusStr = $locked->status instanceof WithdrawalStatus ? $locked->status->value : (string) $locked->status;
            if (in_array($statusStr, [WithdrawalStatus::Completed->value, WithdrawalStatus::Rejected->value], true)) {
                throw ValidationException::withMessages(['status' => 'Cannot reject a finalized withdrawal.']);
            }

            $user = User::whereKey($locked->userId)->lockForUpdate()->firstOrFail();
            if ($locked->source === 'AUTHOR') {
                $user->authorIncome = number_format(
                    (float) $user->authorIncome + (float) $locked->amount,
                    4,
                    '.',
                    '',
                );
                $restoredBalance = 'author income';
            } else {
                $coinToPhpRate = (float) config('moneypad.conversion.coins_to_cash_ratio', 0.01);
                $coinsToRefund = $locked->coins_deducted !== null
                    ? (float) $locked->coins_deducted
                    : ((float) $locked->amount / $coinToPhpRate);
                $user->readerCoins = CoinAmount::add($user->readerCoins, $coinsToRefund);
                $restoredBalance = 'reader coins';
            }
            $user->save();

            $locked->update([
                'status' => WithdrawalStatus::Rejected->value,
                'rejection_reason' => $reason,
                'reviewed_at' => now(),
            ]);

            // Cancel any pending author commissions for this rejected withdrawal
            AuthorReferralCommission::where('withdrawal_request_id', $locked->id)
                ->where('status', '!=', 'claimed')
                ->update(['status' => 'cancelled']);

            if ($locked->system_message_id) {
                SystemMessage::where('id', $locked->system_message_id)->update(['is_pinned' => false]);
            }

            Notification::create([
                'id' => (string) Str::uuid(),
                'userId' => $locked->userId,
                'type' => 'WITHDRAWAL_REJECTED',
                'actorId' => 'system',
                'actorName' => 'System',
                'content' => 'Your withdrawal of ₱'.$locked->amount.' was rejected: '.$reason.'. The balance has been restored to your '.$restoredBalance.'.',
                'timestamp' => (int) (now()->valueOf()),
                'is_pinned' => true,
            ]);
        });
    }

    public static function calculateRequiredAdsForCommission(float $withdrawalAmount): int
    {
        $tiers = config('moneypad.author_commission.ad_tiers', [
            ['max' => 10, 'ads' => 1],
            ['max' => 25, 'ads' => 2],
            ['max' => 50, 'ads' => 3],
            ['max' => 100, 'ads' => 4],
            ['max' => PHP_FLOAT_MAX, 'ads' => 5],
        ]);

        foreach ($tiers as $tier) {
            if ($withdrawalAmount <= $tier['max']) {
                return (int) $tier['ads'];
            }
        }

        return 5;
    }

    protected function createAuthorCommissionIfEligible(WithdrawalRequest $locked, User $user): void
    {
        if (! $user->referrer_id) {
            return;
        }

        $referrer = User::find($user->referrer_id);
        if (! $referrer) {
            return;
        }

        $isAuthor = $locked->source === 'AUTHOR'
            || $user->isVerified
            || Story::where('authorId', $user->id)->exists()
            || in_array($user->role, ['author', 'admin'], true);

        if (! $isAuthor) {
            return;
        }

        $existing = AuthorReferralCommission::where('withdrawal_request_id', $locked->id)->first();
        if ($existing) {
            return;
        }

        $amount = (float) $locked->amount;
        $commissionRate = (float) config('moneypad.author_commission.rate', 0.05);
        $commissionAmount = round($amount * $commissionRate, 2);
        if ($commissionAmount <= 0) {
            return;
        }
        $requiredAds = static::calculateRequiredAdsForCommission($amount);

        AuthorReferralCommission::create([
            'id' => (string) Str::uuid(),
            'referrer_id' => $referrer->id,
            'author_id' => $user->id,
            'withdrawal_request_id' => $locked->id,
            'withdrawal_amount' => $amount,
            'commission_amount' => $commissionAmount,
            'required_ads' => $requiredAds,
            'ads_watched' => 0,
            'status' => 'pending',
        ]);

        Notification::create([
            'id' => (string) Str::uuid(),
            'userId' => $referrer->id,
            'type' => 'AUTHOR_COMMISSION_AVAILABLE',
            'actorId' => $user->id,
            'actorName' => $user->username,
            'actorProfileImageUrl' => $user->profileImageUrl,
            'isActorVerified' => $user->isVerified,
            'content' => "You have a pending ₱{$commissionAmount} commission from {$user->username}'s withdrawal! Watch {$requiredAds} ad(s) to claim it.",
            'timestamp' => (int) (now()->valueOf()),
        ]);
    }
}
