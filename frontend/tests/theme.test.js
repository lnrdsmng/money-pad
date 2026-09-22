import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const user = {
  id: 'user-1',
  username: 'reader',
  email: 'reader@example.test',
  role: 'user',
  plan: 'free',
  onboardingCompleted: true,
  onboardingStep: 4,
  isVerified: false,
  balance: 0,
  authorIncome: 0,
  readerCoins: 0,
};

test('device dark mode does not override the saved app theme', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;

  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    });
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      const body = path === '/api/v1/auth/me'
        ? user
        : path.endsWith('/system-messages')
          ? []
          : path === '/api/v1/daily-login-reward'
            ? { eligible: false, days: [], server_date: '2026-09-22' }
            : { count: 0 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    await page.goto(`${server.resolvedUrls.local[0]}settings`);
    const themeToggle = page.getByRole('switch', { name: 'Toggle dark mode' });
    await themeToggle.waitFor();

    assert.equal(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), true);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    assert.equal(await page.locator('meta[name="color-scheme"]').getAttribute('content'), 'only light');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'light only');

    await themeToggle.click();

    assert.equal(await themeToggle.getAttribute('aria-checked'), 'true');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
    assert.equal(await page.locator('meta[name="color-scheme"]').getAttribute('content'), 'dark');
    assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'dark');

    await page.reload();

    await themeToggle.waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true);
    assert.equal(await page.locator('meta[name="color-scheme"]').getAttribute('content'), 'dark');
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme), 'dark');

    await themeToggle.click();

    assert.equal(await themeToggle.getAttribute('aria-checked'), 'false');
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), false);
    assert.equal(await page.locator('meta[name="color-scheme"]').getAttribute('content'), 'only light');
    assert.equal(await page.evaluate(() => localStorage.getItem('theme')), 'light');

    await context.close();
  } finally {
    await browser?.close();
    await server.close();
  }
});
