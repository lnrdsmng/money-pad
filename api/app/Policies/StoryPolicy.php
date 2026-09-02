<?php

namespace App\Policies;

use App\Models\Story;
use App\Models\User;

class StoryPolicy
{
    public function update(User $user, Story $story): bool
    {
        return $user->id === $story->authorId;
    }

    public function delete(User $user, Story $story): bool
    {
        return $user->id === $story->authorId;
    }
}
