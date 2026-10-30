// PWA: service worker устанавливается, приложение открывается без сети, данные на месте; манифест валиден.
import { chromium } from 'playwright';
import { startServer } from '../../scripts/serve.mjs';
const server = await startServer(new URL('../../dist', import.meta.url).pathname, 5184);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
const page = await ctx.newPage();
const fail = (m) => { console.log('✗', m); process.exitCode = 1; };
await page.goto('http://127.0.0.1:5184/');
const swOk = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
swOk ? console.log('✓ Service worker установлен') : fail('service worker не активен');
const cached = await page.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys[0]); return (await c.keys()).map((r) => new URL(r.url).pathname + new URL(r.url).search); });
console.log('  в кеше:', cached.length, 'файлов');
await page.getByRole('button', { name: 'Начать настройку' }).click();
await page.getByLabel('Имя').fill('Офлайн');
for (let i = 0; i < 4; i++) await page.getByRole('button', { name: /Дальше|Позже/ }).first().click();
await page.getByRole('button', { name: 'Готово' }).click();
await page.getByRole('heading', { name: 'План на сегодня' }).waitFor();
await page.waitForTimeout(300);
await ctx.setOffline(true);
await page.reload();
try { await page.getByText(/Офлайн/).first().waitFor({ timeout: 8000 }); console.log('✓ Без сети приложение открывается, данные сохранены'); }
catch { fail('без сети приложение не открылось'); }
const m = await (await fetch('http://127.0.0.1:5184/manifest.webmanifest')).json();
(m.start_url === './' && m.display === 'standalone' && m.icons.length >= 3) ? console.log('✓ Манифест: относительный start_url, standalone, иконки') : fail('манифест');
await browser.close(); server.close();
