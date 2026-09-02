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
            $table->string('provider', 32)->default('manual')->change();
            $table->string('payment_method', 32)->nullable()->after('provider');
            $table->string('payment_reference', 150)->nullable()->after('reference_number');
            $table->string('payment_proof_path')->nullable()->after('payment_reference');
            $table->timestamp('submitted_at')->nullable()->after('payment_proof_path');
            $table->string('reviewed_by', 50)->nullable()->after('paid_at');
            $table->timestamp('reviewed_at')->nullable()->after('reviewed_by');
            $table->text('rejection_reason')->nullable()->after('reviewed_at');

            $table->foreign('reviewed_by')->references('id')->on('users')->nullOnDelete();
            $table->index(['status', 'submitted_at']);
            $table->unique(['payment_method', 'payment_reference']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('plan_purchases', function (Blueprint $table) {
            $table->dropForeign(['reviewed_by']);
            $table->dropIndex(['status', 'submitted_at']);
            $table->dropUnique(['payment_method', 'payment_reference']);
            $table->dropColumn([
                'payment_method',
                'payment_reference',
                'payment_proof_path',
                'submitted_at',
                'reviewed_by',
                'reviewed_at',
                'rejection_reason',
            ]);
            $table->string('provider', 32)->default('paymongo')->change();
        });
    }
};
