<?php

namespace Tests\Feature;

use App\Models\AuthorEarning;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\StoryView;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AuthorEarningsTest extends TestCase
{
    use RefreshDatabase;

    public function test_counts_one_unique_view_per_reader_and_story(): void
    {
        $author = User::factory()->create();
        [$firstStory, $firstPart] = $this->publishedStory($author, 'first');
        [$secondStory, $secondPart] = $this->publishedStory($author, 'second');
        $reader = User::factory()->create();

        $this->actingAs($reader)->postJson("/api/v1/parts/{$firstPart->id}/view")
            ->assertOk()
            ->assertJsonPath('counted', true);
        $this->actingAs($reader)->postJson("/api/v1/parts/{$firstPart->id}/view")
            ->assertOk()
            ->assertJsonPath('counted', false);
        $this->actingAs($reader)->postJson("/api/v1/parts/{$secondPart->id}/view")
            ->assertOk()
            ->assertJsonPath('counted', true);

        $this->assertSame(2, StoryView::query()->where('author_id', $author->id)->count());
        $this->assertSame(1, $firstStory->fresh()->uniqueViews);
        $this->assertSame(1, $secondStory->fresh()->uniqueViews);
    }

    public function test_credits_standard_rate_after_fifty_views_across_authors_stories(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'https://openexchangerates.org/api/latest.json*' => Http::response([
                'base' => 'USD',
                'rates' => ['PHP' => 56.0],
            ]),
            'https://api.frankfurter.dev/v2/rate/usd/php*' => Http::response([
                'base' => 'USD',
                'quote' => 'PHP',
                'rate' => 56.0,
            ]),
        ]);

        $author = User::factory()->create(['isVerified' => false]);
        [, $firstPart] = $this->publishedStory($author, 'first');
        [, $secondPart] = $this->publishedStory($author, 'second');

        foreach (range(1, 50) as $number) {
            $reader = User::factory()->create();
            $part = $number <= 25 ? $firstPart : $secondPart;
            $this->actingAs($reader)->postJson("/api/v1/parts/{$part->id}/view")->assertOk();
        }

        $author->refresh();
        $earning = AuthorEarning::query()->where('author_id', $author->id)->sole();
        $this->assertSame('2.8000', $author->authorIncome);
        $this->assertSame(50, $earning->milestone_views);
        $this->assertSame('0.0500', $earning->usd_amount);
        $this->assertSame('56.000000', $earning->usd_php_rate);
        $this->assertSame('2.8000', $earning->php_amount);
    }

    public function test_verified_author_payout_is_queued_automatically_at_threshold(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'https://openexchangerates.org/api/latest.json*' => Http::response([
                'base' => 'USD',
                'rates' => ['PHP' => 56.0],
            ]),
            'https://api.frankfurter.dev/v2/rate/usd/php*' => Http::response([
                'base' => 'USD',
                'quote' => 'PHP',
                'rate' => 56.0,
            ]),
        ]);

        $author = User::factory()->create([
            'isVerified' => true,
            'payment_method' => 'GCash',
            'payment_account_name' => 'Verified Author',
            'payment_account_info' => '09171234567',
        ]);
        [, $part] = $this->publishedStory($author, 'verified');

        foreach (range(1, 100) as $number) {
            $reader = User::factory()->create();
            $this->actingAs($reader)->postJson("/api/v1/parts/{$part->id}/view")->assertOk();
        }

        $this->assertDatabaseHas('withdrawal_requests', [
            'userId' => $author->id,
            'source' => 'AUTHOR',
            'gross_amount' => '11.20',
            'net_amount' => '8.20',
            'status' => 'pending_ad_choice',
        ]);
        $this->assertSame('0.0000', $author->fresh()->authorIncome);
        $this->assertSame(2, AuthorEarning::query()->where('author_id', $author->id)->count());
    }

    public function test_author_own_view_does_not_count(): void
    {
        $author = User::factory()->create();
        [, $part] = $this->publishedStory($author, 'self');

        $this->actingAs($author)->postJson("/api/v1/parts/{$part->id}/view")
            ->assertOk()
            ->assertJsonPath('counted', false);

        $this->assertSame(0, StoryView::query()->count());
    }

    public function test_failed_exchange_lookup_keeps_views_pending_for_reconciliation(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'https://api.frankfurter.dev/v2/rate/usd/php*' => Http::sequence()
                ->pushStatus(500)
                ->pushStatus(500)
                ->pushStatus(500)
                ->push([
                    'base' => 'USD',
                    'quote' => 'PHP',
                    'rate' => 56.0,
                ]),
        ]);

        $author = User::factory()->create();
        [, $part] = $this->publishedStory($author, 'pending-rate');

        foreach (range(1, 50) as $number) {
            $reader = User::factory()->create();
            $this->actingAs($reader)->postJson("/api/v1/parts/{$part->id}/view")->assertOk();
        }

        $this->assertSame(50, StoryView::query()->where('author_id', $author->id)->count());
        $this->assertSame(0, AuthorEarning::query()->where('author_id', $author->id)->count());
        $this->assertSame('0.0000', $author->fresh()->authorIncome);

        $this->artisan('withdrawals:reconcile')->assertSuccessful();

        $this->assertSame(1, AuthorEarning::query()->where('author_id', $author->id)->count());
        $this->assertSame('2.8000', $author->fresh()->authorIncome);
    }

    /**
     * @return array{Story, StoryPart}
     */
    private function publishedStory(User $author, string $suffix): array
    {
        $story = Story::factory()->create([
            'id' => "story-{$suffix}",
            'authorId' => $author->id,
            'authorName' => $author->username,
            'isPublished' => true,
        ]);
        $part = StoryPart::factory()->create([
            'id' => "part-{$suffix}",
            'storyId' => $story->id,
            'isPublished' => true,
        ]);

        return [$story, $part];
    }
}
