<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\RewardedAdService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RewardedAdController extends Controller
{
    public function start(Request $request, RewardedAdService $ads): JsonResponse
    {
        $data = $request->validate(['purpose' => 'required|in:coins,withdrawal', 'target_id' => 'nullable|string|max:50']);

        return response()->json($ads->start($request->user(), $data['purpose'], $data['target_id'] ?? null), 201);
    }

    public function verifyMock(Request $request, string $eventId, RewardedAdService $ads): JsonResponse
    {
        $ads->verifyMock($request->user(), $eventId);

        return response()->json(['success' => true]);
    }
}
