<?php

namespace App\Services;

use App\Models\OfferwallCredit;
use App\Models\OfferwallParticipation;
use App\Models\OfferwallSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OfferwallReviewService
{
    public function __construct(private readonly WithdrawalService $withdrawals) {}

    public function approve(OfferwallSubmission $submission, User $admin): OfferwallSubmission
    {
        return DB::transaction(function () use ($submission, $admin): OfferwallSubmission {
            $locked = OfferwallSubmission::whereKey($submission->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === 'approved') {
                return $locked;
            }
            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages(['submission' => 'Only pending proofs can be approved.']);
            }

            $stage = $locked->stage;
            $user = User::whereKey($locked->user_id)->lockForUpdate()->firstOrFail();
            $approvedCount = OfferwallCredit::where('user_id', $user->id)
                ->whereIn('stage_id', $stage->offerwall->stages()->pluck('id'))->count();
            if ($stage->position !== $approvedCount + 1) {
                throw ValidationException::withMessages(['submission' => 'The previous stage must be approved first.']);
            }

            OfferwallCredit::create([
                'id' => (string) Str::uuid(),
                'stage_id' => $stage->id,
                'submission_id' => $locked->id,
                'user_id' => $user->id,
                'amount' => $stage->reward_coins,
            ]);
            $user->readerCoins = CoinAmount::add($user->readerCoins, $stage->reward_coins);
            $user->totalReaderCoins = CoinAmount::add($user->totalReaderCoins, $stage->reward_coins);
            $user->save();
            $locked->update([
                'status' => 'approved',
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);
            if ($approvedCount + 1 === $stage->offerwall->stages()->count()) {
                OfferwallParticipation::where('offerwall_id', $stage->offerwall_id)
                    ->where('user_id', $user->id)->update(['completed_at' => now()]);
            }
            $this->withdrawals->evaluateAndCreate($user);

            return $locked->fresh();
        }, 3);
    }

    public function reject(OfferwallSubmission $submission, User $admin, string $reason): OfferwallSubmission
    {
        return DB::transaction(function () use ($submission, $admin, $reason): OfferwallSubmission {
            $locked = OfferwallSubmission::whereKey($submission->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== 'pending') {
                throw ValidationException::withMessages(['submission' => 'Only pending proofs can be rejected.']);
            }
            $locked->update([
                'status' => 'rejected',
                'rejection_reason' => $reason,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
            ]);

            return $locked->fresh();
        }, 3);
    }
}
