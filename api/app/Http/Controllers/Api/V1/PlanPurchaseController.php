<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePlanPurchaseRequest;
use App\Models\PlanPurchase;
use App\Models\User;
use App\PlanPurchaseStatus;
use App\PlanType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class PlanPurchaseController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $purchases = PlanPurchase::query()
            ->where('userId', $request->user()->id)
            ->latest('submitted_at')
            ->latest('id')
            ->limit(20)
            ->get();

        return response()->json(['data' => $purchases]);
    }

    public function store(StorePlanPurchaseRequest $request): JsonResponse
    {
        $storedPath = null;

        try {
            $purchase = DB::transaction(function () use ($request, &$storedPath): PlanPurchase {
                $user = User::query()->whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
                $hasPendingPurchase = PlanPurchase::query()
                    ->where('userId', $user->id)
                    ->where('status', PlanPurchaseStatus::PendingReview)
                    ->exists();

                if ($hasPendingPurchase) {
                    throw ValidationException::withMessages([
                        'purchase' => 'You already have a payment waiting for review.',
                    ]);
                }

                $planType = PlanType::from($request->validated('plan_type'));
                $storedPath = $request->file('payment_proof')->store($user->id, 'payment_proofs');

                return PlanPurchase::create([
                    'id' => (string) Str::uuid(),
                    'userId' => $user->id,
                    'plan_type' => $planType,
                    'amount' => $planType->price(),
                    'currency' => config('moneypad.currency'),
                    'provider' => 'manual',
                    'payment_method' => $request->validated('payment_method'),
                    'reference_number' => 'MP-'.Str::upper(Str::random(20)),
                    'payment_reference' => $request->validated('payment_reference'),
                    'payment_proof_path' => $storedPath,
                    'status' => PlanPurchaseStatus::PendingReview,
                    'submitted_at' => now(),
                ]);
            }, 3);
        } catch (Throwable $exception) {
            if ($storedPath !== null) {
                Storage::disk('payment_proofs')->delete($storedPath);
            }

            throw $exception;
        }

        return response()->json(['purchase' => $purchase], 201);
    }
}
