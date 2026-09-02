<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class UserReadingProgress extends Model
{
    use HasFactory;

    protected $table = 'user_reading_progress';

    public $incrementing = false;

    // Composite PK won't work perfectly with Eloquent's save() by default without traits,
    // but we can use where() queries.
    protected $primaryKey = null;

    protected $fillable = [
        'userId', 'storyId', 'last_part_id', 'last_scroll_position',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function story()
    {
        return $this->belongsTo(Story::class, 'storyId', 'id');
    }

    public function storyPart()
    {
        return $this->belongsTo(StoryPart::class, 'last_part_id', 'id');
    }
}
