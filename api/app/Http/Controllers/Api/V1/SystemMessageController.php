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

    public function markAllAsRead(Request $request)
    {
        SystemMessage::where('userId', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['success' => true]);
    }

    public function destroy(Request $request, string $id)
    {
        $deleted = SystemMessage::whereKey($id)
            ->where('userId', $request->user()->id)
            ->delete();

        abort_if($deleted === 0, 404);

        return response()->json(['success' => true]);
    }

    public function destroyAll(Request $request)
    {
        SystemMessage::where('userId', $request->user()->id)->delete();

        return response()->json(['success' => true]);
    }
}
