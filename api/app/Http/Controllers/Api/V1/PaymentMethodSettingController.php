<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePaymentMethodSettingRequest;
use App\Models\PaymentMethodSetting;
use Illuminate\Http\JsonResponse;

class PaymentMethodSettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => PaymentMethodSetting::query()->where('is_active', true)->orderBy('label')->get(),
        ]);
    }

    public function adminIndex(): JsonResponse
    {
        return response()->json([
            'data' => PaymentMethodSetting::query()->orderBy('label')->get(),
        ]);
    }

    public function update(
        UpdatePaymentMethodSettingRequest $request,
        PaymentMethodSetting $paymentMethodSetting,
    ): JsonResponse {
        $paymentMethodSetting->update($request->validated());

        return response()->json(['payment_method' => $paymentMethodSetting->fresh()]);
    }
}
