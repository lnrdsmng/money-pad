<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\RejectPlanPurchaseRequest;
use App\Models\PlanPurchase;
use App\PlanPurchaseStatus;
use App\Services\PlanPurchaseReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminPlanPurchaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['sometimes', Rule::enum(PlanPurchaseStatus::class)],
        ]);

        $purchases = PlanPurchase::query()
            ->when(
                isset($validated['status']),
                fn ($query) => $query->where('status', $validated['status']),
                fn ($query) => $query->whereIn('status', [
                    PlanPurchaseStatus::PendingReview,
                    PlanPurchaseStatus::Approved,
                    PlanPurchaseStatus::Rejected,
                ]),
            )
            ->with(['user:id,username,email,plan', 'reviewer:id,username'])
            ->latest('submitted_at')
            ->latest('id')
            ->paginate(30);

        $purchases->getCollection()->each(function (PlanPurchase $purchase): void {
            $purchase->setAttribute(
                'proof_url',
                "/api/v1/admin/plan-purchases/{$purchase->id}/proof",
            );
        });

        return response()->json($purchases);
    }

    public function proof(PlanPurchase $planPurchase): StreamedResponse
    {
        abort_unless(
            $planPurchase->payment_proof_path !== null
                && Storage::disk('payment_proofs')->exists($planPurchase->payment_proof_path),
            404,
        );

        $extension = pathinfo($planPurchase->payment_proof_path, PATHINFO_EXTENSION);

        return Storage::disk('payment_proofs')->response(
            $planPurchase->payment_proof_path,
            "payment-proof-{$planPurchase->id}.{$extension}",
            ['Content-Disposition' => 'inline'],
        );
    }

    public function approve(
        Request $request,
        PlanPurchase $planPurchase,
        PlanPurchaseReviewService $reviewService,
    ): JsonResponse {
        $purchase = $reviewService->approve($planPurchase, $request->user());

        return response()->json(['purchase' => $purchase]);
    }

    public function reject(
        RejectPlanPurchaseRequest $request,
        PlanPurchase $planPurchase,
        PlanPurchaseReviewService $reviewService,
    ): JsonResponse {
        $purchase = $reviewService->reject(
            $planPurchase,
            $request->user(),
            $request->validated('reason'),
        );

        return response()->json(['purchase' => $purchase]);
    }
}
