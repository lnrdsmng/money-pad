<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_request_and_use_password_reset_link(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'reader@example.com']);

        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])
            ->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a password reset link has been sent.');

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user): bool {
            $this->postJson('/api/v1/auth/reset-password', [
                'token' => $notification->token,
                'email' => $user->email,
                'password' => 'NewPassword1',
                'password_confirmation' => 'NewPassword1',
            ])->assertOk();

            return true;
        });

        $this->assertTrue(Hash::check('NewPassword1', $user->fresh()->password));
    }

    public function test_reset_password_uses_signup_password_rules(): void
    {
        $this->postJson('/api/v1/auth/reset-password', [
            'token' => 'invalid-token',
            'email' => 'reader@example.com',
            'password' => 'alllowercase1',
            'password_confirmation' => 'alllowercase1',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_unknown_email_receives_the_same_forgot_password_response(): void
    {
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'missing@example.com'])
            ->assertOk()
            ->assertJsonPath('message', 'If an account exists for that email, a password reset link has been sent.');
    }
}
