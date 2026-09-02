<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\PayMongoService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayMongoWebhookController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request, PayMongoService $payMongoService): JsonResponse
    {
        $payload = $request->getContent();
        if (! $payMongoService->verifyWebhookSignature(
            $payload,
            $request->header('Paymongo-Signature'),
        )) {
            return response()->json(['message' => 'Invalid webhook signature.'], 401);
        }

        $decoded = json_decode($payload, true);
        if (! is_array($decoded)) {
            return response()->json(['message' => 'Invalid webhook payload.'], 400);
        }

        $payMongoService->processWebhook($decoded);

        return response()->json(['received' => true]);
    }
}
