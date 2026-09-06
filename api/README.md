# MoneyPad API

Laravel API for the React application in `../frontend`. Install PHP 8.3+ with PDO SQLite (tests), the PDO driver for your production database, mbstring and XML; install Composer dependencies with `composer install`.

## Local setup

Copy `.env.example` to `.env`, configure the database, then run:

```sh
php artisan key:generate
php artisan migrate
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

Use the frontend proxy for cookie authentication. Configure the application URL, trusted Sanctum SPA domains and secure session cookies for your deployment. React uses sessions; bearer tokens are for API clients and expire after seven days. Logout revokes tokens and password changes invalidate other sessions.

## Structure

`routes/api.php` defines the versioned API. Controllers validate requests and delegate financial operations to services. Policies enforce story/chapter ownership and publication visibility. Public user resources explicitly allowlist profile fields; authenticated account data comes from `/auth/me`. `config/moneypad.php` owns plan, fee, conversion and reward rules.

Reading sessions serialize on the user record and have one authoritative active-session pointer. Reward and payout mutations lock fresh rows in transactions. CoinAmount represents coins in thousandths; payouts round down to centavos and preserve the unpaid coin remainder. Referral attribution uses immutable user IDs.

Story lists and user search return arrays with `X-Next-Page`; clients request `page` until that header is empty. Chapter lists return summaries, with content fetched separately. Chapter updates accept `revision` and return HTTP 409 on stale revisions.

## Rewards and production rollout

The configured Monetag placement is a standard website placement. No supported server verification integration is configured for it, so production ad rewards and ad-based fee waivers are unavailable. Client callbacks, timestamps and ad IDs cannot create coins. Do not enable a production reward flow without implementing and testing a provider-authenticated verification adapter.

For development only, set `REWARDED_AD_PROVIDER=mock` and `REWARDED_AD_MOCK_ENABLED=true`. Both are additionally restricted to local/testing environments. Mock events require a server-created intent, elapsed server time and single-use consumption.

Before rolling out, back up the database and run `php artisan migrate --force`. The integrity migration backfills referral IDs and normalized payout accounts, reserves duplicate payout keys for review, and ends old reading sessions. Accounts marked `payout_account_conflict` cannot withdraw until their payout information is resolved. Review duplicate legacy account ownership before releasing reserved keys.

Legacy chapter HTML is sanitized on reads and writes. Preview persistent cleanup with `php artisan moneypad:sanitize-chapters`; use `--write` to persist it. Concurrently modified chapters are skipped rather than overwritten.

Demo users seed only in local/testing and existing users are not reset. Provision an administrator interactively with `php artisan moneypad:provision-admin username email@example.com`; use `--rotate` to rotate an existing administrator password and revoke sessions/tokens. Rotate any previously deployed demo administrator credentials.

## Validation

```sh
php artisan test --compact
php vendor/bin/pint --dirty --format agent
composer audit
```

PHPUnit uses an in-memory SQLite database. Security, content revision, reward replay, referral identity and payout precision regressions are covered. These tests do not prove production-engine deadlock behavior; validate concurrent financial requests against a disposable database using your production engine before rollout. Never point test runners at production data.
