import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

test('password reset uses toast feedback once and does not ask for email again', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;

  try {
    await server.listen();
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    });
    const page = await browser.newPage();
    await page.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/auth/forgot-password')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'If an account exists for that email, a password reset link has been sent.' }),
        });
        return;
      }
      if (url.includes('/auth/reset-password')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Password reset successfully.' }) });
        return;
      }
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
    });

    const baseUrl = server.resolvedUrls.local[0];
    await page.goto(`${baseUrl}forgot-password`);
    await page.locator('input[type="email"]').fill('reader@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await page.getByText('If an account exists for that email, a password reset link has been sent.').waitFor();
    assert.equal(await page.locator('form [role="status"]').count(), 0);

    await page.goto(`${baseUrl}reset-password?token=test-token&email=reader%40example.com`);
    assert.equal(await page.locator('input[type="email"]').count(), 0);
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill('NewPassword1');
    await passwords.nth(1).fill('NewPassword1');
    await page.getByRole('button', { name: 'Reset password' }).click();
    await page.waitForURL('**/login');
    const successToasts = page.getByText('Password reset successfully. You can now sign in.');
    await successToasts.first().waitFor();
    assert.equal(await successToasts.count(), 1);
  } finally {
    await browser?.close();
    await server.close();
  }
});
