<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemMessage;
use App\Models\User;
use App\Models\WithdrawalRequest;
use App\Services\WithdrawalService;
use App\WithdrawalStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AdminController extends Controller
{
    public function __construct(
        protected WithdrawalService $withdrawalService
    ) {}

    public function eligibleWithdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::query()
            ->whereIn('status', [
                WithdrawalStatus::Eligible->value,
                WithdrawalStatus::WatchingAds->value,
                WithdrawalStatus::PendingAdChoice->value,
            ])
            ->with('user')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($withdrawals);
    }

    public function pendingReviewWithdrawals(): JsonResponse
    {
        $withdrawals = WithdrawalRequest::query()
            ->whereIn('status', [
                WithdrawalStatus::PendingReview->value,
                WithdrawalStatus::PendingAdChoice->value,
                WithdrawalStatus::WatchingAds->value,
                WithdrawalStatus::Eligible->value,
            ])
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
            'userId' => 'required|string',
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
}
