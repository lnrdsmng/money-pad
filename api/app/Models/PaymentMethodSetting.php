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

    protected $appends = ['qr_image_url'];

    protected $fillable = [
        'id',
        'label',
        'account_name',
        'account_identifier',
        'instructions',
        'qr_image_path',
        'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function getQrImageUrlAttribute(): ?string
    {
        return $this->qr_image_path ? asset('storage/'.$this->qr_image_path) : null;
    }
}
