<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ReadingHeartbeatRequest;
use App\Http\Requests\StartReadingSessionRequest;
use App\Models\ReadingSession;
use App\Models\User;
use App\Models\UserReadingProgress;
use App\Models\UserReadPart;
use App\Services\ReadingRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class ReadingSessionController extends Controller
{
    public function start(StartReadingSessionRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        return DB::transaction(function () use ($user, $validated) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if (UserReadPart::query()
                ->where('userId', $user->id)
                ->where('partId', $validated['partId'])
                ->exists()) {
                return response()->json([
                    'message' => 'This chapter has already been completed.',
                    'completed' => true,
                ], 409);
            }

            ReadingSession::query()
                ->where('userId', $user->id)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'ended_at' => now(),
                ]);

            $now = now();
            $session = ReadingSession::create([
                'id' => Str::uuid()->toString(),
                'userId' => $user->id,
                'storyId' => $validated['storyId'],
                'partId' => $validated['partId'],
                'started_at' => $now,
                'last_active_at' => $now,
            ]);

            DB::table('active_reading_sessions')->updateOrInsert(['user_id' => $user->id], ['session_id' => $session->id]);

            return response()->json([
                ...$session->toArray(),
                'reading_policy' => [
                    'heartbeat_interval_seconds' => (int) config('moneypad.reading.heartbeat_interval_seconds'),
                    'idle_timeout_seconds' => (int) config('moneypad.reading.idle_timeout_seconds'),
                ],
            ]);
        }, 3);
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
            'storyId' => 'required|string|exists:stories,id',
            'last_part_id' => ['required', 'string', Rule::exists('story_parts', 'id')->where('storyId', $request->input('storyId'))],
            'last_scroll_position' => 'required|numeric|between:0,1',
        ]);

        $progress = UserReadingProgress::updateOrCreate(
            ['userId' => $userId, 'storyId' => $validated['storyId']],
            ['last_part_id' => $validated['last_part_id'], 'last_scroll_position' => $validated['last_scroll_position']]
        );

        return response()->json($progress);
    }
}
