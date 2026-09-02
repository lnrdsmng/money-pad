<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('payment_method_settings', function (Blueprint $table) {
            $table->string('id', 32)->primary();
            $table->string('label', 50);
            $table->string('account_name', 100);
            $table->string('account_identifier', 150);
            $table->text('instructions')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $now = now();
        DB::table('payment_method_settings')->insert([
            [
                'id' => 'gcash',
                'label' => 'GCash',
                'account_name' => 'MoneyPad Payments',
                'account_identifier' => '09171234567',
                'instructions' => 'Send the exact plan amount and keep the payment reference.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'paymaya',
                'label' => 'Maya',
                'account_name' => 'MoneyPad Payments',
                'account_identifier' => '09181234567',
                'instructions' => 'Send the exact plan amount and keep the payment reference.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'id' => 'paypal',
                'label' => 'PayPal',
                'account_name' => 'MoneyPad Payments',
                'account_identifier' => 'payments@moneypad.ph',
                'instructions' => 'Send the exact plan amount in PHP and keep the transaction ID.',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payment_method_settings');
    }
};
