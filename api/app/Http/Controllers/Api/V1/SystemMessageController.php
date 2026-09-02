<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SystemMessage;
use Illuminate\Http\Request;

class SystemMessageController extends Controller
{
    public function index(Request $request, $userId)
    {
        if ($request->user()->id !== $userId) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $messages = SystemMessage::where('userId', $userId)
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($messages);
    }

    public function markAsRead(Request $request, $id)
    {
        $message = SystemMessage::findOrFail($id);
        if ($message->userId !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $message->update(['is_read' => true]);

        return response()->json(['success' => true]);
    }
}
