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

    protected function prepareForValidation(): void
    {
        if ($this->filled('account_name') && ! $this->filled('payment_reference')) {
            $this->merge(['payment_reference' => $this->input('account_name')]);
        }
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
                'nullable',
                'string',
                'max:150',
            ],
            'account_name' => [
                'nullable',
                'string',
                'max:150',
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
