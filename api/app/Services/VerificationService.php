<?php

namespace App\Services;

use App\Models\AuthorVerificationRequest;
use App\Models\Notification;
use App\Models\PlanPurchase;
use App\Models\Story;
use App\Models\User;
use App\PlanPurchaseStatus;
use App\PlanType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VerificationService
{
    public function payFromBalance(User $user): User
    {
        return DB::transaction(function () use ($user) {
            $user = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $fee = (float) config('moneypad.fees.verification_fee');
            if ($user->isVerified || (float) $user->authorIncome < $fee) {
                throw ValidationException::withMessages(['payment_method' => 'Verification is already complete or the balance is insufficient.']);
            }
            $user->authorIncome = (float) $user->authorIncome - $fee;
            $user->isVerified = true;
            $user->save();

            Story::where('authorId', $user->id)->update(['isAuthorVerified' => true]);

            $ref = 'BAL-'.strtoupper(Str::random(10));

            PlanPurchase::create([
                'id' => (string) Str::uuid(),
                'userId' => $user->id,
                'plan_type' => PlanType::AuthorVerification,
                'amount' => $fee,
                'currency' => config('moneypad.currency', 'PHP'),
                'provider' => 'author_income',
                'payment_method' => 'author_income',
                'reference_number' => 'MP-VERIF-'.strtoupper(Str::random(16)),
                'payment_reference' => $ref,
                'status' => PlanPurchaseStatus::Approved,
                'submitted_at' => now(),
                'paid_at' => now(),
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);

            AuthorVerificationRequest::create([
                'id' => Str::uuid()->toString(),
                'user_id' => $user->id,
                'payment_method' => 'author_income',
                'payment_reference' => $ref,
                'status' => 'approved',
                'reviewed_at' => now(),
                'reviewed_by' => $user->id,
            ]);

            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $user->id,
                'type' => 'VERIFIED',
                'actorId' => $user->id,
                'actorName' => 'System',
                'content' => 'Congratulations! Your author profile is now verified.',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => true,
            ]);

            return $user->fresh();
        }, 3);

    }
}
