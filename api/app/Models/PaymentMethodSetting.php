<?php

namespace App\Models;

use Database\Factories\PaymentMethodSettingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentMethodSetting extends Model
{
    /** @use HasFactory<PaymentMethodSettingFactory> */
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'label',
        'account_name',
        'account_identifier',
        'instructions',
        'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
