<?php

namespace App\Models;

use Database\Factories\DailyLoginRewardClaimFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DailyLoginRewardClaim extends Model
{
    /** @use HasFactory<DailyLoginRewardClaimFactory> */
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'enrollment_id',
        'userId',
        'day_number',
        'reward_date',
        'amount',
        'claimed_at',
    ];

    protected function casts(): array
    {
        return [
            'reward_date' => 'date',
            'amount' => 'decimal:3',
            'claimed_at' => 'datetime',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(NewAccountRewardEnrollment::class, 'enrollment_id', 'id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
