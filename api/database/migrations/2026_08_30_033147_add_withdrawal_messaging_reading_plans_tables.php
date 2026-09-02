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
        Schema::table('users', function (Blueprint $table) {
            $table->enum('role', ['user', 'admin'])->default('user');
            $table->enum('plan', ['free', 'premium', 'pro'])->default('free');
            $table->string('payment_method', 50)->nullable();
            $table->string('payment_account_info', 255)->nullable();
            $table->string('bank_name', 100)->nullable();
            $table->boolean('has_received_first_withdrawal')->default(0);
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->boolean('is_pinned')->default(0);
        });

        Schema::create('system_messages', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->enum('type', ['withdrawal_eligible', 'announcement', 'custom']);
            $table->string('title', 255);
            $table->text('content');
            $table->enum('action_type', ['watch_ads_prompt', 'info', 'none']);
            $table->json('action_payload')->nullable();
            $table->boolean('is_pinned')->default(0);
            $table->boolean('is_read')->default(0);
            // $table->string('withdrawal_request_id', 50)->nullable(); // Add later after table is created
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('withdrawal_requests', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->decimal('amount', 12, 2);
            $table->enum('source', ['AUTHOR', 'READER']);
            $table->string('payment_method', 50);
            $table->string('payment_account_info', 255);
            $table->string('bank_name', 100)->nullable();
            $table->decimal('platform_fee', 8, 2)->default(5.00);
            $table->decimal('bank_fee', 8, 2)->default(0.00);
            $table->integer('ads_watched_count')->default(0);
            $table->boolean('fee_waived')->default(0);
            $table->enum('status', ['eligible', 'pending_ad_choice', 'watching_ads', 'pending_review', 'approved', 'completed', 'rejected']);
            $table->string('system_message_id', 50)->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('system_message_id')->references('id')->on('system_messages')->onDelete('set null');
        });

        Schema::table('system_messages', function (Blueprint $table) {
            $table->string('withdrawal_request_id', 50)->nullable();
            $table->foreign('withdrawal_request_id')->references('id')->on('withdrawal_requests')->onDelete('set null');
        });

        Schema::create('chat_messages', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->string('username', 50);
            $table->string('profile_image_url', 255)->nullable();
            $table->text('message');
            $table->boolean('is_system')->default(0);
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
        });

        Schema::create('reading_sessions', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->string('storyId', 50);
            $table->string('partId', 50);
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('last_active_at')->useCurrent();
            $table->integer('duration_seconds')->default(0);
            $table->decimal('coins_earned', 12, 2)->default(0.00);
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('storyId')->references('id')->on('stories')->onDelete('cascade');
            $table->foreign('partId')->references('id')->on('story_parts')->onDelete('cascade');
        });

        Schema::create('user_reading_progress', function (Blueprint $table) {
            $table->string('userId', 50);
            $table->string('storyId', 50);
            $table->string('last_part_id', 50);
            $table->float('last_scroll_position')->default(0.0);
            $table->timestamps();

            $table->primary(['userId', 'storyId']);
            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('storyId')->references('id')->on('stories')->onDelete('cascade');
            $table->foreign('last_part_id')->references('id')->on('story_parts')->onDelete('cascade');
        });

        Schema::create('user_plans', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->enum('plan_type', ['premium', 'pro']);
            $table->decimal('multiplier', 3, 1);
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('expires_at')->nullable();
            $table->boolean('is_active')->default(1);
            $table->string('receipt_url', 255)->nullable();
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_plans');
        Schema::dropIfExists('user_reading_progress');
        Schema::dropIfExists('reading_sessions');
        Schema::dropIfExists('chat_messages');

        Schema::table('system_messages', function (Blueprint $table) {
            $table->dropForeign(['withdrawal_request_id']);
        });

        Schema::dropIfExists('withdrawal_requests');
        Schema::dropIfExists('system_messages');

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn('is_pinned');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'plan', 'payment_method', 'payment_account_info', 'bank_name', 'has_received_first_withdrawal']);
        });
    }
};
