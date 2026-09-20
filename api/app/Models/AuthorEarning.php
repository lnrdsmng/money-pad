<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuthorEarning extends Model
{
    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'author_id',
        'milestone_views',
        'view_count',
        'verified_benefit',
        'usd_amount',
        'usd_php_rate',
        'php_amount',
        'earned_at',
    ];

    protected function casts(): array
    {
        return [
            'milestone_views' => 'integer',
            'view_count' => 'integer',
            'verified_benefit' => 'boolean',
            'usd_amount' => 'decimal:4',
            'usd_php_rate' => 'decimal:6',
            'php_amount' => 'decimal:4',
            'earned_at' => 'datetime',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
