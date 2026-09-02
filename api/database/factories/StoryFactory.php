<?php

namespace Database\Factories;

use App\Models\Story;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Story>
 */
class StoryFactory extends Factory
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
            'authorId' => User::factory(),
            'authorName' => fake()->userName(),
            'title' => fake()->sentence(4),
            'overview' => fake()->paragraph(),
            'genres' => 'Fantasy',
            'language' => 'en',
            'isPublished' => true,
            'lastUpdatedAt' => now()->timestamp * 1000,
        ];
    }
}
