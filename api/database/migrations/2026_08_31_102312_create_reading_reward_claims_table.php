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
        Schema::create('reading_reward_claims', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->decimal('amount', 14, 3)->default(0);
            $table->unsignedInteger('reward_count')->default(0);
            $table->string('status', 24)->default('awaiting_ad');
            $table->boolean('ad_required')->default(true);
            $table->string('ad_provider', 32)->nullable();
            $table->string('mock_token_hash', 64)->nullable();
            $table->timestamp('ad_verified_at')->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['userId', 'status']);
            $table->index(['userId', 'claimed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reading_reward_claims');
    }
};
