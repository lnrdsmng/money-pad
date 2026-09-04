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
        Schema::create('referral_milestone_claims', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('referrer_id', 50);
            $table->string('referred_user_id', 50)->nullable();
            $table->integer('tier_index');
            $table->decimal('coins_awarded', 12, 2)->default(0.00);
            $table->timestamps();

            $table->foreign('referrer_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('referred_user_id')->references('id')->on('users')->onDelete('set null');
            $table->unique(['referrer_id', 'tier_index']);
        });

        Schema::create('author_verification_requests', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('user_id', 50);
            $table->string('payment_method', 50);
            $table->string('payment_reference', 255)->nullable();
            $table->string('receipt_url', 255)->nullable();
            $table->string('status', 20)->default('pending');
            $table->text('rejection_reason')->nullable();
            $table->string('reviewed_by', 50)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('reviewed_by')->references('id')->on('users')->onDelete('set null');
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('author_verification_requests');
        Schema::dropIfExists('referral_milestone_claims');
    }
};
