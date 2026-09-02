<?php

namespace Database\Factories;

use App\Models\NewAccountRewardEnrollment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<NewAccountRewardEnrollment>
 */
class NewAccountRewardEnrollmentFactory extends Factory
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
            'starts_on' => now('Asia/Manila')->toDateString(),
            'timezone' => 'Asia/Manila',
            'completed_at' => null,
        ];
    }
}
