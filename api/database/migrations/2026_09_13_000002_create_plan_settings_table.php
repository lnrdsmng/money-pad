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
        Schema::create('plan_settings', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('name', 100);
            $table->decimal('price', 10, 2)->default(0.00);
            $table->decimal('rate_per_minute', 10, 3)->default(1.000);
            $table->decimal('multiplier', 8, 2)->default(1.00);
            $table->boolean('ads')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::table('plan_settings')->insert([
            [
                'id' => 'free',
                'name' => 'Free',
                'price' => 0.00,
                'rate_per_minute' => 1.000,
                'multiplier' => 1.00,
                'ads' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'standard',
                'name' => 'Standard',
                'price' => 85.00,
                'rate_per_minute' => 2.500,
                'multiplier' => 2.50,
                'ads' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'mega_premium',
                'name' => 'Mega Premium',
                'price' => 199.00,
                'rate_per_minute' => 4.500,
                'multiplier' => 4.50,
                'ads' => true,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'ultimate_premium',
                'name' => 'Ultimate Premium',
                'price' => 449.00,
                'rate_per_minute' => 6.000,
                'multiplier' => 6.00,
                'ads' => false,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plan_settings');
    }
};
