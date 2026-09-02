<?php

namespace App\Http\Middleware;

use App\Services\PlanExpirationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SyncExpiredPlan
{
    public function __construct(private PlanExpirationService $planExpirationService) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user() !== null) {
            $synchronizedUser = $this->planExpirationService->synchronize($request->user());
            $request->setUserResolver(fn () => $synchronizedUser);
        }

        return $next($request);
    }
}
