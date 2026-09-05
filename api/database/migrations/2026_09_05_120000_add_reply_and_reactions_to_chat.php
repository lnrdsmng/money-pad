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
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->string('reply_to_id', 50)->nullable()->after('is_system');
            $table->foreign('reply_to_id')->references('id')->on('chat_messages')->onDelete('set null');
        });

        Schema::create('chat_message_reactions', function (Blueprint $table) {
            $table->string('id', 50)->primary();
            $table->string('chat_message_id', 50);
            $table->string('user_id', 50);
            $table->string('reaction_type', 20)->default('heart');
            $table->timestamps();

            $table->foreign('chat_message_id')->references('id')->on('chat_messages')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
            $table->unique(['chat_message_id', 'user_id', 'reaction_type'], 'chat_msg_reaction_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('chat_message_reactions');

        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropForeign(['reply_to_id']);
            $table->dropColumn('reply_to_id');
        });
    }
};
