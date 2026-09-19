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
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('community_read_at')->nullable()->index();
        });
        DB::table('users')->whereNull('community_read_at')->update(['community_read_at' => now()]);

        Schema::table('chat_messages', function (Blueprint $table) {
            $table->timestamp('pinned_at')->nullable()->index();
            $table->string('pinned_by', 50)->nullable();
            $table->foreign('pinned_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropForeign(['pinned_by']);
            $table->dropColumn(['pinned_at', 'pinned_by']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('community_read_at');
        });
    }
};
