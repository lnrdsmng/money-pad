<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReadingHeartbeatRequest;
use App\Http\Requests\StartReadingSessionRequest;
use App\Models\ReadingSession;
use App\Models\UserReadingProgress;
use App\Services\ReadingRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ReadingSessionController extends Controller
{
    public function start(StartReadingSessionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        ReadingSession::query()
            ->where('userId', $user->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'ended_at' => now(),
            ]);

        $session = ReadingSession::create([
            'id' => Str::uuid()->toString(),
            'userId' => $user->id,
            'storyId' => $validated['storyId'],
            'partId' => $validated['partId'],
        ]);

        return response()->json($session);
    }

    public function heartbeat(
        ReadingHeartbeatRequest $request,
        ReadingRewardService $readingRewardService,
    ): JsonResponse {
        $result = $readingRewardService->recordHeartbeat(
            $request->user(),
            $request->validated('sessionId'),
        );

        return response()->json(['success' => true, ...$result]);
    }

    public function stop(ReadingHeartbeatRequest $request): JsonResponse
    {
        ReadingSession::query()
            ->where('id', $request->validated('sessionId'))
            ->where('userId', $request->user()->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'ended_at' => now(),
            ]);

        return response()->json(['success' => true]);
    }

    public function getProgress(Request $request, string $userId, string $storyId): JsonResponse
    {
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $progress = UserReadingProgress::where('userId', $userId)->where('storyId', $storyId)->first();

        return response()->json($progress);
    }

    public function saveProgress(Request $request, string $userId): JsonResponse
    {
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'storyId' => 'required|string',
            'last_part_id' => 'required|string',
            'last_scroll_position' => 'required|numeric',
        ]);

        $progress = UserReadingProgress::updateOrCreate(
            ['userId' => $userId, 'storyId' => $validated['storyId']],
            ['last_part_id' => $validated['last_part_id'], 'last_scroll_position' => $validated['last_scroll_position']]
        );

        return response()->json($progress);
    }
}
