import { chromium } from 'playwright';
import { startServer } from '../../scripts/serve.mjs';
const server = await startServer(new URL('../../dist', import.meta.url).pathname, 5183);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 320, height: 640 }, locale: 'ru-RU' });
await page.goto('http://127.0.0.1:5183/');
await page.getByRole('button', { name: 'Начать настройку' }).click();
for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Дальше|Позже/ }).first().click();
await page.getByRole('button', { name: 'Готово' }).click();
for (const r of process.argv.slice(2)) {
  await page.evaluate((h) => { location.hash = h; }, '#/' + r);
  await page.waitForTimeout(300);
  const bad = await page.evaluate(() => {
    const W = window.innerWidth; const out = [];
    for (const el of document.querySelectorAll('body *')) {
      const b = el.getBoundingClientRect();
      if (b.right > W + 1 && b.width > 0 && getComputedStyle(el).position !== 'fixed') {
        const kids = [...el.children].some((c) => c.getBoundingClientRect().right > W + 1);
        if (!kids) out.push(`${el.tagName}.${(el.className || '').toString().slice(0, 60)} right=${Math.round(b.right)} text="${(el.textContent || '').slice(0, 40)}"`);
      }
    }
    return out.slice(0, 6);
  });
  console.log('==', r || 'home'); console.log(bad.join('\n'));
}
await browser.close(); server.close();
