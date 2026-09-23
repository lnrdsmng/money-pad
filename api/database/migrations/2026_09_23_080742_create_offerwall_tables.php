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
        Schema::create('offerwalls', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name', 150);
            $table->string('description', 500);
            $table->string('download_url', 2048);
            $table->string('image_path');
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();
        });

        Schema::create('offerwall_stages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('offerwall_id')->constrained('offerwalls')->cascadeOnDelete();
            $table->unsignedSmallInteger('position');
            $table->string('name', 150);
            $table->decimal('reward_coins', 14, 3);
            $table->unique(['offerwall_id', 'position']);
        });

        Schema::create('offerwall_participations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('offerwall_id')->constrained('offerwalls')->cascadeOnDelete();
            $table->string('user_id', 50);
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['offerwall_id', 'user_id']);
        });

        Schema::create('offerwall_submissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('stage_id')->constrained('offerwall_stages')->cascadeOnDelete();
            $table->string('user_id', 50);
            $table->string('proof_path');
            $table->string('status')->default('pending');
            $table->string('reviewed_by', 50)->nullable();
            $table->text('rejection_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['stage_id', 'user_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('offerwall_credits', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('stage_id')->constrained('offerwall_stages')->cascadeOnDelete();
            $table->foreignUuid('submission_id')->constrained('offerwall_submissions')->cascadeOnDelete();
            $table->string('user_id', 50);
            $table->decimal('amount', 14, 3);
            $table->timestamps();
            $table->unique(['stage_id', 'user_id']);
            $table->unique('submission_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('offerwall_credits');
        Schema::dropIfExists('offerwall_submissions');
        Schema::dropIfExists('offerwall_participations');
        Schema::dropIfExists('offerwall_stages');
        Schema::dropIfExists('offerwalls');
    }
};
