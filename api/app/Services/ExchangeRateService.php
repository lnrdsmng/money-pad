<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class ExchangeRateService
{
    private const CACHE_KEY = 'author-earnings:usd-php-rate';

    public function usdToPhp(): ?float
    {
        $cached = Cache::get(self::CACHE_KEY);
        $cacheSeconds = (int) config('moneypad.author_earnings.exchange.cache_seconds', 3600);

        if ($this->isUsable($cached, $cacheSeconds)) {
            return (float) $cached['rate'];
        }

        try {
            $query = [];
            $appId = config('moneypad.author_earnings.exchange.app_id');
            $url = (string) config('moneypad.author_earnings.exchange.url');
            if (filled($appId)) {
                $query['app_id'] = $appId;
            } else {
                $url = (string) config('moneypad.author_earnings.exchange.fallback_url');
            }

            $response = Http::connectTimeout(3)
                ->timeout(5)
                ->retry([200, 500])
                ->get($url, $query)
                ->throw();

            $base = strtoupper((string) $response->json('base', 'USD'));
            $rate = (float) ($response->json('rates.PHP') ?? $response->json('rate'));
            if ($base !== 'USD') {
                throw new \UnexpectedValueException('The exchange-rate response must use USD as its base currency.');
            }
            if ($rate <= 0) {
                throw new \UnexpectedValueException('The exchange-rate response did not include a valid PHP rate.');
            }

            Cache::put(self::CACHE_KEY, [
                'rate' => $rate,
                'fetched_at' => now()->timestamp,
            ], now()->addSeconds((int) config('moneypad.author_earnings.exchange.max_stale_seconds', 86400)));

            return $rate;
        } catch (Throwable $exception) {
            Log::warning('Author earnings exchange-rate lookup failed.', [
                'exception' => $exception::class,
                'message' => $exception->getMessage(),
            ]);

            $maxStaleSeconds = (int) config('moneypad.author_earnings.exchange.max_stale_seconds', 86400);

            return $this->isUsable($cached, $maxStaleSeconds) ? (float) $cached['rate'] : null;
        }
    }

    private function isUsable(mixed $cached, int $maximumAgeSeconds): bool
    {
        return is_array($cached)
            && isset($cached['rate'], $cached['fetched_at'])
            && (float) $cached['rate'] > 0
            && now()->timestamp - (int) $cached['fetched_at'] <= $maximumAgeSeconds;
    }
}
