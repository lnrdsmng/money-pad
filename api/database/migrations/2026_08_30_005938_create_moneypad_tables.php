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
        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('username', 50)->unique();
            $table->string('email', 100)->unique();
            $table->string('password', 255)->default('');
            $table->text('bio')->nullable();
            $table->integer('followers')->default(0);
            $table->integer('following')->default(0);
            $table->string('profileImageUrl', 255)->nullable();
            $table->string('coverImageUrl', 255)->nullable();
            $table->double('balance')->default(0.0);
            $table->double('authorIncome')->default(0.0);
            $table->decimal('readerCoins', 12, 2)->default(0.00);
            $table->decimal('totalReaderCoins', 12, 2)->default(0.00);
            $table->string('birthday', 10)->default('');
            $table->string('gender', 20)->default('');
            $table->string('preferredGenres', 255)->default('');
            $table->string('referredBy', 50)->default('');
            $table->integer('referralCount')->default(0);
            $table->bigInteger('signupTimestamp')->default(0);
            $table->boolean('isReferralRewardClaimed')->default(0);
            $table->bigInteger('loginTimestamp')->default(0);
            $table->integer('onboardingStep')->default(1);
            $table->boolean('onboardingCompleted')->default(0);
            $table->boolean('isVerified')->default(0);
            $table->bigInteger('adFreeUntil')->default(0);
            $table->boolean('isAdFreePermanently')->default(0);
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('user_id', 50)->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('cache', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->mediumText('value');
            $table->integer('expiration');
        });

        Schema::create('cache_locks', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('owner');
            $table->integer('expiration');
        });

        Schema::create('jobs', function (Blueprint $table) {
            $table->id();
            $table->string('queue')->index();
            $table->longText('payload');
            $table->tinyInteger('attempts')->unsigned();
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });

        Schema::create('job_batches', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('name');
            $table->integer('total_jobs');
            $table->integer('pending_jobs');
            $table->integer('failed_jobs');
            $table->longText('failed_job_ids');
            $table->mediumText('options')->nullable();
            $table->integer('cancelled_at')->nullable();
            $table->integer('created_at');
            $table->integer('finished_at')->nullable();
        });

        Schema::create('failed_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestamp('failed_at')->useCurrent();
        });

        Schema::create('stories', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('authorId', 50);
            $table->string('authorName', 50);
            $table->string('title', 255);
            $table->text('overview');
            $table->string('genres', 255)->default('');
            $table->string('language', 10)->default('en');
            $table->string('coverImageUrl', 255)->nullable();
            $table->integer('readCount')->default(0);
            $table->boolean('isPublished')->default(0);
            $table->boolean('isCompleted')->default(0);
            $table->boolean('isMature')->default(0);
            $table->integer('likes')->default(0);
            $table->integer('commentsCount')->default(0);
            $table->integer('uniqueViews')->default(0);
            $table->integer('repeatedViews')->default(0);
            $table->bigInteger('lastUpdatedAt')->default(0);
            $table->boolean('isAuthorVerified')->default(0);

            $table->foreign('authorId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['isPublished', 'lastUpdatedAt']);
        });

        Schema::create('story_parts', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('storyId', 50);
            $table->string('title', 255);
            $table->mediumText('content');
            $table->integer('order');
            $table->bigInteger('publishedAt')->default(0);
            $table->boolean('isPublished')->default(0);
            $table->integer('readCount')->default(0);
            $table->string('headerImageUrl', 255)->nullable();

            $table->foreign('storyId')->references('id')->on('stories')->onDelete('cascade');
            $table->index(['storyId', 'order']);
            $table->index(['storyId', 'isPublished']);
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('authorId', 50);
            $table->string('senderId', 50);
            $table->string('senderName', 50);
            $table->text('message');
            $table->string('senderProfileImageUrl', 255)->nullable();
            $table->bigInteger('timestamp')->default(0);
            $table->string('parentId', 50)->nullable();
            $table->boolean('isSenderVerified')->default(0);
            $table->integer('likes')->default(0);
            $table->boolean('isLiked')->default(0);

            $table->foreign('authorId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['authorId', 'timestamp']);
            $table->index('parentId');
        });

        Schema::create('follows', function (Blueprint $table) {
            $table->string('followerId', 50);
            $table->string('followedId', 50);

            $table->primary(['followerId', 'followedId']);
            $table->foreign('followerId')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('followedId')->references('id')->on('users')->onDelete('cascade');
            $table->index('followedId');
        });

        Schema::create('user_read_parts', function (Blueprint $table) {
            $table->string('userId', 50);
            $table->string('partId', 50);
            $table->string('storyId', 50);
            $table->bigInteger('readAt')->default(0);

            $table->primary(['userId', 'partId']);
            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('partId')->references('id')->on('story_parts')->onDelete('cascade');
            $table->index(['userId', 'storyId']);
        });

        Schema::create('transactions', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->double('amount');
            $table->string('method', 50);
            $table->string('accountInfo', 255);
            $table->string('source', 20)->default('');
            $table->bigInteger('timestamp')->default(0);
            $table->string('status', 20)->default('Pending');

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['userId', 'timestamp']);
        });

        Schema::create('ad_watch_events', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->decimal('rewardCoins', 12, 2)->default(0.00);
            $table->bigInteger('watchedAt')->default(0);

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['userId', 'watchedAt']);
        });

        Schema::create('reviews', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('storyId', 50);
            $table->string('userId', 50);
            $table->string('username', 50);
            $table->string('userProfileImageUrl', 255)->nullable();
            $table->integer('rating');
            $table->text('comment');
            $table->bigInteger('timestamp')->default(0);
            $table->boolean('isUserVerified')->default(0);

            $table->foreign('storyId')->references('id')->on('stories')->onDelete('cascade');
            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['storyId', 'timestamp']);
        });

        Schema::create('user_story_likes', function (Blueprint $table) {
            $table->string('userId', 50);
            $table->string('storyId', 50);

            $table->primary(['userId', 'storyId']);
            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('storyId')->references('id')->on('stories')->onDelete('cascade');
        });

        Schema::create('part_annotations', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('partId', 50);
            $table->string('userId', 50);
            $table->string('username', 50);
            $table->text('selectedText');
            $table->integer('startIndex');
            $table->integer('endIndex');
            $table->string('type', 10);
            $table->text('content')->nullable();
            $table->bigInteger('timestamp')->default(0);
            $table->boolean('isUserVerified')->default(0);

            $table->foreign('partId')->references('id')->on('story_parts')->onDelete('cascade');
            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['partId', 'timestamp']);
        });

        Schema::create('library_stories', function (Blueprint $table) {
            $table->string('userId', 50);
            $table->string('storyId', 50);
            $table->bigInteger('downloadedAt')->default(0);

            $table->primary(['userId', 'storyId']);
            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('storyId')->references('id')->on('stories')->onDelete('cascade');
        });

        Schema::create('reading_lists', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('userId', 50);
            $table->bigInteger('createdAt')->default(0);

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['userId', 'createdAt']);
        });

        Schema::create('reading_list_stories', function (Blueprint $table) {
            $table->string('listId', 50);
            $table->string('storyId', 50);
            $table->bigInteger('addedAt')->default(0);

            $table->primary(['listId', 'storyId']);
            $table->foreign('listId')->references('id')->on('reading_lists')->onDelete('cascade');
            $table->foreign('storyId')->references('id')->on('stories')->onDelete('cascade');
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50);
            $table->string('type', 50);
            $table->string('actorId', 50);
            $table->string('actorName', 50);
            $table->string('actorProfileImageUrl', 255)->nullable();
            $table->string('storyId', 50)->nullable();
            $table->string('storyTitle', 255)->nullable();
            $table->string('partId', 50)->nullable();
            $table->string('partTitle', 255)->nullable();
            $table->text('content')->nullable();
            $table->bigInteger('timestamp')->default(0);
            $table->boolean('isRead')->default(0);
            $table->boolean('isActorVerified')->default(0);

            $table->foreign('userId')->references('id')->on('users')->onDelete('cascade');
            $table->index(['userId', 'timestamp']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('reading_list_stories');
        Schema::dropIfExists('reading_lists');
        Schema::dropIfExists('library_stories');
        Schema::dropIfExists('part_annotations');
        Schema::dropIfExists('user_story_likes');
        Schema::dropIfExists('reviews');
        Schema::dropIfExists('ad_watch_events');
        Schema::dropIfExists('transactions');
        Schema::dropIfExists('user_read_parts');
        Schema::dropIfExists('follows');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('story_parts');
        Schema::dropIfExists('stories');
        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('job_batches');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('cache_locks');
        Schema::dropIfExists('cache');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
