<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'authorId', 'senderId', 'senderName', 'message', 'senderProfileImageUrl',
        'timestamp', 'parentId', 'isSenderVerified', 'likes', 'isLiked',
    ];

    protected function casts(): array
    {
        return [
            'isSenderVerified' => 'boolean',
            'isLiked' => 'boolean',
            'likes' => 'integer',
        ];
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'authorId', 'id');
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'senderId', 'id');
    }

    public function replies()
    {
        return $this->hasMany(Conversation::class, 'parentId', 'id');
    }
}
