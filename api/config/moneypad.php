<?php

return [
    'currency' => 'PHP',
    'symbol' => '₱',
    'conversion' => ['coins_to_cash_ratio' => 1.0],
    'rewards' => [
        'ad_watch_coins' => 1.0,
        'referral_bonus' => 10.0,
    ],
    'fees' => [
        'verification_fee' => 149.0,
        'ad_free_permanent_fee' => 1499.0,
    ],
    'withdrawals' => [
        'min_gcash_maya' => 10.0,
        'min_bank' => 50.0,
        'platform_fee' => 5.0,
        'bank_processing_fee' => 10.0,
        'ads_to_waive_fee' => 10,
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
            'rate_per_minute' => '0.010',
            'multiplier' => '1.0',
            'ads' => true,
        ],
        'standard' => [
            'name' => 'Standard',
            'price' => '85.00',
            'rate_per_minute' => '0.025',
            'multiplier' => '2.5',
            'ads' => true,
        ],
        'mega_premium' => [
            'name' => 'Mega Premium',
            'price' => '199.00',
            'rate_per_minute' => '0.045',
            'multiplier' => '4.5',
            'ads' => true,
        ],
        'ultimate_premium' => [
            'name' => 'Ultimate Premium',
            'price' => '449.00',
            'rate_per_minute' => '0.060',
            'multiplier' => '6.0',
            'ads' => false,
        ],
    ],
    'rewarded_ads' => [
        'provider' => env('REWARDED_AD_PROVIDER', 'mock'),
        'mock_enabled' => env('REWARDED_AD_MOCK_ENABLED', true),
    ],
];
