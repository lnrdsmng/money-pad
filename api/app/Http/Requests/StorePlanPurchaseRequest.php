<?php

namespace App\Http\Requests;

use App\PlanType;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePlanPurchaseRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'plan_type' => [
                'required',
                Rule::enum(PlanType::class)->except([PlanType::Free]),
            ],
            'payment_method' => [
                'required',
                'string',
                Rule::exists('payment_method_settings', 'id')->where('is_active', true),
            ],
            'payment_reference' => [
                'required',
                'string',
                'max:150',
                Rule::unique('plan_purchases', 'payment_reference')
                    ->where(fn ($query) => $query->where('payment_method', $this->input('payment_method'))),
            ],
            'payment_proof' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'extensions:jpg,jpeg,png,webp',
                'max:5120',
            ],
        ];
    }
}
