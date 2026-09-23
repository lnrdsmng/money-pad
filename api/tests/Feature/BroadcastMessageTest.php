<?php

namespace Tests\Feature;

use App\Jobs\DeliverSystemBroadcast;
use App\Models\SystemBroadcast;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class BroadcastMessageTest extends TestCase
{
    use RefreshDatabase;

    public function test_broadcast_reaches_each_active_user_once_and_survives_message_deletion(): void
    {
        $admin = User::factory()->admin()->create();
        $first = User::factory()->create();
        $second = User::factory()->create();
        User::factory()->create(['terminated_at' => now()]);
        Queue::fake([DeliverSystemBroadcast::class]);

        $response = $this->actingAs($admin)->postJson('/api/v1/admin/messages/broadcast', [
            'title' => 'Notice', 'content' => 'A real announcement',
        ])->assertAccepted()->assertJsonPath('recipient_count', 2);
        $broadcast = SystemBroadcast::findOrFail($response->json('id'));
        Queue::assertPushed(DeliverSystemBroadcast::class);
        (new DeliverSystemBroadcast($broadcast->id))->handle();

        $this->assertDatabaseCount('system_messages', 2);
        $this->actingAs($first)->getJson("/api/v1/users/{$first->id}/system-messages")
            ->assertOk()->assertJsonCount(1)->assertJsonPath('0.title', 'Notice');
        $this->actingAs($second)->getJson("/api/v1/users/{$second->id}/system-messages")
            ->assertOk()->assertJsonCount(1);
        $this->assertSame('completed', $broadcast->fresh()->status);
        $this->assertSame(2, $broadcast->fresh()->delivered_count);

        $this->actingAs($first)->deleteJson('/api/v1/system-messages/delete-all')->assertOk();
        (new DeliverSystemBroadcast($broadcast->id))->handle();
        $this->assertDatabaseCount('system_messages', 1);
    }

    public function test_only_admin_can_start_a_broadcast(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->postJson('/api/v1/admin/messages/broadcast', [
            'title' => 'Notice', 'content' => 'Text',
        ])->assertForbidden();

        $this->assertDatabaseCount('system_broadcasts', 0);
    }
}
