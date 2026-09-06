<?php

namespace App\Models;

use App\Services\ChapterHtmlSanitizer;
use Illuminate\Database\Eloquent\Casts\Attribute;
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
        'readCount', 'headerImageUrl', 'revision',
    ];

    protected function content(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => app(ChapterHtmlSanitizer::class)->sanitize($value),
            set: fn ($value) => app(ChapterHtmlSanitizer::class)->sanitize($value),
        );
    }

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
