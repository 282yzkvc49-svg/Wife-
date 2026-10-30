// Сквозные проверки по критериям приёмки ТЗ (Playwright, Chromium).
// Запуск: npm run test:e2e   (собирает dist и поднимает заглушку облака на 127.0.0.1)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from '../../scripts/serve.mjs';
import { startMockSupabase } from '../mock/supabase-server.mjs';
import { addDays, dayKey, fmtDay, weekday } from '../../src/lib/date.ts';

const ROOT = new URL('../../', import.meta.url).pathname;
const APP = 'http://127.0.0.1:5190/';
const SHOTS = process.env.SHOTS || '/tmp/berezhno-shots';
fs.mkdirSync(SHOTS, { recursive: true });
const today = dayKey();
const results = [];
async function check(name, fn) {
  const t = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t }); console.log('✓', name); }
  catch (e) { results.push({ name, ok: false, error: String(e.message).split('\n')[0] }); console.log('✗', name, '\n   ', String(e.message).split('\n').slice(0, 3).join('\n    ')); }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

const web = await startServer(ROOT + 'dist', 5190);
const cloud = await startMockSupabase(54400);
const browser = await chromium.launch();
const errors = [];

async function newDevice(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, locale: 'ru-RU', timezoneId: 'Europe/Moscow', acceptDownloads: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(APP);
  return { ctx, page };
}
async function nav(page, hash) { await page.evaluate((h) => { location.hash = h; }, '#/' + hash); await page.waitForTimeout(200); }
async function onboard(page, { name = 'Аня', yogaDays = [] } = {}) {
  await page.getByRole('button', { name: 'Начать настройку' }).click();
  await page.getByLabel('Имя').fill(name);
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  for (const d of yogaDays) await page.getByRole('group', { name: 'Дни йоги' }).getByRole('button', { name: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][d - 1], exact: true }).click();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await page.getByRole('button', { name: 'Готово' }).click();
  await page.getByRole('heading', { name: 'План на сегодня' }).waitFor();
}
const planRow = (page, title) => page.locator('li', { has: page.getByRole('button', { name: new RegExp(title) }) }).first();

// ————————————————————————————————————————————————
const { page } = await newDevice();
const wd = weekday(today);
const otherDay = wd === 7 ? 3 : wd < 4 ? wd + 3 : wd - 3;

await check('Онбординг: профиль, назначения, дни йоги → главная', async () => {
  await onboard(page, { yogaDays: [wd, otherDay] });
  expect(await page.getByText('Добр', { exact: false }).first().isVisible(), 'нет приветствия');
  expect(await page.getByText(/Аня/).first().isVisible(), 'нет имени');
});

await check('Привычки: полная и минимальная версии', async () => {
  await page.getByRole('button', { name: 'Отметить выполненным: Стакан тёплой воды утром' }).click();
  await planRow(page, 'Стакан тёплой воды утром').getByText('выполнено').waitFor();
  await page.getByRole('button', { name: 'Снять отметку: Стакан тёплой воды утром' }).click();
  await page.getByRole('button', { name: /^Стакан тёплой воды утром/ }).click();
  await page.getByRole('button', { name: /Короткая версия: Несколько глотков/ }).click();
  await planRow(page, 'Стакан тёплой воды утром').getByText('короткая версия').waitFor();
});

await check('Привычки можно добавить, изменить, поставить на паузу и удалить', async () => {
  await nav(page, 'habits');
  await page.getByRole('button', { name: 'Своя' }).click();
  await page.getByLabel('Название').fill('Растяжка утром');
  await page.getByLabel('Минимальная версия').fill('1 минута');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: /Растяжка утром/ }).first().waitFor();
  await page.getByRole('button', { name: 'Изменить: Растяжка утром' }).click();
  await page.getByLabel('Название').fill('Растяжка после сна');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('button', { name: 'Пауза: Растяжка после сна' }).click();
  await page.getByRole('heading', { name: 'На паузе' }).waitFor();
  await page.getByRole('button', { name: 'Изменить: Растяжка после сна' }).click();
  await page.getByRole('button', { name: 'Удалить' }).click();
  await page.waitForTimeout(200);
  expect(!(await page.getByText('Растяжка после сна').count()), 'привычка не удалилась');
  await page.getByRole('button', { name: 'Добавить: Короткая прогулка' }).click();
});

await check('Йога запланирована в выбранный день и переносится', async () => {
  await nav(page, '');
  const yoga = page.getByRole('button', { name: /^Йога: / });
  await yoga.waitFor();
  await yoga.click();
  await page.getByLabel('Перенести на').fill(addDays(today, 1));
  await page.getByRole('button', { name: 'Перенести', exact: true }).click();
  await page.waitForTimeout(200);
  expect(!(await page.getByRole('button', { name: /^Йога: / }).count()), 'йога осталась сегодня');
  await nav(page, 'move');
  await page.getByText(/перенесено на/).first().waitFor();
});

await check('«У меня мало сил»: план сокращается, без чувства вины', async () => {
  await nav(page, '');
  await page.getByRole('button', { name: 'У меня мало сил' }).click();
  await page.getByText(/бережный день/).waitFor();
  await page.getByRole('button', { name: /По желанию/ }).click();
  await page.getByRole('button', { name: /^Короткая прогулка/ }).waitFor();
  await page.getByRole('button', { name: 'У меня мало сил' }).click();
});

await check('«Я в разъездах»: перекусы вне дома и тишина напоминаний', async () => {
  await page.getByRole('button', { name: 'Я в разъездах' }).click();
  await page.getByText(/В разъездах:/).waitFor();
  await page.getByRole('button', { name: 'Что перекусить вне дома' }).click();
  await page.getByRole('heading', { name: 'Перекусить сейчас' }).waitFor();
  await nav(page, '');
  await page.getByRole('button', { name: 'Я в разъездах' }).click();
});

await check('Рабочие дни задаются вручную → в рабочий день появляются разминки', async () => {
  expect(!(await page.getByRole('button', { name: /^Перерыв:/ }).count()), 'разминки в нерабочий день');
  await nav(page, 'work');
  await page.locator(`button[aria-label^="${fmtDay(today, { weekday: true })}:"]`).click();
  await page.locator(`button[aria-label="${fmtDay(today, { weekday: true })}: В офисе"]`).waitFor();
  await nav(page, '');
  await page.getByRole('button', { name: /^Перерыв:/ }).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/e2e-home-workday.png`, fullPage: true });
});

await check('Модуль «Шея и плечи» с таймером', async () => {
  await nav(page, 'move/warmups');
  await page.getByRole('heading', { name: 'Шея и плечи' }).waitFor();
  const card = page.locator('div.surface', { hasText: 'Мягкая подвижность шеи' }).first();
  await card.getByRole('button', { name: 'Начать' }).click();
  await page.getByRole('dialog').getByRole('heading', { name: 'Удобная посадка' }).waitFor();
  await page.getByRole('dialog').getByText(/Если появились боль, головокружение, онемение/).waitFor();
  await page.getByRole('button', { name: 'Старт' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Готово' }).click();
});

await check('Любимый рецепт добавляется без граммовки', async () => {
  await nav(page, 'food/recipes');
  await page.getByRole('button', { name: 'Рецепт' }).click();
  await page.getByLabel('Название').fill('Сырники');
  await page.getByRole('button', { name: 'Ингредиент' }).click();
  await page.getByLabel('Ингредиент', { exact: true }).fill('Творог');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByRole('heading', { name: 'Сырники' }).waitFor();
  await page.getByText(/Не рассчитывается/).waitFor();
});

await check('Новый рецепт содержит граммовку и пошаговую инструкцию', async () => {
  await nav(page, 'food/recipe/new-lentil-soup');
  await page.getByText('150 г').first().waitFor();
  await page.getByRole('heading', { name: 'Как готовить' }).waitFor();
  await page.getByText(/Примерная оценка на 1 порцию/).waitFor();
});

await check('Меню составляется на 7 дней', async () => {
  await nav(page, 'food');
  const days = await page.locator('section', { hasText: 'Завтрак' }).count();
  expect(days === 7, `дней в меню: ${days}`);
  await page.getByRole('button', { name: `Добавить: Обед, ${fmtDay(today)}` }).click();
  await page.getByPlaceholder('Найти блюдо').fill('чечевиц');
  await page.getByRole('button', { name: /Суп из красной чечевицы/ }).click();
  await page.getByRole('button', { name: /Суп из красной чечевицы.*2 п\./ }).waitFor();
});

await check('Список покупок пересчитывается при изменении меню', async () => {
  await nav(page, 'food/shopping');
  const line = page.locator('li', { hasText: 'Красная чечевица' });
  await line.getByText(/75 г/).waitFor();
  await nav(page, 'food');
  await page.getByRole('button', { name: /Суп из красной чечевицы.*2 п\./ }).click();
  await page.getByRole('button', { name: 'Больше' }).click();
  await page.keyboard.press('Escape');
  await nav(page, 'food/shopping');
  await page.locator('li', { hasText: 'Красная чечевица' }).getByText(/113 г/).waitFor();
});

await check('Можно отмечать купленное и домашние запасы', async () => {
  await page.getByRole('checkbox', { name: 'Куплено: Красная чечевица' }).check();
  expect(await page.getByRole('checkbox', { name: 'Куплено: Красная чечевица' }).isChecked(), 'не отметилось');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await page.getByRole('textbox', { name: 'Продукт' }).fill('Соль');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.locator('section', { hasText: 'Есть дома' }).getByText('Соль').first().waitFor();
  await page.screenshot({ path: `${SHOTS}/e2e-shopping.png`, fullPage: true });
});

await check('Цикл и прогноз овуляции пересчитываются при изменении дат', async () => {
  await nav(page, 'cycle');
  await page.getByRole('button', { name: 'Началась менструация' }).click();
  await page.getByLabel('Первый день').fill(addDays(today, -10));
  await page.getByRole('button', { name: 'Сохранить' }).click();
  const row = page.locator('div', { hasText: /^Следующая менструация/ }).last();
  await row.waitFor();
  const before = await page.locator('dl').first().innerText();
  await page.getByRole('button', { name: 'Изменить даты' }).first().click();
  await page.getByLabel('Первый день').fill(addDays(today, -5));
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.waitForTimeout(200);
  const after = await page.locator('dl').first().innerText();
  expect(before !== after, 'прогноз не изменился');
  await page.getByText(/не подтверждает овуляцию/).first().waitFor();
});

await check('Тесты на овуляцию можно скрыть и вернуть', async () => {
  await page.getByRole('heading', { name: 'Тесты на овуляцию' }).waitFor();
  await page.getByRole('button', { name: 'Записать результат' }).click();
  await page.getByLabel('Производитель').fill('Тест');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.locator('section', { hasText: 'Тесты на овуляцию' }).getByRole('button', { name: 'Скрыть' }).click();
  await page.waitForTimeout(200);
  expect(!(await page.getByRole('heading', { name: 'Тесты на овуляцию' }).count()), 'не скрылось');
  await nav(page, 'settings');
  await page.getByRole('switch', { name: 'Тесты на овуляцию' }).click();
  await nav(page, 'cycle');
  await page.getByRole('heading', { name: 'Тесты на овуляцию' }).waitFor();
  await page.getByText(/— отрицательный/).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/e2e-cycle.png`, fullPage: true });
});

await check('Назначения редактируются пользователем', async () => {
  await nav(page, 'meds');
  await page.getByRole('button', { name: 'Изменить: Инозитол' }).click();
  await page.getByLabel('Дозировка (как в назначении)').fill('2000');
  await page.getByLabel('Единицы').fill('мг');
  await page.getByRole('button', { name: 'Добавить время' }).click();
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByText(/2000 мг · 09:00/).waitFor();
  await nav(page, '');
  await page.getByRole('button', { name: /^Инозитол/ }).waitFor();
  await page.getByText('2000 мг').first().waitFor();
});

await check('Календарь отображает внесённые события', async () => {
  await nav(page, 'calendar');
  const panel = page.locator('section', { hasText: 'Заметка дня' });
  await panel.getByText(/Обед: Суп из красной чечевицы/).waitFor();
  await panel.getByText(/Офис/).waitFor();
  await panel.getByText(/Инозитол 09:00/).first().waitFor();
  await page.screenshot({ path: `${SHOTS}/e2e-calendar.png`, fullPage: true });
});

await check('Напоминания можно изменять и отключать', async () => {
  await nav(page, 'reminders');
  const sw = page.getByRole('switch', { name: 'Включено: Тёплая вода' });
  await sw.click();
  expect((await sw.getAttribute('aria-checked')) === 'false', 'не выключилось');
  await page.getByRole('button', { name: 'Изменить: Тёплая вода' }).click();
  await page.getByLabel('Время').fill('07:30');
  await page.getByRole('button', { name: 'Сохранить' }).click();
  await page.getByText('07:30').first().waitFor();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Скачать файл календаря/ }).click()]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  expect(ics.includes('BEGIN:VCALENDAR') && ics.includes('VALARM'), 'плохой .ics');
  expect(!ics.includes('Тёплая вода'), 'выключенное напоминание попало в календарь');
});

await check('После перезагрузки данные сохраняются', async () => {
  await page.reload();
  await page.getByRole('heading', { name: 'Напоминания', exact: true }).waitFor();
  await nav(page, '');
  await page.getByRole('heading', { name: 'План на сегодня' }).waitFor();
  await planRow(page, 'Стакан тёплой воды утром').getByText('короткая версия').waitFor();
  await nav(page, 'food/recipes');
  await page.getByText('Сырники').waitFor();
  await nav(page, 'reminders');
  expect((await page.getByRole('switch', { name: 'Включено: Тёплая вода' }).getAttribute('aria-checked')) === 'false', 'настройка не сохранилась');
});

await check('Статистика рассчитывается по реальным данным', async () => {
  await nav(page, 'stats');
  await page.getByText(/Минимальных версий за период: 1/).waitFor();
  await page.getByText(/Тестов на овуляцию: 1/).waitFor();
});

await check('Экспорт данных', async () => {
  await nav(page, 'settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Экспорт данных' }).click()]);
  const j = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  expect(j.app === 'berezhno' && j.records.length > 20, `записей: ${j.records?.length}`);
  expect(j.records.some((r) => r.t === 'recipes' && r.data.title === 'Сырники'), 'нет рецепта в экспорте');
});

await check('Удаление всех данных на устройстве', async () => {
  await page.getByRole('button', { name: 'Удалить все данные' }).click();
  await page.getByLabel('Подтверждение').fill('УДАЛИТЬ');
  await page.getByRole('button', { name: 'Удалить навсегда' }).click();
  await page.getByRole('button', { name: 'Начать настройку' }).waitFor({ timeout: 10000 });
});

// ——— Облако: регистрация, вход на другом устройстве, синхронизация ———
const A = await newDevice({ width: 1280, height: 860 });
const B = await newDevice();
async function connectCloud(p) {
  await p.getByLabel('Адрес проекта (Project URL)').fill(cloud.url);
  await p.getByLabel('Публичный ключ (anon / publishable)').fill('test-anon-key-0123456789abcdef');
  await p.getByRole('button', { name: 'Подключить облако' }).click();
}
await check('Регистрация и вход на другом устройстве', async () => {
  await onboard(A.page, { name: 'Маша' });
  await nav(A.page, 'settings');
  await connectCloud(A.page);
  await A.page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await A.page.getByLabel('Почта').fill('masha@example.com');
  await A.page.getByLabel('Пароль').fill('secret-pass-1');
  await A.page.getByRole('button', { name: 'Создать аккаунт' }).click();
  await A.page.getByText('masha@example.com').waitFor();
  await A.page.getByText('Всё синхронизировано.').waitFor({ timeout: 10000 });

  await B.page.getByRole('button', { name: 'Уже пользуюсь на другом устройстве' }).click();
  await connectCloud(B.page);
  await B.page.getByLabel('Почта').fill('masha@example.com');
  await B.page.getByLabel('Пароль').fill('wrong-password');
  await B.page.getByRole('button', { name: 'Войти' }).click();
  await B.page.getByText('Неверная почта или пароль.').waitFor();
  await B.page.getByLabel('Пароль').fill('secret-pass-1');
  await B.page.getByRole('button', { name: 'Войти' }).click();
  await B.page.getByText(/Маша/).first().waitFor({ timeout: 10000 });
});

await check('Данные синхронизируются между устройствами в обе стороны', async () => {
  await nav(A.page, 'habits');
  await A.page.getByRole('button', { name: 'Добавить: Вечернее расслабление' }).click();
  await nav(A.page, 'settings');
  await A.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await A.page.waitForTimeout(500);
  await nav(B.page, 'settings');
  await B.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await B.page.waitForTimeout(500);
  await nav(B.page, 'habits');
  await B.page.getByRole('button', { name: /Вечернее расслабление/ }).first().waitFor();

  await nav(B.page, 'meds');
  await B.page.getByRole('button', { name: 'Изменить: Витамин D' }).click();
  await B.page.getByLabel('Дозировка (как в назначении)').fill('1000');
  await B.page.getByLabel('Единицы').fill('МЕ');
  await B.page.getByRole('button', { name: 'Сохранить' }).click();
  await nav(B.page, 'settings');
  await B.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await B.page.waitForTimeout(500);
  await nav(A.page, 'settings');
  await A.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await A.page.waitForTimeout(500);
  await nav(A.page, 'meds');
  await A.page.getByText(/1000 МЕ/).waitFor();
});

await check('Офлайн: изменения сохраняются и уходят в облако после восстановления сети', async () => {
  await A.ctx.setOffline(true);
  await nav(A.page, '');
  await A.page.getByRole('button', { name: 'Отметить выполненным: Стакан тёплой воды утром' }).click();
  await nav(A.page, 'settings');
  await A.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await A.page.getByText(/Нет сети/).first().waitFor();
  await A.ctx.setOffline(false);
  await A.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await A.page.getByText('Всё синхронизировано.').waitFor({ timeout: 10000 });
  await nav(B.page, 'settings');
  await B.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await B.page.waitForTimeout(500);
  await nav(B.page, '');
  await planRow(B.page, 'Стакан тёплой воды утром').getByText('выполнено').waitFor();
});

await check('Удаление данных в облаке очищает и другое устройство', async () => {
  await nav(B.page, 'settings');
  await B.page.getByRole('button', { name: 'Удалить все данные' }).click();
  await B.page.getByLabel('Подтверждение').fill('УДАЛИТЬ');
  await B.page.getByRole('button', { name: 'Удалить навсегда' }).click();
  await B.page.getByRole('button', { name: 'Начать настройку' }).waitFor({ timeout: 10000 });
  await nav(A.page, 'settings');
  await A.page.getByRole('button', { name: 'Синхронизировать сейчас' }).click();
  await A.page.getByRole('button', { name: 'Начать настройку' }).waitFor({ timeout: 10000 });
});

await A.page.screenshot({ path: `${SHOTS}/e2e-final-desktop.png` });
await browser.close();
web.close(); cloud.server.close();

if (errors.length) results.push({ name: 'Нет ошибок JavaScript на страницах', ok: false, error: errors.slice(0, 3).join(' | ') });
else results.push({ name: 'Нет ошибок JavaScript на страницах', ok: true });
fs.writeFileSync(ROOT + 'tests/e2e/last-run.json', JSON.stringify({ date: new Date().toISOString(), results }, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`\nE2E: ${results.length - failed.length} из ${results.length} проверок пройдено`);
process.exit(failed.length ? 1 : 0);
