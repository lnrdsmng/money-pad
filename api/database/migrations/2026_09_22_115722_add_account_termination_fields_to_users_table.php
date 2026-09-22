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
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('terminated_at')->nullable()->index();
            $table->string('terminated_by', 50)->nullable();
            $table->text('termination_reason')->nullable();
            $table->timestamp('restored_at')->nullable();
            $table->string('restored_by', 50)->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'terminated_at',
                'terminated_by',
                'termination_reason',
                'restored_at',
                'restored_by',
            ]);
        });
    }
};
