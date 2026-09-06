import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

test('notification panel stays inside a 320px viewport', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;

  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    });
    const page = await browser.newPage({ viewport: { width: 320, height: 640 } });

    await page.route('**/api/v1/**', route => {
      const pathname = new URL(route.request().url()).pathname;
      const body = pathname === '/api/v1/auth/me'
        ? {
            id: 'reader-1',
            username: 'reader',
            email: 'reader@example.test',
            role: 'user',
            plan: 'free',
            onboardingCompleted: true,
            onboardingStep: 4,
            isVerified: false,
            balance: '0.000',
            authorIncome: '0.000',
            readerCoins: '0.000',
          }
        : pathname === '/api/v1/daily-login-reward'
          ? { eligible: false, days: [], server_date: '2026-09-06' }
          : pathname === '/api/v1/notifications/unread-count'
            ? { count: 1 }
            : pathname === '/api/v1/notifications'
              ? [{
                  id: 'notification-1',
                  type: 'LIKE',
                  actorName: 'A reader',
                  content: 'liked your story.',
                  isRead: false,
                  timestamp: Date.now(),
                }]
              : [];

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    });

    await page.goto(`${server.resolvedUrls.local[0]}explore`);
    await page.getByRole('button', { name: 'Notifications' }).click();

    const panel = page.getByTestId('notification-panel');
    await panel.waitFor();
    const box = await panel.boundingBox();

    assert.ok(box);
    assert.ok(box.x >= 0, `panel starts outside viewport at x=${box.x}`);
    assert.ok(box.x + box.width <= 320, `panel ends outside viewport at x=${box.x + box.width}`);
    assert.ok(box.y + box.height <= 640, `panel ends below viewport at y=${box.y + box.height}`);
  } finally {
    await browser?.close();
    await server.close();
  }
});
