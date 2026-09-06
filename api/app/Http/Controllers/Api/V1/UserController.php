<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicUserResource;
use App\Models\Conversation;
use App\Models\PartAnnotation;
use App\Models\Review;
use App\Models\Story;
use App\Models\User;
use App\Services\PayoutAccount;
use App\Services\WithdrawalService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function show($userId)
    {
        $user = User::where('id', $userId)->orWhere('username', $userId)->firstOrFail();

        return response()->json((new PublicUserResource($user))->resolve());
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
            'payment_account_name' => 'nullable|string|max:100',
            'payment_account_info' => 'nullable|string|max:100',
            'bank_name' => 'nullable|string',
        ]);

        try {
            DB::transaction(function () use ($user, $validated) {
                $locked = User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                $key = PayoutAccount::normalize($validated['payment_account_info'] ?? $locked->payment_account_info);
                if (array_key_exists('payment_account_info', $validated) && $validated['payment_account_info'] === null) {
                    $key = null;
                }
                if ($key !== null && User::where('payout_account_key', $key)->where('id', '!=', $locked->id)->exists()) {
                    throw ValidationException::withMessages(['payment_account_info' => 'This account number / mobile number is already in use by another account.']);
                }
                if ($key !== $locked->payout_account_key) {
                    DB::table('payout_accounts')->where('user_id', $locked->id)->delete();
                }
                if ($key !== null) {
                    $reserved = DB::table('payout_accounts')->where('account_key', $key)->first();
                    if ($reserved && $reserved->user_id !== $locked->id) {
                        throw ValidationException::withMessages(['payment_account_info' => 'This payout account is reserved or requires administrator review.']);
                    }
                    if (! $reserved) {
                        DB::table('payout_accounts')->insert(['account_key' => $key, 'user_id' => $locked->id]);
                    }
                }
                $locked->fill($validated);
                $locked->payout_account_conflict = false;
                $locked->save();
            }, 3);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['payment_account_info' => 'This account number / mobile number is already in use by another account.']);
        }

        app(WithdrawalService::class)->evaluateAndCreate($user->fresh());

        return response()->json(['success' => true, 'user' => $user->fresh()]);
    }

    public function onboardingGender(Request $request, $userId)
    {
        $user = User::findOrFail($userId);

        if ($request->user()->id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'gender' => 'required|string|in:Male,Female',
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

        $users = User::query();

        if (! empty($query)) {
            $users->where('username', 'like', "%{$query}%");

            $lowerQuery = strtolower($query);
            $users->orderByRaw('CASE
                WHEN LOWER(username) = ? THEN 3
                WHEN LOWER(username) LIKE ? THEN 2
                WHEN LOWER(username) LIKE ? THEN 1
                ELSE 0 END DESC', [
                $lowerQuery,
                $lowerQuery.'%',
                '%'.$lowerQuery.'%',
            ]);
        }

        if ($excludeUserId) {
            $users->where('id', '!=', $excludeUserId);
        }

        // Secondary sort by isVerified
        $users->orderByDesc('isVerified');
        $users->orderBy('username');

        $request->validate(['page' => 'sometimes|integer|min:1']);
        $page = $users->orderBy('id')->simplePaginate(50);

        return response()->json(PublicUserResource::collection(collect($page->items()))->resolve())
            ->header('X-Next-Page', $page->hasMorePages() ? (string) ($page->currentPage() + 1) : '');
    }

    public function updateSettings(Request $request, $userId = null)
    {
        $user = $request->user();

        if ($userId && $userId !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'username' => ['sometimes', 'string', 'min:3', 'max:50', Rule::unique('users')->ignore($user->id)],
            'preferredGenres' => ['sometimes', 'string'],
        ]);

        $oldUsername = $user->username;
        DB::transaction(function () use ($user, $validated, $oldUsername) {
            $user->update($validated);

            if (! empty($validated['username']) && $validated['username'] !== $oldUsername) {
                Story::where('authorId', $user->id)->update(['authorName' => $validated['username']]);
                Conversation::where('senderId', $user->id)->update(['senderName' => $validated['username']]);
                Review::where('userId', $user->id)->update(['username' => $validated['username']]);
                PartAnnotation::where('userId', $user->id)->update(['username' => $validated['username']]);
            }

        });

        return response()->json([
            'success' => true,
            'message' => 'Settings updated successfully.',
            'user' => $user->fresh(),
        ]);
    }
}
