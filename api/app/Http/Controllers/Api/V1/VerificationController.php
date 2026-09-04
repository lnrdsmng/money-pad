<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuthorVerificationRequest;
use App\Models\Notification;
use App\Models\PlanPurchase;
use App\Models\Story;
use App\Models\User;
use App\PlanPurchaseStatus;
use App\PlanType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VerificationController extends Controller
{
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        $qualifyingStories = Story::where('authorId', $user->id)
            ->where('isPublished', true)
            ->whereHas('parts', function ($query) {
                $query->where('isPublished', true);
            }, '>=', 10)
            ->get(['id', 'title']);

        $qualifyingCount = $qualifyingStories->count();
        $pendingRequest = AuthorVerificationRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->latest()
            ->first();

        if (!$pendingRequest) {
            $pendingPlan = PlanPurchase::where('userId', $user->id)
                ->where('plan_type', PlanType::AuthorVerification)
                ->where('status', PlanPurchaseStatus::PendingReview)
                ->latest('submitted_at')
                ->first();
            if ($pendingPlan) {
                $pendingRequest = (object)[
                    'id' => $pendingPlan->id,
                    'user_id' => $pendingPlan->userId,
                    'payment_method' => $pendingPlan->payment_method,
                    'payment_reference' => $pendingPlan->payment_reference,
                    'receipt_url' => $pendingPlan->payment_proof_path,
                    'status' => 'pending',
                    'created_at' => $pendingPlan->submitted_at ?? $pendingPlan->created_at,
                ];
            }
        }

        $latestRequest = AuthorVerificationRequest::where('user_id', $user->id)
            ->latest()
            ->first();

        if (!$latestRequest) {
            $latestPlan = PlanPurchase::where('userId', $user->id)
                ->where('plan_type', PlanType::AuthorVerification)
                ->latest('submitted_at')
                ->first();
            if ($latestPlan) {
                $latestRequest = (object)[
                    'id' => $latestPlan->id,
                    'user_id' => $latestPlan->userId,
                    'payment_method' => $latestPlan->payment_method,
                    'payment_reference' => $latestPlan->payment_reference,
                    'receipt_url' => $latestPlan->payment_proof_path,
                    'status' => $latestPlan->status instanceof \BackedEnum ? $latestPlan->status->value : (string)$latestPlan->status,
                    'rejection_reason' => $latestPlan->rejection_reason,
                    'created_at' => $latestPlan->submitted_at ?? $latestPlan->created_at,
                ];
            }
        }

        return response()->json([
            'qualifyingStoriesCount' => $qualifyingCount,
            'requiredStoriesCount' => 2,
            'isEligible' => $qualifyingCount >= 2,
            'isVerified' => (bool)$user->isVerified,
            'authorIncome' => (float)$user->authorIncome,
            'qualifyingStories' => $qualifyingStories,
            'pendingRequest' => $pendingRequest,
            'latestRequest' => $latestRequest,
        ]);
    }

    public function apply(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->isVerified) {
            return response()->json([
                'message' => 'You are already a verified author.',
            ], 422);
        }

        $qualifyingCount = Story::where('authorId', $user->id)
            ->where('isPublished', true)
            ->whereHas('parts', function ($query) {
                $query->where('isPublished', true);
            }, '>=', 10)
            ->count();

        if ($qualifyingCount < 2) {
            return response()->json([
                'message' => 'You need at least 2 published stories with 10+ published chapters each to qualify for verification.',
            ], 422);
        }

        $validated = $request->validate([
            'payment_method' => 'required|string|in:balance,gcash,maya,bank_transfer',
            'payment_reference' => 'nullable|string|max:255',
            'payment_proof' => 'nullable|file|mimes:jpeg,jpg,png,webp|max:10240',
        ]);

        if ($validated['payment_method'] === 'balance') {
            if ((float)$user->authorIncome < 149.00) {
                return response()->json([
                    'message' => 'Insufficient author income balance. ₱149.00 required, current balance is ₱' . number_format($user->authorIncome, 2),
                ], 422);
            }

            DB::transaction(function () use ($user) {
                $user->authorIncome = (float)$user->authorIncome - 149.00;
                $user->isVerified = true;
                $user->save();

                Story::where('authorId', $user->id)->update(['isAuthorVerified' => true]);

                $ref = 'BAL-' . strtoupper(Str::random(10));

                PlanPurchase::create([
                    'id' => (string) Str::uuid(),
                    'userId' => $user->id,
                    'plan_type' => PlanType::AuthorVerification,
                    'amount' => 149.00,
                    'currency' => config('moneypad.currency', 'PHP'),
                    'provider' => 'author_income',
                    'payment_method' => 'author_income',
                    'reference_number' => 'MP-VERIF-' . strtoupper(Str::random(16)),
                    'payment_reference' => $ref,
                    'status' => PlanPurchaseStatus::Approved,
                    'submitted_at' => now(),
                    'paid_at' => now(),
                    'reviewed_by' => $user->id,
                    'reviewed_at' => now(),
                ]);

                AuthorVerificationRequest::create([
                    'id' => Str::uuid()->toString(),
                    'user_id' => $user->id,
                    'payment_method' => 'author_income',
                    'payment_reference' => $ref,
                    'status' => 'approved',
                    'reviewed_at' => now(),
                    'reviewed_by' => $user->id,
                ]);

                Notification::create([
                    'id' => Str::uuid()->toString(),
                    'userId' => $user->id,
                    'type' => 'VERIFIED',
                    'actorId' => $user->id,
                    'actorName' => 'System',
                    'content' => 'Congratulations! Your author profile is now verified.',
                    'timestamp' => time() * 1000,
                    'isRead' => false,
                    'isActorVerified' => true,
                ]);
            });

            return response()->json([
                'success' => true,
                'message' => 'Congratulations! You are now a verified author.',
                'isVerified' => true,
                'user' => $user->fresh(),
            ]);
        }

        // Receipt upload flow (GCash, Maya, Bank Transfer)
        if (!$request->hasFile('payment_proof') || empty($validated['payment_reference'])) {
            return response()->json([
                'message' => 'Proof of payment receipt and payment reference number are required for manual payment.',
            ], 422);
        }

        $pendingRequest = AuthorVerificationRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();

        $pendingPlan = PlanPurchase::where('userId', $user->id)
            ->where('plan_type', PlanType::AuthorVerification)
            ->where('status', PlanPurchaseStatus::PendingReview)
            ->first();

        if ($pendingRequest || $pendingPlan) {
            return response()->json([
                'message' => 'You already have a verification request waiting for review.',
            ], 422);
        }

        $storedPath = $request->file('payment_proof')->store($user->id, 'payment_proofs');

        PlanPurchase::create([
            'id' => (string) Str::uuid(),
            'userId' => $user->id,
            'plan_type' => PlanType::AuthorVerification,
            'amount' => 149.00,
            'currency' => config('moneypad.currency', 'PHP'),
            'provider' => 'manual',
            'payment_method' => $validated['payment_method'],
            'reference_number' => 'MP-VERIF-' . strtoupper(Str::random(16)),
            'payment_reference' => $validated['payment_reference'],
            'payment_proof_path' => $storedPath,
            'status' => PlanPurchaseStatus::PendingReview,
            'submitted_at' => now(),
        ]);

        $verificationRequest = AuthorVerificationRequest::create([
            'id' => Str::uuid()->toString(),
            'user_id' => $user->id,
            'payment_method' => $validated['payment_method'],
            'payment_reference' => $validated['payment_reference'],
            'receipt_url' => $storedPath,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Verification application submitted successfully. Admin will review your receipt shortly.',
            'request' => $verificationRequest,
        ], 201);
    }

    // Admin endpoints
    public function adminIndex(): JsonResponse
    {
        $requests = AuthorVerificationRequest::with('user:id,username,email,isVerified,authorIncome')
            ->latest()
            ->paginate(30);

        return response()->json($requests);
    }

    public function adminProof(AuthorVerificationRequest $verificationRequest): StreamedResponse
    {
        abort_unless(
            $verificationRequest->receipt_url !== null
                && Storage::disk('payment_proofs')->exists($verificationRequest->receipt_url),
            404,
        );

        $extension = pathinfo($verificationRequest->receipt_url, PATHINFO_EXTENSION);

        return Storage::disk('payment_proofs')->response(
            $verificationRequest->receipt_url,
            "verification-proof-{$verificationRequest->id}.{$extension}",
            ['Content-Disposition' => 'inline'],
        );
    }

    public function adminApprove(Request $request, $id): JsonResponse
    {
        $verification = AuthorVerificationRequest::findOrFail($id);

        if ($verification->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be approved.'], 422);
        }

        DB::transaction(function () use ($verification, $request) {
            $verification->update([
                'status' => 'approved',
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

            PlanPurchase::where('userId', $verification->user_id)
                ->where('plan_type', PlanType::AuthorVerification)
                ->where('status', PlanPurchaseStatus::PendingReview)
                ->update([
                    'status' => PlanPurchaseStatus::Approved,
                    'paid_at' => now(),
                    'reviewed_by' => $request->user()->id,
                    'reviewed_at' => now(),
                ]);

            $targetUser = User::findOrFail($verification->user_id);
            $targetUser->update(['isVerified' => true]);

            Story::where('authorId', $targetUser->id)->update(['isAuthorVerified' => true]);

            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $targetUser->id,
                'type' => 'VERIFIED',
                'actorId' => $request->user()->id,
                'actorName' => $request->user()->username,
                'content' => 'Congratulations! Your author verification application has been approved.',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => true,
            ]);
        });

        return response()->json([
            'success' => true,
            'message' => 'Verification request approved.',
            'request' => $verification->fresh('user'),
        ]);
    }

    public function adminReject(Request $request, $id): JsonResponse
    {
        $request->validate(['reason' => 'required|string']);
        $verification = AuthorVerificationRequest::findOrFail($id);

        if ($verification->status !== 'pending') {
            return response()->json(['message' => 'Only pending requests can be rejected.'], 422);
        }

        $verification->update([
            'status' => 'rejected',
            'rejection_reason' => $request->reason,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        PlanPurchase::where('userId', $verification->user_id)
            ->where('plan_type', PlanType::AuthorVerification)
            ->where('status', PlanPurchaseStatus::PendingReview)
            ->update([
                'status' => PlanPurchaseStatus::Rejected,
                'rejection_reason' => $request->reason,
                'reviewed_by' => $request->user()->id,
                'reviewed_at' => now(),
            ]);

        Notification::create([
            'id' => Str::uuid()->toString(),
            'userId' => $verification->user_id,
            'type' => 'SYSTEM',
            'actorId' => $request->user()->id,
            'actorName' => 'Admin',
            'content' => 'Your author verification request was rejected: ' . $request->reason,
            'timestamp' => time() * 1000,
            'isRead' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Verification request rejected.',
            'request' => $verification->fresh('user'),
        ]);
    }
}
