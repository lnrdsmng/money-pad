<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\UserReadPart;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StoryPartController extends Controller
{
    public function index(Request $request, $storyId)
    {
        $onlyPublished = filter_var($request->query('onlyPublished', 'false'), FILTER_VALIDATE_BOOLEAN);

        $query = StoryPart::where('storyId', $storyId)->orderBy('order');

        if ($onlyPublished) {
            $query->where('isPublished', true);
        }

        return response()->json($query->get());
    }

    public function show($partId)
    {
        $part = StoryPart::findOrFail($partId);

        return response()->json($part);
    }

    public function store(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        if ($story->authorId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'required|string',
            'content' => 'required|string',
            'order' => 'nullable|integer',
            'headerImageUrl' => 'nullable|url',
        ]);

        $order = $validated['order'] ?? (($story->parts()->max('order') ?? 0) + 1);

        $part = StoryPart::create(array_merge($validated, [
            'id' => Str::uuid()->toString(),
            'storyId' => $storyId,
            'order' => $order,
            'publishedAt' => 0,
            'isPublished' => false,
        ]));

        return response()->json(['id' => $part->id], 201);
    }

    public function update(Request $request, $partId)
    {
        $part = StoryPart::findOrFail($partId);
        $story = Story::findOrFail($part->storyId);

        if ($story->authorId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'string',
            'content' => 'string',
            'order' => 'integer',
            'headerImageUrl' => 'nullable|url',
            'isPublished' => 'boolean',
        ]);

        if (isset($validated['isPublished']) && $validated['isPublished']) {
            if (! $part->isPublished) {
                $validated['publishedAt'] = time() * 1000;
            }
            if (! $story->isPublished) {
                $story->update([
                    'isPublished' => true,
                    'lastUpdatedAt' => time() * 1000,
                ]);
            }
        }

        $part->update($validated);

        return response()->json(['success' => true]);
    }

    public function destroy(Request $request, $partId)
    {
        $part = StoryPart::findOrFail($partId);
        $story = Story::findOrFail($part->storyId);

        if ($story->authorId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $part->delete();

        return response()->json(['success' => true]);
    }

    public function recordStoryRead(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        // This is a simplified version, should ideally check unique views logic
        $story->increment('readCount');

        return response()->json(['success' => true, 'newReadCount' => $story->readCount]);
    }

    public function recordPartRead(Request $request, $partId)
    {
        $part = StoryPart::findOrFail($partId);
        $userId = $request->user()->id;

        UserReadPart::firstOrCreate(
            ['userId' => $userId, 'partId' => $partId],
            ['storyId' => $part->storyId, 'readAt' => time() * 1000]
        );

        $part->increment('readCount');

        return response()->json(['success' => true]);
    }

    public function recordPartView(Request $request, $partId)
    {
        // View implies hitting the page, doesn't mandate a full read
        $part = StoryPart::findOrFail($partId);

        return response()->json(['success' => true]);
    }

    public function publishedCount($storyId)
    {
        $count = StoryPart::where('storyId', $storyId)->where('isPublished', true)->count();

        return response()->json(['count' => $count]);
    }
}
