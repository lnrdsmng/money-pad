import assert from 'node:assert/strict';
import { createServer as createHttpServer, request } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { createServer, preview } from 'vite';

function send(port, host, path, method = 'GET', body = '') {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        Host: host,
        Origin: `https://${host}`,
        'X-Forwarded-Proto': 'https',
        Cookie: 'session=test-session',
        'X-XSRF-TOKEN': 'test-csrf',
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('development and preview forward tunnel requests to Laravel', async (t) => {
  const backend = createHttpServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Set-Cookie', 'session=updated; Path=/; Secure; HttpOnly; SameSite=Lax');
    res.end(JSON.stringify({ path: req.url, method: req.method, headers: req.headers, body }));
  });
  backend.listen(0, '127.0.0.1');
  await once(backend, 'listening');
  const originalBackendUrl = process.env.BACKEND_URL;
  const originalTunnelUrl = process.env.TUNNEL_URL;
  process.env.BACKEND_URL = `http://127.0.0.1:${backend.address().port}`;

  try {
    for (const host of ['moneypad-test.ngrok-free.app', 'moneypad-test.trycloudflare.com']) {
      process.env.TUNNEL_URL = `https://${host}`;
      for (const mode of ['development', 'preview']) {
        await t.test(`${mode}: ${host}`, async () => {
          const options = { host: '127.0.0.1', port: 0, strictPort: true };
          const server = mode === 'development'
            ? await createServer({ server: options })
            : await preview({ preview: options });
          if (mode === 'development') await server.listen();
          const port = server.httpServer.address().port;

          try {
            for (const path of ['/api/v1/auth/me', '/sanctum/csrf-cookie', '/storage/uploads/test.png', '/up']) {
              const response = await send(port, host, path);
              assert.equal(response.status, 200);
              const forwarded = JSON.parse(response.body);
              assert.equal(forwarded.path, path);
              assert.equal(forwarded.headers.host, host);
              assert.equal(forwarded.headers.origin, `https://${host}`);
              assert.equal(forwarded.headers['x-forwarded-proto'], 'https');
              assert.equal(forwarded.headers.cookie, 'session=test-session');
              assert.equal(response.headers['set-cookie'][0],
                'session=updated; Path=/; Secure; HttpOnly; SameSite=Lax');
            }

            const payload = JSON.stringify({ username: 'tunnel-test' });
            const posted = await send(port, host, '/api/v1/auth/login', 'POST', payload);
            const forwarded = JSON.parse(posted.body);
            assert.equal(forwarded.method, 'POST');
            assert.equal(forwarded.body, payload);
            assert.equal(forwarded.headers['x-xsrf-token'], 'test-csrf');

            assert.equal((await send(port, 'untrusted.example', '/api/v1/auth/me')).status, 403);
            assert.equal((await send(port, 'localhost', '/up')).status, 200);

            if (mode === 'development') {
              const client = await send(port, host, '/@vite/client');
              assert.equal(client.status, 200);
              assert.ok(client.body.includes(host));
              assert.ok(client.body.includes('wss'));
            }
          } finally {
            if (mode === 'development') await server.close();
            else await new Promise((resolve, reject) => server.httpServer.close((err) => err ? reject(err) : resolve()));
          }
        });
      }
    }
  } finally {
    if (originalBackendUrl === undefined) delete process.env.BACKEND_URL;
    else process.env.BACKEND_URL = originalBackendUrl;
    if (originalTunnelUrl === undefined) delete process.env.TUNNEL_URL;
    else process.env.TUNNEL_URL = originalTunnelUrl;
    await new Promise((resolve) => backend.close(resolve));
  }
});
