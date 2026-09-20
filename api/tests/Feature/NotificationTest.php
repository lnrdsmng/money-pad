<?php

namespace Tests\Feature;

use App\Models\Notification;
use App\Models\SystemMessage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_notifications_endpoints_work_for_authenticated_user(): void
    {
        $user = User::factory()->create();

        Notification::create([
            'id' => 'notif_1',
            'userId' => $user->id,
            'type' => 'LIKE',
            'actorId' => 'actor_1',
            'actorName' => 'John',
            'content' => 'liked your story',
            'timestamp' => time() * 1000,
            'isRead' => false,
        ]);

        Notification::create([
            'id' => 'notif_2',
            'userId' => $user->id,
            'type' => 'FOLLOW',
            'actorId' => 'actor_2',
            'actorName' => 'Jane',
            'content' => 'followed you',
            'timestamp' => time() * 1000,
            'isRead' => false,
        ]);

        // Unread count
        $countRes = $this->actingAs($user)->getJson('/api/v1/notifications/unread-count');
        $countRes->assertOk()->assertJsonPath('count', 2);

        // List
        $listRes = $this->actingAs($user)->getJson('/api/v1/notifications');
        $listRes->assertOk()->assertJsonCount(2);

        // Mark single as read
        $markRes = $this->actingAs($user)->putJson('/api/v1/notifications/notif_1/read');
        $markRes->assertOk()->assertJsonPath('success', true);

        // Unread count now 1
        $countRes2 = $this->actingAs($user)->getJson('/api/v1/notifications/unread-count');
        $countRes2->assertOk()->assertJsonPath('count', 1);

        // Mark all as read
        $markAllRes = $this->actingAs($user)->postJson('/api/v1/notifications/read-all');
        $markAllRes->assertOk()->assertJsonPath('success', true);

        // Unread count now 0
        $countRes3 = $this->actingAs($user)->getJson('/api/v1/notifications/unread-count');
        $countRes3->assertOk()->assertJsonPath('count', 0);
    }

    public function test_user_can_delete_only_their_notifications_and_system_messages(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        Notification::create([
            'id' => 'mine', 'userId' => $user->id, 'type' => 'WELCOME', 'actorId' => 'system',
            'actorName' => 'System', 'timestamp' => now()->valueOf(), 'isRead' => false,
        ]);
        Notification::create([
            'id' => 'theirs', 'userId' => $other->id, 'type' => 'WELCOME', 'actorId' => 'system',
            'actorName' => 'System', 'timestamp' => now()->valueOf(), 'isRead' => false,
        ]);
        $systemMessage = SystemMessage::create([
            'id' => 'system-mine', 'userId' => $user->id, 'type' => 'info',
            'title' => 'Notice', 'content' => 'Information only.', 'action_type' => 'info',
        ]);

        $this->actingAs($user)->deleteJson('/api/v1/notifications/theirs')->assertNotFound();
        $this->deleteJson('/api/v1/notifications/mine')->assertOk();
        $this->deleteJson("/api/v1/system-messages/{$systemMessage->id}")->assertOk();

        $this->assertDatabaseHas('notifications', ['id' => 'theirs']);
        $this->assertDatabaseMissing('notifications', ['id' => 'mine']);
        $this->assertDatabaseMissing('system_messages', ['id' => 'system-mine']);
    }

    public function test_bulk_notification_actions_are_scoped_to_authenticated_user(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        foreach ([[$user, 'mine'], [$other, 'theirs']] as [$owner, $id]) {
            Notification::create([
                'id' => $id, 'userId' => $owner->id, 'type' => 'WELCOME', 'actorId' => 'system',
                'actorName' => 'System', 'timestamp' => now()->valueOf(), 'isRead' => false,
            ]);
        }

        $this->actingAs($user)->postJson('/api/v1/notifications/read-all')->assertOk();
        $this->assertDatabaseHas('notifications', ['id' => 'mine', 'isRead' => true]);
        $this->assertDatabaseHas('notifications', ['id' => 'theirs', 'isRead' => false]);

        $this->deleteJson('/api/v1/notifications/delete-all')->assertOk();
        $this->assertDatabaseMissing('notifications', ['id' => 'mine']);
        $this->assertDatabaseHas('notifications', ['id' => 'theirs']);
    }
}
