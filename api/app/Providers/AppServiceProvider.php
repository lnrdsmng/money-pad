<?php

namespace App\Providers;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $frontendUrl = rtrim((string) config('moneypad.frontend_url'), '/');

            return $frontendUrl.'/reset-password?token='.urlencode($token).'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });

        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(30)->by('ip:'.$request->ip()),
            Limit::perMinute(5)->by('account:'.mb_strtolower((string) $request->input('username')).'|'.$request->ip()),
        ]);
        RateLimiter::for('signup', fn (Request $request) => Limit::perHour(10)->by($request->ip()));
        RateLimiter::for('forgot-password', fn (Request $request) => [
            Limit::perMinute(5)->by($request->ip()),
            Limit::perMinute(1)->by(mb_strtolower((string) $request->input('email')).'|'.$request->ip()),
        ]);
        RateLimiter::for('reset-password', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
    }
}
