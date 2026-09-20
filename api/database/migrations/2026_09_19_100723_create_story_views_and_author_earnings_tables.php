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
        Schema::create('story_views', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('story_id', 50);
            $table->string('viewer_id', 50);
            $table->string('author_id', 50);
            $table->timestamp('viewed_at');
            $table->timestamps();

            $table->foreign('story_id')->references('id')->on('stories')->cascadeOnDelete();
            $table->foreign('viewer_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('author_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['story_id', 'viewer_id']);
            $table->index(['author_id', 'viewed_at']);
        });

        Schema::create('author_earnings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('author_id', 50);
            $table->unsignedBigInteger('milestone_views');
            $table->unsignedInteger('view_count')->default(50);
            $table->boolean('verified_benefit');
            $table->decimal('usd_amount', 8, 4);
            $table->decimal('usd_php_rate', 12, 6);
            $table->decimal('php_amount', 14, 4);
            $table->timestamp('earned_at');
            $table->timestamps();

            $table->foreign('author_id')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['author_id', 'milestone_views']);
            $table->index(['author_id', 'earned_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('author_earnings');
        Schema::dropIfExists('story_views');
    }
};
