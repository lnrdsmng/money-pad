<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DailyLoginRewardService;
use App\Services\PlanExpirationService;
use App\Services\ReferralService;
use App\Services\TurnstileService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function login(Request $request, PlanExpirationService $planExpirationService, TurnstileService $turnstile)
    {
        $turnstile->verify($request, 'login');
        $request->validate([
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        $user = User::where('username', $request->username)->first();

        if (! $user) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        // Transitional hash-on-login strategy
        $needsRehash = false;

        // Check if stored password is a hash (starts with $2y$ or $argon2)
        if (Str::startsWith($user->password, '$2y$') || Str::startsWith($user->password, '$argon2')) {
            if (! Hash::check($request->password, $user->password)) {
                return response()->json(['message' => 'Invalid credentials'], 401);
            }
        } else {
            // Legacy plaintext comparison
            if ($user->password !== $request->password) {
                return response()->json(['message' => 'Invalid credentials'], 401);
            }
            $needsRehash = true;
        }

        if ($user->terminated_at !== null) {
            return response()->json([
                'message' => 'This account has been terminated. Contact support if you believe this is an error.',
            ], 403);
        }

        if ($needsRehash) {
            $user->password = Hash::make($request->password);
            $user->save();
        }

        // Authenticate for SPA (Session)
        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $user = $planExpirationService->synchronize($user);

        // Generate token for mobile app if needed
        $token = $request->hasSession() ? null : $user->createToken('auth_token', ['*'], now()->addDays(7))->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function signup(Request $request, DailyLoginRewardService $rewardService, ReferralService $referralService, TurnstileService $turnstile)
    {
        $turnstile->verify($request, 'signup');
        $request->validate([
            'username' => 'required|string|min:3|max:50|regex:/^[A-Za-z0-9_]+$/|unique:users',
            'email' => 'required|email|max:100|unique:users',
            'password' => ['required', 'string', PasswordRule::min(8)->mixedCase()->numbers()],
            'referral_code' => 'nullable|string|max:255',
        ]);

        $user = DB::transaction(function () use ($request, $rewardService, $referralService): User {
            $user = User::create([
                'id' => Str::uuid()->toString(),
                'username' => $request->username,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'signupTimestamp' => time() * 1000,
                'onboardingStep' => 1,
                'onboardingCompleted' => false,
                'readerCoins' => 0.00,
                'authorIncome' => 0.00,
                'role' => 'user',
                'plan' => 'free',
            ]);
            $rewardService->enroll($user);

            if ($referralCode = trim((string) $request->input('referral_code', ''))) {
                $user = $referralService->claimWelcome($user, $referralCode);
            }

            return $user;
        }, 3);

        Auth::guard('web')->login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $token = $request->hasSession() ? null : $user->createToken('auth_token', ['*'], now()->addDays(7))->plainTextToken;

        return response()->json([
            'user' => $user->fresh() ?? $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $accessToken = $request->user()?->currentAccessToken();

        if ($accessToken instanceof PersonalAccessToken) {
            $accessToken->delete();
        } else {
            $request->user()?->tokens()->delete();
        }

        if (Auth::guard('web')->check()) {
            Auth::guard('web')->logout();
        }

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json(['success' => true]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user());
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => ['required', 'string', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password does not match.'], 422);
        }

        $pwd = $request->new_password;
        $user->password = Hash::make($pwd);
        $user->save();
        $user->tokens()->delete();
        if (config('session.driver') === 'database') {
            DB::table('sessions')->where('user_id', $user->id)
                ->when($request->hasSession(), fn ($query) => $query->where('id', '!=', $request->session()->getId()))
                ->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.',
        ]);
    }

    public function forgotPassword(Request $request, TurnstileService $turnstile)
    {
        $turnstile->verify($request, 'forgot_password');
        $data = $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink($data);

        return response()->json([
            'message' => 'If an account exists for that email, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(Request $request)
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::min(8)->mixedCase()->numbers()],
        ]);

        $status = Password::reset($data, function (User $user, string $password): void {
            $user->forceFill([
                'password' => Hash::make($password),
            ])->save();
            $user->tokens()->delete();
            DB::table('sessions')->where('user_id', $user->id)->delete();
        });

        if ($status !== Password::PasswordReset) {
            return response()->json(['message' => __($status)], 422);
        }

        return response()->json(['message' => 'Password reset successfully.']);
    }
}
