<?php

namespace App\Services;

use App\Models\SystemMessage;
use App\Models\User;
use App\Models\UserPlan;
use App\PlanType;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PlanExpirationService
{
    public function synchronize(User $user): User
    {
        if ($user->plan === PlanType::Free) {
            return $user;
        }

        return DB::transaction(function () use ($user): User {
            $lockedUser = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $expiredPlan = UserPlan::query()
                ->where('userId', $lockedUser->id)
                ->where('is_active', true)
                ->whereNotNull('expires_at')
                ->where('expires_at', '<=', now())
                ->lockForUpdate()
                ->first();

            if ($expiredPlan === null) {
                return $lockedUser;
            }

            $expiredPlan->update(['is_active' => false]);
            $lockedUser->update(['plan' => PlanType::Free]);

            SystemMessage::create([
                'id' => (string) Str::uuid(),
                'userId' => $lockedUser->id,
                'type' => 'custom',
                'title' => 'Plan expired',
                'content' => 'Your monthly plan expired and your account returned to the Free plan.',
                'action_type' => 'info',
                'is_pinned' => true,
                'is_read' => false,
            ]);

            return $lockedUser->fresh();
        }, 3);
    }
}
