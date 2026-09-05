<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\ChatMessageReaction;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    public function index(Request $request)
    {
        $since = $request->query('since');
        $userId = $request->user()?->id;

        $query = ChatMessage::with(['replyTo:id,userId,username,message'])
            ->withCount(['reactions as heart_count' => function ($q) {
                $q->where('reaction_type', 'heart');
            }])
            ->orderByDesc('created_at');

        if ($userId) {
            $query->withExists(['reactions as user_has_hearted' => function ($q) use ($userId) {
                $q->where('user_id', $userId)->where('reaction_type', 'heart');
            }]);
        }

        if ($since) {
            $query->where('created_at', '>', date('Y-m-d H:i:s', $since));
        }

        $messages = $query->limit(50)->get()->reverse()->values();

        if (!$userId) {
            $messages->each(function ($msg) {
                $msg->user_has_hearted = false;
            });
        }

        return response()->json($messages);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1000',
            'reply_to_id' => 'nullable|string|exists:chat_messages,id',
        ]);

        $user = $request->user();

        $msg = ChatMessage::create([
            'id' => Str::uuid()->toString(),
            'userId' => $user->id,
            'username' => $user->username,
            'profile_image_url' => $user->profileImageUrl,
            'message' => $validated['message'],
            'reply_to_id' => $validated['reply_to_id'] ?? null,
            'is_system' => $user->isAdmin(),
        ]);

        $notifiedUserIds = [];

        // Notify parent message author if threaded reply
        if (!empty($validated['reply_to_id'])) {
            $parent = ChatMessage::find($validated['reply_to_id']);
            if ($parent && $parent->userId !== $user->id) {
                Notification::create([
                    'id' => Str::uuid()->toString(),
                    'userId' => $parent->userId,
                    'type' => 'CHAT_REPLY',
                    'actorId' => $user->id,
                    'actorName' => $user->username,
                    'actorProfileImageUrl' => $user->profileImageUrl,
                    'partId' => $msg->id,
                    'content' => 'replied to your chat: "' . Str::limit($validated['message'], 50) . '"',
                    'timestamp' => time() * 1000,
                    'isRead' => false,
                    'isActorVerified' => (bool)$user->isVerified,
                ]);
                $notifiedUserIds[] = $parent->userId;
            }
        }

        // Scan for @mentions
        if (preg_match_all('/@([a-zA-Z0-9_]+)/', $validated['message'], $matches)) {
            $mentionedUsernames = array_unique($matches[1]);
            $mentionedUsers = User::whereIn('username', $mentionedUsernames)
                ->where('id', '!=', $user->id)
                ->whereNotIn('id', $notifiedUserIds)
                ->get();

            foreach ($mentionedUsers as $mUser) {
                Notification::create([
                    'id' => Str::uuid()->toString(),
                    'userId' => $mUser->id,
                    'type' => 'CHAT_MENTION',
                    'actorId' => $user->id,
                    'actorName' => $user->username,
                    'actorProfileImageUrl' => $user->profileImageUrl,
                    'partId' => $msg->id,
                    'content' => 'mentioned you in Community Lounge: "' . Str::limit($validated['message'], 50) . '"',
                    'timestamp' => time() * 1000,
                    'isRead' => false,
                    'isActorVerified' => (bool)$user->isVerified,
                ]);
            }
        }

        $msg->load('replyTo:id,userId,username,message');
        $msg->heart_count = 0;
        $msg->user_has_hearted = false;

        return response()->json($msg);
    }

    public function toggleReaction(Request $request, $id)
    {
        $user = $request->user();
        $chatMessage = ChatMessage::findOrFail($id);

        if ($chatMessage->userId === $user->id) {
            return response()->json([
                'message' => 'You cannot react to your own message.',
            ], 422);
        }

        $reaction = ChatMessageReaction::where('chat_message_id', $chatMessage->id)
            ->where('user_id', $user->id)
            ->where('reaction_type', 'heart')
            ->first();

        if ($reaction) {
            $reaction->delete();
            $reacted = false;
        } else {
            ChatMessageReaction::create([
                'id' => Str::uuid()->toString(),
                'chat_message_id' => $chatMessage->id,
                'user_id' => $user->id,
                'reaction_type' => 'heart',
            ]);
            $reacted = true;

            Notification::create([
                'id' => Str::uuid()->toString(),
                'userId' => $chatMessage->userId,
                'type' => 'CHAT_LIKE',
                'actorId' => $user->id,
                'actorName' => $user->username,
                'actorProfileImageUrl' => $user->profileImageUrl,
                'partId' => $chatMessage->id,
                'content' => 'liked your message in Community Lounge',
                'timestamp' => time() * 1000,
                'isRead' => false,
                'isActorVerified' => (bool)$user->isVerified,
            ]);
        }

        $heartCount = ChatMessageReaction::where('chat_message_id', $chatMessage->id)
            ->where('reaction_type', 'heart')
            ->count();

        return response()->json([
            'reacted' => $reacted,
            'heart_count' => $heartCount,
        ]);
    }
}
