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
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('wallAuthorId', 50)->nullable()->after('partTitle');
            $table->string('conversationId', 50)->nullable()->after('wallAuthorId');
            $table->string('parentConversationId', 50)->nullable()->after('conversationId');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropColumn(['wallAuthorId', 'conversationId', 'parentConversationId']);
        });
    }
};
