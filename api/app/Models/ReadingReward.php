<?php

namespace App\Models;

use App\PlanType;
use App\ReadingRewardStatus;
use Database\Factories\ReadingRewardFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReadingReward extends Model
{
    /** @use HasFactory<ReadingRewardFactory> */
    use HasFactory, Prunable;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'userId',
        'reading_session_id',
        'storyId',
        'partId',
        'claim_id',
        'minute_index',
        'plan_type',
        'rate_per_minute',
        'amount',
        'status',
        'earned_at',
        'expires_at',
        'claimed_at',
    ];

    protected function casts(): array
    {
        return [
            'plan_type' => PlanType::class,
            'rate_per_minute' => 'decimal:3',
            'amount' => 'decimal:3',
            'status' => ReadingRewardStatus::class,
            'earned_at' => 'datetime',
            'expires_at' => 'datetime',
            'claimed_at' => 'datetime',
        ];
    }

    public function prunable(): Builder
    {
        $retentionCutoff = now()->subDays((int) config('moneypad.reading.claimed_history_days'));

        return static::query()->where(function (Builder $query) use ($retentionCutoff): void {
            $query
                ->where(function (Builder $claimed) use ($retentionCutoff): void {
                    $claimed
                        ->where('status', ReadingRewardStatus::Claimed)
                        ->where('claimed_at', '<', $retentionCutoff);
                })
                ->orWhere(function (Builder $expired) use ($retentionCutoff): void {
                    $expired
                        ->whereIn('status', [
                            ReadingRewardStatus::Pending->value,
                            ReadingRewardStatus::Expired->value,
                        ])
                        ->where('expires_at', '<', $retentionCutoff);
                });
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function readingSession(): BelongsTo
    {
        return $this->belongsTo(ReadingSession::class, 'reading_session_id', 'id');
    }

    public function story(): BelongsTo
    {
        return $this->belongsTo(Story::class, 'storyId', 'id');
    }

    public function storyPart(): BelongsTo
    {
        return $this->belongsTo(StoryPart::class, 'partId', 'id');
    }

    public function claim(): BelongsTo
    {
        return $this->belongsTo(ReadingRewardClaim::class, 'claim_id', 'id');
    }
}
