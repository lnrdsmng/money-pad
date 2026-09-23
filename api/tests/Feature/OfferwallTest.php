<?php

namespace Tests\Feature;

use App\Models\Offerwall;
use App\Models\OfferwallSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OfferwallTest extends TestCase
{
    use RefreshDatabase;

    private function image(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent(
            'proof.png',
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/5XcAAAAASUVORK5CYII='),
        );
    }

    public function test_stage_review_credits_once_and_unlocks_the_next_stage(): void
    {
        Storage::fake('public');
        Storage::fake('offerwall_proofs');
        $admin = User::factory()->admin()->create();
        $user = User::factory()->create();
        $other = User::factory()->create();
        $response = $this->actingAs($admin)->postJson('/api/v1/admin/offerwalls', [
            'name' => 'Puzzle Quest',
            'description' => 'Complete two levels',
            'download_url' => 'https://example.com/app',
            'image' => $this->image(),
            'stages' => [
                ['name' => 'Level 1', 'reward_coins' => '2.500'],
                ['name' => 'Level 2', 'reward_coins' => '3.000'],
            ],
        ])->assertCreated();
        $offerwall = Offerwall::with('stages')->findOrFail($response->json('offerwall.id'));
        $firstStage = $offerwall->stages[0];
        $secondStage = $offerwall->stages[1];

        $this->actingAs($user)->getJson('/api/v1/offerwalls')->assertOk()
            ->assertJsonPath('data.0.category', 'new');
        $this->postJson("/api/v1/offerwalls/{$offerwall->id}/start")->assertOk()
            ->assertJsonPath('category', 'started')->assertJsonPath('stages.1.status', 'locked');
        $this->getJson('/api/v1/offerwalls?category=new')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/offerwalls?category=started')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson("/api/v1/offerwalls/{$offerwall->id}/stages/{$secondStage->id}/proof", [
            'proof' => $this->image(),
        ])->assertUnprocessable();

        $proofResponse = $this->postJson("/api/v1/offerwalls/{$offerwall->id}/stages/{$firstStage->id}/proof", [
            'proof' => $this->image(),
        ])->assertCreated();
        $submission = OfferwallSubmission::findOrFail($proofResponse->json('submission.id'));
        $this->actingAs($other)->get("/api/v1/offerwall-submissions/{$submission->id}/proof")->assertNotFound();
        $this->actingAs($admin)->postJson("/api/v1/admin/offerwall-submissions/{$submission->id}/approve")
            ->assertOk();
        $this->postJson("/api/v1/admin/offerwall-submissions/{$submission->id}/approve")->assertOk();

        $this->assertDatabaseCount('offerwall_credits', 1);
        $this->assertSame('2.500', $user->fresh()->readerCoins);
        $this->actingAs($user)->getJson("/api/v1/offerwalls/{$offerwall->id}")->assertOk()
            ->assertJsonPath('stages.0.status', 'approved')->assertJsonPath('stages.1.status', 'ready');

        $secondProof = $this->postJson("/api/v1/offerwalls/{$offerwall->id}/stages/{$secondStage->id}/proof", [
            'proof' => $this->image(),
        ])->assertCreated()->json('submission.id');
        $this->actingAs($admin)->postJson("/api/v1/admin/offerwall-submissions/{$secondProof}/reject", [
            'reason' => 'The screenshot does not show level 2.',
        ])->assertOk();
        $this->actingAs($user)->getJson("/api/v1/offerwalls/{$offerwall->id}")->assertOk()
            ->assertJsonPath('stages.1.status', 'rejected');
        $resubmission = $this->postJson("/api/v1/offerwalls/{$offerwall->id}/stages/{$secondStage->id}/proof", [
            'proof' => $this->image(),
        ])->assertCreated()->json('submission.id');
        $this->actingAs($admin)->postJson("/api/v1/admin/offerwall-submissions/{$resubmission}/approve")
            ->assertOk();
        $this->assertDatabaseCount('offerwall_credits', 2);
        $this->assertSame('5.500', $user->fresh()->readerCoins);
        $this->actingAs($user)->getJson("/api/v1/offerwalls/{$offerwall->id}")->assertOk()
            ->assertJsonPath('category', 'completed')->assertJsonPath('earned_coins', '5.500');
        $this->getJson('/api/v1/offerwalls?category=completed')->assertOk()->assertJsonCount(1, 'data');

        $this->actingAs($admin)->deleteJson("/api/v1/admin/offerwalls/{$offerwall->id}")->assertOk();
        $this->actingAs($user)->getJson('/api/v1/offerwalls')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson("/api/v1/offerwalls/{$offerwall->id}/start")->assertNotFound();
        $this->postJson("/api/v1/offerwalls/{$offerwall->id}/stages/{$firstStage->id}/proof", [
            'proof' => $this->image(),
        ])->assertNotFound();

    }
}
