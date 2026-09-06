<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicUserResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->resource->only([
            'id', 'username', 'bio', 'profileImageUrl', 'coverImageUrl',
            'isVerified', 'followers', 'following', 'signupTimestamp',
        ]);
    }
}
