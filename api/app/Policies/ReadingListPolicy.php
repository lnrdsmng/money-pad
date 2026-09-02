<?php

namespace App\Policies;

use App\Models\ReadingList;
use App\Models\User;

class ReadingListPolicy
{
    public function update(User $user, ReadingList $readingList): bool
    {
        return $user->id === $readingList->userId;
    }

    public function delete(User $user, ReadingList $readingList): bool
    {
        return $user->id === $readingList->userId;
    }
}
