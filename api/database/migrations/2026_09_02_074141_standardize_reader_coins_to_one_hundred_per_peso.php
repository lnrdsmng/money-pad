<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::table('users')->update([
            'readerCoins' => DB::raw('readerCoins * 100'),
            'totalReaderCoins' => DB::raw('totalReaderCoins * 100'),
        ]);
        DB::table('reading_sessions')->update(['coins_earned' => DB::raw('coins_earned * 100')]);
        DB::table('reading_rewards')->update([
            'rate_per_minute' => DB::raw('rate_per_minute * 100'),
            'amount' => DB::raw('amount * 100'),
        ]);
        DB::table('reading_reward_claims')->update(['amount' => DB::raw('amount * 100')]);
        DB::table('ad_watch_events')->update(['rewardCoins' => DB::raw('rewardCoins * 100')]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('users')->update([
            'readerCoins' => DB::raw('readerCoins / 100'),
            'totalReaderCoins' => DB::raw('totalReaderCoins / 100'),
        ]);
        DB::table('reading_sessions')->update(['coins_earned' => DB::raw('coins_earned / 100')]);
        DB::table('reading_rewards')->update([
            'rate_per_minute' => DB::raw('rate_per_minute / 100'),
            'amount' => DB::raw('amount / 100'),
        ]);
        DB::table('reading_reward_claims')->update(['amount' => DB::raw('amount / 100')]);
        DB::table('ad_watch_events')->update(['rewardCoins' => DB::raw('rewardCoins / 100')]);
    }
};
