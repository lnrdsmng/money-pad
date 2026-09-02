<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function show($userId)
    {
        $user = User::findOrFail($userId);

        return response()->json($user);
    }

    public function updateProfile(Request $request, $userId)
    {
        $user = User::findOrFail($userId);

        // Ensure user can only update their own profile
        if ($request->user()->id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'bio' => 'nullable|string',
            'profileImageUrl' => 'nullable|url',
            'coverImageUrl' => 'nullable|url',
            'payment_method' => 'nullable|string|in:GCash,Maya,Bank Transfer',
            'payment_account_info' => 'nullable|string',
            'bank_name' => 'nullable|string',
        ]);

        $user->update($validated);

        app(\App\Services\WithdrawalService::class)->evaluateAndCreate($user->fresh());

        return response()->json(['success' => true, 'user' => $user->fresh()]);
    }

    public function onboardingGender(Request $request, $userId)
    {
        $user = User::findOrFail($userId);

        if ($request->user()->id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'gender' => 'required|string',
        ]);

        $user->update(['gender' => $validated['gender'], 'onboardingStep' => 2]);

        return response()->json(['success' => true]);
    }

    public function onboardingBirthday(Request $request, $userId)
    {
        $user = User::findOrFail($userId);

        if ($request->user()->id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'birthday' => 'required|string',
        ]);

        $user->update(['birthday' => $validated['birthday'], 'onboardingStep' => 3]);

        return response()->json(['success' => true]);
    }

    public function onboardingGenres(Request $request, $userId)
    {
        $user = User::findOrFail($userId);

        if ($request->user()->id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'preferredGenres' => 'required|string',
        ]);

        $user->update(['preferredGenres' => $validated['preferredGenres'], 'onboardingStep' => 4]);

        return response()->json(['success' => true]);
    }

    public function completeOnboarding(Request $request, $userId)
    {
        $user = User::findOrFail($userId);

        if ($request->user()->id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user->update(['onboardingCompleted' => true]);

        return response()->json(['success' => true]);
    }

    public function search(Request $request)
    {
        $query = $request->input('query', $request->input('q', ''));
        $excludeUserId = $request->input('excludeUserId');

        $users = User::where('username', 'like', "%{$query}%");

        if ($excludeUserId) {
            $users->where('id', '!=', $excludeUserId);
        }

        return response()->json($users->get());
    }
}
