<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\WithdrawalRequest;
use App\WithdrawalStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<WithdrawalRequest>
 */
class WithdrawalRequestFactory extends Factory
{
    protected $model = WithdrawalRequest::class;

    public function definition(): array
    {
        $amount = 10.00;
        $platformFee = 3.00;
        $bankFee = 0.00;
        $net = $amount - $platformFee - $bankFee;

        return [
            'id' => (string) Str::uuid(),
            'userId' => User::factory(),
            'amount' => number_format($amount, 2, '.', ''),
            'gross_amount' => number_format($amount, 2, '.', ''),
            'net_amount' => number_format($net, 2, '.', ''),
            'coins_deducted' => '1000.000',
            'source' => 'READER',
            'payment_method' => 'GCash',
            'payment_account_info' => '09171234567',
            'bank_name' => null,
            'account_snapshot' => [
                'payment_method' => 'GCash',
                'payment_account_info' => '09171234567',
                'bank_name' => null,
            ],
            'platform_fee' => number_format($platformFee, 2, '.', ''),
            'bank_fee' => number_format($bankFee, 2, '.', ''),
            'ads_watched_count' => 0,
            'fee_waived' => false,
            'status' => WithdrawalStatus::PendingReview->value,
            'triggered_at' => now('Asia/Manila'),
            'earliest_review_at' => now('Asia/Manila'),
            'estimated_deadline_at' => now('Asia/Manila')->addDays(7),
        ];
    }

    public function bank(): static
    {
        return $this->state(fn () => [
            'payment_method' => 'Bank Transfer',
            'payment_account_info' => '1234567890',
            'bank_name' => 'BDO',
            'amount' => '20.00',
            'gross_amount' => '20.00',
            'bank_fee' => '10.00',
            'net_amount' => '7.00',
            'coins_deducted' => '2000.000',
            'account_snapshot' => [
                'payment_method' => 'Bank Transfer',
                'payment_account_info' => '1234567890',
                'bank_name' => 'BDO',
            ],
        ]);
    }

    public function feeWaived(): static
    {
        return $this->state(fn (array $attributes) => [
            'fee_waived' => true,
            'ads_watched_count' => 10,
            'net_amount' => number_format((float) $attributes['gross_amount'] - (float) $attributes['bank_fee'], 2, '.', ''),
        ]);
    }
}
