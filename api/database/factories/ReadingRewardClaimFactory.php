<?php

namespace Database\Factories;

use App\Models\ReadingRewardClaim;
use App\Models\User;
use App\ReadingRewardClaimStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ReadingRewardClaim>
 */
class ReadingRewardClaimFactory extends Factory
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
            'userId' => User::factory(),
            'amount' => '0.010',
            'reward_count' => 1,
            'status' => ReadingRewardClaimStatus::AwaitingAd,
            'ad_required' => true,
            'ad_provider' => 'mock',
        ];
    }
}
