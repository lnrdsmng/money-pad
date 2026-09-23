<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OfferwallCredit extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'stage_id', 'submission_id', 'user_id', 'amount'];
}
