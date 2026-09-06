<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class SecurityRegressionTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_profiles_search_and_followers_omit_private_data(): void
    {
        $user = User::factory()->create(['payment_account_info' => '09171234567']);
        $viewer = User::factory()->create();
        DB::table('follows')->insert(['followerId' => $user->id, 'followedId' => $viewer->id]);
        foreach (["/users/{$user->id}", '/users/search', "/users/{$viewer->id}/followers"] as $path) {
            $response = $this->getJson('/api/v1'.$path)->assertOk();
            foreach (['password', 'email', 'payment_account_info', 'birthday', 'readerCoins', 'authorIncome', 'balance'] as $field) {
                $this->assertStringNotContainsString('"'.$field.'":', $response->getContent());
            }
        }
        $this->actingAs($viewer)->getJson("/api/v1/users/{$user->id}/transactions")->assertForbidden();
    }

    public function test_drafts_are_only_visible_to_the_author(): void
    {
        $author = User::factory()->create();
        $other = User::factory()->create();
        $story = Story::factory()->create(['authorId' => $author->id, 'isPublished' => false]);
        $part = StoryPart::factory()->create(['storyId' => $story->id, 'isPublished' => false]);
        foreach (["/stories/{$story->id}", "/stories/{$story->id}/parts", "/parts/{$part->id}"] as $path) {
            $this->getJson('/api/v1'.$path)->assertNotFound();
        }
        $this->getJson('/api/v1/stories')->assertJsonMissing(['id' => $story->id]);
        $this->actingAs($other)->getJson("/api/v1/authors/{$author->id}/stories/drafts")->assertForbidden();
        $this->actingAs($author)->getJson("/api/v1/parts/{$part->id}")->assertOk();
        $this->getJson("/api/v1/stories/{$story->id}/parts")->assertOk()->assertJsonCount(1);
    }

    public function test_user_cannot_forge_a_system_notification(): void
    {
        $user = User::factory()->create();
        $target = User::factory()->create();
        $this->actingAs($user)->postJson('/api/v1/notifications', [
            'userId' => $target->id, 'actorId' => 'system', 'actorName' => 'System',
            'type' => 'WITHDRAWAL_APPROVED', 'isActorVerified' => true, 'is_pinned' => true,
        ])->assertForbidden();
        $this->assertSame(0, Notification::count());
    }

    public function test_chapter_html_is_sanitized_on_write_and_legacy_reads(): void
    {
        $author = User::factory()->create();
        $story = Story::factory()->create(['authorId' => $author->id, 'isPublished' => true]);
        $part = StoryPart::factory()->create(['storyId' => $story->id, 'isPublished' => true]);
        $html = '<p><strong>Safe text</strong></p><img src="https://example.test/a.png" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Link</a><svg onload="alert(1)"></svg>';
        $this->actingAs($author)->putJson("/api/v1/parts/{$part->id}", ['content' => $html])->assertOk();
        $stored = DB::table('story_parts')->where('id', $part->id)->value('content');
        $this->assertStringContainsString('<strong>Safe text</strong>', $stored);
        foreach (['onerror', '<script', 'javascript:', '<svg'] as $unsafe) {
            $this->assertStringNotContainsString($unsafe, $stored);
        }
        DB::table('story_parts')->where('id', $part->id)->update(['content' => $html]);
        $response = $this->getJson("/api/v1/parts/{$part->id}")->assertOk();
        $this->assertStringNotContainsString('onerror', $response->json('content'));
        $this->artisan('moneypad:sanitize-chapters', ['--write' => true])->assertSuccessful();
        $this->assertStringNotContainsString('onerror', DB::table('story_parts')->where('id', $part->id)->value('content'));
    }

    public function test_browser_logout_revokes_previously_issued_tokens(): void
    {
        $user = User::factory()->create();
        $user->createToken('old-browser');
        $this->actingAs($user, 'web')->postJson('/api/v1/auth/logout')->assertOk();
        $this->assertSame(0, $user->tokens()->count());
        $this->assertGuest('web');
    }

    public function test_login_attempts_are_throttled(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/v1/auth/login', ['username' => 'missing', 'password' => 'bad'])->assertUnauthorized();
        }
        $this->postJson('/api/v1/auth/login', ['username' => 'missing', 'password' => 'bad'])->assertStatus(429);
    }

    public function test_demo_seeder_does_not_create_accounts_in_production(): void
    {
        $this->app->instance('env', 'production');
        $this->artisan('db:seed', ['--class' => UserSeeder::class, '--force' => true])->assertSuccessful();
        $this->assertDatabaseCount('users', 0);
    }
}
