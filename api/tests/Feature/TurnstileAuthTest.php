<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TurnstileAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    public function test_login_requires_a_fresh_verified_token_for_every_attempt(): void
    {
        config(['services.turnstile.secret_key' => 'test-secret', 'services.turnstile.hostname' => 'localhost']);
        Http::preventStrayRequests();
        $used = [];
        Http::fake(['challenges.cloudflare.com/turnstile/v0/siteverify' => function ($request) use (&$used) {
            $token = $request['response'];
            $valid = ! isset($used[$token]);
            $used[$token] = true;

            return Http::response(['success' => $valid, 'hostname' => 'localhost', 'action' => 'login']);
        }]);
        $user = User::factory()->create();
        $first = ['username' => $user->username, 'password' => 'incorrect', 'turnstile_token' => 'first-token'];

        $this->postJson('/api/v1/auth/login', $first)->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', array_merge($first, ['password' => 'Password123!']))
            ->assertUnprocessable()->assertJsonValidationErrors('turnstile_token');
        $this->postJson('/api/v1/auth/login', array_merge($first, [
            'password' => 'Password123!', 'turnstile_token' => 'fresh-token',
        ]))->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_all_three_forms_reject_missing_or_wrong_action_tokens(): void
    {
        config(['services.turnstile.secret_key' => 'test-secret', 'services.turnstile.hostname' => 'localhost']);
        Http::preventStrayRequests();
        Http::fake(['challenges.cloudflare.com/turnstile/v0/siteverify' => Http::response([
            'success' => true, 'hostname' => 'localhost', 'action' => 'login',
        ])]);

        foreach (['login', 'signup', 'forgot-password'] as $form) {
            $this->postJson("/api/v1/auth/{$form}", [])->assertUnprocessable()
                ->assertJsonValidationErrors('turnstile_token');
        }
        $this->postJson('/api/v1/auth/signup', ['turnstile_token' => 'wrong-action'])
            ->assertUnprocessable()->assertJsonValidationErrors('turnstile_token');
        $this->postJson('/api/v1/auth/forgot-password', ['turnstile_token' => 'wrong-action'])
            ->assertUnprocessable()->assertJsonValidationErrors('turnstile_token');

        $this->assertDatabaseCount('users', 0);
    }

    public function test_signup_and_forgot_password_accept_their_own_verified_actions(): void
    {
        config(['services.turnstile.secret_key' => 'test-secret', 'services.turnstile.hostname' => 'localhost']);
        Http::preventStrayRequests();
        Http::fake(['challenges.cloudflare.com/turnstile/v0/siteverify' => fn ($request) => Http::response([
            'success' => true,
            'hostname' => 'localhost',
            'action' => $request['response'] === 'signup-token' ? 'signup' : 'forgot_password',
        ])]);
        Notification::fake();

        $this->postJson('/api/v1/auth/signup', [
            'username' => 'newreader',
            'email' => 'newreader@example.com',
            'password' => 'Password123!',
            'turnstile_token' => 'signup-token',
        ])->assertOk()->assertJsonPath('user.username', 'newreader');
        $user = User::where('username', 'newreader')->firstOrFail();
        $this->postJson('/api/v1/auth/forgot-password', [
            'email' => $user->email,
            'turnstile_token' => 'forgot-token',
        ])->assertOk();
        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_wrong_hostname_is_rejected(): void
    {
        config(['services.turnstile.secret_key' => 'test-secret', 'services.turnstile.hostname' => 'money-pad.example']);
        Http::preventStrayRequests();
        Http::fake(['challenges.cloudflare.com/turnstile/v0/siteverify' => Http::response([
            'success' => true, 'hostname' => 'other.example', 'action' => 'login',
        ])]);

        $this->postJson('/api/v1/auth/login', ['turnstile_token' => 'token'])
            ->assertUnprocessable()->assertJsonValidationErrors('turnstile_token');
    }

    public function test_cloudflare_dummy_key_works_locally_without_action_or_real_hostname(): void
    {
        config([
            'services.turnstile.secret_key' => '1x0000000000000000000000000000000AA',
            'services.turnstile.hostname' => 'localhost',
        ]);
        Http::preventStrayRequests();
        Http::fake(['challenges.cloudflare.com/turnstile/v0/siteverify' => Http::response([
            'success' => true, 'hostname' => 'example.com',
        ])]);
        $user = User::factory()->create();

        $this->postJson('/api/v1/auth/login', [
            'username' => $user->username,
            'password' => 'Password123!',
            'turnstile_token' => 'XXXX.DUMMY.TOKEN.XXXX',
        ])->assertOk()->assertJsonPath('user.id', $user->id);
    }

    public function test_dummy_secret_is_rejected_in_production(): void
    {
        config([
            'services.turnstile.secret_key' => '1x0000000000000000000000000000000AA',
            'services.turnstile.hostname' => 'money-pad.example',
        ]);
        $this->app->instance('env', 'production');

        $this->postJson('/api/v1/auth/login', [
            'username' => 'someone', 'password' => 'Password123!', 'turnstile_token' => 'dummy',
        ])->assertServiceUnavailable();
    }
}
