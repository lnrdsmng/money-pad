<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Offerwall;
use App\Models\OfferwallStage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminOfferwallController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Offerwall::query()->with('stages')->latest()->paginate(20)
            ->through(fn (Offerwall $offerwall) => [
                'id' => $offerwall->id,
                'name' => $offerwall->name,
                'description' => $offerwall->description,
                'download_url' => $offerwall->download_url,
                'image_url' => '/storage/'.$offerwall->image_path,
                'archived_at' => $offerwall->archived_at,
                'stages' => $offerwall->stages,
            ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'description' => ['required', 'string', 'max:500'],
            'download_url' => ['required', 'url', 'starts_with:https://', 'max:2048'],
            'image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'extensions:jpg,jpeg,png,webp', 'max:5120'],
            'stages' => ['required', 'array', 'min:1', 'max:100'],
            'stages.*.name' => ['required', 'string', 'max:150'],
            'stages.*.reward_coins' => ['required', 'numeric', 'gt:0', 'decimal:0,3', 'max:1000000'],
        ]);
        $path = $request->file('image')->store('offerwalls', 'public');
        try {
            $offerwall = DB::transaction(function () use ($data, $path): Offerwall {
                $offerwall = Offerwall::create([
                    'id' => (string) Str::uuid(),
                    'name' => trim($data['name']),
                    'description' => trim($data['description']),
                    'download_url' => $data['download_url'],
                    'image_path' => $path,
                ]);
                foreach ($data['stages'] as $index => $stage) {
                    OfferwallStage::create([
                        'id' => (string) Str::uuid(),
                        'offerwall_id' => $offerwall->id,
                        'position' => $index + 1,
                        'name' => trim($stage['name']),
                        'reward_coins' => $stage['reward_coins'],
                    ]);
                }

                return $offerwall;
            }, 3);
        } catch (\Throwable $exception) {
            Storage::disk('public')->delete($path);
            throw $exception;
        }

        return response()->json(['offerwall' => $offerwall->load('stages')], 201);
    }

    public function destroy(Offerwall $offerwall): JsonResponse
    {
        $offerwall->update(['archived_at' => now()]);

        return response()->json(['success' => true]);
    }
}
