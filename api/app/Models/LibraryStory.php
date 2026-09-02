<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LibraryStory extends Model
{
    use HasFactory;

    protected $table = 'library_stories';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'userId', 'storyId', 'downloadedAt',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function story()
    {
        return $this->belongsTo(Story::class, 'storyId', 'id');
    }
}
