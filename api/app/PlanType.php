<?php

namespace App;

enum PlanType: string
{
    case Free = 'free';
    case Standard = 'standard';
    case MegaPremium = 'mega_premium';
    case UltimatePremium = 'ultimate_premium';
    case AuthorVerification = 'author_verification';

    public function ratePerMinute(): string
    {
        return (string) config("moneypad.plans.{$this->value}.rate_per_minute", '0.000');
    }

    public function price(): string
    {
        return (string) config("moneypad.plans.{$this->value}.price", '149.00');
    }

    public function requiresClaimAd(): bool
    {
        return (bool) config("moneypad.plans.{$this->value}.ads", false);
    }

    public function durationMonths(): int
    {
        return in_array($this, [self::Free, self::AuthorVerification], true) ? 0 : 1;
    }
}
