<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class UserStoryLike extends Pivot
{
    protected $table = 'user_story_likes';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['userId', 'storyId'];

    /**
     * Set the keys for a save or delete query on this composite key model.
     *
     * @param  \Illuminate\Database\Eloquent\Builder  $query
     * @return \Illuminate\Database\Eloquent\Builder
     */
    protected function setKeysForSaveQuery($query)
    {
        return $query
            ->where('userId', $this->getAttribute('userId') ?? ($this->original['userId'] ?? null))
            ->where('storyId', $this->getAttribute('storyId') ?? ($this->original['storyId'] ?? null));
    }
}
