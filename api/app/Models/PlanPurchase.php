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
        'payment_method',
        'provider_checkout_id',
        'reference_number',
        'payment_reference',
        'payment_proof_path',
        'status',
        'checkout_url',
        'submitted_at',
        'paid_at',
        'reviewed_by',
        'reviewed_at',
        'rejection_reason',
        'failure_reason',
    ];

    protected $hidden = ['payment_proof_path'];

    protected function casts(): array
    {
        return [
            'plan_type' => PlanType::class,
            'amount' => 'decimal:2',
            'status' => PlanPurchaseStatus::class,
            'submitted_at' => 'datetime',
            'paid_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'id');
    }
}
