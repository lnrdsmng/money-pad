<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Offerwall;
use App\Models\OfferwallParticipation;
use App\Models\OfferwallSubmission;
use App\Services\OfferwallService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OfferwallController extends Controller
{
    public function index(Request $request, OfferwallService $service): JsonResponse
    {
        $data = $request->validate(['category' => ['sometimes', 'in:new,started,completed']]);
        $category = $data['category'] ?? null;
        $participations = OfferwallParticipation::query()->select('offerwall_id')
            ->where('user_id', $request->user()->id);
        $offers = Offerwall::query()->whereNull('archived_at')->with('stages')
            ->when($category === 'new', fn ($query) => $query->whereNotIn('id', clone $participations))
            ->when($category === 'started', fn ($query) => $query->whereIn('id', (clone $participations)->whereNull('completed_at')))
            ->when($category === 'completed', fn ($query) => $query->whereIn('id', (clone $participations)->whereNotNull('completed_at')))
            ->latest()->paginate(20);
        $offers->getCollection()->transform(fn (Offerwall $offerwall) => $service->present($offerwall, $request->user()));

        return response()->json($offers);
    }

    public function show(Request $request, Offerwall $offerwall, OfferwallService $service): JsonResponse
    {
        abort_if($offerwall->archived_at !== null, 404);
        $offerwall->load('stages');

        return response()->json($service->present($offerwall, $request->user(), true));
    }

    public function start(Request $request, Offerwall $offerwall, OfferwallService $service): JsonResponse
    {
        $service->start($offerwall, $request->user());

        return $this->show($request, $offerwall, $service);
    }

    public function submit(Request $request, Offerwall $offerwall, string $stageId, OfferwallService $service): JsonResponse
    {
        $request->validate([
            'proof' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'extensions:jpg,jpeg,png,webp', 'max:5120'],
        ]);
        $path = $request->file('proof')->store($request->user()->id, 'offerwall_proofs');
        $submission = $service->submit($offerwall, $stageId, $request->user(), $path);

        return response()->json(['submission' => $submission], 201);
    }

    public function proof(Request $request, OfferwallSubmission $submission): StreamedResponse
    {
        abort_unless($request->user()->id === $submission->user_id, 404);

        return $this->serveProof($submission);
    }

    public function serveProof(OfferwallSubmission $submission): StreamedResponse
    {
        abort_unless(Storage::disk('offerwall_proofs')->exists($submission->proof_path), 404);

        return Storage::disk('offerwall_proofs')->response(
            $submission->proof_path,
            "offerwall-proof-{$submission->id}.".pathinfo($submission->proof_path, PATHINFO_EXTENSION),
            ['Content-Disposition' => 'inline'],
        );
    }
}
