<?php

namespace App\Services;

use App\Models\Offerwall;
use App\Models\OfferwallCredit;
use App\Models\OfferwallParticipation;
use App\Models\OfferwallSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OfferwallService
{
    public function start(Offerwall $offerwall, User $user): void
    {
        DB::transaction(function () use ($offerwall, $user): void {
            $current = Offerwall::whereKey($offerwall->id)->lockForUpdate()->firstOrFail();
            abort_if($current->archived_at !== null, 404);
            OfferwallParticipation::query()->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'offerwall_id' => $current->id,
                'user_id' => $user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }, 3);
    }

    /** @return array<string, mixed> */
    public function present(Offerwall $offerwall, User $user, bool $includeStages = false): array
    {
        $stages = $offerwall->stages;
        $participation = OfferwallParticipation::where('offerwall_id', $offerwall->id)
            ->where('user_id', $user->id)->first();
        $credits = OfferwallCredit::where('user_id', $user->id)
            ->whereIn('stage_id', $stages->pluck('id'))->get()->keyBy('stage_id');
        $completed = $credits->count();
        $totalCoins = $stages->sum(fn ($stage) => (float) $stage->reward_coins);
        $earnedCoins = $credits->sum(fn ($credit) => (float) $credit->amount);
        $category = $participation === null ? 'new' : ($completed === $stages->count() ? 'completed' : 'started');
        $nextStage = $stages->first(fn ($stage) => ! $credits->has($stage->id));

        $result = [
            'id' => $offerwall->id,
            'name' => $offerwall->name,
            'description' => $offerwall->description,
            'download_url' => $offerwall->download_url,
            'image_url' => '/storage/'.$offerwall->image_path,
            'category' => $category,
            'completed_stages' => $completed,
            'stage_count' => $stages->count(),
            'total_coins' => number_format($totalCoins, 3, '.', ''),
            'earned_coins' => number_format($earnedCoins, 3, '.', ''),
            'next_step' => $nextStage?->name,
        ];

        if ($includeStages) {
            $submissions = OfferwallSubmission::where('user_id', $user->id)
                ->whereIn('stage_id', $stages->pluck('id'))
                ->orderByDesc('created_at')->orderByDesc('id')->get()->unique('stage_id')->keyBy('stage_id');
            $result['stages'] = $stages->map(function ($stage) use ($credits, $submissions, $completed, $participation) {
                $submission = $submissions->get($stage->id);
                $status = match (true) {
                    $credits->has($stage->id) => 'approved',
                    $participation === null || $stage->position > $completed + 1 => 'locked',
                    $submission?->status === 'pending' => 'pending',
                    $submission?->status === 'rejected' => 'rejected',
                    default => 'ready',
                };

                return [
                    'id' => $stage->id,
                    'name' => $stage->name,
                    'position' => $stage->position,
                    'reward_coins' => $stage->reward_coins,
                    'status' => $status,
                    'rejection_reason' => $submission?->rejection_reason,
                    'proof_url' => $submission === null ? null : "/api/v1/offerwall-submissions/{$submission->id}/proof",
                ];
            })->all();
        }

        return $result;
    }

    public function submit(Offerwall $offerwall, string $stageId, User $user, string $proofPath): OfferwallSubmission
    {
        try {
            return DB::transaction(function () use ($offerwall, $stageId, $user, $proofPath): OfferwallSubmission {
                $offerwall = Offerwall::whereKey($offerwall->id)->lockForUpdate()->firstOrFail();
                abort_if($offerwall->archived_at !== null, 404);
                $participation = OfferwallParticipation::where('offerwall_id', $offerwall->id)
                    ->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
                $stage = $offerwall->stages()->whereKey($stageId)->firstOrFail();
                $approvedCount = OfferwallCredit::where('user_id', $user->id)
                    ->whereIn('stage_id', $offerwall->stages()->pluck('id'))->count();
                if ($stage->position !== $approvedCount + 1 || $participation->completed_at !== null
                    || OfferwallSubmission::where('stage_id', $stageId)->where('user_id', $user->id)
                        ->where('status', 'pending')->exists()) {
                    throw ValidationException::withMessages(['stage' => 'This stage is not ready for a new proof.']);
                }

                return OfferwallSubmission::create([
                    'id' => (string) Str::uuid(),
                    'stage_id' => $stageId,
                    'user_id' => $user->id,
                    'proof_path' => $proofPath,
                    'status' => 'pending',
                ]);
            }, 3);
        } catch (\Throwable $exception) {
            Storage::disk('offerwall_proofs')->delete($proofPath);
            throw $exception;
        }
    }
}
