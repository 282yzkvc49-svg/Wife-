// Проверка сборки с вшитыми параметрами облака: сразу показывается вход, без полей адреса и ключа.
import { chromium } from 'playwright';
import { startServer } from '../../scripts/serve.mjs';
const server = await startServer(new URL('../../dist', import.meta.url).pathname, 5185);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:5185/');
await page.getByRole('button', { name: 'Уже пользуюсь на другом устройстве' }).click();
const login = await page.getByLabel('Почта').isVisible();
const cfgForm = await page.getByText('Адрес проекта').count();
console.log(login && !cfgForm ? '✓ Сразу форма входа, облако уже настроено' : '✗ форма входа не показана');
await page.getByLabel('Почта').fill('test@example.com');
await page.getByLabel('Пароль').fill('12345678');
await page.getByRole('button', { name: 'Войти' }).click();
await page.waitForTimeout(1500);
console.log('  ответ без сети до Supabase:', (await page.locator('.bg-amber').first().innerText().catch(() => '—')).slice(0, 90));
console.log(errs.length ? errs.join('\n') : '  ошибок JS нет');
await browser.close(); server.close();
