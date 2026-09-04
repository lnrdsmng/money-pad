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
            'isAuthorVerified' => (bool)$request->user()->isVerified,
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
        $query = $request->input('query', $request->input('q', ''));
        $genre = $request->input('genre');
        $excludeAuthorId = $request->input('excludeAuthorId');

        $builder = Story::query()
            ->leftJoin('users', 'stories.authorId', '=', 'users.id')
            ->select('stories.*', 'users.isVerified as author_is_verified')
            ->where('stories.isPublished', true);

        if (!empty($query)) {
            $builder->where(function ($q) use ($query) {
                $q->where('stories.title', 'like', "%{$query}%")
                  ->orWhere('stories.overview', 'like', "%{$query}%")
                  ->orWhere('stories.authorName', 'like', "%{$query}%");
            });

            $lowerQuery = strtolower($query);
            $builder->orderByRaw("CASE 
                WHEN LOWER(stories.title) = ? THEN 4
                WHEN LOWER(stories.title) LIKE ? THEN 3
                WHEN LOWER(stories.title) LIKE ? THEN 2
                WHEN LOWER(stories.overview) LIKE ? THEN 1
                ELSE 0 END DESC", [
                $lowerQuery,
                $lowerQuery . '%',
                '%' . $lowerQuery . '%',
                '%' . $lowerQuery . '%'
            ]);
        }

        if (!empty($genre) && strtolower($genre) !== 'all') {
            $builder->where('stories.genres', 'like', "%{$genre}%");
        }

        if ($excludeAuthorId) {
            $builder->where('stories.authorId', '!=', $excludeAuthorId);
        }

        // Secondary sort by author verification
        $builder->orderByDesc('users.isVerified');
        $builder->orderByDesc('stories.lastUpdatedAt');

        return response()->json($builder->get());
    }

    public function continueReading(Request $request)
    {
        $user = $request->user();

        $progresses = \App\Models\UserReadingProgress::where('userId', $user->id)
            ->with(['story', 'storyPart'])
            ->orderByDesc('updated_at')
            ->limit(20)
            ->get();

        $results = [];

        foreach ($progresses as $progress) {
            $story = $progress->story;
            if (!$story || !$story->isPublished) {
                continue;
            }

            $totalParts = \App\Models\StoryPart::where('storyId', $story->id)
                ->where('isPublished', true)
                ->count();

            if ($totalParts === 0) {
                continue;
            }

            $readCount = \App\Models\UserReadPart::where('userId', $user->id)
                ->where('storyId', $story->id)
                ->count();

            $percentage = min(100, (int) round(($readCount / max(1, $totalParts)) * 100));

            $part = $progress->storyPart;
            if (!$part || !$part->isPublished) {
                $part = \App\Models\StoryPart::where('storyId', $story->id)
                    ->where('isPublished', true)
                    ->orderBy('order')
                    ->first();
            }

            $results[] = [
                'story' => $story,
                'last_part_id' => $part ? $part->id : $progress->last_part_id,
                'last_part_title' => $part ? $part->title : null,
                'last_scroll_position' => $progress->last_scroll_position,
                'completed_percentage' => $percentage,
                'read_count' => $readCount,
                'total_parts' => $totalParts,
                'updated_at' => $progress->updated_at,
            ];
        }

        return response()->json($results);
    }

    public function recommended(Request $request)
    {
        $user = $request->user();
        $preferred = $user->preferredGenres;
        $genres = [];

        if ($preferred) {
            if (is_string($preferred)) {
                $genres = array_filter(array_map('trim', explode(',', $preferred)));
            } elseif (is_array($preferred)) {
                $genres = $preferred;
            }
        }

        $query = Story::where('isPublished', true)
            ->where('authorId', '!=', $user->id);

        if (!empty($genres)) {
            $query->where(function ($q) use ($genres) {
                foreach ($genres as $g) {
                    $q->orWhere('genres', 'like', "%{$g}%");
                }
            });
        }

        $stories = $query->orderByDesc('isAuthorVerified')
            ->orderByDesc('readCount')
            ->orderByDesc('likes')
            ->limit(15)
            ->get();

        if ($stories->count() < 6) {
            $existingIds = $stories->pluck('id')->toArray();
            $additional = Story::where('isPublished', true)
                ->where('authorId', '!=', $user->id)
                ->whereNotIn('id', $existingIds)
                ->orderByDesc('isAuthorVerified')
                ->orderByDesc('readCount')
                ->orderByDesc('likes')
                ->limit(15 - $stories->count())
                ->get();

            $stories = $stories->merge($additional);
        }

        return response()->json($stories);
    }

    public function genres()
    {
        return response()->json([
            'Romance', 'Fantasy', 'Mystery', 'Sci-Fi', 'Horror', 'Action',
            'LGBTQIA+', 'Werewolf', 'New Adult', 'Short Story', 'Teen Fiction',
            'Historical Fiction', 'Paranormal', 'Humor', 'Contemporary Lit',
            'Diverse Lit', 'Thriller', 'Adventure', 'Fan Fiction', 'Non-Fiction',
            'Poetry', 'General'
        ]);
    }
}
