<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReferralMilestoneClaim extends Model
{
    use HasFactory;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'referrer_id',
        'referred_user_id',
        'tier_index',
        'coins_awarded',
    ];

    protected function casts(): array
    {
        return [
            'tier_index' => 'integer',
            'coins_awarded' => 'decimal:2',
        ];
    }

    public function referrer()
    {
        return $this->belongsTo(User::class, 'referrer_id', 'id');
    }

    public function referredUser()
    {
        return $this->belongsTo(User::class, 'referred_user_id', 'id');
    }
}
