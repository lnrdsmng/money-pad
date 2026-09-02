<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    public function index(Request $request)
    {
        $since = $request->query('since');

        $query = ChatMessage::orderByDesc('created_at');

        if ($since) {
            $query->where('created_at', '>', date('Y-m-d H:i:s', $since));
        }

        $messages = $query->limit(50)->get()->reverse()->values();

        return response()->json($messages);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1000',
        ]);

        $user = $request->user();

        $msg = ChatMessage::create([
            'id' => Str::uuid()->toString(),
            'userId' => $user->id,
            'username' => $user->username,
            'profile_image_url' => $user->profileImageUrl,
            'message' => $validated['message'],
            'is_system' => $user->isAdmin(),
        ]);

        return response()->json($msg);
    }
}
