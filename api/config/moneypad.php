<?php

return [
    'currency' => 'PHP',
    'symbol' => '₱',
    'conversion' => ['coins_to_cash_ratio' => (float) env('COIN_TO_PHP_RATE', 0.01)],
    'rewards' => [
        'ad_watch_coins' => 100.0,
        'referral_bonus' => 1000.0,
        'new_account_timezone' => 'Asia/Manila',
        'new_account_daily_coins' => [1, 2, 2, 3, 4, 5, 8],
    ],
    'fees' => [
        'verification_fee' => 149.0,
        'ad_free_permanent_fee' => 1499.0,
    ],
    'withdrawals' => [
        'min_gcash_maya' => (float) env('WITHDRAWAL_MIN_GCASH_MAYA', 10.0),
        'min_bank' => (float) env('WITHDRAWAL_MIN_BANK', 20.0),
        'platform_fee' => (float) env('WITHDRAWAL_PLATFORM_FEE', 3.0),
        'bank_processing_fee' => (float) env('WITHDRAWAL_BANK_FEE', 10.0),
        'ads_to_waive_fee' => (int) env('WITHDRAWAL_ADS_TO_WAIVE_FEE', 10),
        'timezone' => env('WITHDRAWAL_TIMEZONE', 'Asia/Manila'),
        'processing_days' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        'turnaround_business_days_min' => 1,
        'turnaround_business_days_max' => 7,
        'auto_trigger_enabled' => (bool) env('WITHDRAWAL_AUTO_TRIGGER_ENABLED', true),
    ],
    'reading' => [
        'idle_timeout_seconds' => 120,
        'heartbeat_interval_seconds' => 60,
        'maximum_heartbeat_seconds' => 180,
        'reward_expiration_hours' => 24,
        'claimed_history_days' => 30,
    ],
    'plans' => [
        'free' => [
            'name' => 'Free',
            'price' => '0.00',
            'rate_per_minute' => '1.000',
            'multiplier' => '1.0',
            'ads' => true,
        ],
        'standard' => [
            'name' => 'Standard',
            'price' => '85.00',
            'rate_per_minute' => '2.500',
            'multiplier' => '2.5',
            'ads' => true,
        ],
        'mega_premium' => [
            'name' => 'Mega Premium',
            'price' => '199.00',
            'rate_per_minute' => '4.500',
            'multiplier' => '4.5',
            'ads' => true,
        ],
        'ultimate_premium' => [
            'name' => 'Ultimate Premium',
            'price' => '449.00',
            'rate_per_minute' => '6.000',
            'multiplier' => '6.0',
            'ads' => false,
        ],
        'author_verification' => [
            'name' => 'Author Verification',
            'price' => '149.00',
            'rate_per_minute' => '0.000',
            'multiplier' => '1.0',
            'ads' => false,
        ],
    ],
    'payments' => [
        'proof_retention_days' => 180,
    ],
    'rewarded_ads' => [
        'provider' => env('REWARDED_AD_PROVIDER', 'mock'),
        'mock_enabled' => env('REWARDED_AD_MOCK_ENABLED', true),
    ],
];
