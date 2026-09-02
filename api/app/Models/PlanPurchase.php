<?php

namespace App\Models;

use App\PlanPurchaseStatus;
use App\PlanType;
use Database\Factories\PlanPurchaseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlanPurchase extends Model
{
    /** @use HasFactory<PlanPurchaseFactory> */
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'userId',
        'plan_type',
        'amount',
        'currency',
        'provider',
        'provider_checkout_id',
        'reference_number',
        'status',
        'checkout_url',
        'paid_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'plan_type' => PlanType::class,
            'amount' => 'decimal:2',
            'status' => PlanPurchaseStatus::class,
            'paid_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }
}
