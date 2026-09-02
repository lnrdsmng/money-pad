<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'userId', 'type', 'actorId', 'actorName', 'actorProfileImageUrl',
        'storyId', 'storyTitle', 'partId', 'partTitle', 'content', 'timestamp',
        'isRead', 'isActorVerified', 'is_pinned',
    ];

    protected function casts(): array
    {
        return [
            'isRead' => 'boolean',
            'isActorVerified' => 'boolean',
            'is_pinned' => 'boolean',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
