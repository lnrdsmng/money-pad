<?php

namespace Tests\Feature;

use App\Models\PartAnnotation;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ParagraphCommentsTest extends TestCase
{
    use RefreshDatabase;

    public function test_paragraph_summary_counts_comments_and_replies(): void
    {
        [$reader, $part] = $this->createReaderAndPart();

        $comment = $this->createComment($reader, $part, 'comment-1');
        $this->actingAs($reader)->postJson("/api/v1/parts/{$part->id}/annotations", [
            'parentId' => $comment->id,
            'content' => 'A reply',
        ])->assertOk();

        $this->getJson("/api/v1/parts/{$part->id}/annotation-summaries")
            ->assertOk()
            ->assertJsonPath('0.startIndex', 0)
            ->assertJsonPath('0.commentCount', 2);
    }

    public function test_reader_can_reply_and_toggle_a_heart(): void
    {
        [$reader, $part] = $this->createReaderAndPart();
        $comment = $this->createComment($reader, $part, 'comment-2');

        $this->actingAs($reader)
            ->postJson("/api/v1/annotations/{$comment->id}/heart")
            ->assertOk()
            ->assertJson(['isHearted' => true, 'heartsCount' => 1]);

        $this->actingAs($reader)
            ->getJson("/api/v1/parts/{$part->id}/annotations?startIndex=0&endIndex=16")
            ->assertOk()
            ->assertJsonPath('data.0.heartsCount', 1)
            ->assertJsonPath('data.0.isHearted', true);

        $this->actingAs($reader)
            ->postJson("/api/v1/annotations/{$comment->id}/heart")
            ->assertOk()
            ->assertJson(['isHearted' => false, 'heartsCount' => 0]);
    }

    public function test_reply_content_is_required(): void
    {
        [$reader, $part] = $this->createReaderAndPart();
        $comment = $this->createComment($reader, $part, 'comment-3');

        $this->actingAs($reader)->postJson("/api/v1/parts/{$part->id}/annotations", [
            'parentId' => $comment->id,
        ])->assertUnprocessable()->assertJsonValidationErrors('content');
    }

    private function createReaderAndPart(): array
    {
        $author = User::factory()->create();
        $reader = User::factory()->create();
        $story = Story::factory()->create(['authorId' => $author->id, 'authorName' => $author->username]);
        $part = StoryPart::create([
            'id' => 'part-comments',
            'storyId' => $story->id,
            'title' => 'Chapter',
            'content' => '<p>A paragraph here</p>',
            'order' => 1,
            'isPublished' => true,
        ]);

        return [$reader, $part];
    }

    private function createComment(User $reader, StoryPart $part, string $id): PartAnnotation
    {
        return PartAnnotation::create([
            'id' => $id,
            'partId' => $part->id,
            'userId' => $reader->id,
            'username' => $reader->username,
            'selectedText' => 'A paragraph here',
            'startIndex' => 0,
            'endIndex' => 16,
            'type' => 'COMMENT',
            'content' => 'A comment',
            'timestamp' => now()->timestamp * 1000,
            'isUserVerified' => false,
        ]);
    }
}
