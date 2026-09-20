<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $now = now();

        DB::table('payment_method_settings')->upsert([
            [
                'id' => 'coins-ph',
                'label' => 'Coins.ph',
                'account_name' => 'MoneyPad Demo Payments',
                'account_identifier' => '09170000001',
                'instructions' => 'Demo destination: send the exact amount and keep the last 4 digits of the reference.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'gotyme-bank',
                'label' => 'GoTyme Bank',
                'account_name' => 'MoneyPad Demo Payments',
                'account_identifier' => '100000000001',
                'instructions' => 'Demo destination: send the exact amount and keep the last 4 digits of the reference.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'maribank',
                'label' => 'MariBank',
                'account_name' => 'MoneyPad Demo Payments',
                'account_identifier' => '100000000002',
                'instructions' => 'Demo destination: send the exact amount and keep the last 4 digits of the reference.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'bpi',
                'label' => 'BPI',
                'account_name' => 'MoneyPad Demo Payments',
                'account_identifier' => '100000000003',
                'instructions' => 'Demo destination: send the exact amount and keep the last 4 digits of the reference.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ], ['id'], ['label', 'account_name', 'account_identifier', 'instructions', 'is_active', 'updated_at']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('payment_method_settings')
            ->whereIn('id', ['coins-ph', 'gotyme-bank', 'maribank', 'bpi'])
            ->delete();
    }
};
