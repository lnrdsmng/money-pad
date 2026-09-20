<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\Models\UserReadingProgress;
use App\Models\UserReadPart;
use App\Services\ActivityNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;

class StoryController extends Controller
{
    public function __construct(private readonly ActivityNotificationService $activityNotifications) {}

    public function index(Request $request)
    {
        $verifiedAuthor = User::query()
            ->select('isVerified')
            ->whereColumn('users.id', 'stories.authorId')
            ->limit(1);

        return $this->page(
            Story::where('isPublished', true)
                ->orderByDesc($verifiedAuthor)
                ->orderByDesc('lastUpdatedAt')
                ->orderBy('id'),
            $request,
        );
    }

    public function show(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        abort_unless(Gate::forUser($request->user('sanctum'))->allows('view', $story), 404);

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
            'createInitialChapter' => 'sometimes|boolean',
        ]);

        $createInitialChapter = (bool) ($validated['createInitialChapter'] ?? false);
        unset($validated['createInitialChapter']);
        $validated['genres'] = $validated['genres'] ?? '';
        $validated['language'] = $validated['language'] ?? 'en';

        $author = $request->user();
        [$story, $initialPartId] = DB::transaction(function () use ($validated, $author, $createInitialChapter) {
            $story = Story::create(array_merge($validated, [
                'id' => Str::uuid()->toString(),
                'authorId' => $author->id,
                'authorName' => $author->username,
                'isAuthorVerified' => (bool) $author->isVerified,
                'lastUpdatedAt' => time() * 1000,
            ]));

            $initialPartId = null;
            if ($createInitialChapter) {
                $initialPartId = Str::uuid()->toString();
                StoryPart::create([
                    'id' => $initialPartId,
                    'storyId' => $story->id,
                    'title' => 'Untitled Chapter',
                    'content' => '',
                    'order' => 1,
                    'publishedAt' => 0,
                    'isPublished' => false,
                ]);
            }

            return [$story, $initialPartId];
        });

        return response()->json(array_filter([
            'id' => $story->id,
            'initialPartId' => $initialPartId,
        ]), 201);
    }

    public function update(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        Gate::authorize('update', $story);

        $validated = $request->validate([
            'title' => 'string',
            'overview' => 'string',
            'genres' => 'nullable|string',
            'language' => 'nullable|string',
            'coverImageUrl' => 'nullable|url',
            'isMature' => 'boolean',
            'isCompleted' => 'boolean',
        ]);

        if (array_key_exists('genres', $validated)) {
            $validated['genres'] = $validated['genres'] ?? '';
        }

        $validated['lastUpdatedAt'] = time() * 1000;
        $story->update($validated);

        return response()->json(['success' => true]);
    }

    public function destroy(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        Gate::authorize('delete', $story);

        $story->delete();

        return response()->json(['success' => true]);
    }

    public function publish(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        Gate::authorize('update', $story);

        $wasPublished = $story->isPublished;
        $story->update(['isPublished' => true, 'lastUpdatedAt' => time() * 1000]);

        if (! $wasPublished) {
            $this->activityNotifications->notifyStoryPublished($story, $request->user());
        }

        return response()->json(['success' => true]);
    }

    public function unpublish(Request $request, $storyId)
    {
        $story = Story::findOrFail($storyId);

        Gate::authorize('update', $story);

        $story->update(['isPublished' => false, 'lastUpdatedAt' => time() * 1000]);

        return response()->json(['success' => true]);
    }

    public function publishedByAuthor(Request $request, $authorId)
    {
        $stories = Story::where('authorId', $authorId)->where('isPublished', true)->orderByDesc('lastUpdatedAt')->orderBy('id');

        return $this->page($stories, $request);
    }

    public function draftsByAuthor(Request $request, $authorId)
    {
        abort_unless($request->user()->id === $authorId, 403);
        $stories = Story::where('authorId', $authorId)->where('isPublished', false)->orderByDesc('lastUpdatedAt')->orderBy('id');

        return $this->page($stories, $request);
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

        if (! empty($query)) {
            $builder->where(function ($q) use ($query) {
                $q->where('stories.title', 'like', "%{$query}%")
                    ->orWhere('stories.overview', 'like', "%{$query}%")
                    ->orWhere('stories.authorName', 'like', "%{$query}%");
            });

            $lowerQuery = strtolower($query);
            $builder->orderByRaw('CASE
                WHEN LOWER(stories.title) = ? THEN 4
                WHEN LOWER(stories.title) LIKE ? THEN 3
                WHEN LOWER(stories.title) LIKE ? THEN 2
                WHEN LOWER(stories.overview) LIKE ? THEN 1
                ELSE 0 END DESC', [
                $lowerQuery,
                $lowerQuery.'%',
                '%'.$lowerQuery.'%',
                '%'.$lowerQuery.'%',
            ]);
        }

        if (! empty($genre) && strtolower($genre) !== 'all') {
            $builder->where('stories.genres', 'like', "%{$genre}%");
        }

        if ($excludeAuthorId) {
            $builder->where('stories.authorId', '!=', $excludeAuthorId);
        }

        // Secondary sort by author verification
        $builder->orderByDesc('users.isVerified');
        $builder->orderByDesc('stories.lastUpdatedAt');

        return $this->page($builder->orderBy('stories.id'), $request);
    }

    public function continueReading(Request $request)
    {
        $user = $request->user();
        $limit = min(100, max(1, (int) $request->input('limit', 100)));

        $progresses = UserReadingProgress::where('userId', $user->id)
            ->with(['story', 'storyPart:id,storyId,title,isPublished'])
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get();

        $storyIds = $progresses->pluck('storyId');
        $publishedCounts = StoryPart::whereIn('storyId', $storyIds)->where('isPublished', true)
            ->selectRaw('storyId, COUNT(*) AS aggregate')->groupBy('storyId')->pluck('aggregate', 'storyId');
        $readCounts = UserReadPart::where('userId', $user->id)->whereIn('storyId', $storyIds)
            ->selectRaw('storyId, COUNT(*) AS aggregate')->groupBy('storyId')->pluck('aggregate', 'storyId');
        $firstParts = StoryPart::whereIn('storyId', $storyIds)->where('isPublished', true)
            ->select(['id', 'storyId', 'title', 'order'])->orderBy('order')->get()->groupBy('storyId');

        $results = [];

        foreach ($progresses as $progress) {
            $story = $progress->story;
            if (! $story || ! $story->isPublished) {
                continue;
            }

            $totalParts = (int) ($publishedCounts[$story->id] ?? 0);
            if ($totalParts === 0) {
                continue;
            }
            $readCount = (int) ($readCounts[$story->id] ?? 0);

            $percentage = min(100, (int) round(($readCount / max(1, $totalParts)) * 100));

            $part = $progress->storyPart;
            $firstPart = $firstParts->get($story->id)?->first();
            if (! $part || ! $part->isPublished) {
                $part = $firstPart;
            }

            $results[] = [
                'story' => $story,
                'last_part_id' => $part ? $part->id : $progress->last_part_id,
                'last_part_title' => $part ? $part->title : null,
                'first_part_id' => $firstPart ? $firstPart->id : null,
                'last_scroll_position' => $progress->last_scroll_position,
                'completed_percentage' => $percentage,
                'is_finished' => $percentage >= 100 || $readCount >= $totalParts,
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

        if (! empty($genres)) {
            $query->where(function ($q) use ($genres) {
                foreach ($genres as $g) {
                    $q->orWhere('genres', 'like', "%{$g}%");
                }
            });
        }

        $verifiedAuthor = User::query()
            ->select('isVerified')
            ->whereColumn('users.id', 'stories.authorId')
            ->limit(1);

        $stories = $query->orderByDesc($verifiedAuthor)
            ->orderByDesc('readCount')
            ->orderByDesc('likes')
            ->limit(15)
            ->get();

        if ($stories->count() < 6) {
            $existingIds = $stories->pluck('id')->toArray();
            $additional = Story::where('isPublished', true)
                ->where('authorId', '!=', $user->id)
                ->whereNotIn('id', $existingIds)
                ->orderByDesc(User::query()
                    ->select('isVerified')
                    ->whereColumn('users.id', 'stories.authorId')
                    ->limit(1))
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
            'Poetry', 'General',
        ]);
    }

    private function page($query, Request $request): JsonResponse
    {
        $request->validate(['page' => 'sometimes|integer|min:1', 'per_page' => 'sometimes|integer|min:1|max:100']);
        $page = $query->simplePaginate($request->integer('per_page', 30));

        return response()->json($page->items())->header('X-Next-Page', $page->hasMorePages() ? (string) ($page->currentPage() + 1) : '');
    }
}
