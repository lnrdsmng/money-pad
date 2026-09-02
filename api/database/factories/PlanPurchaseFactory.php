<?php

namespace Database\Factories;

use App\Models\PlanPurchase;
use App\Models\User;
use App\PlanPurchaseStatus;
use App\PlanType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PlanPurchase>
 */
class PlanPurchaseFactory extends Factory
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
            'plan_type' => PlanType::Standard,
            'amount' => '85.00',
            'currency' => 'PHP',
            'provider' => 'manual',
            'payment_method' => 'gcash',
            'reference_number' => 'MP-'.Str::upper(Str::random(16)),
            'payment_reference' => Str::upper(Str::random(12)),
            'payment_proof_path' => 'proofs/'.Str::uuid().'.png',
            'status' => PlanPurchaseStatus::PendingReview,
            'submitted_at' => now(),
        ];
    }
}
