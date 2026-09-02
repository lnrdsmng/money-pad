<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
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

        // Generate token for mobile app if needed
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function signup(Request $request)
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

        Auth::login($user);
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user' => $user->fresh() ?? $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        if ($request->user() && method_exists($request->user(), 'currentAccessToken') && $request->user()->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
        }

        Auth::logout();

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
}
