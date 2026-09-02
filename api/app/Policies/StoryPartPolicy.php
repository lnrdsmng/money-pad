<?php

namespace App\Policies;

use App\Models\StoryPart;
use App\Models\User;

class StoryPartPolicy
{
    public function update(User $user, StoryPart $storyPart): bool
    {
        return $user->id === $storyPart->story->authorId;
    }

    public function delete(User $user, StoryPart $storyPart): bool
    {
        return $user->id === $storyPart->story->authorId;
    }
}
