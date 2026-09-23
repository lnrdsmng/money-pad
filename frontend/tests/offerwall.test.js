import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

test('offerwall card opens stages and records that the user started', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
    let starts = 0;
    const offer = {
      id: 'offer-1', name: 'Puzzle Quest', description: 'Complete two levels', image_url: '/cover.png',
      download_url: 'https://example.com/app', category: 'new', completed_stages: 0, stage_count: 2,
      total_coins: '5.500', earned_coins: '0.000', next_step: 'Level 1',
    };
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      let data = {};
      if (path.endsWith('/auth/me')) {
        data = { id: 'user-1', username: 'reader', role: 'user', onboardingCompleted: true, plan: 'free', readerCoins: '0.000' };
      } else if (path.endsWith('/daily-login-reward')) {
        data = { eligible: false, days: [], server_date: '2026-09-23' };
      } else if (path.endsWith('/system-messages') || path.endsWith('/notifications')) {
        data = [];
      } else if (path.endsWith('/offerwalls') && route.request().method() === 'GET') {
        data = { data: url.searchParams.get('category') === 'new' ? [offer] : [], current_page: 1, last_page: 1 };
      } else if (path.endsWith('/offerwalls/offer-1/start')) {
        starts++;
        data = { ...offer, category: 'started' };
      } else if (path.endsWith('/offerwalls/offer-1')) {
        data = { ...offer, category: 'started', stages: [
          { id: 'stage-1', name: 'Level 1', position: 1, reward_coins: '2.500', status: 'ready' },
          { id: 'stage-2', name: 'Level 2', position: 2, reward_coins: '3.000', status: 'locked' },
        ] };
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    await page.route('**/cover.png', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: '' }));

    await page.goto(`${server.resolvedUrls.local[0]}offerwalls`);
    try {
      await page.getByText('Puzzle Quest').waitFor({ timeout: 5000 });
    } catch {
      throw new Error(`Offerwall card did not render. Page: ${await page.locator('body').innerText()}; errors: ${pageErrors.join('; ')}`);
    }
    await page.getByText('Puzzle Quest').click();
    await page.getByRole('heading', { name: 'Rewards' }).waitFor();
    assert.equal(starts, 1);
    await page.getByRole('button', { name: /Level 1.*Upload proof/ }).click();
    await page.getByLabel('Proof image').waitFor();
    assert.equal(await page.getByRole('button', { name: /Level 2/ }).isDisabled(), true);
  } finally {
    await browser?.close();
    await server.close();
  }
});
