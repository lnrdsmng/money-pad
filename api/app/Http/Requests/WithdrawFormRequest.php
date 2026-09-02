<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WithdrawFormRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->userId === $this->user()->id;
    }

    public function rules(): array
    {
        return [
            'userId' => 'required|string',
            'amount' => 'required|numeric|min:'.config('moneypad.withdrawals.minimum_amount', 500),
            'method' => 'required|string',
            'accountInfo' => 'required|string',
            'source' => 'required|string|in:AUTHOR,READER,REFERRAL',
            'timestamp' => 'required|numeric',
        ];
    }
}
