<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Notification;
use App\Models\PartAnnotation;
use App\Models\Review;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\Models\UserStoryLike;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
                'content' => $request->user()->username . ' started following you',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool)$request->user()->isVerified,
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

    public function followers($userId)
    {
        $followerIds = DB::table('follows')->where('followedId', $userId)->pluck('followerId');
        $users = User::whereIn('id', $followerIds)->get();

        return response()->json($users);
    }

    public function following($userId)
    {
        $followedIds = DB::table('follows')->where('followerId', $userId)->pluck('followedId');
        $users = User::whereIn('id', $followedIds)->get();

        return response()->json($users);
    }

    public function conversations($authorId)
    {
        $conversations = Conversation::where('authorId', $authorId)
            ->whereNull('parentId')
            ->orderByDesc('timestamp')
            ->get();

        return response()->json($conversations);
    }

    public function storeConversation(Request $request)
    {
        $validated = $request->validate([
            'authorId' => 'required|string',
            'message' => 'required|string',
            'parentId' => 'nullable|string',
        ]);

        $user = $request->user();

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

        // If threaded reply, notify parent message author
        if (!empty($validated['parentId'])) {
            $parent = Conversation::find($validated['parentId']);
            if ($parent && $parent->senderId !== $user->id) {
                Notification::create([
                    'id' => Str::uuid()->toString(),
                    'userId' => $parent->senderId,
                    'type' => 'REPLY',
                    'actorId' => $user->id,
                    'actorName' => $user->username,
                    'actorProfileImageUrl' => $user->profileImageUrl,
                    'content' => $user->username . ' replied to your comment on the author wall',
                    'timestamp' => time() * 1000,
                    'isRead' => false,
                    'isActorVerified' => (bool)$user->isVerified,
                ]);
            }
        } elseif ($validated['authorId'] !== $user->id) {
            // New wall post, notify wall owner
            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $validated['authorId'],
                'type' => 'CONVERSATION',
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'content' => $user->username . ' posted on your message wall',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool)$user->isVerified,
            ]);
        }

        // Scan for @mentions
        if (preg_match_all('/@([a-zA-Z0-9_]+)/', $validated['message'], $matches)) {
            $mentionedUsernames = array_unique($matches[1]);
            $mentionedUsers = User::whereIn('username', $mentionedUsernames)
                ->where('id', '!=', $user->id)
                ->get();

            foreach ($mentionedUsers as $mUser) {
                Notification::create([
                    'id' => Str::uuid()->toString(),
                    'userId' => $mUser->id,
                    'type' => 'MENTION',
                    'actorId' => $user->id,
                    'actorName' => $user->username,
                    'actorProfileImageUrl' => $user->profileImageUrl,
                    'content' => $user->username . ' mentioned you in a message on the author wall',
                    'timestamp' => time() * 1000,
                    'isRead' => false,
                    'isActorVerified' => (bool)$user->isVerified,
                ]);
            }
        }

        return response()->json(['success' => true]);
    }

    public function replies($parentId)
    {
        $replies = Conversation::where('parentId', $parentId)->orderBy('timestamp')->get();

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
                'content' => $request->user()->username . ' liked your message',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool)$request->user()->isVerified,
            ]);
        }

        return response()->json(['success' => true]);
    }

    public function reviews($storyId)
    {
        $reviews = Review::where('storyId', $storyId)->orderByDesc('timestamp')->get();

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
                'content' => $user->username . ' gave "' . $story->title . '" a ' . $validated['rating'] . '-star review',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool)$user->isVerified,
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

        $story = Story::findOrFail($storyId);
        $userId = $validated['userId'];

        $existingLike = UserStoryLike::where('userId', $userId)->where('storyId', $storyId)->first();

        if ($existingLike) {
            $existingLike->delete();
            $story->decrement('likes');
        } else {
            UserStoryLike::create(['userId' => $userId, 'storyId' => $storyId]);
            $story->increment('likes');

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
                    'content' => $request->user()->username . ' liked your story "' . $story->title . '"',
                    'timestamp' => time() * 1000,
                    'isRead' => false,
                    'isActorVerified' => (bool)$request->user()->isVerified,
                ]);
            }
        }

        return response()->json(['success' => true, 'newLikes' => $story->likes]);
    }

    public function isStoryLiked(Request $request, $storyId)
    {
        $userId = $request->query('userId');
        $exists = UserStoryLike::where('userId', $userId)->where('storyId', $storyId)->exists();

        return response()->json(['isLiked' => $exists]);
    }

    public function annotations($partId)
    {
        $annotations = PartAnnotation::where('partId', $partId)->orderByDesc('timestamp')->get();

        return response()->json($annotations);
    }

    public function storeAnnotation(Request $request, $partId)
    {
        $validated = $request->validate([
            'userId' => 'required|string',
            'selectedText' => 'required|string',
            'startIndex' => 'required|integer',
            'endIndex' => 'required|integer',
            'type' => 'required|string|in:LIKE,COMMENT',
            'content' => 'nullable|string',
        ]);

        if ($validated['userId'] !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = $request->user();

        PartAnnotation::create([
            'id' => Str::uuid()->toString(),
            'partId' => $partId,
            'userId' => $user->id,
            'username' => $user->username,
            'selectedText' => $validated['selectedText'],
            'startIndex' => $validated['startIndex'],
            'endIndex' => $validated['endIndex'],
            'type' => $validated['type'],
            'content' => $validated['content'] ?? null,
            'timestamp' => time() * 1000,
            'isUserVerified' => $user->isVerified,
        ]);

        $part = StoryPart::with('story')->find($partId);
        if ($part && $part->story && $part->story->authorId !== $user->id) {
            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $part->story->authorId,
                'type' => $validated['type'] === 'LIKE' ? 'LIKE' : 'REVIEW',
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'storyId' => $part->story->id,
                'storyTitle' => $part->story->title,
                'partId' => $part->id,
                'partTitle' => $part->title,
                'content' => $validated['type'] === 'LIKE'
                    ? $user->username . ' liked a passage in "' . $part->title . '"'
                    : $user->username . ' commented on a passage in "' . $part->title . '"',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool)$user->isVerified,
            ]);
        }

        return response()->json(['success' => true]);
    }
}
