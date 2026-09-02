<?php

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
        Schema::table('withdrawal_requests', function (Blueprint $table) {
            if (! Schema::hasColumn('withdrawal_requests', 'gross_amount')) {
                $table->decimal('gross_amount', 12, 2)->nullable()->after('amount');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'net_amount')) {
                $table->decimal('net_amount', 12, 2)->nullable()->after('gross_amount');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'coins_deducted')) {
                $table->decimal('coins_deducted', 12, 3)->nullable()->after('net_amount');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'account_snapshot')) {
                $table->json('account_snapshot')->nullable()->after('bank_name');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'triggered_at')) {
                $table->timestamp('triggered_at')->nullable()->after('reviewed_at');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'earliest_review_at')) {
                $table->timestamp('earliest_review_at')->nullable()->after('triggered_at');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'estimated_deadline_at')) {
                $table->timestamp('estimated_deadline_at')->nullable()->after('earliest_review_at');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('estimated_deadline_at');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'rejection_reason')) {
                $table->text('rejection_reason')->nullable()->after('completed_at');
            }
            if (! Schema::hasColumn('withdrawal_requests', 'payout_reference')) {
                $table->string('payout_reference', 255)->nullable()->after('rejection_reason');
            }
        });

        // Backfill existing records
        DB::table('withdrawal_requests')
            ->whereNull('gross_amount')
            ->update([
                'gross_amount' => DB::raw('amount'),
                'net_amount' => DB::raw('amount - CASE WHEN fee_waived = 1 THEN 0 ELSE platform_fee END - bank_fee'),
                'triggered_at' => DB::raw('created_at'),
            ]);

        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->index(['userId', 'status']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('withdrawal_requests', function (Blueprint $table) {
            $table->dropIndex(['userId', 'status']);
            $table->dropIndex(['status']);
            $table->dropColumn([
                'gross_amount',
                'net_amount',
                'coins_deducted',
                'account_snapshot',
                'triggered_at',
                'earliest_review_at',
                'estimated_deadline_at',
                'completed_at',
                'rejection_reason',
                'payout_reference',
            ]);
        });
    }
};
