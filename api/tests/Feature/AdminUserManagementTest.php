<?php

namespace Tests\Feature;

use App\Models\SystemMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class AdminUserManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_searches_active_normal_users_by_username(): void
    {
        $admin = User::factory()->admin()->create(['username' => 'reader_admin']);
        $match = User::factory()->create(['username' => 'reader_one']);
        User::factory()->create(['username' => 'different_name']);
        User::factory()->create(['username' => 'reader_terminated', 'terminated_at' => now()]);

        $response = $this->actingAs($admin)
            ->getJson('/api/v1/admin/users/search?query=reader')
            ->assertOk();

        $this->assertSame([$match->id], collect($response->json('data'))->pluck('id')->all());
    }

    public function test_admin_can_terminate_and_restore_a_normal_user(): void
    {
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create(['username' => 'blocked_reader']);
        $tokenId = $user->createToken('mobile')->accessToken->id;
        DB::table('sessions')->insert([
            'id' => 'existing-session',
            'user_id' => $user->id,
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'payload' => '',
            'last_activity' => now()->timestamp,
        ]);

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$user->id}/terminate", ['reason' => 'Repeated abuse'])
            ->assertOk()
            ->assertJsonPath('user.termination_reason', 'Repeated abuse');

        $user->refresh();
        $this->assertNotNull($user->terminated_at);
        $this->assertSame($admin->id, $user->terminated_by);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $tokenId]);
        $this->assertDatabaseMissing('sessions', ['user_id' => $user->id]);

        $this->postJson('/api/v1/auth/login', [
            'username' => $user->username,
            'password' => 'Password123!',
        ])->assertForbidden()->assertJsonPath('message', 'This account has been terminated. Contact support if you believe this is an error.');

        $this->actingAs($user)->getJson('/api/v1/auth/me')->assertUnauthorized();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$user->id}/restore")
            ->assertOk()
            ->assertJsonPath('user.terminated_at', null);

        $user->refresh();
        $this->assertNull($user->terminated_at);
        $this->assertNotNull($user->restored_at);
        $this->assertSame($admin->id, $user->restored_by);

        $this->postJson('/api/v1/auth/login', [
            'username' => $user->username,
            'password' => 'Password123!',
        ])->assertOk();
    }

    public function test_admin_cannot_terminate_an_administrator(): void
    {
        $admin = User::factory()->admin()->create();
        $otherAdmin = User::factory()->admin()->create();

        $this->actingAs($admin)
            ->postJson("/api/v1/admin/users/{$otherAdmin->id}/terminate", ['reason' => 'Not allowed'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('user');
    }

    public function test_message_recipient_must_be_an_active_normal_user(): void
    {
        $admin = User::factory()->admin()->create();
        $terminatedUser = User::factory()->create(['terminated_at' => now()]);

        $this->actingAs($admin)->postJson('/api/v1/admin/messages/send', [
            'userId' => $terminatedUser->id,
            'title' => 'Hello',
            'content' => 'Message',
        ])->assertUnprocessable()->assertJsonValidationErrors('userId');

        $this->assertSame(0, SystemMessage::query()->count());
    }
}
