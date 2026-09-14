<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ReadingList;
use App\Models\Story;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class ReadingListController extends Controller
{
    public function index(User $user): JsonResponse
    {
        $lists = ReadingList::query()
            ->where('userId', $user->id)
            ->with(['stories' => fn ($query) => $query
                ->where('isPublished', true)
                ->orderByDesc('reading_list_stories.addedAt')])
            ->orderByDesc('createdAt')
            ->get()
            ->map(fn (ReadingList $list) => [
                'id' => $list->id,
                'name' => $list->name,
                'description' => $list->description,
                'userId' => $list->userId,
                'createdAt' => $list->createdAt,
                'stories' => $list->stories,
                'storyCount' => $list->stories->count(),
            ]);

        return response()->json($lists);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
        ]);

        $readingList = ReadingList::create([
            'id' => Str::uuid()->toString(),
            'name' => trim($validated['name']),
            'description' => isset($validated['description']) ? trim($validated['description']) : null,
            'userId' => $request->user()->id,
            'createdAt' => now()->timestamp * 1000,
        ]);

        return response()->json([
            ...$readingList->toArray(),
            'stories' => [],
            'storyCount' => 0,
        ], 201);
    }

    public function addStory(Request $request, ReadingList $readingList, Story $story): JsonResponse
    {
        Gate::authorize('update', $readingList);

        abort_unless($story->isPublished || $story->authorId === $request->user()->id, 404);

        $readingList->stories()->syncWithoutDetaching([
            $story->id => ['addedAt' => now()->timestamp * 1000],
        ]);

        return response()->json(['success' => true]);
    }

    public function removeStory(ReadingList $readingList, Story $story): JsonResponse
    {
        Gate::authorize('update', $readingList);
        $readingList->stories()->detach($story->id);

        return response()->json(['success' => true]);
    }
}
