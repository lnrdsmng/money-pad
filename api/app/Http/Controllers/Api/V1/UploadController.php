<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class UploadController extends Controller
{
    public function upload(Request $request)
    {
        $request->validate([
            'image' => 'required|image|max:2048', // 2MB Max
        ]);

        $path = $request->file('image')->store('uploads', 'public');

        return response()->json([
            'url' => asset('storage/'.$path),
        ]);
    }
}
