<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ActivityNotificationService
{
    public function notifyStoryPublished(Story $story, User $author): void
    {
        $this->notifyFollowers($author, 'NEW_STORY', $story, null, "published a new story: \"{$story->title}\"");
    }

    public function notifyPartPublished(StoryPart $part, User $author): void
    {
        $story = $part->story;
        $this->notifyFollowers($author, 'NEW_PART', $story, $part, "published a new chapter in \"{$story->title}\"");
    }

    private function notifyFollowers(User $author, string $type, Story $story, ?StoryPart $part, string $content): void
    {
        DB::table('follows')->where('followedId', $author->id)->pluck('followerId')
            ->chunk(500)
            ->each(function ($followerIds) use ($author, $type, $story, $part, $content): void {
                $timestamp = now()->timestamp * 1000;
                $rows = collect($followerIds)->map(fn (string $followerId): array => [
                    'id' => (string) Str::uuid(), 'userId' => $followerId, 'type' => $type,
                    'actorId' => $author->id, 'actorName' => $author->username,
                    'actorProfileImageUrl' => $author->profileImageUrl, 'storyId' => $story->id,
                    'storyTitle' => $story->title, 'partId' => $part?->id, 'partTitle' => $part?->title,
                    'content' => $content, 'timestamp' => $timestamp, 'isRead' => false,
                    'isActorVerified' => (bool) $author->isVerified, 'is_pinned' => false,
                ])->all();

                if ($rows !== []) {
                    Notification::insert($rows);
                }
            });
    }
}
