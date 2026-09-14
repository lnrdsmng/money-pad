<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartAnnotationReaction extends Model
{
    protected $table = 'part_annotation_reactions';

    public $timestamps = false;

    protected $fillable = [
        'annotationId', 'userId', 'createdAt',
    ];

    public function annotation(): BelongsTo
    {
        return $this->belongsTo(PartAnnotation::class, 'annotationId', 'id');
    }
}
