<?php

namespace App\Services;

class CoinAmount
{
    /**
     * Create a new class instance.
     */
    public static function units(string|int|float $coins): int
    {
        return (int) round((float) $coins * 1000);
    }

    public static function format(int $units): string
    {
        $sign = $units < 0 ? '-' : '';
        $units = abs($units);

        return $sign.intdiv($units, 1000).'.'.str_pad((string) ($units % 1000), 3, '0', STR_PAD_LEFT);
    }

    public static function add(string|int|float $coins, string|int|float $amount): string
    {
        return self::format(self::units($coins) + self::units($amount));
    }
}
