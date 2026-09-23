<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

class TurnstileService
{
    private const TEST_SECRETS = [
        '1x0000000000000000000000000000000AA',
        '2x0000000000000000000000000000000AA',
        '3x0000000000000000000000000000000AA',
    ];

    public function verify(Request $request, string $action): void
    {
        $secret = (string) config('services.turnstile.secret_key');
        $expectedHostname = (string) config('services.turnstile.hostname');
        $testSecret = in_array($secret, self::TEST_SECRETS, true);

        if ($secret === '' || (app()->environment('production') && ($expectedHostname === '' || $testSecret))) {
            if (app()->environment('production')) {
                abort(503, 'Verification is temporarily unavailable.');
            }

            return;
        }

        $data = $request->validate([
            'turnstile_token' => ['required', 'string', 'max:2048'],
        ]);

        try {
            $response = Http::asForm()
                ->connectTimeout(3)
                ->timeout(8)
                ->post('https://challenges.cloudflare.com/turnstile/v0/siteverify', [
                    'secret' => $secret,
                    'response' => $data['turnstile_token'],
                    'remoteip' => $request->ip(),
                ]);
        } catch (\Throwable) {
            throw ValidationException::withMessages([
                'turnstile_token' => 'Verification is temporarily unavailable. Please try again.',
            ]);
        }

        $result = $response->json();
        if (! $response->successful() || ! is_array($result) || ($result['success'] ?? false) !== true
            || (! $testSecret && ($result['action'] ?? null) !== $action)
            || (! $testSecret && $expectedHostname !== '' && ($result['hostname'] ?? null) !== $expectedHostname)) {
            throw ValidationException::withMessages([
                'turnstile_token' => 'Verification expired or failed. Please try again.',
            ]);
        }
    }
}
