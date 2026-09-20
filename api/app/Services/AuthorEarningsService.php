<?php

namespace App\Services;

use App\Models\AuthorEarning;
use App\Models\Story;
use App\Models\StoryView;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthorEarningsService
{
    public function __construct(
        private readonly ExchangeRateService $exchangeRates,
        private readonly WithdrawalService $withdrawals,
    ) {}

    public function recordUniqueStoryView(User $viewer, Story $story): bool
    {
        if (! $story->isPublished || $story->authorId === $viewer->id) {
            return false;
        }

        try {
            $created = DB::transaction(function () use ($viewer, $story): bool {
                $lockedStory = Story::query()->whereKey($story->id)->lockForUpdate()->firstOrFail();
                if (! $lockedStory->isPublished || $lockedStory->authorId === $viewer->id) {
                    return false;
                }

                $view = StoryView::firstOrCreate(
                    ['story_id' => $lockedStory->id, 'viewer_id' => $viewer->id],
                    [
                        'id' => (string) Str::uuid(),
                        'author_id' => $lockedStory->authorId,
                        'viewed_at' => now(),
                    ],
                );

                if ($view->wasRecentlyCreated) {
                    $lockedStory->increment('uniqueViews');
                }

                return $view->wasRecentlyCreated;
            }, 3);
        } catch (UniqueConstraintViolationException) {
            return false;
        }

        if ($created) {
            $this->creditEligibleBatches((string) $story->authorId);
        }

        return $created;
    }

    public function creditEligibleBatches(string $authorId): int
    {
        $batchSize = (int) config('moneypad.author_earnings.views_per_batch', 50);
        $viewCount = StoryView::query()->where('author_id', $authorId)->count();
        $lastMilestone = (int) AuthorEarning::query()->where('author_id', $authorId)->max('milestone_views');

        if ($viewCount < $lastMilestone + $batchSize) {
            return 0;
        }

        $rate = $this->exchangeRates->usdToPhp();
        if ($rate === null) {
            return 0;
        }

        $credited = DB::transaction(function () use ($authorId, $batchSize, $rate): int {
            $author = User::query()->whereKey($authorId)->lockForUpdate()->firstOrFail();
            $viewCount = StoryView::query()->where('author_id', $authorId)->count();
            $lastMilestone = (int) AuthorEarning::query()->where('author_id', $authorId)->max('milestone_views');
            $nextMilestone = $lastMilestone + $batchSize;
            $totalPhp = 0.0;
            $creditedBatches = 0;

            while ($nextMilestone <= $viewCount) {
                $usdAmount = $author->isVerified
                    ? (float) config('moneypad.author_earnings.verified_usd_per_batch', 0.10)
                    : (float) config('moneypad.author_earnings.standard_usd_per_batch', 0.05);
                $phpAmount = round($usdAmount * $rate, 4);

                AuthorEarning::create([
                    'id' => (string) Str::uuid(),
                    'author_id' => $author->id,
                    'milestone_views' => $nextMilestone,
                    'view_count' => $batchSize,
                    'verified_benefit' => (bool) $author->isVerified,
                    'usd_amount' => number_format($usdAmount, 4, '.', ''),
                    'usd_php_rate' => number_format($rate, 6, '.', ''),
                    'php_amount' => number_format($phpAmount, 4, '.', ''),
                    'earned_at' => now(),
                ]);

                $totalPhp += $phpAmount;
                $creditedBatches++;
                $nextMilestone += $batchSize;
            }

            if ($totalPhp > 0) {
                $author->authorIncome = number_format((float) $author->authorIncome + $totalPhp, 4, '.', '');
                $author->save();
            }

            return $creditedBatches;
        }, 3);

        if ($credited > 0) {
            $this->withdrawals->evaluateAndCreate(User::findOrFail($authorId));
        }

        return $credited;
    }
}
