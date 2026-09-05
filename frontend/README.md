# MoneyPad web app

React runs on port 5173 and proxies `/api`, `/sanctum`, `/storage`, and `/up` to
Laravel on port 8000. Expose **port 5173** through one ngrok or Cloudflare tunnel.
The browser uses the same public origin for the app, API, CSRF cookies, and uploads.

## Start Laravel

From `api`, with PHP and Composer available:

```powershell
php artisan config:clear
php artisan storage:link
php artisan serve --host=127.0.0.1 --port=8000
```

Keep this terminal running. On a fresh installation, install Composer dependencies,
create `.env` from `.env.example`, generate the application key, configure the database,
and run migrations first. `storage:link` only needs to succeed once.

## Start a tunnel

In another terminal, choose one:

```powershell
ngrok http http://127.0.0.1:5173
```

```powershell
cloudflared tunnel --url http://127.0.0.1:5173
```

ngrok requires your account's agent authentication setup. Cloudflare Quick Tunnels
print a temporary `https://...trycloudflare.com` URL. Keep the tunnel terminal running.
For a named Cloudflare tunnel, point its public hostname at `http://127.0.0.1:5173`.

## Configure and start React

From `frontend`, copy `.env.example` to `.env.local` if that file does not already exist.
Set the exact HTTPS URL printed by your tunnel:

```dotenv
BACKEND_URL=http://127.0.0.1:8000
TUNNEL_URL=https://your-tunnel-hostname
```

In `api/.env`, set `APP_DEBUG=false`, set `APP_URL` to the same public HTTPS URL,
and keep `SESSION_DOMAIN=null`. Leave `SESSION_SECURE_COOKIE` unset so it follows
the request scheme, or set it to `true` for HTTPS-only use. Leave
`SANCTUM_STATEFUL_DOMAINS` unset to use automatic same-origin recognition; if you
already override it, include the exact tunnel hostname without `https://`.
Run `php artisan config:clear` from `api` after editing its environment.

Then, from `frontend`:

```powershell
npm install
npm run dev
```

Open the public tunnel URL. Vite permits that exact hostname and connects hot reload
over the public WebSocket endpoint. Restart Vite whenever `TUNNEL_URL` changes.
The API URL in React remains `/api/v1`; no second tunnel or CORS wildcard is needed.
The same-origin session configuration also preserves mobile bearer-token support.

For a built preview, stop the dev server and run:

```powershell
npm run build
npm run preview
```

Preview uses port 5173 and the same backend proxy. These are development/preview
servers; a production host must serve `dist` and reverse-proxy the backend paths.

## Checks and troubleshooting

- Run `npm run build`, `npm run lint`, and `npm run test:tunnel` from `frontend`.
- A blocked-host message means `TUNNEL_URL` does not match the opened URL, or Vite needs a restart.
- A proxy connection error means Laravel is not listening at `BACKEND_URL`.
- For a 419 response, check the session settings above, clear Laravel's config cache,
  and sign in again. Both login and signup fetch a CSRF cookie before posting.
- If uploads return 404, check `api/public/storage` and run `php artisan storage:link`.
  Images previously saved with an old absolute localhost/tunnel URL retain that URL;
  re-upload those images or use a stable hostname.
- If an installed PWA shows an old version, close other app tabs and reload to activate
  the updated worker. API and CSRF responses are fetched from the network.
- For ordinary local development, clear `TUNNEL_URL`, restore the local `APP_URL`,
  and unset any HTTPS-only session-cookie override.

References: [Vite server options](https://vite.dev/config/server-options),
[Laravel Sanctum](https://laravel.com/docs/13.x/sanctum),
[ngrok CLI](https://ngrok.com/docs/agent/cli),
[Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).
