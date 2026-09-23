import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

test('login refreshes the one-use verification token after bad credentials', async () => {
  const previousKey = process.env.VITE_TURNSTILE_SITE_KEY;
  process.env.VITE_TURNSTILE_SITE_KEY = 'test-site-key';
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    const tokens = [];
    await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: `
        window.turnstile = {
          render(element, options) {
            this.options = options;
            this.count = (this.count || 0) + 1;
            const widget = document.createElement('div');
            widget.dataset.testTurnstileWidget = 'true';
            widget.style.width = options.size === 'compact' ? '150px' : '300px';
            widget.style.height = options.size === 'compact' ? '140px' : '65px';
            element.appendChild(widget);
            options.callback('token-' + this.count);
            return 'widget';
          },
          reset() { this.count += 1; this.options.callback('token-' + this.count); },
          remove() {}
        };
      ` });
    });
    await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth/login')) {
        const body = route.request().postDataJSON();
        tokens.push(body.turnstile_token);
        await route.fulfill({
          status: tokens.length === 1 ? 401 : 200,
          contentType: 'application/json',
          body: tokens.length === 1 ? JSON.stringify({ message: 'Invalid credentials' }) : JSON.stringify({
            user: { id: 'user-1', username: 'reader', role: 'user', onboardingCompleted: true, readerCoins: 0 },
          }),
        });
        return;
      }
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });

    for (const width of [320, 360, 375]) {
      await page.setViewportSize({ width, height: 720 });
      for (const path of ['login', 'register', 'forgot-password']) {
        await page.goto(`${server.resolvedUrls.local[0]}${path}`);
        const widget = page.locator('[data-test-turnstile-widget]');
        await widget.waitFor();
        const widgetBox = await widget.boundingBox();
        const formBox = await page.locator('form').first().boundingBox();
        assert.ok(widgetBox && formBox, `${path} at ${width}px: expected visible widget and form`);
        assert.equal(widgetBox.width, 300, `${path} at ${width}px: expected the rectangular widget`);
        assert.equal(widgetBox.height, 65, `${path} at ${width}px: expected the rectangular widget`);
        assert.ok(widgetBox.x >= 0 && widgetBox.x + widgetBox.width <= width,
          `${path} at ${width}px: widget extends beyond the viewport`);
        assert.ok(widgetBox.x >= formBox.x, `${path} at ${width}px: widget extends beyond the form's left edge`);
        assert.ok(widgetBox.x + widgetBox.width <= formBox.x + formBox.width,
          `${path} at ${width}px: widget extends beyond the form's right edge`);
        assert.ok(Math.abs(widgetBox.x + widgetBox.width / 2 - (formBox.x + formBox.width / 2)) <= 1,
          `${path} at ${width}px: widget is not centered in the form`);
      }
    }

    await page.goto(`${server.resolvedUrls.local[0]}login`);
    await page.getByPlaceholder('Username').fill('reader');
    await page.getByPlaceholder('Password').fill('wrong');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.getByText('Invalid credentials').first().waitFor();
    await page.getByPlaceholder('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Login' }).click();
    await page.waitForURL('**/explore');

    assert.deepEqual(tokens, ['token-1', 'token-2']);
  } finally {
    await browser?.close();
    await server.close();
    if (previousKey === undefined) delete process.env.VITE_TURNSTILE_SITE_KEY;
    else process.env.VITE_TURNSTILE_SITE_KEY = previousKey;
  }
});
