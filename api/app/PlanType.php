<?php

namespace App;

enum PlanType: string
{
    case Free = 'free';
    case Standard = 'standard';
    case MegaPremium = 'mega_premium';
    case UltimatePremium = 'ultimate_premium';

    public function ratePerMinute(): string
    {
        return (string) config("moneypad.plans.{$this->value}.rate_per_minute");
    }

    public function price(): string
    {
        return (string) config("moneypad.plans.{$this->value}.price");
    }

    public function requiresClaimAd(): bool
    {
        return (bool) config("moneypad.plans.{$this->value}.ads", true);
    }
}
