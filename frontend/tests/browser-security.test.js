import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createServer } from 'vite';

test('chapter rendering removes executable markup and preserves safe formatting', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  let browser;
  try {
    await server.listen();
    browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    await page.route('**/api/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
    await page.goto(server.resolvedUrls.local[0]);
    const result = await page.evaluate(async () => {
      const { formatChapterHtml } = await import('/src/utils/formatHtml.ts');
      const html = formatChapterHtml('<p><strong>Safe</strong></p><p></p><img src="x" onerror="window.exploited=1"><a href="javascript:alert(1)">link</a><svg onload="window.exploited=1"></svg><script>window.exploited=1</script>');
      const node = document.createElement('div');
      node.innerHTML = html;
      document.body.append(node);
      return { html, unsafe: node.querySelectorAll('script,svg,[onerror],[onload],[href^="javascript:"]').length };
    });
    assert.equal(result.unsafe, 0);
    assert.match(result.html, /<strong>Safe<\/strong>/);
    assert.match(result.html, /<p><br><\/p>/);
    assert.equal(await page.evaluate(() => window.exploited), undefined);
  } finally {
    await browser?.close();
    await server.close();
  }
});
