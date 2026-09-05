<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\DailyLoginRewardService;
use App\Services\PlanExpirationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function login(Request $request, PlanExpirationService $planExpirationService)
    {
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

        if ($needsRehash) {
            $user->password = Hash::make($request->password);
            $user->save();
        }

        // Authenticate for SPA (Session)
        Auth::login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $user = $planExpirationService->synchronize($user);

        // Generate token for mobile app if needed
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function signup(Request $request, DailyLoginRewardService $rewardService)
    {
        $request->validate([
            'username' => 'required|string|unique:users',
            'email' => 'required|email|unique:users',
            'password' => 'required|string|min:8',
        ]);

        $pwd = $request->password;
        // Simple strength check: must have at least one upper, one lower, one number
        if (! preg_match('/[A-Z]/', $pwd) || ! preg_match('/[a-z]/', $pwd) || ! preg_match('/[0-9]/', $pwd)) {
            return response()->json(['message' => 'Password is too weak. Must contain uppercase, lowercase, and numbers.'], 400);
        }

        $user = DB::transaction(function () use ($request, $rewardService): User {
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

            return $user;
        }, 3);

        Auth::login($user);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $token = $user->createToken('auth_token')->plainTextToken;

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
            'new_password' => 'required|string|min:8',
        ]);

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password does not match.'], 422);
        }

        $pwd = $request->new_password;
        if (! preg_match('/[A-Z]/', $pwd) || ! preg_match('/[a-z]/', $pwd) || ! preg_match('/[0-9]/', $pwd)) {
            return response()->json(['message' => 'Password is too weak. Must contain uppercase, lowercase, and numbers.'], 400);
        }

        $user->password = Hash::make($pwd);
        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.',
        ]);
    }
}
