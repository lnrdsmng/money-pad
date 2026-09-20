<?php

$usesDevelopmentAds = in_array(env('APP_ENV', 'production'), ['local', 'testing'], true);

return [
    'frontend_url' => env('FRONTEND_URL', env('APP_URL', 'http://localhost:5173')),
    'referral_milestones' => [
        1 => ['tier' => 1, 'chapters' => 5, 'ads' => 2, 'coins' => 5],
        2 => ['tier' => 2, 'chapters' => 15, 'ads' => 5, 'coins' => 10],
        3 => ['tier' => 3, 'chapters' => 25, 'ads' => 7, 'coins' => 20],
        4 => ['tier' => 4, 'chapters' => 40, 'ads' => 10, 'coins' => 35],
        5 => ['tier' => 5, 'chapters' => 80, 'ads' => 12, 'coins' => 60],
        6 => ['tier' => 6, 'chapters' => 110, 'ads' => 15, 'coins' => 70],
    ],

    'author_commission' => [
        'rate' => 0.05,
        'ad_tiers' => [
            ['max' => 10, 'ads' => 1],
            ['max' => 25, 'ads' => 2],
            ['max' => 50, 'ads' => 3],
            ['max' => 100, 'ads' => 4],
            ['max' => PHP_FLOAT_MAX, 'ads' => 5],
        ],
    ],

    'author_earnings' => [
        'views_per_batch' => 50,
        'verified_usd_per_batch' => 0.10,
        'standard_usd_per_batch' => 0.05,
        'verified_minimum_php' => 10.0,
        'standard_minimum_php' => 40.0,
        'exchange' => [
            'url' => env('AUTHOR_EXCHANGE_RATE_URL', 'https://openexchangerates.org/api/latest.json'),
            'fallback_url' => env('AUTHOR_EXCHANGE_RATE_FALLBACK_URL', 'https://api.frankfurter.dev/v2/rate/usd/php'),
            'app_id' => env('OPEN_EXCHANGE_RATES_APP_ID'),
            'cache_seconds' => (int) env('AUTHOR_EXCHANGE_RATE_CACHE_SECONDS', 3600),
            'max_stale_seconds' => (int) env('AUTHOR_EXCHANGE_RATE_MAX_STALE_SECONDS', 86400),
        ],
    ],

    'currency' => 'PHP',
    'symbol' => '₱',
    'conversion' => ['coins_to_cash_ratio' => (float) env('COIN_TO_PHP_RATE', 0.01)],
    'rewards' => [
        'ad_watch_coins' => 2.0,
        'ad_watch_cooldown_seconds' => 60,
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
        'provider' => env('REWARDED_AD_PROVIDER', $usesDevelopmentAds ? 'mock' : 'monetag_website'),
        'mock_enabled' => env('REWARDED_AD_MOCK_ENABLED', $usesDevelopmentAds),
    ],
];
