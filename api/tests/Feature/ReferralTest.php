<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReferralTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_claim_welcome_referral_bonus_within_24_hours(): void
    {
        $referrer = User::factory()->create([
            'username' => 'referrer123',
            'referralCount' => 0,
        ]);

        $referee = User::factory()->create([
            'username' => 'newbie',
            'created_at' => now()->subHours(2),
            'referredBy' => '',
            'isReferralRewardClaimed' => false,
            'readerCoins' => 0.0,
            'totalReaderCoins' => 0.0,
        ]);

        $response = $this->actingAs($referee)
            ->postJson('/api/v1/referrals/claim-welcome', [
                'referral_code' => 'referrer123',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $referee->refresh();
        $referrer->refresh();

        $this->assertEquals('referrer123', $referee->referredBy);
        $this->assertTrue($referee->isReferralRewardClaimed);
        $this->assertEquals(10.0, (float)$referee->readerCoins);
        $this->assertEquals(1, $referrer->referralCount);

        $this->assertDatabaseHas('notifications', [
            'userId' => $referrer->id,
            'type' => 'REFERRAL_REWARD',
            'actorId' => $referee->id,
        ]);
    }

    public function test_user_cannot_claim_welcome_bonus_if_already_referred(): void
    {
        $referrer = User::factory()->create(['username' => 'referrer123']);
        $referee = User::factory()->create([
            'referredBy' => 'someone_else',
            'created_at' => now()->subHours(2),
        ]);

        $response = $this->actingAs($referee)
            ->postJson('/api/v1/referrals/claim-welcome', [
                'referral_code' => 'referrer123',
            ]);

        $response->assertStatus(422);
    }

    public function test_user_cannot_claim_welcome_bonus_after_24_hours(): void
    {
        $referrer = User::factory()->create(['username' => 'referrer123']);
        $referee = User::factory()->create([
            'referredBy' => '',
            'isReferralRewardClaimed' => false,
            'created_at' => now()->subHours(25),
        ]);

        $response = $this->actingAs($referee)
            ->postJson('/api/v1/referrals/claim-welcome', [
                'referral_code' => 'referrer123',
            ]);

        $response->assertStatus(422);
    }

    public function test_referrer_milestones_and_claiming(): void
    {
        $referrer = User::factory()->create([
            'username' => 'super_referrer',
            'readerCoins' => 0.0,
            'totalReaderCoins' => 0.0,
        ]);

        $referee = User::factory()->create([
            'username' => 'referred_user',
            'referredBy' => 'super_referrer',
        ]);

        // Referee reads 5 chapters and watches 3 ads (Tier 1 requirement: 5 chapters + 3 ads = 10 coins)
        \App\Models\Story::create([
            'id' => 'story_1',
            'authorId' => $referrer->id,
            'authorName' => $referrer->username,
            'title' => 'Story 1',
            'overview' => 'Overview',
            'isPublished' => true,
        ]);

        for ($i = 1; $i <= 5; $i++) {
            \App\Models\StoryPart::create([
                'id' => 'part_' . $i,
                'storyId' => 'story_1',
                'title' => 'Part ' . $i,
                'content' => 'Content',
                'order' => $i,
                'isPublished' => true,
            ]);

            DB::table('user_read_parts')->insert([
                'userId' => $referee->id,
                'partId' => 'part_' . $i,
                'storyId' => 'story_1',
                'readAt' => time(),
            ]);
        }

        for ($i = 1; $i <= 3; $i++) {
            DB::table('ad_watch_events')->insert([
                'id' => 'ad_' . $i,
                'userId' => $referee->id,
                'rewardCoins' => 0.5,
                'watchedAt' => time(),
            ]);
        }

        $res = $this->actingAs($referrer)->getJson('/api/v1/referrals/milestones');
        $res->assertOk()
            ->assertJsonPath('totalChaptersRead', 5)
            ->assertJsonPath('totalAdsWatched', 3)
            ->assertJsonPath('tiers.0.canClaim', true);

        // Claim tier 1
        $claimRes = $this->actingAs($referrer)->postJson('/api/v1/referrals/claim-milestone', [
            'tier_index' => 1,
        ]);

        $claimRes->assertOk()->assertJsonPath('success', true);
        $this->assertEquals(10.0, (float)$referrer->fresh()->readerCoins);

        // Attempt duplicate claim
        $dupRes = $this->actingAs($referrer)->postJson('/api/v1/referrals/claim-milestone', [
            'tier_index' => 1,
        ]);
        $dupRes->assertStatus(422);
    }

    public function test_empty_username_does_not_leak_unreferred_milestones(): void
    {
        $unrelatedAuthor = User::factory()->create();
        $unrelatedStory = \App\Models\Story::create([
            'id' => 's_unrelated_1',
            'authorId' => $unrelatedAuthor->id,
            'authorName' => $unrelatedAuthor->username,
            'title' => 'Unrelated Story',
            'overview' => 'Overview',
            'isPublished' => true,
        ]);
        $unrelatedPart = \App\Models\StoryPart::create([
            'id' => 'p_unrelated_1',
            'storyId' => $unrelatedStory->id,
            'title' => 'Part 1',
            'content' => 'Content',
            'order' => 1,
            'isPublished' => true,
        ]);

        $unrelatedUser = User::factory()->create(['referredBy' => '']);
        DB::table('user_read_parts')->insert([
            'userId' => $unrelatedUser->id,
            'partId' => $unrelatedPart->id,
            'storyId' => $unrelatedStory->id,
            'readAt' => time(),
        ]);

        $caller = User::factory()->create([
            'username' => '',
            'referredBy' => '',
        ]);

        $res = $this->actingAs($caller)->getJson('/api/v1/referrals/milestones');
        $res->assertOk()
            ->assertJsonPath('totalChaptersRead', 0)
            ->assertJsonPath('totalAdsWatched', 0);
    }
}
