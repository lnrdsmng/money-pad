<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PlanSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPlanSettingController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => PlanSetting::query()->orderBy('price')->get(),
        ]);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $plan = PlanSetting::findOrFail($id);

        $validated = $request->validate([
            'price' => 'sometimes|numeric|min:0',
            'rate_per_minute' => 'sometimes|numeric|min:0',
            'multiplier' => 'sometimes|numeric|min:0',
            'ads' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ]);

        $plan->update($validated);

        return response()->json([
            'message' => "{$plan->name} plan settings updated successfully.",
            'data' => $plan->fresh(),
        ]);
    }
}
