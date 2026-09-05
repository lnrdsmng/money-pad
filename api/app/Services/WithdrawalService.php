<?php

namespace App\Services;

use App\Models\Notification;
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
        return [
            'min_gcash_maya' => (float) config('moneypad.withdrawals.min_gcash_maya', 10.0),
            'min_bank' => (float) config('moneypad.withdrawals.min_bank', 20.0),
            'platform_fee' => (float) config('moneypad.withdrawals.platform_fee', 3.0),
            'bank_fee' => (float) config('moneypad.withdrawals.bank_processing_fee', 10.0),
            'ads_to_waive_fee' => (int) config('moneypad.withdrawals.ads_to_waive_fee', 10),
            'coin_to_php_rate' => (float) config('moneypad.conversion.coins_to_cash_ratio', 0.01),
            'timezone' => (string) config('moneypad.withdrawals.timezone', 'Asia/Manila'),
            'processing_days' => config('moneypad.withdrawals.processing_days', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
            'processing_days_label' => 'Monday–Saturday',
            'processing_turnaround_label' => '1–7 business days',
            'sunday_deferred' => true,
            'auto_withdrawal_description' => 'Withdrawals are processed automatically once you meet the minimum balance and configure complete payout details.',
        ];
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
        return DB::transaction(function () use ($user): ?WithdrawalRequest {
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->first();
            if (! $lockedUser) {
                return null;
            }

            // Must not have an active withdrawal
            $hasActive = WithdrawalRequest::query()
                ->where('userId', $lockedUser->id)
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
            $readerCoins = (float) $lockedUser->readerCoins;
            $pesoBalance = round($readerCoins * $coinToPhpRate, 2);

            $threshold = $this->getThresholdForMethod($lockedUser->payment_method);
            if ($pesoBalance < $threshold) {
                return null;
            }

            // Reserve/deduct balance atomically
            $grossAmount = number_format($pesoBalance, 2, '.', '');
            $coinsToDeduct = $grossAmount / $coinToPhpRate;

            $lockedUser->readerCoins = number_format(max(0, (float) $lockedUser->readerCoins - $coinsToDeduct), 3, '.', '');
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
                'status' => WithdrawalStatus::PendingReview->value,
                'triggered_at' => $schedule['triggered_at'],
                'earliest_review_at' => $schedule['earliest_review_at'],
                'estimated_deadline_at' => $schedule['estimated_deadline_at'],
            ]);

            $msg = SystemMessage::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'type' => 'withdrawal_eligible',
                'title' => 'Automatic Payout Processing',
                'content' => 'You reached the minimum balance! An automatic payout of ₱'.$grossAmount.' to '.$lockedUser->payment_method.' has been queued. Complete designated in-app tasks (10 ads) before review to waive the ₱'.number_format($platformFee, 2, '.', '').' platform fee.',
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
                'content' => 'Your automatic payout of ₱'.$grossAmount.' to '.$lockedUser->payment_method.' is pending review.',
                'timestamp' => (int) (now()->valueOf()),
                'is_pinned' => true,
            ]);

            return $req->fresh();
        }, 3);
    }

    /**
     * Record progress on the fee-waiver tasks.
     *
     * @return array<string, mixed>
     */
    public function recordWaiverTask(WithdrawalRequest $req, User $user): array
    {
        if ($req->userId !== $user->id) {
            throw ValidationException::withMessages(['user' => 'Unauthorized']);
        }

        $statusStr = $req->status instanceof WithdrawalStatus ? $req->status->value : (string) $req->status;
        if (! in_array($statusStr, [
            WithdrawalStatus::PendingReview->value,
            WithdrawalStatus::PendingAdChoice->value,
            WithdrawalStatus::WatchingAds->value,
            WithdrawalStatus::Eligible->value,
        ], true)) {
            throw ValidationException::withMessages(['status' => 'Fee waiver is no longer editable for this withdrawal.']);
        }

        $req->increment('ads_watched_count');
        $target = (int) config('moneypad.withdrawals.ads_to_waive_fee', 10);

        if ($req->ads_watched_count >= $target) {
            $req->fee_waived = true;
            $gross = (float) ($req->gross_amount ?? $req->amount);
            $bankFee = (float) $req->bank_fee;
            $req->net_amount = number_format(max(0, $gross - $bankFee), 2, '.', '');
        }

        $req->save();

        return [
            'success' => true,
            'count' => $req->ads_watched_count,
            'fee_waived' => (bool) $req->fee_waived,
            'net_amount' => $req->net_amount,
            'status' => $req->status instanceof WithdrawalStatus ? $req->status->value : (string) $req->status,
        ];
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
            if (! in_array($statusStr, [
                WithdrawalStatus::PendingReview->value,
                WithdrawalStatus::PendingAdChoice->value,
                WithdrawalStatus::WatchingAds->value,
                WithdrawalStatus::Eligible->value,
            ], true)) {
                throw ValidationException::withMessages(['status' => 'Withdrawal cannot be approved from its current status.']);
            }

            $locked->update([
                'status' => WithdrawalStatus::Approved->value,
                'reviewed_at' => now(),
            ]);

            $user = User::findOrFail($locked->userId);

            // Handle referral bonus
            if ($user->referredBy && ! $user->has_received_first_withdrawal) {
                $inviter = User::where('username', $user->referredBy)->first();
                if ($inviter) {
                    $bonus = (float) config('moneypad.rewards.referral_bonus', 1000.0);
                    $inviter->increment('readerCoins', $bonus);
                    $inviter->increment('totalReaderCoins', $bonus);
                }
                $user->update(['has_received_first_withdrawal' => true]);
            }

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
            if (! in_array($statusStr, [
                WithdrawalStatus::PendingReview->value,
                WithdrawalStatus::Approved->value,
                WithdrawalStatus::PendingAdChoice->value,
                WithdrawalStatus::WatchingAds->value,
                WithdrawalStatus::Eligible->value,
            ], true)) {
                throw ValidationException::withMessages(['status' => 'Withdrawal cannot be completed from its current status.']);
            }

            $user = User::findOrFail($locked->userId);
            if ($user->referredBy && ! $user->has_received_first_withdrawal) {
                $inviter = User::where('username', $user->referredBy)->first();
                if ($inviter) {
                    $bonus = (float) config('moneypad.rewards.referral_bonus', 1000.0);
                    $inviter->increment('readerCoins', $bonus);
                    $inviter->increment('totalReaderCoins', $bonus);
                }
                $user->update(['has_received_first_withdrawal' => true]);
            }

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

            // Refund reserved coins
            $user = User::whereKey($locked->userId)->lockForUpdate()->firstOrFail();
            $coinToPhpRate = (float) config('moneypad.conversion.coins_to_cash_ratio', 0.01);
            $coinsToRefund = $locked->coins_deducted !== null
                ? (float) $locked->coins_deducted
                : ((float) $locked->amount / $coinToPhpRate);

            $user->readerCoins = number_format((float) $user->readerCoins + $coinsToRefund, 3, '.', '');
            $user->save();

            $locked->update([
                'status' => WithdrawalStatus::Rejected->value,
                'rejection_reason' => $reason,
                'reviewed_at' => now(),
            ]);

            if ($locked->system_message_id) {
                SystemMessage::where('id', $locked->system_message_id)->update(['is_pinned' => false]);
            }

            Notification::create([
                'id' => (string) Str::uuid(),
                'userId' => $locked->userId,
                'type' => 'WITHDRAWAL_REJECTED',
                'actorId' => 'system',
                'actorName' => 'System',
                'content' => 'Your withdrawal of ₱'.$locked->amount.' was rejected: '.$reason.'. The balance has been restored to your reader coins.',
                'timestamp' => (int) (now()->valueOf()),
                'is_pinned' => true,
            ]);
        });
    }
}
