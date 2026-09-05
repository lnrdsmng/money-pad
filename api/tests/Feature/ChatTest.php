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
        $this->assertTrue((bool)$firstMsg['user_has_hearted']);
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

    public function test_heart_reaction_toggle_and_cannot_heart_own_message(): void
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

        // User A cannot react to own message
        $this->actingAs($userA)->postJson("/api/v1/chat/messages/{$msgA->id}/react")
            ->assertStatus(422)
            ->assertJsonPath('message', 'You cannot react to your own message.');

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
}
