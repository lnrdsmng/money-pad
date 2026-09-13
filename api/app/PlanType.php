<?php

namespace App;

use App\Models\PlanSetting;

enum PlanType: string
{
    case Free = 'free';
    case Standard = 'standard';
    case MegaPremium = 'mega_premium';
    case UltimatePremium = 'ultimate_premium';
    case AuthorVerification = 'author_verification';

    public function ratePerMinute(): string
    {
        $setting = PlanSetting::find($this->value);
        if ($setting) {
            return number_format((float) $setting->rate_per_minute, 3, '.', '');
        }

        return (string) config("moneypad.plans.{$this->value}.rate_per_minute", '0.000');
    }

    public function price(): string
    {
        $setting = PlanSetting::find($this->value);
        if ($setting) {
            return number_format((float) $setting->price, 2, '.', '');
        }

        return (string) config("moneypad.plans.{$this->value}.price", '149.00');
    }

    public function requiresClaimAd(): bool
    {
        $setting = PlanSetting::find($this->value);
        if ($setting) {
            return (bool) $setting->ads;
        }

        return (bool) config("moneypad.plans.{$this->value}.ads", false);
    }

    public function durationMonths(): int
    {
        return 0;
    }
}
