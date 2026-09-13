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
        Schema::create('author_referral_commissions', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('referrer_id', 50);
            $table->string('author_id', 50);
            $table->string('withdrawal_request_id', 50);
            $table->decimal('withdrawal_amount', 12, 2);
            $table->decimal('commission_amount', 12, 2);
            $table->unsignedInteger('required_ads')->default(1);
            $table->unsignedInteger('ads_watched')->default(0);
            $table->string('status', 30)->default('pending');
            $table->timestamp('claimed_at')->nullable();
            $table->timestamps();

            $table->foreign('referrer_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('author_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('withdrawal_request_id')->references('id')->on('withdrawal_requests')->onDelete('cascade');

            $table->index(['referrer_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('author_referral_commissions');
    }
};
