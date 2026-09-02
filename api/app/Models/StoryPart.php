<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StoryPart extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'storyId', 'title', 'content', 'order', 'publishedAt', 'isPublished',
        'readCount', 'headerImageUrl',
    ];

    protected function casts(): array
    {
        return [
            'isPublished' => 'boolean',
            'order' => 'integer',
        ];
    }

    public function story()
    {
        return $this->belongsTo(Story::class, 'storyId', 'id');
    }
}
