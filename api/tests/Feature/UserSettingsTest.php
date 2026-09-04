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
}
