import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

test('reader reaches the first reward heartbeat without continuous input', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;
  let heartbeatCount = 0;
  let startCount = 0;
  let failHeartbeat = false;
  const completedParts = new Set();
  const progressWrites = [];
  const pageErrors = [];

  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    });
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.route('**/api/v1/**', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const method = request.method();
      const json = body => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

      if (pathname === '/api/v1/auth/me') {
        return json({
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
        });
      }
      if ((pathname === '/api/v1/parts/part-1' || pathname === '/api/v1/parts/part-2') && method === 'GET') {
        const partId = pathname.endsWith('part-1') ? 'part-1' : 'part-2';
        return json({
          id: partId,
          storyId: 'story-1',
          title: partId === 'part-1' ? 'A Long Chapter' : 'The Next Chapter',
          content: `<p>${'Reading content '.repeat(2500)}</p>`,
          order: partId === 'part-1' ? 1 : 2,
          isPublished: true,
          isCompletedByCurrentUser: completedParts.has(partId),
        });
      }
      if (pathname === '/api/v1/stories/story-1/parts') {
        return json([
          { id: 'part-1', title: 'A Long Chapter', order: 1, isPublished: true },
          { id: 'part-2', title: 'The Next Chapter', order: 2, isPublished: true },
        ]);
      }
      if (pathname === '/api/v1/reading/start' && method === 'POST') {
        startCount += 1;
        return json({
          id: `session-${startCount}`,
          reading_policy: { heartbeat_interval_seconds: 1, idle_timeout_seconds: 5 },
        });
      }
      if (pathname === '/api/v1/reading/heartbeat' && method === 'POST') {
        heartbeatCount += 1;
        if (failHeartbeat) {
          return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
        }
        return json({ amount_awarded: '1.000', pending_total: '1.000', stale: false });
      }
      if (pathname.endsWith('/read') && pathname.includes('/parts/') && method === 'POST') {
        completedParts.add(pathname.split('/').at(-2));
        return json({ success: true, alreadyCompleted: false });
      }
      if (pathname.endsWith('/reading-progress') && method === 'POST') {
        progressWrites.push(request.postDataJSON());
        return json({ success: true });
      }
      if (pathname.includes('/reading-progress/') && method === 'GET') return json(null);
      if (pathname === '/api/v1/daily-login-reward') {
        return json({ eligible: false, days: [], server_date: '2026-09-06' });
      }
      if (pathname.endsWith('/system-messages')) return json([]);
      if (pathname === '/api/v1/notifications/unread-count') return json({ count: 0 });
      return json(method === 'GET' ? [] : { success: true });
    });

    await page.goto(`${server.resolvedUrls.local[0]}story/story-1/read/part-1`);
    try {
      await page.waitForSelector('h1:has-text("A Long Chapter")', { timeout: 10_000 });
    } catch {
      const body = await page.locator('body').innerText();
      assert.fail(`Reader did not render. Body: ${body} Errors: ${pageErrors.join('; ')}`);
    }
    await page.waitForSelector('[title^="Reading active"]');

    await page.waitForFunction(() => document.querySelector('[data-testid="reading-coin-total"]')?.textContent === '1');

    assert.ok(heartbeatCount >= 1);

    failHeartbeat = true;
    await page.waitForSelector('text=Reading income tracking is temporarily unavailable.', { timeout: 15_000 });

    const startsBeforeChapterEnd = startCount;
    const completionResponse = page.waitForResponse(response => (
      response.url().endsWith('/api/v1/parts/part-1/read') && response.request().method() === 'POST'
    ));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForSelector('text=Done');
    await completionResponse;

    assert.equal(startCount, startsBeforeChapterEnd);

    failHeartbeat = false;
    await page.locator('a', { hasText: 'Next Chapter' }).click();
    await page.waitForSelector('h1:has-text("The Next Chapter")');
    await page.waitForSelector('[title^="Reading active"]');
    assert.equal(
      await page.getByRole('dialog').count(),
      0,
      `dialog: ${await page.getByRole('dialog').allInnerTexts()} writes: ${JSON.stringify(progressWrites)}`,
    );

    const startsAfterNextChapter = startCount;
    await page.locator('a', { hasText: 'Previous Chapter' }).click();
    await page.waitForSelector('h1:has-text("A Long Chapter")');
    await page.waitForSelector('text=Done');
    await page.waitForTimeout(500);

    assert.equal(startCount, startsAfterNextChapter);
    assert.equal(
      await page.getByRole('dialog').count(),
      0,
      `dialog: ${await page.getByRole('dialog').allInnerTexts()} writes: ${JSON.stringify(progressWrites)}`,
    );
    assert.equal(progressWrites.at(-1)?.last_part_id, 'part-1');
  } finally {
    await browser?.close();
    await server.close();
  }
});
