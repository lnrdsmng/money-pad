<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemBroadcastRecipient extends Model
{
    public $timestamps = false;

    protected $fillable = ['broadcast_id', 'user_id', 'delivered_at'];
}
