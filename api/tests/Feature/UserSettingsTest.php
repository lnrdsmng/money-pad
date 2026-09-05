<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UserSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_settings(): void
    {
        $user = User::factory()->create([
            'username' => 'original_name',
            'preferredGenres' => 'Romance',
        ]);

        $res = $this->actingAs($user)->putJson('/api/v1/users/settings', [
            'username' => 'new_cool_name',
            'preferredGenres' => 'Sci-Fi,Fantasy',
        ]);

        $res->assertOk()->assertJsonPath('success', true);
        $user->refresh();
        $this->assertEquals('new_cool_name', $user->username);
        $this->assertEquals('Sci-Fi,Fantasy', $user->preferredGenres);
    }

    public function test_user_can_change_password(): void
    {
        $user = User::factory()->create([
            'password' => Hash::make('OldPassword123'),
        ]);

        $res = $this->actingAs($user)->postJson('/api/v1/auth/change-password', [
            'current_password' => 'OldPassword123',
            'new_password' => 'NewPassword456',
        ]);

        $res->assertOk()->assertJsonPath('success', true);

        $user->refresh();
        $this->assertTrue(Hash::check('NewPassword456', $user->password));
    }

    public function test_user_can_save_gcash_payout_with_account_name(): void
    {
        $user = User::factory()->create();

        $res = $this->actingAs($user)->putJson("/api/v1/users/{$user->id}/profile", [
            'payment_method' => 'GCash',
            'payment_account_name' => 'Juan Dela Cruz',
            'payment_account_info' => '09171234567',
        ]);

        $res->assertOk()->assertJsonPath('success', true);
        $user->refresh();
        $this->assertEquals('GCash', $user->payment_method);
        $this->assertEquals('Juan Dela Cruz', $user->payment_account_name);
        $this->assertEquals('09171234567', $user->payment_account_info);
    }

    public function test_duplicate_payout_mobile_number_is_rejected(): void
    {
        $user1 = User::factory()->create([
            'payment_method' => 'GCash',
            'payment_account_name' => 'User One',
            'payment_account_info' => '09171234567',
        ]);

        $user2 = User::factory()->create();

        // Exact match
        $resExact = $this->actingAs($user2)->putJson("/api/v1/users/{$user2->id}/profile", [
            'payment_method' => 'Maya',
            'payment_account_name' => 'User Two',
            'payment_account_info' => '09171234567',
        ]);
        $resExact->assertStatus(422)->assertJsonValidationErrors('payment_account_info');

        // Normalized match (+63 format with spaces)
        $resNormalized = $this->actingAs($user2)->putJson("/api/v1/users/{$user2->id}/profile", [
            'payment_method' => 'GCash',
            'payment_account_name' => 'User Two',
            'payment_account_info' => '+63 917 123 4567',
        ]);
        $resNormalized->assertStatus(422)->assertJsonValidationErrors('payment_account_info');

        // User 1 can resave their own number
        $resSelf = $this->actingAs($user1)->putJson("/api/v1/users/{$user1->id}/profile", [
            'payment_method' => 'GCash',
            'payment_account_name' => 'User One Updated',
            'payment_account_info' => '09171234567',
        ]);
        $resSelf->assertOk();
        $this->assertEquals('User One Updated', $user1->fresh()->payment_account_name);
    }
}
