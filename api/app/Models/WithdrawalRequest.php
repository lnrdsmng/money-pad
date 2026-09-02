<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WithdrawalRequest extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id', 'userId', 'amount', 'source', 'payment_method', 'payment_account_info',
        'bank_name', 'platform_fee', 'bank_fee', 'ads_watched_count', 'fee_waived',
        'status', 'system_message_id', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'fee_waived' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'userId', 'id');
    }

    public function systemMessage()
    {
        return $this->belongsTo(SystemMessage::class, 'system_message_id', 'id');
    }
}
