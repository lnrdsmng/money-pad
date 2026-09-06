<?php

use App\Services\PayoutAccount;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('referrer_id', 50)->nullable()->index();
            $table->string('payout_account_key', 255)->nullable()->index();
            $table->boolean('payout_account_conflict')->default(false);
        });
        DB::table('users')->orderBy('id')->chunkById(200, function ($users) {
            foreach ($users as $user) {
                $referrer = empty($user->referredBy) ? null : DB::table('users')
                    ->where('username', $user->referredBy)->first();
                $referrer ??= empty($user->referredBy) ? null : DB::table('users')->find($user->referredBy);
                DB::table('users')->where('id', $user->id)->update([
                    'referrer_id' => $referrer?->id,
                    'payout_account_key' => PayoutAccount::normalize($user->payment_account_info),
                ]);
            }
        });
        // Preserve duplicate legacy accounts for review; do not silently assign ownership.
        $duplicates = DB::table('users')->select('payout_account_key')->whereNotNull('payout_account_key')
            ->groupBy('payout_account_key')->havingRaw('COUNT(*) > 1')->pluck('payout_account_key');
        foreach ($duplicates as $key) {
            DB::table('users')->where('payout_account_key', $key)->update([
                'payout_account_conflict' => true,
            ]);
        }
        Schema::create('payout_accounts', function (Blueprint $table) {
            $table->string('account_key', 255)->primary();
            $table->string('user_id', 50)->nullable()->unique();
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
        });
        DB::table('users')->whereNotNull('payout_account_key')->orderBy('id')->chunkById(200, function ($users) {
            foreach ($users as $user) {
                DB::table('payout_accounts')->insertOrIgnore([
                    'account_key' => $user->payout_account_key,
                    'user_id' => $user->payout_account_conflict ? null : $user->id,
                ]);
            }
        });
        Schema::table('story_parts', fn (Blueprint $table) => $table->unsignedInteger('revision')->default(0));
        Schema::create('active_reading_sessions', function (Blueprint $table) {
            $table->string('user_id', 50)->primary();
            $table->string('session_id', 50)->unique();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('session_id')->references('id')->on('reading_sessions')->cascadeOnDelete();
        });
        DB::table('reading_sessions')->where('is_active', true)->update(['is_active' => false, 'ended_at' => now()]);
        Schema::create('rewarded_ad_events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('user_id', 50);
            $table->string('purpose', 24);
            $table->string('target_id', 50)->nullable();
            $table->string('provider', 24);
            $table->string('zone_id', 50)->nullable();
            $table->timestamp('expires_at');
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamps();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'purpose', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rewarded_ad_events');
        Schema::dropIfExists('active_reading_sessions');
        Schema::dropIfExists('payout_accounts');
        Schema::table('story_parts', fn (Blueprint $table) => $table->dropColumn('revision'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['referrer_id', 'payout_account_key', 'payout_account_conflict']));
    }
};
