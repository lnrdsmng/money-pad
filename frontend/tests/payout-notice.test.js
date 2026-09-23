import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

test('processing notice appears only while an admin is handling a payout', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    let status = null;
    await page.route('**/api/v1/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      let data = {};
      if (path.endsWith('/auth/me')) {
        data = { id: 'user-1', username: 'reader', role: 'user', onboardingCompleted: true, plan: 'free', readerCoins: '0.000', authorIncome: '0.0000' };
      } else if (path.endsWith('/daily-login-reward')) {
        data = { eligible: false, days: [], server_date: '2026-09-23' };
      } else if (path.endsWith('/system-messages') || path.endsWith('/notifications')) {
        data = [];
      } else if (path.endsWith('/withdrawal-requests')) {
        data = status ? [{
          id: 'withdrawal-1', userId: 'user-1', status, source: 'READER', amount: '10.00',
          payment_method: 'GCash', payment_account_info: '***', platform_fee: '3.00', bank_fee: '0.00',
          fee_waived: false, ads_watched_count: 0, created_at: '2026-09-23T00:00:00Z',
        }] : [];
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    });
    const notice = page.getByText(/Previous payouts are held per income source/);
    for (const [nextStatus, shouldShow] of [
      [null, false], ['pending_ad_choice', false], ['pending_review', true],
      ['approved', true], ['completed', false],
    ]) {
      status = nextStatus;
      await Promise.all([
        page.waitForResponse((response) => response.url().includes('/withdrawal-requests')),
        page.goto(`${server.resolvedUrls.local[0]}earnings`),
      ]);
      await page.getByRole('heading', { name: 'Earnings & Payouts' }).waitFor();
      assert.equal(await notice.count() > 0, shouldShow, `status ${nextStatus}`);
    }
  } finally {
    await browser?.close();
    await server.close();
  }
});
