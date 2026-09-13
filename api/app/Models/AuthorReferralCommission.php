<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuthorReferralCommission extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'referrer_id',
        'author_id',
        'withdrawal_request_id',
        'withdrawal_amount',
        'commission_amount',
        'required_ads',
        'ads_watched',
        'status',
        'claimed_at',
    ];

    protected function casts(): array
    {
        return [
            'withdrawal_amount' => 'decimal:2',
            'commission_amount' => 'decimal:2',
            'required_ads' => 'integer',
            'ads_watched' => 'integer',
            'claimed_at' => 'datetime',
        ];
    }

    public function referrer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'referrer_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function withdrawalRequest(): BelongsTo
    {
        return $this->belongsTo(WithdrawalRequest::class, 'withdrawal_request_id');
    }
}
