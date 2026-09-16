<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReferralMilestoneProgress extends Model
{
    use HasFactory;

    protected $table = 'referral_milestone_progress';

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'referrer_id',
        'referred_user_id',
        'tier_index',
        'chapters_read',
        'ads_watched',
        'is_completed',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'tier_index' => 'integer',
            'chapters_read' => 'integer',
            'ads_watched' => 'integer',
            'is_completed' => 'boolean',
            'completed_at' => 'datetime',
        ];
    }

    public function referrer()
    {
        return $this->belongsTo(User::class, 'referrer_id', 'id');
    }

    public function referredUser()
    {
        return $this->belongsTo(User::class, 'referred_user_id', 'id');
    }
}
