<?php

namespace App\Console\Commands;

use App\Services\ChapterHtmlSanitizer;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

#[Signature('moneypad:sanitize-chapters {--write : Persist sanitized HTML; otherwise only report changes}')]
#[Description('Sanitize existing chapter HTML without overwriting concurrent edits')]
class SanitizeChapters extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(ChapterHtmlSanitizer $sanitizer): int
    {
        $changed = 0;
        $skipped = 0;
        DB::table('story_parts')->orderBy('id')->chunkById(100, function ($parts) use ($sanitizer, &$changed, &$skipped) {
            foreach ($parts as $part) {
                $html = $sanitizer->sanitize($part->content);
                if ($html === $part->content) {
                    continue;
                }
                $changed++;
                if ($this->option('write')) {
                    $updated = DB::table('story_parts')->where('id', $part->id)->where('revision', $part->revision)
                        ->update(['content' => $html, 'revision' => $part->revision + 1]);
                    if (! $updated) {
                        $skipped++;
                    }
                }
            }
        });
        $this->info("Chapters requiring cleanup: {$changed}; concurrent edits skipped: {$skipped}.");

        return $skipped ? self::FAILURE : self::SUCCESS;
    }
}
