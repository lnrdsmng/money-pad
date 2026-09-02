<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReadingSession extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id', 'userId', 'storyId', 'partId', 'started_at', 'last_active_at', 'duration_seconds',
        'rewarded_minutes', 'coins_earned', 'is_active', 'ended_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'last_active_at' => 'datetime',
            'ended_at' => 'datetime',
            'coins_earned' => 'decimal:3',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class, 'storyId', 'id');
    }

    public function storyPart(): BelongsTo
    {
        return $this->belongsTo(StoryPart::class, 'partId', 'id');
    }

    public function rewards(): HasMany
    {
        return $this->hasMany(ReadingReward::class, 'reading_session_id', 'id');
    }
}
