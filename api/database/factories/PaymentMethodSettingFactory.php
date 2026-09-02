<?php

namespace Database\Factories;

use App\Models\PaymentMethodSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentMethodSetting>
 */
class PaymentMethodSettingFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => fake()->unique()->randomElement(['gcash', 'paymaya', 'paypal']),
            'label' => fake()->company(),
            'account_name' => fake()->name(),
            'account_identifier' => fake()->email(),
            'instructions' => fake()->sentence(),
            'is_active' => true,
        ];
    }
}
