<?php

namespace App\Services;

class PayoutAccount
{
    /**
     * Create a new class instance.
     */
    public static function normalize(?string $account): ?string
    {
        if ($account === null || trim($account) === '') {
            return null;
        }
        $digits = preg_replace('/\D+/', '', $account);
        if (strlen($digits) === 12 && str_starts_with($digits, '639')) {
            $digits = '0'.substr($digits, 2);
        } elseif (strlen($digits) === 10 && str_starts_with($digits, '9')) {
            $digits = '0'.$digits;
        }

        return $digits !== '' ? $digits : mb_strtolower(trim($account));
    }
}
