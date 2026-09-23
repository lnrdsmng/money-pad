<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\OfferwallSubmission;
use App\Services\OfferwallReviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminOfferwallSubmissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['status' => ['sometimes', 'in:pending,approved,rejected']]);
        $submissions = OfferwallSubmission::query()
            ->when(isset($data['status']), fn ($query) => $query->where('status', $data['status']))
            ->with(['user:id,username,email', 'stage.offerwall'])
            ->latest()->paginate(30);
        $submissions->getCollection()->each(function ($submission): void {
            $submission->setAttribute('proof_url', "/api/v1/admin/offerwall-submissions/{$submission->id}/proof");
            $submission->stage->offerwall->setAttribute(
                'image_url', '/storage/'.$submission->stage->offerwall->image_path,
            );
        });

        return response()->json($submissions);
    }

    public function proof(OfferwallSubmission $submission, OfferwallController $controller): StreamedResponse
    {
        return $controller->serveProof($submission);
    }

    public function approve(Request $request, OfferwallSubmission $submission, OfferwallReviewService $service): JsonResponse
    {
        return response()->json(['submission' => $service->approve($submission, $request->user())]);
    }

    public function reject(Request $request, OfferwallSubmission $submission, OfferwallReviewService $service): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        return response()->json(['submission' => $service->reject($submission, $request->user(), $data['reason'])]);
    }
}
