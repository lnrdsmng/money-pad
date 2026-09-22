<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AccountTerminationService
{
    public function terminate(User $user, User $admin, string $reason): User
    {
        if ($user->isAdmin()) {
            throw ValidationException::withMessages([
                'user' => 'Administrator accounts cannot be terminated.',
            ]);
        }

        return DB::transaction(function () use ($user, $admin, $reason): User {
            $lockedUser = User::query()->lockForUpdate()->findOrFail($user->id);
            $lockedUser->forceFill([
                'terminated_at' => now(),
                'terminated_by' => $admin->id,
                'termination_reason' => $reason,
                'restored_at' => null,
                'restored_by' => null,
            ])->save();
            $lockedUser->tokens()->delete();
            DB::table('sessions')->where('user_id', $lockedUser->id)->delete();

            return $lockedUser->refresh();
        }, 3);
    }

    public function restore(User $user, User $admin): User
    {
        if ($user->isAdmin()) {
            throw ValidationException::withMessages([
                'user' => 'Administrator accounts cannot be restored through user management.',
            ]);
        }

        $user->forceFill([
            'terminated_at' => null,
            'restored_at' => now(),
            'restored_by' => $admin->id,
        ])->save();

        return $user->refresh();
    }
}
