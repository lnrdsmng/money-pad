<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class UserStoryLike extends Pivot
{
    protected $table = 'user_story_likes';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['userId', 'storyId'];
}
