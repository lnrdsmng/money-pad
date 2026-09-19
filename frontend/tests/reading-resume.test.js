import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const user = {
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
};

const parts = [
  { id: 'part-1', storyId: 'story-1', title: 'First Chapter', order: 1, isPublished: true },
  { id: 'part-2', storyId: 'story-1', title: 'Second Chapter', order: 2, isPublished: true },
];

async function openStoryPage(browser, baseUrl, progress) {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const method = request.method();
    const json = body => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (pathname === '/api/v1/auth/me') return json(user);
    if (pathname === '/api/v1/stories/story-1') {
      return json({
        id: 'story-1',
        title: 'Resume Test Story',
        authorName: 'Author',
        overview: 'Story overview',
        genres: 'Fiction',
        isCompleted: false,
        isMature: false,
        isAuthorVerified: false,
        readCount: 10,
        likes: 2,
      });
    }
    if (pathname === '/api/v1/stories/story-1/parts') return json(parts);
    if (pathname === '/api/v1/users/reader-1/reading-progress/story-1' && method === 'GET') {
      return json(progress);
    }
    if (pathname === '/api/v1/parts/part-2' && method === 'GET') {
      return json({
        ...parts[1],
        content: `<p>${'Chapter content '.repeat(500)}</p>`,
        isCompletedByCurrentUser: false,
      });
    }
    if (pathname === '/api/v1/reading/start' && method === 'POST') {
      return json({
        id: 'session-1',
        reading_policy: { heartbeat_interval_seconds: 60, idle_timeout_seconds: 120 },
      });
    }
    if (pathname === '/api/v1/daily-login-reward') {
      return json({ eligible: false, days: [], server_date: '2026-09-19' });
    }
    if (pathname.endsWith('/system-messages')) return json([]);
    if (pathname === '/api/v1/notifications/unread-count') return json({ count: 0 });
    return json(method === 'GET' ? [] : { success: true });
  });

  await page.goto(`${baseUrl}story/story-1`);
  await page.getByRole('heading', { name: 'Resume Test Story' }).waitFor();
  return { context, page };
}

test('story reading button opens saved progress or falls back to chapter one', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;

  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    });
    const baseUrl = server.resolvedUrls.local[0];

    const saved = await openStoryPage(browser, baseUrl, {
      last_part_id: 'part-2',
      last_scroll_position: 0.4,
      updated_at: '2026-09-19T00:00:00.000Z',
    });
    const resumeLink = saved.page.getByRole('link', { name: 'Continue Reading Chapter 2' });
    assert.match(await resumeLink.getAttribute('href'), /\/story\/story-1\/read\/part-2$/);
    await resumeLink.click();
    await saved.page.getByRole('heading', { name: 'Second Chapter' }).waitFor();
    assert.equal(await saved.page.getByRole('dialog').count(), 0);
    await saved.context.close();

    const fresh = await openStoryPage(browser, baseUrl, null);
    assert.match(
      await fresh.page.getByRole('link', { name: 'Start Reading Chapter 1' }).getAttribute('href'),
      /\/story\/story-1\/read\/part-1$/,
    );
    await fresh.context.close();

    const unavailable = await openStoryPage(browser, baseUrl, {
      last_part_id: 'unpublished-part',
      last_scroll_position: 0.8,
      updated_at: '2026-09-19T00:00:00.000Z',
    });
    assert.match(
      await unavailable.page.getByRole('link', { name: 'Start Reading Chapter 1' }).getAttribute('href'),
      /\/story\/story-1\/read\/part-1$/,
    );
    await unavailable.context.close();
  } finally {
    await browser?.close();
    await server.close();
  }
});
