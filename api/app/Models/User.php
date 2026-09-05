<?php

namespace App\Models;

use App\PlanType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The "type" of the primary key ID.
     */
    protected $keyType = 'string';

    /**
     * Indicates if the IDs are auto-incrementing.
     */
    public $incrementing = false;

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($user) {
            if (empty($user->signupTimestamp)) {
                $user->signupTimestamp = ($user->created_at ? $user->created_at->timestamp : time()) * 1000;
            }
        });
    }

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'id',
        'username',
        'email',
        'password',
        'bio',
        'profileImageUrl',
        'coverImageUrl',
        'birthday',
        'gender',
        'preferredGenres',
        'signupTimestamp',
        'role',
        'plan',
        'payment_method',
        'payment_account_name',
        'payment_account_info',
        'bank_name',
        'onboardingStep',
        'onboardingCompleted',
        'isVerified',
        'balance',
        'authorIncome',
        'readerCoins',
        'totalReaderCoins',
        'followers',
        'following',
        'referredBy',
        'referralCount',
        'isReferralRewardClaimed',
        'has_received_first_withdrawal',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'isVerified' => 'boolean',
            'isReferralRewardClaimed' => 'boolean',
            'has_received_first_withdrawal' => 'boolean',
            'onboardingCompleted' => 'boolean',
            'isAdFreePermanently' => 'boolean',
            'plan' => PlanType::class,
            'readerCoins' => 'decimal:3',
            'totalReaderCoins' => 'decimal:3',
        ];
    }

    public function isAdmin()
    {
        return $this->role === 'admin';
    }

    public function earningRatePerMinute(): string
    {
        return $this->plan->ratePerMinute();
    }

    public function requiresClaimAd(): bool
    {
        return $this->plan->requiresClaimAd();
    }

    public function withdrawalRequests(): HasMany
    {
        return $this->hasMany(WithdrawalRequest::class, 'userId', 'id');
    }

    public function systemMessages(): HasMany
    {
        return $this->hasMany(SystemMessage::class, 'userId', 'id');
    }

    public function readingSessions(): HasMany
    {
        return $this->hasMany(ReadingSession::class, 'userId', 'id');
    }

    public function readingProgress(): HasMany
    {
        return $this->hasMany(UserReadingProgress::class, 'userId', 'id');
    }

    public function activePlan(): HasOne
    {
        return $this->hasOne(UserPlan::class, 'userId', 'id')->where('is_active', true);
    }

    public function readingRewards(): HasMany
    {
        return $this->hasMany(ReadingReward::class, 'userId', 'id');
    }

    public function readingRewardClaims(): HasMany
    {
        return $this->hasMany(ReadingRewardClaim::class, 'userId', 'id');
    }

    public function planPurchases(): HasMany
    {
        return $this->hasMany(PlanPurchase::class, 'userId', 'id');
    }

    public function newAccountRewardEnrollment(): HasOne
    {
        return $this->hasOne(NewAccountRewardEnrollment::class, 'userId', 'id');
    }

    public function dailyLoginRewardClaims(): HasMany
    {
        return $this->hasMany(DailyLoginRewardClaim::class, 'userId', 'id');
    }

    public function authorVerificationRequests(): HasMany
    {
        return $this->hasMany(AuthorVerificationRequest::class, 'user_id', 'id');
    }

    public function referralMilestoneClaims(): HasMany
    {
        return $this->hasMany(ReferralMilestoneClaim::class, 'referrer_id', 'id');
    }
}
