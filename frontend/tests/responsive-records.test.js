import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const admin = {
  id: 'admin-1', username: 'admin', email: 'admin@example.test', role: 'admin',
  plan: 'free', onboardingCompleted: true, onboardingStep: 4, isVerified: false,
  balance: 0, authorIncome: 0, readerCoins: 0,
};

const member = {
  id: 'user-1', username: 'reader', email: 'reader@example.test', role: 'user',
  plan: 'standard', readerCoins: 25, authorIncome: 50,
};

const withdrawal = {
  id: 'withdrawal-1', userId: member.id, user: member, amount: '20.00',
  gross_amount: '25.00', net_amount: '20.00', payment_method: 'GCash',
  payment_account_info: '09123456789', platform_fee: '5.00', bank_fee: '0',
  ads_watched_count: 0, fee_waived: false, status: 'pending_review',
  created_at: '2026-09-18T00:00:00Z',
};
const approvedWithdrawal = { ...withdrawal, id: 'withdrawal-2', status: 'approved' };
const completedWithdrawal = { ...withdrawal, id: 'withdrawal-3', status: 'completed' };

const purchase = {
  id: 'purchase-1', user: member, plan_type: 'standard', amount: '99.00',
  payment_method: 'gcash', payment_reference: '1234', status: 'pending_review',
  submitted_at: '2026-09-18T00:00:00Z', rejection_reason: null,
  proof_url: '/api/v1/admin/plan-purchases/purchase-1/proof',
};

const plans = [
  { id: 'free', name: 'Free', price: '0.00', rate_per_minute: '1.000', multiplier: '1.00', ads: true, is_active: true },
  { id: 'standard', name: 'Standard', price: '85.00', rate_per_minute: '2.500', multiplier: '2.50', ads: true, is_active: true },
  { id: 'mega_premium', name: 'Mega Premium', price: '199.00', rate_per_minute: '4.500', multiplier: '4.50', ads: true, is_active: true },
  { id: 'ultimate_premium', name: 'Ultimate Premium', price: '449.00', rate_per_minute: '6.000', multiplier: '6.00', ads: false, is_active: true },
];

const paymentMethods = ['GCash', 'Maya', 'PayPal'].map((label, index) => ({
  id: `method-${index + 1}`,
  label,
  account_name: 'Money Pad',
  account_identifier: `account-${index + 1}`,
  instructions: 'Use your payment reference when submitting proof.',
  is_active: true,
  qr_image_url: null,
}));

test('admin records use cards below desktop width and tables on desktop', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;

  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    });
    const page = await browser.newPage();

    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      const body = path === '/api/v1/auth/me' ? admin
        : path === '/api/v1/admin/users' ? [member]
          : path === '/api/v1/admin/withdrawals/pending-review' ? [withdrawal]
            : path === '/api/v1/admin/withdrawals/approved' ? [approvedWithdrawal]
              : path === '/api/v1/admin/withdrawals/completed' ? [completedWithdrawal]
              : path === '/api/v1/admin/plan-purchases' ? { data: [purchase] }
                : path === '/api/v1/admin/plans' ? { data: plans }
                  : path === '/api/v1/admin/payment-methods' ? { data: paymentMethods }
                  : {};

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    for (const width of [320, 390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: width === 1920 ? 1080 : 800 });

      for (const [route, heading] of [
        ['users', 'User Management'],
        ['withdrawals', 'Withdrawal Management'],
        ['plan-payments', 'Plan payments'],
      ]) {
        await page.goto(`${server.resolvedUrls.local[0]}admin/${route}`);
        await page.getByRole('heading', { name: heading }).waitFor();
        await page.getByText('reader', { exact: true }).first().waitFor({ state: 'attached' });

        const tableVisible = await page.locator('table').first().isVisible();
        const cardVisible = await page.locator('article').first().isVisible();
        assert.equal(tableVisible, width >= 1024, `${route} table at ${width}px`);
        assert.equal(cardVisible, width < 1024, `${route} card at ${width}px`);
        if (width < 1024) {
          const bounds = await page.locator('article').first().boundingBox();
          assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `${route} card fits at ${width}px`);
        }

        if (route === 'withdrawals') {
          if (width === 390) {
            await page.locator('article').getByRole('button', { name: 'Reject' }).click();
            assert.equal(await page.getByRole('dialog').isVisible(), true);
            await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
          }

          await page.getByRole('button', { name: /Approved \/ In Processing/ }).click();
          await page.getByText('reader', { exact: true }).first().waitFor({ state: 'attached' });
          assert.equal(await page.locator('table').first().isVisible(), width >= 1024);
          assert.equal(await page.locator('article').first().isVisible(), width < 1024);
          if (width === 390) {
            assert.equal(await page.locator('article').getByRole('button', { name: 'Mark Sent' }).isVisible(), true);
          }

          await page.getByRole('button', { name: /History/ }).click();
          await page.getByText('reader', { exact: true }).first().waitFor({ state: 'attached' });
          assert.equal(await page.locator('table').first().isVisible(), width >= 1024);
          assert.equal(await page.locator('article').first().isVisible(), width < 1024);
        }

        if (width >= 1024) {
          const viewportLayout = await page.evaluate(() => ({
            documentClientHeight: document.documentElement.clientHeight,
            documentScrollHeight: document.documentElement.scrollHeight,
            mainClientHeight: document.querySelector('main')?.clientHeight,
            viewportHeight: window.innerHeight,
          }));
          assert.equal(
            viewportLayout.documentScrollHeight,
            viewportLayout.documentClientHeight,
            `${route} does not create a second desktop document scrollbar`,
          );
          assert.equal(
            viewportLayout.mainClientHeight,
            viewportLayout.viewportHeight,
            `${route} main content fills the desktop viewport`,
          );

          if (route === 'plan-payments') {
            const bottomSpacing = await page.evaluate(() => {
              const main = document.querySelector('main');
              const finalSection = Array.from(document.querySelectorAll('section')).at(-1);
              main?.scrollTo(0, main.scrollHeight);
              const mainBounds = main?.getBoundingClientRect();
              const sectionBounds = finalSection?.getBoundingClientRect();
              return mainBounds && sectionBounds ? {
                spacing: mainBounds.bottom - sectionBounds.bottom,
                scrollable: main.scrollHeight > main.clientHeight,
              } : null;
            });
            assert.equal(bottomSpacing?.scrollable, true, 'plan payments exercises desktop scrolling');
            assert.ok(
              bottomSpacing !== null && bottomSpacing.spacing >= 0 && bottomSpacing.spacing <= 40,
              `plan payments keeps only its intended bottom padding (${bottomSpacing?.spacing}px)`,
            );
          }
        }

        if (width === 390 && route === 'plan-payments') {
          await page.locator('article').getByRole('button', { name: 'Approve' }).click();
          assert.equal(await page.getByRole('dialog').isVisible(), true);
        }
      }
    }
  } finally {
    await browser?.close();
    await server.close();
  }
});

test('referral milestones use cards below desktop width and a table on desktop', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;

  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    });
    const page = await browser.newPage();
    const tier = {
      tier: 1, targetChapters: 2, currentChapters: 2, targetAds: 1, currentAds: 1,
      coins: 10, isCompleted: true, isClaimed: false, canClaim: true, isLocked: false,
    };

    await page.route('**/api/v1/**', route => {
      const path = new URL(route.request().url()).pathname;
      let body = {};

      if (path === '/api/v1/auth/me') {
        body = { ...member, onboardingCompleted: true, onboardingStep: 4, isVerified: false, balance: 0 };
      } else if (path === '/api/v1/daily-login-reward') {
        body = { eligible: false, days: [], server_date: '2026-09-18' };
      } else if (path === `/api/v1/users/${member.id}/withdrawal-requests` ||
        path === `/api/v1/users/${member.id}/system-messages`) {
        body = [];
      } else if (path === '/api/v1/referrals/milestones') {
        body = {
          referralCode: member.username, referralCount: 1, totalChaptersRead: 2,
          totalAdsWatched: 1, referrals: [{ id: 'friend-1', username: 'friend', activeTier: 1, tiers: [tier] }],
          tiers: [],
        };
      } else if (path === '/api/v1/referrals/author-commissions') {
        body = {
          commissions: [], summary: { total_claimed: 0, total_pending: 0, total_ready_to_claim: 0, total_count: 0 },
        };
      }

      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });

    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${server.resolvedUrls.local[0]}earnings`);
      await page.getByRole('button', { name: 'Referrals' }).click();
      await page.getByText('Tier 1', { exact: true }).first().waitFor({ state: 'attached' });

      const tableVisible = await page.locator('table').first().isVisible();
      const cardVisible = await page.locator('article').filter({ hasText: 'Tier 1' }).first().isVisible();
      assert.equal(tableVisible, width >= 1024, `milestone table at ${width}px`);
      assert.equal(cardVisible, width < 1024, `milestone card at ${width}px`);
      if (width < 1024) {
        const bounds = await page.locator('article').filter({ hasText: 'Tier 1' }).first().boundingBox();
        assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, `milestone card fits at ${width}px`);
      }
      assert.equal(await page.getByRole('button', { name: 'Claim +10' }).count(), 1);
    }
  } finally {
    await browser?.close();
    await server.close();
  }
});
