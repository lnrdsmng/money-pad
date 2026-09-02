<?php

namespace Database\Factories;

use App\Models\DailyLoginRewardClaim;
use App\Models\NewAccountRewardEnrollment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<DailyLoginRewardClaim>
 */
class DailyLoginRewardClaimFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'enrollment_id' => NewAccountRewardEnrollment::factory(),
            'userId' => User::factory(),
            'day_number' => 1,
            'reward_date' => now('Asia/Manila')->toDateString(),
            'amount' => '1.000',
            'claimed_at' => now(),
        ];
    }
}
