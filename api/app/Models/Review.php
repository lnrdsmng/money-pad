<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Review extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'storyId', 'userId', 'username', 'userProfileImageUrl', 'rating',
        'comment', 'timestamp', 'isUserVerified',
    ];

    protected function casts(): array
    {
        return [
            'isUserVerified' => 'boolean',
            'rating' => 'integer',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function story()
    {
        return $this->belongsTo(Story::class, 'storyId', 'id');
    }
}
