<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PlanSetting extends Model
{
    use HasFactory;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'id',
        'name',
        'price',
        'rate_per_minute',
        'multiplier',
        'ads',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'rate_per_minute' => 'decimal:3',
            'multiplier' => 'decimal:2',
            'ads' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
