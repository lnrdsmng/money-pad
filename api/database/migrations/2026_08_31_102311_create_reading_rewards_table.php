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
        Schema::create('reading_rewards', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->string('reading_session_id', 50);
            $table->string('storyId', 50);
            $table->string('partId', 50);
            $table->string('claim_id', 50)->nullable();
            $table->unsignedInteger('minute_index');
            $table->string('plan_type', 32);
            $table->decimal('rate_per_minute', 14, 3);
            $table->decimal('amount', 14, 3);
            $table->string('status', 20)->default('pending');
            $table->timestamp('earned_at');
            $table->timestamp('expires_at');
            $table->timestamp('claimed_at')->nullable();
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('reading_session_id')->references('id')->on('reading_sessions')->cascadeOnDelete();
            $table->foreign('storyId')->references('id')->on('stories')->cascadeOnDelete();
            $table->foreign('partId')->references('id')->on('story_parts')->cascadeOnDelete();
            $table->unique(['reading_session_id', 'minute_index']);
            $table->index(['userId', 'status', 'expires_at']);
            $table->index(['userId', 'claimed_at']);
            $table->index('claim_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reading_rewards');
    }
};
