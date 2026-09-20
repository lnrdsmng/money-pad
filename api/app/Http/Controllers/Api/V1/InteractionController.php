<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\PublicUserResource;
use App\Models\Conversation;
use App\Models\Notification;
use App\Models\PartAnnotation;
use App\Models\PartAnnotationReaction;
use App\Models\Review;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\Models\UserStoryLike;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InteractionController extends Controller
{
    public function follow(Request $request, $userId)
    {
        $validated = $request->validate([
            'followedId' => 'required|string',
        ]);

        if ($userId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($userId === $validated['followedId']) {
            return response()->json(['message' => 'You cannot follow yourself.'], 422);
        }

        $inserted = DB::table('follows')->insertOrIgnore([
            'followerId' => $userId,
            'followedId' => $validated['followedId'],
        ]);

        if ($inserted) {
            User::where('id', $userId)->increment('following');
            User::where('id', $validated['followedId'])->increment('followers');

            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $validated['followedId'],
                'type' => 'FOLLOW',
                'actorId' => $userId,
                'actorName' => $request->user()->username,
                'actorProfileImageUrl' => $request->user()->profileImageUrl,
                'content' => $request->user()->username.' started following you',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool) $request->user()->isVerified,
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function unfollow(Request $request, $userId)
    {
        $validated = $request->validate([
            'followedId' => 'required|string',
        ]);

        if ($userId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $deleted = DB::table('follows')
            ->where('followerId', $userId)
            ->where('followedId', $validated['followedId'])
            ->delete();

        if ($deleted) {
            User::where('id', $userId)->where('following', '>', 0)->decrement('following');
            User::where('id', $validated['followedId'])->where('followers', '>', 0)->decrement('followers');
        }

        return response()->json(['success' => true]);
    }

    public function isFollowing($userId, $followedId)
    {
        $exists = DB::table('follows')
            ->where('followerId', $userId)
            ->where('followedId', $followedId)
            ->exists();

        return response()->json(['isFollowing' => $exists]);
    }

    public function followers(Request $request, $userId)
    {
        $followerIds = DB::table('follows')->where('followedId', $userId)->pluck('followerId');
        $users = User::whereIn('id', $followerIds)->get();

        return response()->json($this->usersWithFollowState($request, $users));
    }

    public function following(Request $request, $userId)
    {
        $followedIds = DB::table('follows')->where('followerId', $userId)->pluck('followedId');
        $users = User::whereIn('id', $followedIds)->get();

        return response()->json($this->usersWithFollowState($request, $users));
    }

    public function conversations($authorId)
    {
        $conversations = Conversation::where('authorId', $authorId)
            ->whereNull('parentId')
            ->with('sender:id,username,profileImageUrl,isVerified')
            ->orderByDesc('timestamp')
            ->get();

        $conversations->each(function (Conversation $conversation): void {
            $conversation->senderName = $conversation->sender?->username ?? $conversation->senderName;
            $conversation->senderProfileImageUrl = $conversation->sender?->profileImageUrl;
            $conversation->isSenderVerified = (bool) ($conversation->sender?->isVerified ?? $conversation->isSenderVerified);
            $conversation->makeHidden('sender');
        });

        return response()->json($conversations);
    }

    public function storeConversation(Request $request)
    {
        $validated = $request->validate([
            'authorId' => 'required|string|exists:users,id',
            'message' => 'required|string|max:2000',
            'parentId' => 'nullable|string|exists:conversations,id',
        ]);

        $user = $request->user();
        $parent = null;
        if (! empty($validated['parentId'])) {
            $parent = Conversation::findOrFail($validated['parentId']);
            abort_unless($parent->authorId === $validated['authorId'], 422, 'The reply does not belong to this author wall.');
        }

        $conversation = Conversation::create([
            'id' => Str::uuid()->toString(),
            'authorId' => $validated['authorId'],
            'senderId' => $user->id,
            'senderName' => $user->username,
            'message' => $validated['message'],
            'senderProfileImageUrl' => $user->profileImageUrl,
            'timestamp' => time() * 1000,
            'parentId' => $validated['parentId'] ?? null,
            'isSenderVerified' => $user->isVerified,
        ]);

        $recipients = collect();
        if ($parent && $parent->senderId !== $user->id) {
            $recipients->put($parent->senderId, [
                'type' => 'REPLY',
                'content' => $user->username.' replied to your message on the author wall',
            ]);
        } elseif (! $parent && $validated['authorId'] !== $user->id) {
            $recipients->put($validated['authorId'], [
                'type' => 'CONVERSATION',
                'content' => $user->username.' posted on your message wall',
            ]);
        } elseif (! $parent) {
            DB::table('follows')
                ->where('followedId', $user->id)
                ->where('followerId', '!=', $user->id)
                ->pluck('followerId')
                ->each(fn (string $followerId) => $recipients->put($followerId, [
                    'type' => 'AUTHOR_WALL_POST',
                    'content' => $user->username.' posted a new message on their author wall',
                ]));
        }

        if (preg_match_all('/@([a-zA-Z0-9_]+)/', $validated['message'], $matches)) {
            $mentionedUsernames = array_unique($matches[1]);
            $mentionedUsers = User::whereIn('username', $mentionedUsernames)
                ->where('id', '!=', $user->id)
                ->get();

            foreach ($mentionedUsers as $mUser) {
                $existingNotification = $recipients->get($mUser->id);
                if (in_array($existingNotification['type'] ?? null, ['CONVERSATION', 'REPLY'], true)) {
                    continue;
                }
                $recipients->put($mUser->id, [
                    'type' => 'MENTION',
                    'content' => $user->username.' mentioned you in a message on the author wall',
                ]);
            }
        }

        $recipients->each(function (array $notification, string $recipientId) use ($conversation, $parent, $user): void {
            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $recipientId,
                'type' => $notification['type'],
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'wallAuthorId' => $conversation->authorId,
                'conversationId' => $conversation->id,
                'parentConversationId' => $parent?->id,
                'content' => $notification['content'],
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool) $user->isVerified,
            ]);
        });

        return response()->json(['success' => true, 'conversation' => $conversation]);
    }

    public function replies($parentId)
    {
        $replies = Conversation::where('parentId', $parentId)->with('sender:id,username,profileImageUrl,isVerified')->orderBy('timestamp')->get();
        $replies->each(function (Conversation $conversation): void {
            $conversation->senderName = $conversation->sender?->username ?? $conversation->senderName;
            $conversation->senderProfileImageUrl = $conversation->sender?->profileImageUrl;
            $conversation->isSenderVerified = (bool) ($conversation->sender?->isVerified ?? $conversation->isSenderVerified);
            $conversation->makeHidden('sender');
        });

        return response()->json($replies);
    }

    public function likeConversation(Request $request, $conversationId)
    {
        $validated = $request->validate([
            'userId' => 'required|string',
            'delta' => 'required|integer',
        ]);

        if ($validated['userId'] !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $conversation = Conversation::findOrFail($conversationId);
        $conversation->increment('likes', $validated['delta']);
        $conversation->update(['isLiked' => $validated['delta'] > 0]);

        if ($validated['delta'] > 0 && $conversation->senderId !== $request->user()->id) {
            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $conversation->senderId,
                'type' => 'CONVERSATION_LIKE',
                'actorId' => $request->user()->id,
                'actorName' => $request->user()->username,
                'actorProfileImageUrl' => $request->user()->profileImageUrl,
                'wallAuthorId' => $conversation->authorId,
                'conversationId' => $conversation->id,
                'parentConversationId' => $conversation->parentId,
                'content' => $request->user()->username.' liked your message',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool) $request->user()->isVerified,
            ]);
        }

        return response()->json(['success' => true]);
    }

    private function usersWithFollowState(Request $request, $users): array
    {
        $viewerId = $request->user('sanctum')?->id;
        $followedIds = $viewerId
            ? DB::table('follows')->where('followerId', $viewerId)->whereIn('followedId', $users->pluck('id'))->pluck('followedId')->flip()
            : collect();

        return collect(PublicUserResource::collection($users)->resolve($request))
            ->map(fn (array $user): array => [
                ...$user,
                'isFollowing' => $followedIds->has($user['id']),
            ])
            ->all();
    }

    public function reviews($storyId)
    {
        $reviews = Review::where('storyId', $storyId)->with('user:id,username,profileImageUrl,isVerified')->orderByDesc('timestamp')->get();
        $reviews->each(function (Review $review): void {
            $review->username = $review->user?->username ?? $review->username;
            $review->userProfileImageUrl = $review->user?->profileImageUrl;
            $review->isUserVerified = (bool) ($review->user?->isVerified ?? $review->isUserVerified);
            $review->makeHidden('user');
        });

        return response()->json($reviews);
    }

    public function storeReview(Request $request, $storyId)
    {
        $validated = $request->validate([
            'userId' => 'required|string',
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'required|string',
        ]);

        if ($validated['userId'] !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = $request->user();

        if (Review::where('storyId', $storyId)->where('userId', $user->id)->exists()) {
            return response()->json(['message' => 'You have already reviewed this story.'], 422);
        }

        Review::create([
            'id' => Str::uuid()->toString(),
            'storyId' => $storyId,
            'userId' => $user->id,
            'username' => $user->username,
            'userProfileImageUrl' => $user->profileImageUrl,
            'rating' => $validated['rating'],
            'comment' => $validated['comment'],
            'timestamp' => time() * 1000,
            'isUserVerified' => $user->isVerified,
        ]);

        $story = Story::find($storyId);
        if ($story && $story->authorId !== $user->id) {
            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $story->authorId,
                'type' => 'REVIEW',
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'storyId' => $story->id,
                'storyTitle' => $story->title,
                'content' => $user->username.' gave "'.$story->title.'" a '.$validated['rating'].'-star review',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool) $user->isVerified,
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function hasReviewed(Request $request, $storyId)
    {
        $userId = $request->query('userId');

        $exists = Review::where('storyId', $storyId)->where('userId', $userId)->exists();

        return response()->json(['hasReviewed' => $exists]);
    }

    public function likeStory(Request $request, $storyId)
    {
        $validated = $request->validate([
            'userId' => 'required|string',
        ]);

        if ($validated['userId'] !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $userId = $validated['userId'];

        return DB::transaction(function () use ($request, $storyId, $userId) {
            $story = Story::whereKey($storyId)->lockForUpdate()->firstOrFail();
            $deleted = DB::table('user_story_likes')
                ->where('userId', $userId)
                ->where('storyId', $storyId)
                ->delete();

            if ($deleted > 0) {
                DB::table('stories')
                    ->where('id', $storyId)
                    ->update(['likes' => DB::raw('CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END')]);
                $isLiked = false;
            } else {
                DB::table('user_story_likes')->insertOrIgnore([
                    'userId' => $userId,
                    'storyId' => $storyId,
                ]);
                DB::table('stories')
                    ->where('id', $storyId)
                    ->increment('likes');
                $isLiked = true;

                if ($story->authorId !== $userId) {
                    Notification::create([
                        'id' => Str::uuid()->toString(),
                        'userId' => $story->authorId,
                        'type' => 'LIKE',
                        'actorId' => $userId,
                        'actorName' => $request->user()->username,
                        'actorProfileImageUrl' => $request->user()->profileImageUrl,
                        'storyId' => $story->id,
                        'storyTitle' => $story->title,
                        'content' => $request->user()->username.' liked your story "'.$story->title.'"',
                        'timestamp' => time() * 1000,
                        'isRead' => false,
                        'isActorVerified' => (bool) $request->user()->isVerified,
                    ]);
                }
            }

            $newLikes = (int) DB::table('stories')->where('id', $storyId)->value('likes');

            return response()->json([
                'success' => true,
                'isLiked' => $isLiked,
                'newLikes' => $newLikes,
            ]);
        }, 3);
    }

    public function isStoryLiked(Request $request, $storyId)
    {
        $userId = $request->query('userId');
        $exists = UserStoryLike::where('userId', $userId)->where('storyId', $storyId)->exists();

        return response()->json(['isLiked' => $exists]);
    }

    public function annotationSummaries($partId)
    {
        $summaries = DB::table('part_annotations as annotation')
            ->leftJoin('part_annotations as parent', 'annotation.parentId', '=', 'parent.id')
            ->where('annotation.partId', $partId)
            ->where('annotation.type', 'COMMENT')
            ->selectRaw('COALESCE(parent.startIndex, annotation.startIndex) as startIndex')
            ->selectRaw('COALESCE(parent.endIndex, annotation.endIndex) as endIndex')
            ->selectRaw('COALESCE(parent.selectedText, annotation.selectedText) as selectedText')
            ->selectRaw('COUNT(annotation.id) as commentCount')
            ->groupByRaw('COALESCE(parent.startIndex, annotation.startIndex), COALESCE(parent.endIndex, annotation.endIndex), COALESCE(parent.selectedText, annotation.selectedText)')
            ->get();

        return response()->json($summaries);
    }

    public function annotations(Request $request, $partId)
    {
        if (! $request->has(['startIndex', 'endIndex'])) {
            $annotations = PartAnnotation::where('partId', $partId)->orderByDesc('timestamp')->get();

            return response()->json($annotations);
        }

        $validated = $request->validate([
            'startIndex' => 'required|integer|min:0',
            'endIndex' => 'required|integer|gt:startIndex',
            'page' => 'sometimes|integer|min:1',
        ]);
        $viewerId = $request->user('sanctum')?->id;

        $comments = PartAnnotation::query()
            ->where('partId', $partId)
            ->where('type', 'COMMENT')
            ->whereNull('parentId')
            ->where('startIndex', '>=', $validated['startIndex'])
            ->where('startIndex', '<', $validated['endIndex'])
            ->with([
                'user:id,username,profileImageUrl,isVerified',
                'reactions' => fn ($query) => $viewerId
                    ? $query->where('userId', $viewerId)
                    : $query->whereRaw('1 = 0'),
                'replies' => fn ($query) => $query->with([
                    'user:id,username,profileImageUrl,isVerified',
                    'reactions' => fn ($reactionQuery) => $viewerId
                        ? $reactionQuery->where('userId', $viewerId)
                        : $reactionQuery->whereRaw('1 = 0'),
                ])->withCount('reactions'),
            ])
            ->withCount('reactions')
            ->orderByDesc('timestamp')
            ->paginate(25);

        $comments->getCollection()->transform(
            fn (PartAnnotation $annotation) => $this->serializeAnnotation($annotation)
        );

        return response()->json($comments);
    }

    public function storeAnnotation(Request $request, $partId)
    {
        $validated = $request->validate([
            'userId' => 'sometimes|string',
            'parentId' => 'nullable|string|exists:part_annotations,id',
            'selectedText' => 'required_without:parentId|string|max:10000',
            'startIndex' => 'required_without:parentId|integer|min:0',
            'endIndex' => 'required_without:parentId|integer|gt:startIndex',
            'type' => 'required_without:parentId|string|in:LIKE,COMMENT',
            'content' => [
                Rule::requiredIf(fn () => $request->input('type') === 'COMMENT' || $request->filled('parentId')),
                'nullable',
                'string',
                'max:2000',
            ],
        ]);

        if (isset($validated['userId']) && $validated['userId'] !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = $request->user();
        $parent = null;
        if (! empty($validated['parentId'])) {
            $parent = PartAnnotation::query()
                ->where('id', $validated['parentId'])
                ->where('partId', $partId)
                ->whereNull('parentId')
                ->where('type', 'COMMENT')
                ->firstOrFail();
        }

        $annotation = PartAnnotation::create([
            'id' => Str::uuid()->toString(),
            'parentId' => $parent?->id,
            'partId' => $partId,
            'userId' => $user->id,
            'username' => $user->username,
            'selectedText' => $parent?->selectedText ?? $validated['selectedText'],
            'startIndex' => $parent?->startIndex ?? $validated['startIndex'],
            'endIndex' => $parent?->endIndex ?? $validated['endIndex'],
            'type' => $parent ? 'COMMENT' : $validated['type'],
            'content' => $validated['content'] ?? null,
            'timestamp' => time() * 1000,
            'isUserVerified' => $user->isVerified,
        ]);

        $part = StoryPart::with('story')->find($partId);
        $notifiedUserId = null;
        if ($parent && $parent->userId !== $user->id) {
            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $parent->userId,
                'type' => 'COMMENT_REPLY',
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'storyId' => $part?->story?->id,
                'storyTitle' => $part?->story?->title,
                'partId' => $part?->id,
                'partTitle' => $part?->title,
                'content' => $user->username.' replied to your comment in "'.$part?->title.'"',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool) $user->isVerified,
            ]);
            $notifiedUserId = $parent->userId;
        }

        if ($part && $part->story && $part->story->authorId !== $user->id && $part->story->authorId !== $notifiedUserId) {
            Notification::create([
                'id' => Str::uuid()->toString(), 'userId' => $part->story->authorId,
                'type' => ($parent ? 'COMMENT' : $validated['type']) === 'LIKE' ? 'LIKE' : 'REVIEW',
                'actorId' => $user->id, 'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl, 'storyId' => $part->story->id,
                'storyTitle' => $part->story->title, 'partId' => $part->id, 'partTitle' => $part->title,
                'content' => $user->username.' commented on a passage in "'.$part->title.'"',
                'timestamp' => time() * 1000, 'isRead' => false,
                'isActorVerified' => (bool) $user->isVerified,
            ]);
        }

        return response()->json(['success' => true, 'annotation' => $annotation]);
    }

    public function toggleAnnotationHeart(Request $request, PartAnnotation $annotation)
    {
        abort_unless($annotation->type === 'COMMENT', 422, 'Only comments can receive hearts.');

        $key = [
            'annotationId' => $annotation->id,
            'userId' => $request->user()->id,
        ];
        $existing = PartAnnotationReaction::where($key)->first();

        if ($existing) {
            PartAnnotationReaction::where($key)->delete();
            $isHearted = false;
        } else {
            PartAnnotationReaction::create([
                ...$key,
                'createdAt' => now()->timestamp * 1000,
            ]);
            $isHearted = true;

            if ($annotation->userId !== $request->user()->id) {
                $part = StoryPart::with('story')->find($annotation->partId);
                Notification::create([
                    'id' => Str::uuid()->toString(), 'userId' => $annotation->userId,
                    'type' => 'COMMENT_LIKE', 'actorId' => $request->user()->id,
                    'actorName' => $request->user()->username,
                    'actorProfileImageUrl' => $request->user()->profileImageUrl,
                    'storyId' => $part?->story?->id, 'storyTitle' => $part?->story?->title,
                    'partId' => $part?->id, 'partTitle' => $part?->title,
                    'content' => $request->user()->username.' hearted your comment',
                    'timestamp' => time() * 1000, 'isRead' => false,
                    'isActorVerified' => (bool) $request->user()->isVerified,
                ]);
            }
        }

        return response()->json([
            'isHearted' => $isHearted,
            'heartsCount' => PartAnnotationReaction::where('annotationId', $annotation->id)->count(),
        ]);
    }

    private function serializeAnnotation(
        PartAnnotation $annotation,
        bool $includeReplies = true
    ): array {
        return [
            'id' => $annotation->id,
            'parentId' => $annotation->parentId,
            'userId' => $annotation->userId,
            'username' => $annotation->user?->username ?? $annotation->username,
            'userProfileImageUrl' => $annotation->user?->profileImageUrl,
            'isUserVerified' => (bool) ($annotation->user?->isVerified ?? $annotation->isUserVerified),
            'selectedText' => $annotation->selectedText,
            'startIndex' => $annotation->startIndex,
            'endIndex' => $annotation->endIndex,
            'content' => $annotation->content,
            'timestamp' => $annotation->timestamp,
            'heartsCount' => $annotation->reactions_count,
            'isHearted' => $annotation->reactions->isNotEmpty(),
            'replies' => $includeReplies
                ? $annotation->replies->map(
                    fn (PartAnnotation $reply) => $this->serializeAnnotation($reply, false)
                )->values()
                : [],
        ];
    }
}
