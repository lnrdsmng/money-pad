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
        Schema::create('system_broadcasts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('title');
            $table->text('content');
            $table->string('status')->default('queued');
            $table->unsignedInteger('recipient_count')->default(0);
            $table->unsignedInteger('delivered_count')->default(0);
            $table->text('failure_reason')->nullable();
            $table->timestamps();
        });

        Schema::create('system_broadcast_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('broadcast_id')->constrained('system_broadcasts')->cascadeOnDelete();
            $table->string('user_id', 50);
            $table->timestamp('delivered_at')->nullable();
            $table->unique(['broadcast_id', 'user_id']);
            $table->index(['broadcast_id', 'delivered_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_broadcast_recipients');
        Schema::dropIfExists('system_broadcasts');
    }
};
