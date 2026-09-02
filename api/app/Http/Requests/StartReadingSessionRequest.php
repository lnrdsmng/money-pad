<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StartReadingSessionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'storyId' => [
                'required',
                'string',
                Rule::exists('stories', 'id')->where('isPublished', true),
            ],
            'partId' => [
                'required',
                'string',
                Rule::exists('story_parts', 'id')->where(
                    fn ($query) => $query
                        ->where('storyId', $this->string('storyId')->toString())
                        ->where('isPublished', true),
                ),
            ],
        ];
    }
}
