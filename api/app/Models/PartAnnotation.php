<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PartAnnotation extends Model
{
    protected $table = 'part_annotations';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'id', 'partId', 'userId', 'username', 'selectedText', 'startIndex', 'endIndex',
        'type', 'content', 'timestamp', 'isUserVerified',
    ];

    protected function casts(): array
    {
        return [
            'startIndex' => 'integer',
            'endIndex' => 'integer',
            'isUserVerified' => 'boolean',
        ];
    }
}
