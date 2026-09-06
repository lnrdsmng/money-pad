<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\UserReadPart;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class StoryPartController extends Controller
{
    public function index(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);
        $viewer = $request->user('sanctum');
        abort_unless(Gate::forUser($viewer)->allows('view', $story), 404);
        $owner = $viewer?->id === $story->authorId;
        $onlyPublished = filter_var($request->query('onlyPublished', 'false'), FILTER_VALIDATE_BOOLEAN);

        $query = StoryPart::where('storyId', $storyId)->orderBy('order');

        if (! $owner || $onlyPublished) {
            $query->where('isPublished', true);
        }

        return response()->json($query->get(['id', 'storyId', 'title', 'order', 'isPublished', 'publishedAt', 'readCount', 'headerImageUrl', 'revision']));
    }

    public function show(Request $request, $partId)
    {
        $part = StoryPart::findOrFail($partId);

        abort_unless(Gate::forUser($request->user('sanctum'))->allows('view', $part), 404);

        return response()->json($part);
    }

    public function store(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        Gate::authorize('update', $story);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'nullable|string|max:1000000',
            'order' => 'nullable|integer',
            'headerImageUrl' => 'nullable|url',
        ]);

        $order = $validated['order'] ?? (($story->parts()->max('order') ?? 0) + 1);

        $part = StoryPart::create(array_merge($validated, [
            'id' => Str::uuid()->toString(),
            'storyId' => $storyId,
            'content' => $validated['content'] ?? '',
            'order' => $order,
            'publishedAt' => 0,
            'isPublished' => false,
        ]));

        return response()->json(['id' => $part->id], 201);
    }

    public function update(Request $request, $partId)
    {
        return DB::transaction(function () use ($request, $partId) {
            $part = StoryPart::whereKey($partId)->lockForUpdate()->firstOrFail();
            Gate::authorize('update', $part);
            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'content' => 'sometimes|nullable|string|max:1000000',
                'order' => 'sometimes|integer|min:1',
                'headerImageUrl' => 'sometimes|nullable|url:http,https|max:2048',
                'isPublished' => 'sometimes|boolean',
                'revision' => 'sometimes|integer|min:0',
            ]);
            if (isset($validated['revision']) && $validated['revision'] !== (int) $part->revision) {
                return response()->json(['message' => 'This chapter changed in another editor. Reload before saving.', 'revision' => $part->revision], 409);
            }
            unset($validated['revision']);
            if (($validated['isPublished'] ?? false) && ! $part->isPublished) {
                $validated['publishedAt'] = time() * 1000;
                $part->story->update(['isPublished' => true, 'lastUpdatedAt' => time() * 1000]);
            }
            $part->fill($validated);
            $part->revision++;
            $part->save();

            return response()->json(['success' => true, 'revision' => $part->revision]);
        }, 3);
    }

    public function destroy(Request $request, $partId)
    {
        $part = StoryPart::findOrFail($partId);
        $story = Story::findOrFail($part->storyId);

        Gate::authorize('update', $story);

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

        Gate::authorize('view', $part);
        $read = UserReadPart::firstOrCreate(
            ['userId' => $userId, 'partId' => $partId],
            ['storyId' => $part->storyId, 'readAt' => time() * 1000]
        );

        if ($read->wasRecentlyCreated) {
            $part->increment('readCount');
        }

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
