<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\DailyLoginRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DailyLoginRewardController extends Controller
{
    public function show(Request $request, DailyLoginRewardService $rewardService): JsonResponse
    {
        return response()->json($rewardService->status($request->user()));
    }

    public function claim(Request $request, DailyLoginRewardService $rewardService): JsonResponse
    {
        $result = $rewardService->claim($request->user());

        return response()->json($result, $result['created'] ? 201 : 200);
    }
}
