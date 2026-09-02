<?php

namespace Database\Factories;

use App\Models\ReadingReward;
use App\Models\ReadingSession;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use App\PlanType;
use App\ReadingRewardStatus;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ReadingReward>
 */
class ReadingRewardFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'id' => (string) Str::uuid(),
            'userId' => User::factory(),
            'reading_session_id' => ReadingSession::factory(),
            'storyId' => Story::factory(),
            'partId' => StoryPart::factory(),
            'minute_index' => 1,
            'plan_type' => PlanType::Free,
            'rate_per_minute' => '1.000',
            'amount' => '1.000',
            'status' => ReadingRewardStatus::Pending,
            'earned_at' => now(),
            'expires_at' => now()->addDay(),
        ];
    }
}
