<?php

namespace Database\Factories;

use App\Models\Story;
use App\Models\StoryPart;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<StoryPart>
 */
class StoryPartFactory extends Factory
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
            'storyId' => Story::factory(),
            'title' => fake()->sentence(3),
            'content' => '<p>'.fake()->paragraph().'</p>',
            'order' => 1,
            'publishedAt' => now()->timestamp * 1000,
            'isPublished' => true,
        ];
    }
}
