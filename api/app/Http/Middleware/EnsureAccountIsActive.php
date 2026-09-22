<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureAccountIsActive
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->terminated_at !== null) {
            return response()->json([
                'message' => 'This account has been terminated. Contact support if you believe this is an error.',
            ], 401);
        }

        return $next($request);
    }
}
