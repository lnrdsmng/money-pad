<?php

namespace Database\Seeders;

use App\Models\User;
use App\PlanType;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Normal User
        User::updateOrCreate(
            ['username' => 'user'],
            [
                'id' => Str::uuid()->toString(),
                'email' => 'user@moneypad.com',
                'password' => Hash::make('Password123!'),
                'bio' => 'Standard MoneyPad reader and author account.',
                'followers' => 12,
                'following' => 5,
                'balance' => 150.00,
                'authorIncome' => 75.00,
                'readerCoins' => 250.00,
                'totalReaderCoins' => 250.00,
                'birthday' => '1998-05-15',
                'gender' => 'Female',
                'preferredGenres' => 'Romance,Fantasy,Mystery',
                'signupTimestamp' => now()->timestamp * 1000,
                'onboardingStep' => 4,
                'onboardingCompleted' => true,
                'isVerified' => false,
                'role' => 'user',
                'plan' => PlanType::Free,
                'payment_method' => 'GCash',
                'payment_account_info' => '09171234567',
            ]
        );

        // 2. Admin User
        User::updateOrCreate(
            ['username' => 'admin'],
            [
                'id' => Str::uuid()->toString(),
                'email' => 'admin@moneypad.com',
                'password' => Hash::make('Password123!'),
                'bio' => 'MoneyPad Platform Administrator.',
                'followers' => 100,
                'following' => 10,
                'balance' => 1000.00,
                'authorIncome' => 500.00,
                'readerCoins' => 1000.00,
                'totalReaderCoins' => 1000.00,
                'birthday' => '1990-01-01',
                'gender' => 'Male',
                'preferredGenres' => 'Fantasy,Sci-Fi,Thriller',
                'signupTimestamp' => now()->timestamp * 1000,
                'onboardingStep' => 4,
                'onboardingCompleted' => true,
                'isVerified' => true,
                'role' => 'admin',
                'plan' => PlanType::MegaPremium,
                'payment_method' => 'Bank Transfer',
                'bank_name' => 'BDO',
                'payment_account_info' => '123456789012',
            ]
        );
    }
}
