<?php

namespace App\Models;

use Database\Factories\NewAccountRewardEnrollmentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NewAccountRewardEnrollment extends Model
{
    /** @use HasFactory<NewAccountRewardEnrollmentFactory> */
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = ['id', 'userId', 'starts_on', 'timezone', 'completed_at'];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'completed_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function claims(): HasMany
    {
        return $this->hasMany(DailyLoginRewardClaim::class, 'enrollment_id', 'id');
    }
}
