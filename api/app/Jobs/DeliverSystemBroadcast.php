<?php

namespace App\Jobs;

use App\Models\SystemBroadcast;
use App\Models\SystemBroadcastRecipient;
use App\Models\SystemMessage;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliverSystemBroadcast implements ShouldQueue
{
    use Queueable;

    public function __construct(public string $broadcastId) {}

    public function handle(): void
    {
        $broadcast = SystemBroadcast::findOrFail($this->broadcastId);
        $broadcast->update(['status' => 'sending', 'failure_reason' => null]);
        $recipients = SystemBroadcastRecipient::query()->where('broadcast_id', $this->broadcastId)
            ->whereNull('delivered_at')->orderBy('id')->limit(100)->pluck('id');

        foreach ($recipients as $id) {
            DB::transaction(function () use ($id, $broadcast): void {
                $recipient = SystemBroadcastRecipient::whereKey($id)->lockForUpdate()->firstOrFail();
                if ($recipient->delivered_at !== null) {
                    return;
                }
                SystemMessage::create([
                    'id' => (string) Str::uuid(),
                    'userId' => $recipient->user_id,
                    'type' => 'announcement',
                    'title' => $broadcast->title,
                    'content' => $broadcast->content,
                    'action_type' => 'none',
                ]);
                $recipient->update(['delivered_at' => now()]);
                SystemBroadcast::whereKey($broadcast->id)->increment('delivered_count');
            }, 3);
        }

        if (SystemBroadcastRecipient::where('broadcast_id', $this->broadcastId)->whereNull('delivered_at')->exists()) {
            self::dispatch($this->broadcastId);
        } else {
            $broadcast->update(['status' => 'completed']);
        }
    }

    public function failed(\Throwable $exception): void
    {
        SystemBroadcast::whereKey($this->broadcastId)->update([
            'status' => 'failed',
            'failure_reason' => 'Delivery failed. Retry the queue job after resolving the error.',
        ]);
    }
}
