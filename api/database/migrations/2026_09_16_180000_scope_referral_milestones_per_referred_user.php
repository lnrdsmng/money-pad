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
        if (! Schema::hasTable('referral_milestone_progress')) {
            Schema::create('referral_milestone_progress', function (Blueprint $table) {
                $table->string('id', 50)->primary();
                $table->string('referrer_id', 50);
                $table->string('referred_user_id', 50);
                $table->integer('tier_index');
                $table->integer('chapters_read')->default(0);
                $table->integer('ads_watched')->default(0);
                $table->boolean('is_completed')->default(false);
                $table->timestamp('completed_at')->nullable();
                $table->timestamps();

                $table->foreign('referrer_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('referred_user_id')->references('id')->on('users')->onDelete('cascade');
                $table->unique(['referrer_id', 'referred_user_id', 'tier_index'], 'ref_milestone_progress_unique');
                $table->index(['referrer_id', 'referred_user_id']);
            });
        }

        Schema::table('referral_milestone_claims', function (Blueprint $table) {
            $table->index('referrer_id');
            $table->unique(['referrer_id', 'referred_user_id', 'tier_index'], 'ref_milestone_claims_user_tier_unique');
            $table->dropUnique(['referrer_id', 'tier_index']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('referral_milestone_claims', function (Blueprint $table) {
            $table->unique(['referrer_id', 'tier_index']);
            $table->dropUnique('ref_milestone_claims_user_tier_unique');
            $table->dropIndex(['referrer_id']);
        });

        Schema::dropIfExists('referral_milestone_progress');
    }
};
