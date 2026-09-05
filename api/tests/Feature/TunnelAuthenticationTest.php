<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use PHPUnit\Framework\Attributes\TestWith;
use Tests\TestCase;

class TunnelAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    #[TestWith(['moneypad-test.ngrok-free.app'])]
    #[TestWith(['moneypad-test.trycloudflare.com'])]
    public function test_same_origin_tunnel_posts_require_csrf_tokens(string $host): void
    {
        $this->app->instance('env', 'local');

        $response = $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeaders(['Origin' => 'https://'.$host, 'X-Forwarded-Proto' => 'https'])
            ->postJson('http://'.$host.'/api/v1/auth/signup', []);

        $response->assertStatus(419);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_session_users_can_log_out_through_the_tunnel(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user, 'web')
            ->withHeaders(['Origin' => 'https://moneypad-test.trycloudflare.com'])
            ->postJson('http://moneypad-test.trycloudflare.com/api/v1/auth/logout');

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertGuest('web');
    }

    public function test_tunnel_login_sets_session_cookies_with_a_valid_csrf_token(): void
    {
        $user = User::factory()->create(['password' => 'TunnelPassword123']);
        $this->app->instance('env', 'local');

        $response = $this->withSession(['_token' => 'tunnel-csrf'])
            ->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])
            ->withHeaders([
                'Origin' => 'https://moneypad-test.trycloudflare.com',
                'X-Forwarded-Proto' => 'https',
                'X-CSRF-TOKEN' => 'tunnel-csrf',
            ])
            ->postJson('http://moneypad-test.trycloudflare.com/api/v1/auth/login', [
                'username' => $user->username,
                'password' => 'TunnelPassword123',
            ]);

        $response->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertCookie(config('session.cookie'));
        $this->assertAuthenticatedAs($user, 'web');
    }

    public function test_mobile_logout_still_revokes_the_bearer_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('mobile');

        $response = $this->withToken($token->plainTextToken)->postJson('/api/v1/auth/logout');

        $response->assertOk()->assertJsonPath('success', true);
        $this->assertModelMissing($token->accessToken);
    }

    #[TestWith(['127.0.0.1', 'https'])]
    #[TestWith(['::1', 'https'])]
    #[TestWith(['192.0.2.10', 'http'])]
    public function test_only_local_proxies_can_supply_the_public_scheme(string $proxyIp, string $scheme): void
    {
        Route::get('/tunnel-url-check', function (Request $request): JsonResponse {
            return response()->json(['url' => $request->getSchemeAndHttpHost().'/storage/uploads/cover.png']);
        });

        $response = $this->withServerVariables(['REMOTE_ADDR' => $proxyIp])
            ->withHeaders([
                'X-Forwarded-Proto' => 'https',
                'X-Forwarded-Port' => '5173',
                'X-Forwarded-Host' => 'untrusted.example',
            ])
            ->getJson('http://moneypad-test.trycloudflare.com/tunnel-url-check');

        $response->assertOk()->assertJsonPath(
            'url', $scheme.'://moneypad-test.trycloudflare.com/storage/uploads/cover.png',
        );
    }
}
