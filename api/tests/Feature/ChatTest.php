<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_list_chat_messages_with_reply_and_reactions_data(): void
    {
        $userA = User::factory()->create(['username' => 'alice']);
        $userB = User::factory()->create(['username' => 'bob']);

        $msgA = ChatMessage::create([
            'id' => 'msg-1',
            'userId' => $userA->id,
            'username' => $userA->username,
            'message' => 'Hello everyone!',
            'is_system' => false,
        ]);

        $this->actingAs($userB)->postJson("/api/v1/chat/messages/{$msgA->id}/react")
            ->assertOk()
            ->assertJson([
                'reacted' => true,
                'heart_count' => 1,
            ]);

        $replyMsg = $this->actingAs($userB)->postJson('/api/v1/chat/messages', [
            'message' => '@alice Hi Alice!',
            'reply_to_id' => $msgA->id,
        ])->assertOk()->json();

        $this->assertEquals($msgA->id, $replyMsg['reply_to_id']);
        $this->assertEquals('alice', $replyMsg['reply_to']['username']);

        $listRes = $this->actingAs($userB)->getJson('/api/v1/chat/messages')
            ->assertOk()
            ->json();

        $this->assertCount(2, $listRes);
        $firstMsg = collect($listRes)->firstWhere('id', 'msg-1');
        $this->assertEquals(1, $firstMsg['heart_count']);
        $this->assertTrue((bool) $firstMsg['user_has_hearted']);
    }

    public function test_replying_to_a_message_sends_notification_to_original_author(): void
    {
        $userA = User::factory()->create(['username' => 'alice']);
        $userB = User::factory()->create(['username' => 'bob']);

        $msgA = ChatMessage::create([
            'id' => 'msg-1',
            'userId' => $userA->id,
            'username' => $userA->username,
            'message' => 'First message',
            'is_system' => false,
        ]);

        $replyRes = $this->actingAs($userB)->postJson('/api/v1/chat/messages', [
            'message' => '@alice replying to you',
            'reply_to_id' => $msgA->id,
        ])->assertOk()->json();

        $this->assertDatabaseHas('notifications', [
            'userId' => $userA->id,
            'type' => 'CHAT_REPLY',
            'actorId' => $userB->id,
            'partId' => $replyRes['id'],
        ]);
    }

    public function test_mentioning_a_user_sends_notification(): void
    {
        $userA = User::factory()->create(['username' => 'alice']);
        $userB = User::factory()->create(['username' => 'bob']);

        $mentionRes = $this->actingAs($userA)->postJson('/api/v1/chat/messages', [
            'message' => 'Shoutout to @bob for helping out',
        ])->assertOk()->json();

        $this->assertDatabaseHas('notifications', [
            'userId' => $userB->id,
            'type' => 'CHAT_MENTION',
            'actorId' => $userA->id,
            'partId' => $mentionRes['id'],
        ]);
    }

    public function test_heart_reaction_toggle_including_own_message(): void
    {
        $userA = User::factory()->create(['username' => 'alice']);
        $userB = User::factory()->create(['username' => 'bob']);

        $msgA = ChatMessage::create([
            'id' => 'msg-1',
            'userId' => $userA->id,
            'username' => $userA->username,
            'message' => 'My own message',
            'is_system' => false,
        ]);

        // Users can react to their own messages without generating a notification.
        $this->actingAs($userA)->postJson("/api/v1/chat/messages/{$msgA->id}/react")
            ->assertOk()
            ->assertJson(['reacted' => true, 'heart_count' => 1]);
        $this->assertDatabaseMissing('notifications', [
            'userId' => $userA->id,
            'type' => 'CHAT_LIKE',
            'actorId' => $userA->id,
        ]);
        $this->actingAs($userA)->postJson("/api/v1/chat/messages/{$msgA->id}/react")
            ->assertOk()
            ->assertJson(['reacted' => false, 'heart_count' => 0]);

        // User B can react
        $this->actingAs($userB)->postJson("/api/v1/chat/messages/{$msgA->id}/react")
            ->assertOk()
            ->assertJson([
                'reacted' => true,
                'heart_count' => 1,
            ]);

        $this->assertDatabaseHas('notifications', [
            'userId' => $userA->id,
            'type' => 'CHAT_LIKE',
            'actorId' => $userB->id,
            'partId' => $msgA->id,
        ]);

        // User B toggles off (unlikes)
        $this->actingAs($userB)->postJson("/api/v1/chat/messages/{$msgA->id}/react")
            ->assertOk()
            ->assertJson([
                'reacted' => false,
                'heart_count' => 0,
            ]);
    }

    public function test_unread_count_ignores_own_messages_and_can_be_cleared(): void
    {
        $viewer = User::factory()->create();
        $other = User::factory()->create();
        ChatMessage::create(['id' => 'other-1', 'userId' => $other->id, 'username' => $other->username, 'message' => 'Unread']);
        ChatMessage::create(['id' => 'own-1', 'userId' => $viewer->id, 'username' => $viewer->username, 'message' => 'Mine']);

        $this->actingAs($viewer)->getJson('/api/v1/chat/unread-count')->assertOk()->assertJsonPath('count', 1);
        $this->actingAs($viewer)->postJson('/api/v1/chat/read')->assertOk();
        $this->actingAs($viewer)->getJson('/api/v1/chat/unread-count')->assertOk()->assertJsonPath('count', 0);
    }

    public function test_only_admin_can_pin_a_message(): void
    {
        $user = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $message = ChatMessage::create(['id' => 'pin-me', 'userId' => $user->id, 'username' => $user->username, 'message' => 'Important']);

        $this->actingAs($user)->putJson("/api/v1/admin/chat/messages/{$message->id}/pin")->assertForbidden();
        $this->actingAs($admin)->putJson("/api/v1/admin/chat/messages/{$message->id}/pin")->assertOk();
        $this->assertNotNull($message->fresh()->pinned_at);
        $this->actingAs($admin)->deleteJson("/api/v1/admin/chat/messages/{$message->id}/pin")->assertOk();
        $this->assertNull($message->fresh()->pinned_at);
    }
}
