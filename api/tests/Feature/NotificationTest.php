<?php

namespace Tests\Feature;

use App\Models\Notification;
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
}
