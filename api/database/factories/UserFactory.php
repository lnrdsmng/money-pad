<?php

namespace Database\Factories;

use App\Models\User;
use App\PlanType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'username' => fake()->unique()->userName(),
            'email' => fake()->unique()->safeEmail(),
            'password' => static::$password ??= Hash::make('Password123!'),
            'bio' => fake()->sentence(),
            'followers' => 0,
            'following' => 0,
            'balance' => 0.0,
            'authorIncome' => 0.0,
            'readerCoins' => 0.00,
            'totalReaderCoins' => 0.00,
            'birthday' => '2000-01-01',
            'gender' => 'Other',
            'preferredGenres' => 'Fantasy,Sci-Fi',
            'signupTimestamp' => now()->timestamp * 1000,
            'onboardingStep' => 4,
            'onboardingCompleted' => true,
            'isVerified' => false,
            'role' => 'user',
            'plan' => PlanType::Free,
        ];
    }

    /**
     * Indicate that the user is an admin.
     */
    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'admin',
            'isVerified' => true,
            'plan' => PlanType::MegaPremium,
        ]);
    }

    public function onPlan(PlanType $plan): static
    {
        return $this->state(fn (array $attributes) => [
            'plan' => $plan,
        ]);
    }
}
