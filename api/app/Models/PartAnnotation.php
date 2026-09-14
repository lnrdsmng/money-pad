<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PartAnnotation extends Model
{
    protected $table = 'part_annotations';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'partId', 'userId', 'username', 'selectedText', 'startIndex', 'endIndex',
        'type', 'content', 'timestamp', 'isUserVerified', 'parentId',
    ];

    protected function casts(): array
    {
        return [
            'startIndex' => 'integer',
            'endIndex' => 'integer',
            'isUserVerified' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parentId', 'id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(self::class, 'parentId', 'id')->orderBy('timestamp');
    }

    public function reactions(): HasMany
    {
        return $this->hasMany(PartAnnotationReaction::class, 'annotationId', 'id');
    }
}
