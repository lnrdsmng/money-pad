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
        Schema::create('daily_login_reward_claims', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('enrollment_id', 50);
            $table->string('userId', 50);
            $table->unsignedTinyInteger('day_number');
            $table->date('reward_date');
            $table->decimal('amount', 14, 3);
            $table->timestamp('claimed_at');
            $table->timestamps();

            $table->foreign('enrollment_id')->references('id')->on('new_account_reward_enrollments')->cascadeOnDelete();
            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
            $table->unique(['enrollment_id', 'day_number']);
            $table->unique(['userId', 'reward_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('daily_login_reward_claims');
    }
};
