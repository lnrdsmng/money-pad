<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

#[Signature('moneypad:provision-admin {username} {email} {--rotate : Rotate an existing administrator password}')]
#[Description('Provision an administrator using an interactively entered password')]
class ProvisionAdmin extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('Run this command interactively to enter a password securely.');

            return self::FAILURE;
        }
        $data = ['username' => $this->argument('username'), 'email' => $this->argument('email'),
            'password' => $this->secret('New password (at least 12 characters)')];
        $validator = Validator::make($data, ['username' => 'required|string|max:50|regex:/^[A-Za-z0-9_]+$/',
            'email' => 'required|email|max:100', 'password' => 'required|string|min:12']);
        if ($validator->fails()) {
            $this->error($validator->errors()->first());

            return self::FAILURE;
        }
        $existing = User::where('username', $data['username'])->first();
        if ($existing && (! $this->option('rotate') || ! $existing->isAdmin())) {
            $this->error('Account exists. Only existing administrators can be updated with --rotate.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($data, $existing) {
            if ($existing) {
                $existing->update(['password' => $data['password']]);
                $existing->tokens()->delete();
                DB::table('sessions')->where('user_id', $existing->id)->delete();
            } else {
                User::create([...$data, 'id' => (string) Str::uuid(), 'role' => 'admin', 'plan' => 'free', 'onboardingCompleted' => true]);
            }
        });
        $this->info('Administrator credentials saved.');

        return self::SUCCESS;
    }
}
