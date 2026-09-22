<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePaymentMethodSettingRequest;
use App\Models\PaymentMethodSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Throwable;

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
        $validated = $request->safe()->except(['qr_image', 'remove_qr_image']);
        $oldQrImagePath = $paymentMethodSetting->qr_image_path;
        $newQrImagePath = null;

        try {
            if ($request->hasFile('qr_image')) {
                $newQrImagePath = $request->file('qr_image')->store('payment-qr', 'public');
                $validated['qr_image_path'] = $newQrImagePath;
            } elseif ($request->boolean('remove_qr_image')) {
                $validated['qr_image_path'] = null;
            }

            $paymentMethodSetting->update($validated);
        } catch (Throwable $exception) {
            if ($newQrImagePath !== null) {
                Storage::disk('public')->delete($newQrImagePath);
            }

            throw $exception;
        }

        if ($oldQrImagePath !== null && $oldQrImagePath !== $paymentMethodSetting->qr_image_path) {
            Storage::disk('public')->delete($oldQrImagePath);
        }

        return response()->json(['payment_method' => $paymentMethodSetting->fresh()]);
    }
}
