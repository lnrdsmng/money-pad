<?php

namespace App\Services;

use App\Models\PlanPurchase;
use App\Models\SystemMessage;
use App\Models\User;
use App\Models\UserPlan;
use App\PlanPurchaseStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PlanPurchaseReviewService
{
    public function approve(PlanPurchase $purchase, User $admin): PlanPurchase
    {
        return DB::transaction(function () use ($purchase, $admin): PlanPurchase {
            $lockedPurchase = PlanPurchase::query()->whereKey($purchase->id)->lockForUpdate()->firstOrFail();

            if ($lockedPurchase->status === PlanPurchaseStatus::Approved) {
                return $lockedPurchase;
            }

            if ($lockedPurchase->status !== PlanPurchaseStatus::PendingReview) {
                throw ValidationException::withMessages([
                    'purchase' => 'Only pending payments can be approved.',
                ]);
            }

            $user = User::query()->whereKey($lockedPurchase->userId)->lockForUpdate()->firstOrFail();
            $currentPlan = UserPlan::query()
                ->where('userId', $user->id)
                ->where('is_active', true)
                ->lockForUpdate()
                ->first();
            $now = now();
            $expiresAt = $now->copy()->addMonthsNoOverflow($lockedPurchase->plan_type->durationMonths());

            if ($currentPlan?->plan_type === $lockedPurchase->plan_type
                && $currentPlan->expires_at?->isAfter($now)) {
                $expiresAt = $currentPlan->expires_at->copy()
                    ->addMonthsNoOverflow($lockedPurchase->plan_type->durationMonths());
            }

            UserPlan::query()
                ->where('userId', $user->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            UserPlan::create([
                'id' => (string) Str::uuid(),
                'userId' => $user->id,
                'plan_type' => $lockedPurchase->plan_type,
                'multiplier' => config("moneypad.plans.{$lockedPurchase->plan_type->value}.multiplier"),
                'started_at' => $now,
                'expires_at' => $expiresAt,
                'is_active' => true,
            ]);

            $user->update(['plan' => $lockedPurchase->plan_type]);
            $lockedPurchase->update([
                'status' => PlanPurchaseStatus::Approved,
                'paid_at' => $now,
                'reviewed_by' => $admin->id,
                'reviewed_at' => $now,
                'rejection_reason' => null,
            ]);

            PlanPurchase::query()
                ->where('userId', $user->id)
                ->whereKeyNot($lockedPurchase->id)
                ->where('status', PlanPurchaseStatus::PendingReview)
                ->update([
                    'status' => PlanPurchaseStatus::Cancelled,
                    'reviewed_by' => $admin->id,
                    'reviewed_at' => $now,
                    'rejection_reason' => 'Superseded by an approved payment.',
                ]);

            SystemMessage::create([
                'id' => (string) Str::uuid(),
                'userId' => $user->id,
                'type' => 'custom',
                'title' => 'Plan activated',
                'content' => config("moneypad.plans.{$lockedPurchase->plan_type->value}.name")
                    .' is active until '.$expiresAt->format('F j, Y').'.',
                'action_type' => 'info',
                'is_pinned' => true,
                'is_read' => false,
            ]);

            return $lockedPurchase->fresh(['user', 'reviewer']);
        }, 3);
    }

    public function reject(PlanPurchase $purchase, User $admin, string $reason): PlanPurchase
    {
        return DB::transaction(function () use ($purchase, $admin, $reason): PlanPurchase {
            $lockedPurchase = PlanPurchase::query()->whereKey($purchase->id)->lockForUpdate()->firstOrFail();

            if ($lockedPurchase->status !== PlanPurchaseStatus::PendingReview) {
                throw ValidationException::withMessages([
                    'purchase' => 'Only pending payments can be rejected.',
                ]);
            }

            $lockedPurchase->update([
                'status' => PlanPurchaseStatus::Rejected,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
                'rejection_reason' => $reason,
            ]);

            SystemMessage::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedPurchase->userId,
                'type' => 'custom',
                'title' => 'Plan payment needs attention',
                'content' => 'Your payment was rejected: '.$reason,
                'action_type' => 'info',
                'is_pinned' => true,
                'is_read' => false,
            ]);

            return $lockedPurchase->fresh(['user', 'reviewer']);
        }, 3);
    }
}
