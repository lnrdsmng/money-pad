<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfferwallStage extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'offerwall_id', 'position', 'name', 'reward_coins'];

    public function offerwall(): BelongsTo
    {
        return $this->belongsTo(Offerwall::class);
    }
}
