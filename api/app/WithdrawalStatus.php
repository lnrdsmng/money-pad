<?php

namespace App;

enum WithdrawalStatus: string
{
    case Eligible = 'eligible';
    case PendingAdChoice = 'pending_ad_choice';
    case WatchingAds = 'watching_ads';
    case PendingReview = 'pending_review';
    case Approved = 'approved';
    case Completed = 'completed';
    case Rejected = 'rejected';

    public function isPending(): bool
    {
        return in_array($this, [
            self::Eligible,
            self::PendingAdChoice,
            self::WatchingAds,
            self::PendingReview,
        ], true);
    }

    public function isActive(): bool
    {
        return in_array($this, [
            self::Eligible,
            self::PendingAdChoice,
            self::WatchingAds,
            self::PendingReview,
            self::Approved,
        ], true);
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Completed, self::Rejected], true);
    }
}
