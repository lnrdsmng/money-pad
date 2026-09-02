<?php

namespace App\Models;

use App\WithdrawalStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WithdrawalRequest extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'userId',
        'amount',
        'gross_amount',
        'net_amount',
        'coins_deducted',
        'source',
        'payment_method',
        'payment_account_info',
        'bank_name',
        'account_snapshot',
        'platform_fee',
        'bank_fee',
        'ads_watched_count',
        'fee_waived',
        'status',
        'system_message_id',
        'triggered_at',
        'earliest_review_at',
        'estimated_deadline_at',
        'reviewed_at',
        'completed_at',
        'rejection_reason',
        'payout_reference',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'gross_amount' => 'decimal:2',
            'net_amount' => 'decimal:2',
            'coins_deducted' => 'decimal:3',
            'platform_fee' => 'decimal:2',
            'bank_fee' => 'decimal:2',
            'ads_watched_count' => 'integer',
            'fee_waived' => 'boolean',
            'account_snapshot' => 'array',
            'status' => WithdrawalStatus::class,
            'triggered_at' => 'datetime',
            'earliest_review_at' => 'datetime',
            'estimated_deadline_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function systemMessage()
    {
        return $this->belongsTo(SystemMessage::class, 'system_message_id', 'id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', [
            WithdrawalStatus::Eligible->value,
            WithdrawalStatus::PendingAdChoice->value,
            WithdrawalStatus::WatchingAds->value,
            WithdrawalStatus::PendingReview->value,
            WithdrawalStatus::Approved->value,
        ]);
    }

    public function scopePendingReview(Builder $query): Builder
    {
        return $query->whereIn('status', [
            WithdrawalStatus::PendingReview->value,
            WithdrawalStatus::PendingAdChoice->value,
            WithdrawalStatus::WatchingAds->value,
            WithdrawalStatus::Eligible->value,
        ]);
    }

    public function scopeApproved(Builder $query): Builder
    {
        return $query->where('status', WithdrawalStatus::Approved->value);
    }

    public function scopeCompleted(Builder $query): Builder
    {
        return $query->where('status', WithdrawalStatus::Completed->value);
    }
}
