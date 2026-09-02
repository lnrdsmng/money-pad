<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class UserReadPart extends Pivot
{
    protected $table = 'user_read_parts';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['userId', 'partId', 'storyId', 'readAt'];
}
