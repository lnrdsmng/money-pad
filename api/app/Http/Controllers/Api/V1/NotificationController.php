<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    public function index(Request $request, $userId = null)
    {
        $targetUserId = $userId ?? $request->user()->id;

        if ($targetUserId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $notifications = Notification::where('userId', $targetUserId)
            ->orderByDesc('is_pinned')
            ->orderByDesc('timestamp')
            ->get();

        return response()->json($notifications);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'userId' => 'required|string',
            'type' => 'required|string',
            'actorId' => 'required|string',
            'actorName' => 'required|string',
            'actorProfileImageUrl' => 'nullable|url',
            'storyId' => 'nullable|string',
            'storyTitle' => 'nullable|string',
            'partId' => 'nullable|string',
            'partTitle' => 'nullable|string',
            'content' => 'nullable|string',
            'isActorVerified' => 'boolean',
            'is_pinned' => 'boolean',
        ]);

        Notification::create(array_merge($validated, [
            'id' => Str::uuid()->toString(),
            'timestamp' => time() * 1000,
            'isRead' => false,
        ]));

        return response()->json(['success' => true]);
    }

    public function unreadCount(Request $request, $userId = null)
    {
        $targetUserId = $userId ?? $request->user()->id;

        if ($targetUserId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $count = Notification::where('userId', $targetUserId)->where('isRead', false)->count();

        return response()->json(['count' => $count]);
    }

    public function markAsRead(Request $request, $notificationId)
    {
        $notification = Notification::findOrFail($notificationId);

        if ($notification->userId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $notification->update(['isRead' => true]);

        return response()->json(['success' => true]);
    }

    public function markAllAsRead(Request $request, $userId = null)
    {
        $targetUserId = $userId ?? $request->user()->id;

        if ($targetUserId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        Notification::where('userId', $targetUserId)->where('isRead', false)->update(['isRead' => true]);

        return response()->json(['success' => true]);
    }
}
