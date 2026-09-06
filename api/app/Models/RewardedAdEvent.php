<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RewardedAdEvent extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'user_id', 'purpose', 'target_id', 'provider', 'zone_id', 'expires_at', 'verified_at', 'consumed_at'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'verified_at' => 'datetime', 'consumed_at' => 'datetime'];
    }
}
