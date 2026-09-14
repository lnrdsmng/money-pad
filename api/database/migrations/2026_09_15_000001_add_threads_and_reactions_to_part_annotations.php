<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('part_annotations', function (Blueprint $table) {
            $table->string('parentId', 50)->nullable()->after('id');
            $table->foreign('parentId')->references('id')->on('part_annotations')->nullOnDelete();
            $table->index(['partId', 'startIndex', 'endIndex'], 'part_annotations_paragraph_index');
        });

        Schema::create('part_annotation_reactions', function (Blueprint $table) {
            $table->string('annotationId', 50);
            $table->string('userId', 50);
            $table->bigInteger('createdAt')->default(0);

            $table->primary(['annotationId', 'userId']);
            $table->foreign('annotationId')->references('id')->on('part_annotations')->cascadeOnDelete();
            $table->foreign('userId')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('part_annotation_reactions');

        Schema::table('part_annotations', function (Blueprint $table) {
            $table->dropForeign(['parentId']);
            $table->dropIndex('part_annotations_paragraph_index');
            $table->dropColumn('parentId');
        });
    }
};
