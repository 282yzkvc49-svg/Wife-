// Обход всех экранов после онбординга: нет ошибок в консоли, скриншоты мобильного и десктопа.
import { chromium } from 'playwright';
import { startServer } from '../../scripts/serve.mjs';
const SH = process.env.SHOTS || '/tmp/shots';
const server = await startServer(new URL('../../dist', import.meta.url).pathname, 5181);
const browser = await chromium.launch();
const routes = ['', 'food', 'food/recipes', 'food/recipe/fav-plov', 'food/recipe/new-lentil-soup', 'food/shopping', 'food/snacks', 'food/analysis', 'habits', 'move', 'move/warmups', 'move/activity', 'cycle', 'meds', 'calendar', 'work', 'library', 'library/folic-acid', 'stats', 'year', 'reminders', 'settings', 'more'];
const errors = [];
for (const vp of [{ name: 'mobile', width: 390, height: 844 }, { name: 'small', width: 320, height: 640 }, { name: 'desktop', width: 1280, height: 860 }]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: vp.name === 'mobile' ? 2 : 1, locale: 'ru-RU', timezoneId: 'Europe/Moscow' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${vp.name} pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${vp.name} console: ${m.text()}`); });
  await page.goto('http://127.0.0.1:5181/');
  await page.getByRole('button', { name: 'Начать настройку' }).click();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Дальше|Позже/ }).first().click();
  await page.getByRole('button', { name: 'Готово' }).click();
  await page.waitForTimeout(300);
  for (const r of routes) {
    await page.evaluate((h) => { location.hash = h; }, '#/' + r);
    await page.waitForTimeout(250);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) errors.push(`${vp.name} ${r || 'home'}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `${SH}/${vp.name}-${(r || 'home').replace(/\//g, '_')}.png`, fullPage: vp.name === 'desktop' });
  }
  await ctx.close();
}
console.log(errors.join('\n') || 'no errors');
await browser.close(); server.close();
