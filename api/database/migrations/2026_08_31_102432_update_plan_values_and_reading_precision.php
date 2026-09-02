<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('plan', 32)->default('free')->change();
            $table->decimal('readerCoins', 14, 3)->default(0)->change();
            $table->decimal('totalReaderCoins', 14, 3)->default(0)->change();
        });

        Schema::table('user_plans', function (Blueprint $table) {
            $table->string('plan_type', 32)->change();
        });

        Schema::table('reading_sessions', function (Blueprint $table) {
            $table->decimal('coins_earned', 14, 3)->default(0)->change();
            $table->unsignedInteger('rewarded_minutes')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamp('ended_at')->nullable();
        });

        $mappedUsers = DB::table('users')
            ->whereIn('plan', ['premium', 'pro'])
            ->get(['id', 'plan']);

        DB::table('users')->where('plan', 'premium')->update(['plan' => 'standard']);
        DB::table('users')->where('plan', 'pro')->update(['plan' => 'mega_premium']);
        DB::table('user_plans')->where('plan_type', 'premium')->update(['plan_type' => 'standard']);
        DB::table('user_plans')->where('plan_type', 'pro')->update(['plan_type' => 'mega_premium']);

        $now = now();
        foreach ($mappedUsers as $mappedUser) {
            $newPlan = $mappedUser->plan === 'premium' ? 'standard' : 'mega_premium';

            DB::table('system_messages')->insert([
                'id' => (string) Str::uuid(),
                'userId' => $mappedUser->id,
                'type' => 'custom',
                'title' => 'Your MoneyPad plan was updated',
                'content' => "Your existing {$mappedUser->plan} plan was moved to {$newPlan} under our new one-time plan lineup.",
                'action_type' => 'info',
                'action_payload' => json_encode([
                    'previous_plan' => $mappedUser->plan,
                    'new_plan' => $newPlan,
                ], JSON_THROW_ON_ERROR),
                'is_pinned' => true,
                'is_read' => false,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        Schema::table('reading_rewards', function (Blueprint $table) {
            $table->foreign('claim_id')->references('id')->on('reading_reward_claims')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reading_rewards', function (Blueprint $table) {
            $table->dropForeign(['claim_id']);
        });

        DB::table('users')->where('plan', 'standard')->update(['plan' => 'premium']);
        DB::table('users')->whereIn('plan', ['mega_premium', 'ultimate_premium'])->update(['plan' => 'pro']);
        DB::table('user_plans')->where('plan_type', 'standard')->update(['plan_type' => 'premium']);
        DB::table('user_plans')->whereIn('plan_type', ['mega_premium', 'ultimate_premium'])->update(['plan_type' => 'pro']);

        Schema::table('reading_sessions', function (Blueprint $table) {
            $table->dropColumn(['rewarded_minutes', 'is_active', 'ended_at']);
            $table->decimal('coins_earned', 12, 2)->default(0)->change();
        });

        Schema::table('user_plans', function (Blueprint $table) {
            $table->string('plan_type', 16)->change();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('plan', 16)->default('free')->change();
            $table->decimal('readerCoins', 12, 2)->default(0)->change();
            $table->decimal('totalReaderCoins', 12, 2)->default(0)->change();
        });
    }
};
