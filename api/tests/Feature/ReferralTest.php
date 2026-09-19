<?php

namespace Tests\Feature;

use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\Services\ReferralService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ReferralTest extends TestCase
{
    use RefreshDatabase;

    public function test_milestone_ad_requirements_match_each_tier(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/referrals/milestones')->assertOk();

        $this->assertSame([2, 5, 7, 10, 12, 15], collect($response->json('tiers'))->pluck('targetAds')->all());
    }

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
        $this->assertEquals(10.0, (float) $referee->readerCoins);
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

        // Referee reads 5 chapters and watches ads (Tier 1 requirement: 5 chapters + 2 ads).
        Story::create([
            'id' => 'story_1',
            'authorId' => $referrer->id,
            'authorName' => $referrer->username,
            'title' => 'Story 1',
            'overview' => 'Overview',
            'isPublished' => true,
        ]);

        for ($i = 1; $i <= 5; $i++) {
            StoryPart::create([
                'id' => 'part_'.$i,
                'storyId' => 'story_1',
                'title' => 'Part '.$i,
                'content' => 'Content',
                'order' => $i,
                'isPublished' => true,
            ]);

            DB::table('user_read_parts')->insert([
                'userId' => $referee->id,
                'partId' => 'part_'.$i,
                'storyId' => 'story_1',
                'readAt' => time(),
            ]);
        }

        for ($i = 1; $i <= 3; $i++) {
            DB::table('ad_watch_events')->insert([
                'id' => 'ad_'.$i,
                'userId' => $referee->id,
                'rewardCoins' => 0.5,
                'watchedAt' => time(),
            ]);
        }

        $res = $this->actingAs($referrer)->getJson('/api/v1/referrals/milestones');
        $res->assertOk()
            ->assertJsonPath('totalChaptersRead', 5)
            ->assertJsonPath('totalAdsWatched', 2)
            ->assertJsonPath('tiers.0.canClaim', true);

        // Claim tier 1
        $claimRes = $this->actingAs($referrer)->postJson('/api/v1/referrals/claim-milestone', [
            'tier_index' => 1,
        ]);

        $claimRes->assertOk()->assertJsonPath('success', true);
        $this->assertEquals(5.0, (float) $referrer->fresh()->readerCoins);

        // Attempt duplicate claim
        $dupRes = $this->actingAs($referrer)->postJson('/api/v1/referrals/claim-milestone', [
            'tier_index' => 1,
        ]);
        $dupRes->assertStatus(422);
    }

    public function test_empty_username_does_not_leak_unreferred_milestones(): void
    {
        $unrelatedAuthor = User::factory()->create();
        $unrelatedStory = Story::create([
            'id' => 's_unrelated_1',
            'authorId' => $unrelatedAuthor->id,
            'authorName' => $unrelatedAuthor->username,
            'title' => 'Unrelated Story',
            'overview' => 'Overview',
            'isPublished' => true,
        ]);
        $unrelatedPart = StoryPart::create([
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

    public function test_claiming_with_non_existent_username_returns_validation_error(): void
    {
        $referee = User::factory()->create([
            'username' => 'newbie_claim',
            'created_at' => now()->subHours(2),
            'referredBy' => '',
            'isReferralRewardClaimed' => false,
        ]);

        $response = $this->actingAs($referee)
            ->postJson('/api/v1/referrals/claim-welcome', [
                'referral_code' => 'ghost_user',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['referral_code'])
            ->assertJsonPath('errors.referral_code.0', "The referral username 'ghost_user' does not exist.");
    }

    public function test_signup_with_valid_referral_code_rewards_both_users(): void
    {
        $referrer = User::factory()->create([
            'username' => 'alice_referrer',
            'referralCount' => 0,
        ]);

        $response = $this->postJson('/api/v1/auth/signup', [
            'username' => 'bob_referee',
            'email' => 'bob@example.com',
            'password' => 'Password123!',
            'referral_code' => 'alice_referrer',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.username', 'bob_referee')
            ->assertJsonPath('user.referredBy', 'alice_referrer');

        $this->assertEquals(10.0, (float) $response->json('user.readerCoins'));
        $this->assertEquals(1, $referrer->fresh()->referralCount);
        $this->assertDatabaseHas('notifications', [
            'userId' => $referrer->id,
            'type' => 'REFERRAL_REWARD',
            'actorName' => 'bob_referee',
        ]);
    }

    public function test_signup_with_invalid_referral_code_fails_validation(): void
    {
        $response = $this->postJson('/api/v1/auth/signup', [
            'username' => 'charlie_test',
            'email' => 'charlie@example.com',
            'password' => 'Password123!',
            'referral_code' => 'nonexistent_user',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['referral_code'])
            ->assertJsonPath('errors.referral_code.0', "The referral username 'nonexistent_user' does not exist.");

        $this->assertDatabaseMissing('users', ['username' => 'charlie_test']);
    }

    public function test_claiming_with_full_referral_url_succeeds(): void
    {
        $referrer = User::factory()->create([
            'username' => 'author_link',
            'referralCount' => 0,
        ]);
        $referee = User::factory()->create([
            'username' => 'reader_link',
            'created_at' => now()->subHours(1),
            'referredBy' => '',
            'isReferralRewardClaimed' => false,
            'readerCoins' => 0,
        ]);

        $response = $this->actingAs($referee)
            ->postJson('/api/v1/referrals/claim-welcome', [
                'referral_code' => 'http://localhost:5173/register?ref=author_link',
            ]);

        $response->assertOk()
            ->assertJsonPath('success', true);
        $this->assertEquals(10.0, (float) $response->json('readerCoins'));

        $this->assertEquals('author_link', $referee->fresh()->referredBy);
        $this->assertEquals(1, $referrer->fresh()->referralCount);
    }

    public function test_claiming_with_url_containing_non_existent_username_returns_validation_error(): void
    {
        $referee = User::factory()->create([
            'username' => 'reader_link_fail',
            'created_at' => now()->subHours(1),
            'referredBy' => '',
            'isReferralRewardClaimed' => false,
        ]);

        $response = $this->actingAs($referee)
            ->postJson('/api/v1/referrals/claim-welcome', [
                'referral_code' => 'https://moneypad.app/register?ref=ghost_writer/',
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['referral_code'])
            ->assertJsonPath('errors.referral_code.0', "The referral username 'ghost_writer' does not exist.");
    }

    public function test_user_can_link_referrer_after_24_hours_without_bonus(): void
    {
        $referrer = User::factory()->create(['username' => 'mentor', 'referralCount' => 0]);
        $referee = User::factory()->create([
            'username' => 'student',
            'created_at' => now()->subDays(3),
            'referredBy' => '',
            'isReferralRewardClaimed' => false,
            'readerCoins' => 5.0,
        ]);

        $response = $this->actingAs($referee)->postJson('/api/v1/referrals/link', [
            'referral_code' => 'mentor',
        ]);

        $response->assertOk()
            ->assertJsonPath('success', true);

        $referee->refresh();
        $referrer->refresh();

        $this->assertEquals('mentor', $referee->referredBy);
        $this->assertEquals($referrer->id, $referee->referrer_id);
        $this->assertFalse($referee->isReferralRewardClaimed); // no bonus since > 24 hours
        $this->assertEquals(5.0, (float) $referee->readerCoins);
        $this->assertEquals(1, $referrer->referralCount);
    }

    public function test_referral_milestones_are_isolated_per_referred_user(): void
    {
        $referrer = User::factory()->create(['username' => 'shared_host', 'readerCoins' => 0.0]);
        $userB = User::factory()->create(['username' => 'friend_b', 'referredBy' => 'shared_host', 'referrer_id' => $referrer->id]);
        $userC = User::factory()->create(['username' => 'friend_c', 'referredBy' => 'shared_host', 'referrer_id' => $referrer->id]);

        $referralService = app(ReferralService::class);

        // User B completes the Tier 1 chapter and ad requirements.
        for ($i = 0; $i < 5; $i++) {
            $referralService->recordChapterRead($userB->id);
        }
        $bRow = $referralService->ensureProgressRow($referrer->id, $userB->id, 1);
        $bRow->update(['ads_watched' => 2, 'is_completed' => true]);

        // Check milestones from host's perspective
        $res = $this->actingAs($referrer)->getJson('/api/v1/referrals/milestones');
        $res->assertOk();

        $referrals = collect($res->json('referrals'));
        $bProgress = $referrals->firstWhere('id', $userB->id);
        $cProgress = $referrals->firstWhere('id', $userC->id);

        $this->assertNotNull($bProgress);
        $this->assertNotNull($cProgress);

        // User B should have tier 1 completed and claimable
        $this->assertTrue($bProgress['tiers'][0]['canClaim']);
        $this->assertEquals(5, $bProgress['tiers'][0]['currentChapters']);
        $this->assertEquals(2, $bProgress['tiers'][0]['currentAds']);

        // User C should NOT have tier 1 completed (isolated)
        $this->assertFalse($cProgress['tiers'][0]['canClaim']);
        $this->assertEquals(0, $cProgress['tiers'][0]['currentChapters']);
        $this->assertEquals(0, $cProgress['tiers'][0]['currentAds']);

        // Host claims User B's tier 1
        $claimRes = $this->actingAs($referrer)->postJson('/api/v1/referrals/claim-milestone', [
            'referred_user_id' => $userB->id,
            'tier_index' => 1,
        ]);
        $claimRes->assertOk()->assertJsonPath('success', true);
        $this->assertEquals(5.0, (float) $referrer->fresh()->readerCoins);

        // Verify User B's tier 1 is claimed and tier 2 is active
        $resAfter = $this->actingAs($referrer)->getJson('/api/v1/referrals/milestones');
        $bAfter = collect($resAfter->json('referrals'))->firstWhere('id', $userB->id);
        $this->assertTrue($bAfter['tiers'][0]['isClaimed']);
        $this->assertEquals(2, $bAfter['activeTier']);

        // User C remains on tier 1 unclaimed
        $cAfter = collect($resAfter->json('referrals'))->firstWhere('id', $userC->id);
        $this->assertFalse($cAfter['tiers'][0]['isClaimed']);
        $this->assertEquals(1, $cAfter['activeTier']);
    }

    public function test_sequential_tier_locking_blocks_progress_before_previous_tier_claimed(): void
    {
        $referrer = User::factory()->create(['username' => 'lock_host']);
        $userB = User::factory()->create(['username' => 'lock_reader', 'referredBy' => 'lock_host', 'referrer_id' => $referrer->id]);

        $referralService = app(ReferralService::class);

        // Complete Tier 1 (5 chapters + 2 ads)
        for ($i = 0; $i < 5; $i++) {
            $referralService->recordChapterRead($userB->id);
        }
        $bRow = $referralService->ensureProgressRow($referrer->id, $userB->id, 1);
        $bRow->update(['ads_watched' => 2, 'is_completed' => true]);

        // Active tier is still 1 (because host hasn't claimed Tier 1 yet)
        $this->assertEquals(1, $referralService->getActiveTierForReferee($referrer->id, $userB->id));

        // User B reads 10 more chapters while Tier 1 is waiting to be claimed
        for ($i = 0; $i < 10; $i++) {
            $referralService->recordChapterRead($userB->id);
        }

        // Tier 2 progress must remain 0 because Tier 1 hasn't been claimed yet
        $milestones = $referralService->milestones($referrer);
        $bProgress = collect($milestones['referrals'])->firstWhere('id', $userB->id);
        $this->assertEquals(0, $bProgress['tiers'][1]['currentChapters']);

        // Host claims Tier 1 -> active tier moves to Tier 2
        $referralService->claimMilestone($referrer, $userB->id, 1);
        $this->assertEquals(2, $referralService->getActiveTierForReferee($referrer->id, $userB->id));

        // Now User B reads 2 chapters -> Tier 2 receives the progress
        $referralService->recordChapterRead($userB->id);
        $referralService->recordChapterRead($userB->id);

        $milestonesAfter = $referralService->milestones($referrer);
        $bAfter = collect($milestonesAfter['referrals'])->firstWhere('id', $userB->id);
        $this->assertEquals(2, $bAfter['tiers'][1]['currentChapters']);
    }

    public function test_referee_can_watch_tier_ad_without_double_coin_bonus(): void
    {
        $referrer = User::factory()->create(['username' => 'ad_host']);
        $userB = User::factory()->create([
            'username' => 'ad_referee',
            'referredBy' => 'ad_host',
            'referrer_id' => $referrer->id,
            'readerCoins' => 10.0,
        ]);

        // Start rewarded ad for purpose 'referral_tier'
        $startRes = $this->actingAs($userB)->postJson('/api/v1/rewarded-ads', [
            'purpose' => 'referral_tier',
            'target_id' => '1',
        ]);
        $startRes->assertCreated();
        $adEventId = $startRes->json('id');

        // Mock verify ad after 6 seconds
        $this->travel(6)->seconds();
        $verifyRes = $this->actingAs($userB)->postJson("/api/v1/rewarded-ads/{$adEventId}/mock-verify");
        $verifyRes->assertOk();

        // Complete tier ad
        $consumeRes = $this->actingAs($userB)->postJson('/api/v1/referrals/tiers/1/watch-ad', [
            'ad_event_id' => $adEventId,
        ]);
        $consumeRes->assertOk()->assertJsonPath('success', true);

        // Verify referee did NOT get direct coin bonus (balance is still 10.0)
        $this->assertEquals(10.0, (float) $userB->fresh()->readerCoins);

        // Verify tier 1 ad count incremented
        $referralService = app(ReferralService::class);
        $milestones = $referralService->milestones($referrer);
        $bProgress = collect($milestones['referrals'])->firstWhere('id', $userB->id);
        $this->assertEquals(1, $bProgress['tiers'][0]['currentAds']);

        // Attempting to consume the same ad event again fails
        $replayRes = $this->actingAs($userB)->postJson('/api/v1/referrals/tiers/1/watch-ad', [
            'ad_event_id' => $adEventId,
        ]);
        $replayRes->assertStatus(422);
    }
}
