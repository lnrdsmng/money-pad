<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Story extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'authorId', 'authorName', 'title', 'overview', 'genres', 'language',
        'coverImageUrl', 'readCount', 'isPublished', 'isCompleted', 'isMature',
        'likes', 'commentsCount', 'uniqueViews', 'repeatedViews', 'lastUpdatedAt',
        'isAuthorVerified',
    ];

    protected function casts(): array
    {
        return [
            'isPublished' => 'boolean',
            'isCompleted' => 'boolean',
            'isMature' => 'boolean',
            'isAuthorVerified' => 'boolean',
        ];
    }

    public function author()
    {
        return $this->belongsTo(User::class, 'authorId', 'id');
    }

    public function parts()
    {
        return $this->hasMany(StoryPart::class, 'storyId', 'id')->orderBy('order');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class, 'storyId', 'id');
    }
}
