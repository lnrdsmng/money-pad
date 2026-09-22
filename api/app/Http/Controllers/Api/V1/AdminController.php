<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\TerminateUserRequest;
use App\Models\SystemMessage;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\AccountTerminationService;
use App\Services\WithdrawalService;
use App\WithdrawalStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function __construct(
        protected WithdrawalService $withdrawalService,
        protected AccountTerminationService $accountTerminationService,
    ) {}

    public function eligibleWithdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::query()
            ->where('status', WithdrawalStatus::PendingReview->value)
            ->with('user')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($withdrawals);
    }

    public function pendingReviewWithdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::query()
            ->where('status', WithdrawalStatus::PendingReview->value)
            ->with('user')
            ->orderBy('created_at')
            ->get();

        return response()->json($withdrawals);
    }

    public function approvedWithdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::query()
            ->where('status', WithdrawalStatus::Approved->value)
            ->with('user')
            ->orderBy('reviewed_at')
            ->get();

        return response()->json($withdrawals);
    }

    public function completedWithdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::query()
            ->whereIn('status', [
                WithdrawalStatus::Completed->value,
                WithdrawalStatus::Rejected->value,
            ])
            ->with('user')
            ->orderByDesc('updated_at')
            ->get();

        return response()->json($withdrawals);
    }

    public function approveWithdrawal(Request $request, string $id): JsonResponse
    {
        $withdrawal = WithdrawalRequest::findOrFail($id);
        $this->withdrawalService->approve($withdrawal);

        return response()->json(['success' => true]);
    }

    public function completeWithdrawal(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'payout_reference' => 'nullable|string|max:255',
        ]);

        $withdrawal = WithdrawalRequest::findOrFail($id);
        $this->withdrawalService->complete($withdrawal, $validated['payout_reference'] ?? null);

        return response()->json(['success' => true]);
    }

    public function rejectWithdrawal(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => 'required|string|max:1000',
        ]);

        $withdrawal = WithdrawalRequest::findOrFail($id);
        $this->withdrawalService->reject($withdrawal, $validated['reason']);

        return response()->json(['success' => true]);
    }

    public function massNotifyEligible(): JsonResponse
    {
        return response()->json(['success' => true]);
    }

    public function sendMessage(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'userId' => [
                'required',
                'string',
                Rule::exists('users', 'id')->where(fn ($query) => $query
                    ->where('role', 'user')
                    ->whereNull('terminated_at')),
            ],
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'is_pinned' => 'boolean',
        ]);

        $msg = SystemMessage::create([
            'id' => (string) Str::uuid(),
            'userId' => $validated['userId'],
            'type' => 'custom',
            'title' => $validated['title'],
            'content' => $validated['content'],
            'action_type' => 'none',
            'is_pinned' => $validated['is_pinned'] ?? false,
        ]);

        return response()->json($msg);
    }

    public function broadcastMessage(Request $request): JsonResponse
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
        ]);

        return response()->json(['success' => true, 'message' => 'Broadcast simulated']);
    }

    public function users(): JsonResponse
    {
        $users = User::orderByDesc('signupTimestamp')->get();

        return response()->json($users);
    }

    public function searchUsers(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:50'],
        ]);
        $search = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], trim($validated['query']));

        $users = User::query()
            ->select(['id', 'username', 'email'])
            ->where('role', 'user')
            ->whereNull('terminated_at')
            ->where('username', 'like', "%{$search}%")
            ->orderByRaw('CASE WHEN LOWER(username) = ? THEN 0 WHEN LOWER(username) LIKE ? THEN 1 ELSE 2 END', [
                mb_strtolower($validated['query']),
                mb_strtolower($validated['query']).'%',
            ])
            ->orderBy('username')
            ->limit(10)
            ->get();

        return response()->json(['data' => $users]);
    }

    public function terminateUser(TerminateUserRequest $request, User $user): JsonResponse
    {
        $terminatedUser = $this->accountTerminationService->terminate(
            $user,
            $request->user(),
            $request->validated('reason'),
        );

        return response()->json(['user' => $terminatedUser]);
    }

    public function restoreUser(Request $request, User $user): JsonResponse
    {
        $restoredUser = $this->accountTerminationService->restore($user, $request->user());

        return response()->json(['user' => $restoredUser]);
    }
}
