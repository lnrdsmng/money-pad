<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfferwallParticipation extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'offerwall_id', 'user_id', 'completed_at'];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }
}
