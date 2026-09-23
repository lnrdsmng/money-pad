<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemBroadcast extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'title', 'content', 'status', 'recipient_count', 'delivered_count', 'failure_reason'];
}
