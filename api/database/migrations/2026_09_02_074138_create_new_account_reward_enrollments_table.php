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
        Schema::create('new_account_reward_enrollments', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('userId', 50)->unique();
            $table->date('starts_on');
            $table->string('timezone', 64)->default('Asia/Manila');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('new_account_reward_enrollments');
    }
};
