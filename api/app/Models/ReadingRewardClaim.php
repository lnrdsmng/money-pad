<?php

namespace App\Models;

use App\ReadingRewardClaimStatus;
use Database\Factories\ReadingRewardClaimFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReadingRewardClaim extends Model
{
    /** @use HasFactory<ReadingRewardClaimFactory> */
    use HasFactory, Prunable;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'userId',
        'amount',
        'reward_count',
        'status',
        'ad_required',
        'ad_provider',
        'mock_token_hash',
        'ad_verified_at',
        'claimed_at',
    ];

    protected $hidden = ['mock_token_hash'];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:3',
            'status' => ReadingRewardClaimStatus::class,
            'ad_required' => 'boolean',
            'ad_verified_at' => 'datetime',
            'claimed_at' => 'datetime',
        ];
    }

    public function prunable(): Builder
    {
        $retentionCutoff = now()->subDays((int) config('moneypad.reading.claimed_history_days'));

        return static::query()->where(function (Builder $query) use ($retentionCutoff): void {
            $query
                ->where(function (Builder $completed) use ($retentionCutoff): void {
                    $completed
                        ->where('status', ReadingRewardClaimStatus::Completed)
                        ->where('claimed_at', '<', $retentionCutoff);
                })
                ->orWhere(function (Builder $unfinished) use ($retentionCutoff): void {
                    $unfinished
                        ->whereIn('status', [
                            ReadingRewardClaimStatus::AwaitingAd->value,
                            ReadingRewardClaimStatus::Cancelled->value,
                        ])
                        ->where('updated_at', '<', $retentionCutoff);
                });
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function rewards(): HasMany
    {
        return $this->hasMany(ReadingReward::class, 'claim_id', 'id');
    }
}
