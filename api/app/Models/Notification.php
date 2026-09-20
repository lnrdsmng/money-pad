<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notification extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'userId', 'type', 'actorId', 'actorName', 'actorProfileImageUrl',
        'storyId', 'storyTitle', 'partId', 'partTitle', 'wallAuthorId',
        'conversationId', 'parentConversationId', 'content', 'timestamp',
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

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actorId', 'id');
    }

    public function wallAuthor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'wallAuthorId', 'id');
    }
}
