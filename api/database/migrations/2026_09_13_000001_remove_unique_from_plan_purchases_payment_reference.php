<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('plan_purchases', function (Blueprint $table) {
            $table->dropUnique(['payment_method', 'payment_reference']);
            $table->index('payment_reference');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plan_purchases', function (Blueprint $table) {
            $table->dropIndex(['payment_reference']);
            $table->unique(['payment_method', 'payment_reference']);
        });
    }
};
