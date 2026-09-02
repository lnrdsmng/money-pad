<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Story;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StoryController extends Controller
{
    public function index()
    {
        return response()->json(Story::all());
    }

    public function show($storyId)
    {
        $story = Story::findOrFail($storyId);

        return response()->json($story);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string',
            'overview' => 'required|string',
            'genres' => 'nullable|string',
            'language' => 'nullable|string',
            'coverImageUrl' => 'nullable|url',
            'isMature' => 'boolean',
        ]);

        $storyId = Str::uuid()->toString();

        $story = Story::create(array_merge($validated, [
            'id' => $storyId,
            'authorId' => $request->user()->id,
            'authorName' => $request->user()->username,
            'lastUpdatedAt' => time() * 1000,
        ]));

        return response()->json(['id' => $story->id], 201);
    }

    public function update(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        if ($story->authorId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validated = $request->validate([
            'title' => 'string',
            'overview' => 'string',
            'genres' => 'nullable|string',
            'language' => 'nullable|string',
            'coverImageUrl' => 'nullable|url',
            'isMature' => 'boolean',
            'isCompleted' => 'boolean',
        ]);

        $validated['lastUpdatedAt'] = time() * 1000;
        $story->update($validated);

        return response()->json(['success' => true]);
    }

    public function destroy(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        if ($story->authorId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $story->delete();

        return response()->json(['success' => true]);
    }

    public function publish(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        if ($story->authorId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $story->update(['isPublished' => true, 'lastUpdatedAt' => time() * 1000]);

        return response()->json(['success' => true]);
    }

    public function unpublish(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        if ($story->authorId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $story->update(['isPublished' => false, 'lastUpdatedAt' => time() * 1000]);

        return response()->json(['success' => true]);
    }

    public function publishedByAuthor($authorId)
    {
        $stories = Story::where('authorId', $authorId)->where('isPublished', true)->get();

        return response()->json($stories);
    }

    public function draftsByAuthor($authorId)
    {
        $stories = Story::where('authorId', $authorId)->where('isPublished', false)->get();

        return response()->json($stories);
    }

    public function search(Request $request)
    {
        $query = $request->input('query', '');
        $genre = $request->input('genre');
        $excludeAuthorId = $request->input('excludeAuthorId');

        $stories = Story::where('title', 'like', "%{$query}%")->where('isPublished', true);

        if ($genre) {
            $stories->where('genres', 'like', "%{$genre}%");
        }

        if ($excludeAuthorId) {
            $stories->where('authorId', '!=', $excludeAuthorId);
        }

        return response()->json($stories->get());
    }

    public function genres()
    {
        // Mocked based on what might be typical or fetched from a config.
        $genres = ['Romance', 'Fantasy', 'Sci-Fi', 'Mystery', 'Thriller', 'Horror', 'Historical', 'Action', 'Adventure'];

        return response()->json($genres);
    }
}
