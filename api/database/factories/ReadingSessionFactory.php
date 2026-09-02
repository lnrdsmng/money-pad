<?php

namespace Database\Factories;

use App\Models\ReadingSession;
use App\Models\Story;
use App\Models\StoryPart;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<ReadingSession>
 */
class ReadingSessionFactory extends Factory
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
            'storyId' => Story::factory(),
            'partId' => StoryPart::factory(),
            'started_at' => now(),
            'last_active_at' => now(),
            'duration_seconds' => 0,
            'rewarded_minutes' => 0,
            'coins_earned' => '0.000',
            'is_active' => true,
        ];
    }
}
