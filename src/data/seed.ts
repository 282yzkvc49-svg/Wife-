import type { Habit, Prefs, Reminder, Supplement, CycleSettings } from './types';
import { dayKey, localTimeZone } from '../lib/date';

/** Время «рождения» встроенных записей: любая правка пользователя на любом устройстве новее и побеждает. */
export const SEED_TS = '2026-01-01T00:00:00.000Z';
export const PREFS_ID = 'prefs';
export const CYCLE_SETTINGS_ID = 'settings';

export function defaultPrefs(): Prefs {
  return {
    name: '',
    goal: 'preparing',
    startDate: dayKey(),
    onboarded: false,
    modules: {
      cycle: true, ovulationTests: true, supplements: true, yoga: true, warmups: true, nutrition: true,
      snacks: true, library: true, honey: false, water: true, produce: true, newHabitHints: true,
    },
    yogaDays: [],
    yogaTime: '19:00',
    workStart: '09:00',
    workEnd: '18:00',
    warmupTimes: ['11:00', '15:30'],
    mealTimes: { breakfast: '08:30', lunch: '13:00', dinner: '19:30', snack: '16:30' },
    menuHorizon: 7,
    waterGoal: null,
    timeZone: localTimeZone(),
    testsTotal: 4,
    testsAfterFirstMonth: 'calendar',
    calendarHideMedNames: false,
    yearPlanChecks: {},
    hiddenCalendarCategories: [],
    defaultContexts: [],
    excludedFoods: ['печень', 'имбирь', 'сельдерей'],
    limitFoods: ['лимон'],
  };
}

export const DEFAULT_CYCLE: CycleSettings = { avgCycle: 28, avgPeriod: 5, regularity: 'unknown', useHistory: true };

/** Уже существующая привычка пользователя — тёплая вода утром. */
export const BASE_HABITS: Array<{ id: string; habit: Habit }> = [
  { id: 'h-water', habit: { seed: 'warm-water', title: 'Стакан тёплой воды утром', fullVersion: 'Стакан тёплой воды после пробуждения', minVersion: 'Несколько глотков тёплой воды',
    icon: 'glass', schedule: { kind: 'daily' }, timeOfDay: 'morning', time: '08:00', core: true, status: 'active', order: 0, startedAt: '2026-01-01' } },
  { id: 'h-honey', habit: { seed: 'honey', title: 'Ложка мёда утром', fullVersion: 'Ложка мёда (по желанию)', minVersion: 'Пропустить — это необязательно',
    icon: 'sun', schedule: { kind: 'daily' }, timeOfDay: 'morning', core: false, optional: true, status: 'paused', anchor: 'h-water', order: 1, startedAt: '2026-01-01',
    note: 'Необязательная привычка. Доказанного влияния мёда на фертильность нет; сахара мёда — часть «свободных сахаров» за день.' } },
];

export interface HabitIdea { key: string; habit: Habit; why: string }
export const HABIT_IDEAS: HabitIdea[] = [
  { key: 'fruit-morning', why: 'Простой шаг к разнообразию фруктов', habit: { seed: 'fruit-morning', title: 'Фрукт в первой половине дня', fullVersion: 'Съесть фрукт до обеда', minVersion: 'Несколько долек или горсть ягод', icon: 'apple', schedule: { kind: 'daily' }, timeOfDay: 'morning', core: false, status: 'active', anchor: 'h-water', order: 10, startedAt: '' } },
  { key: 'extra-veg', why: 'Больше овощей без перестройки меню', habit: { seed: 'extra-veg', title: 'Дополнительная порция овощей', fullVersion: 'Овощной гарнир или салат к обеду или ужину', minVersion: 'Пара ломтиков овощей', icon: 'carrot', schedule: { kind: 'daily' }, timeOfDay: 'day', core: false, status: 'active', order: 11, startedAt: '' } },
  { key: 'protein-variety', why: 'Рыба, бобовые, яйца, птица — по очереди', habit: { seed: 'protein-variety', title: 'Разнообразный белок', fullVersion: 'Выбрать белок, которого не было вчера', minVersion: 'Подумать, какой белок будет завтра', icon: 'utensils', schedule: { kind: 'daily' }, timeOfDay: 'day', core: false, status: 'active', order: 12, startedAt: '' } },
  { key: 'screen-breaks', why: 'Отдых для глаз и шеи в рабочие дни', habit: { seed: 'screen-breaks', title: 'Перерывы от экрана', fullVersion: 'Каждые 1–1,5 часа — 2–3 минуты без экрана', minVersion: 'Один перерыв за день', icon: 'eye', schedule: { kind: 'workdays' }, timeOfDay: 'day', core: false, status: 'active', order: 13, startedAt: '' } },
  { key: 'short-walk', why: 'Движение, которое легко вписать в день', habit: { seed: 'short-walk', title: 'Короткая прогулка', fullVersion: '15–20 минут пешком', minVersion: '5 минут на улице', icon: 'footprints', schedule: { kind: 'daily' }, timeOfDay: 'any', core: false, status: 'active', order: 14, startedAt: '' } },
  { key: 'food-prep', why: 'Меньше решений в загруженные дни', habit: { seed: 'food-prep', title: 'Подготовка продуктов', fullVersion: 'Помыть и нарезать овощи на 2–3 дня', minVersion: 'Подготовить продукты на завтра', icon: 'cooking', schedule: { kind: 'weekdays', days: [7] }, timeOfDay: 'evening', core: false, status: 'active', order: 15, startedAt: '' } },
  { key: 'menu-plan', why: 'Меню и покупки за один раз', habit: { seed: 'menu-plan', title: 'Планирование меню', fullVersion: 'Составить меню на неделю', minVersion: 'Выбрать 3 ужина', icon: 'notebook', schedule: { kind: 'weekdays', days: [7] }, timeOfDay: 'evening', core: false, status: 'active', order: 16, startedAt: '' } },
  { key: 'evening-relax', why: 'Мягкий переход ко сну', habit: { seed: 'evening-relax', title: 'Вечернее расслабление', fullVersion: '10 минут спокойного дыхания или растяжки', minVersion: '5 спокойных вдохов', icon: 'moon', schedule: { kind: 'daily' }, timeOfDay: 'evening', core: false, status: 'active', order: 17, startedAt: '' } },
  { key: 'sleep-regular', why: 'Привычное время сна облегчает утро', habit: { seed: 'sleep-regular', title: 'Регулярный режим сна', fullVersion: 'Лечь в привычное время ±30 минут', minVersion: 'Начать готовиться ко сну на 15 минут раньше', icon: 'bed', schedule: { kind: 'daily' }, timeOfDay: 'evening', core: false, status: 'active', order: 18, startedAt: '' } },
];

/** Назначения, о которых сказано в ТЗ. Дозировку и время вводит пользователь — по назначению врача. */
export const PRESCRIBED: Array<{ id: string; s: Supplement }> = [
  { id: 'sup-inositol', s: { name: 'Инозитол', dose: '', unit: '', times: [], frequency: 'daily', comment: '', source: 'Назначение врача', components: ['инозитол'], active: true, order: 0 } },
  { id: 'sup-folic', s: { name: 'Фолиевая кислота', dose: '', unit: '', times: [], frequency: 'daily', comment: '', source: 'Назначение врача', components: ['фолиевая кислота'], active: true, order: 1 } },
  { id: 'sup-vitd', s: { name: 'Витамин D', dose: '', unit: '', times: [], frequency: 'daily', comment: '', source: 'Назначение врача', components: ['витамин D'], active: true, order: 2 } },
];

export function defaultReminders(p: Prefs): Array<{ id: string; r: Reminder }> {
  const out: Array<{ id: string; r: Reminder }> = [
    { id: 'rem-water', r: { kind: 'water', title: 'Тёплая вода', time: '08:00', repeat: { kind: 'daily' }, enabled: true } },
    { id: 'rem-produce', r: { kind: 'produce', title: 'Фрукт или овощ до обеда', time: '11:30', repeat: { kind: 'daily' }, enabled: true } },
    { id: 'rem-yoga', r: { kind: 'yoga', title: 'Йога', time: p.yogaTime, repeat: { kind: 'yogaDays' }, enabled: true } },
    { id: 'rem-menu', r: { kind: 'menu', title: 'Составить меню на неделю', time: '18:00', repeat: { kind: 'weekdays', days: [7] }, enabled: true } },
    { id: 'rem-shopping', r: { kind: 'shopping', title: 'Покупки по списку', time: '11:00', repeat: { kind: 'weekdays', days: [6] }, enabled: true } },
    { id: 'rem-lunch', r: { kind: 'meal', title: 'Обед', time: p.mealTimes.lunch, repeat: { kind: 'daily' }, enabled: false } },
    { id: 'rem-tests', r: { kind: 'tests', title: 'Тест на овуляцию', time: '10:00', repeat: { kind: 'daily' }, enabled: true } },
  ];
  p.warmupTimes.forEach((t, i) => out.push({ id: `rem-warmup-${i}`, r: { kind: 'warmup', title: 'Пятиминутная разминка', time: t, repeat: { kind: 'workdays' }, enabled: true } }));
  return out;
}

export interface YearPhase { id: string; months: [number, number]; title: string; items: Array<{ id: string; text: string; link?: string }> }
export const YEAR_PLAN: YearPhase[] = [
  { id: 'p1', months: [1, 1], title: 'Запуск', items: [
    { id: 'p1-profile', text: 'Настроить профиль и цель', link: '#/settings' },
    { id: 'p1-cycle', text: 'Внести данные цикла', link: '#/cycle' },
    { id: 'p1-meds', text: 'Заполнить назначения врача', link: '#/meds' },
    { id: 'p1-habits', text: 'Выбрать 1–2 первые привычки', link: '#/habits' },
    { id: 'p1-produce', text: 'Начать отмечать фрукты и овощи', link: '#/' },
    { id: 'p1-recipes', text: 'Дополнить любимые рецепты', link: '#/food/recipes' },
    { id: 'p1-menu', text: 'Составить первое меню и список покупок', link: '#/food' },
    { id: 'p1-move', text: 'Выбрать дни йоги и время разминок', link: '#/move' },
    { id: 'p1-tests', text: 'Тесты на овуляцию — по желанию', link: '#/cycle' },
  ] },
  { id: 'p2', months: [2, 3], title: 'Закрепление', items: [
    { id: 'p2-review', text: 'Посмотреть статистику привычек', link: '#/stats' },
    { id: 'p2-variety', text: 'Добавить 2–3 новых овоща или блюда', link: '#/food/recipes' },
    { id: 'p2-menu', text: 'Улучшить меню и расписание', link: '#/food' },
    { id: 'p2-yoga', text: 'Продолжить йогу', link: '#/move' },
    { id: 'p2-cycles', text: 'Сверить прогноз с историей циклов', link: '#/cycle' },
    { id: 'p2-reminders', text: 'Скорректировать напоминания', link: '#/reminders' },
  ] },
  { id: 'p3', months: [4, 6], title: 'Устойчивый режим', items: [
    { id: 'p3-keep', text: 'Оставить работающие привычки, отказаться от неудобных', link: '#/habits' },
    { id: 'p3-menu', text: 'Персонализировать меню', link: '#/food' },
    { id: 'p3-activity', text: 'Посмотреть статистику активности', link: '#/stats' },
    { id: 'p3-mid', text: 'Промежуточный обзор', link: '#/stats' },
  ] },
  { id: 'p4', months: [7, 9], title: 'Поддержание', items: [
    { id: 'p4-keep', text: 'Поддерживать режим и разнообразие', link: '#/' },
    { id: 'p4-adapt', text: 'Подстроить план под изменения жизни', link: '#/settings' },
    { id: 'p4-modules', text: 'Отключить ненужные функции', link: '#/settings' },
  ] },
  { id: 'p5', months: [10, 12], title: 'Годовой обзор', items: [
    { id: 'p5-habits', text: 'История привычек и питания', link: '#/stats' },
    { id: 'p5-move', text: 'Сколько было йоги и разминок', link: '#/stats' },
    { id: 'p5-cycles', text: 'История циклов и рецептов', link: '#/stats' },
    { id: 'p5-next', text: 'Настроить следующий период', link: '#/settings' },
  ] },
];

export interface SnackIdea {
  id: string; title: string; detail: string;
  minutes: 2 | 5 | 15; type: Array<'light' | 'hearty' | 'sweet' | 'salty'>;
  needsFridge: boolean; needsHeat: boolean; where: Array<'store' | 'home' | 'travel'>;
  category: 'fruit' | 'yogurt' | 'nuts' | 'bread' | 'cheese' | 'sandwich' | 'ready' | 'other';
}
export const SNACK_IDEAS: SnackIdea[] = [
  { id: 'sn-apple', title: 'Яблоко или груша', detail: 'Можно взять с собой с утра.', minutes: 2, type: ['light', 'sweet'], needsFridge: false, needsHeat: false, where: ['store', 'home', 'travel'], category: 'fruit' },
  { id: 'sn-banana', title: 'Банан', detail: 'Удобен в дороге.', minutes: 2, type: ['light', 'sweet'], needsFridge: false, needsHeat: false, where: ['store', 'home', 'travel'], category: 'fruit' },
  { id: 'sn-berries', title: 'Ягоды или нарезанные фрукты', detail: 'Готовые порции в отделе фруктов.', minutes: 2, type: ['light', 'sweet'], needsFridge: true, needsHeat: false, where: ['store', 'home'], category: 'fruit' },
  { id: 'sn-yogurt', title: 'Натуральный йогурт', detail: 'Можно добавить фрукт или горсть орехов.', minutes: 2, type: ['light'], needsFridge: true, needsHeat: false, where: ['store', 'home'], category: 'yogurt' },
  { id: 'sn-cottage', title: 'Творог с ягодами', detail: 'Сытно и быстро. Рецепт есть в «Новых рецептах».', minutes: 5, type: ['hearty', 'sweet'], needsFridge: true, needsHeat: false, where: ['home', 'store'], category: 'yogurt' },
  { id: 'sn-nuts', title: 'Горсть несолёных орехов', detail: 'Около 20–30 г. Хорошо хранится в сумке.', minutes: 2, type: ['hearty', 'salty'], needsFridge: false, needsHeat: false, where: ['store', 'home', 'travel'], category: 'nuts' },
  { id: 'sn-crisp-cheese', title: 'Цельнозерновые хлебцы с творожным сыром', detail: 'Можно добавить огурец.', minutes: 5, type: ['hearty', 'salty'], needsFridge: true, needsHeat: false, where: ['home', 'store'], category: 'bread' },
  { id: 'sn-cheese', title: 'Кусочек сыра и цельнозерновой хлеб', detail: 'Сытный перекус без готовки.', minutes: 2, type: ['hearty', 'salty'], needsFridge: true, needsHeat: false, where: ['store', 'home'], category: 'cheese' },
  { id: 'sn-veg-sticks', title: 'Овощные палочки', detail: 'Морковь, огурец, перец. Можно с йогуртовым соусом.', minutes: 5, type: ['light', 'salty'], needsFridge: true, needsHeat: false, where: ['home', 'store'], category: 'other' },
  { id: 'sn-sandwich', title: 'Сэндвич с яйцом или тунцом', detail: 'Любимый сэндвич — из ваших рецептов.', minutes: 15, type: ['hearty', 'salty'], needsFridge: true, needsHeat: false, where: ['home'], category: 'sandwich' },
  { id: 'sn-ready-sandwich', title: 'Готовый сэндвич или ролл', detail: 'Выбирайте с овощами и белком (яйцо, курица, рыба).', minutes: 2, type: ['hearty', 'salty'], needsFridge: true, needsHeat: false, where: ['store', 'travel'], category: 'sandwich' },
  { id: 'sn-ready-salad', title: 'Готовый салат', detail: 'С овощами и белком; соус можно попросить отдельно.', minutes: 2, type: ['light', 'salty'], needsFridge: true, needsHeat: false, where: ['store', 'travel'], category: 'ready' },
  { id: 'sn-ready-meal', title: 'Готовое горячее блюдо с гарниром', detail: 'Если есть где разогреть: крупа + мясо/рыба + овощи.', minutes: 5, type: ['hearty'], needsFridge: true, needsHeat: true, where: ['store', 'travel'], category: 'ready' },
  { id: 'sn-soup', title: 'Порция супа', detail: 'Например, чечевичный суп из «Новых рецептов» — в контейнере на работу.', minutes: 5, type: ['hearty'], needsFridge: true, needsHeat: true, where: ['home'], category: 'ready' },
  { id: 'sn-kefir', title: 'Кефир или питьевой йогурт', detail: 'Удобно, когда некогда.', minutes: 2, type: ['light'], needsFridge: true, needsHeat: false, where: ['store', 'travel'], category: 'yogurt' },
  { id: 'sn-dried', title: 'Сухофрукты с орехами', detail: 'Небольшая порция; лучше вместе с едой.', minutes: 2, type: ['sweet', 'hearty'], needsFridge: false, needsHeat: false, where: ['store', 'home', 'travel'], category: 'nuts' },
  { id: 'sn-egg', title: 'Варёное яйцо', detail: 'Можно сварить заранее на 2–3 дня.', minutes: 2, type: ['hearty', 'salty'], needsFridge: true, needsHeat: false, where: ['home', 'travel'], category: 'other' },
  { id: 'sn-toast', title: 'Тост с вареньем или начинкой', detail: 'Ваш любимый вариант — без чувства вины.', minutes: 5, type: ['sweet'], needsFridge: false, needsHeat: true, where: ['home'], category: 'bread' },
];

export const STORES = [
  { id: 'vkusvill', name: 'ВкусВилл', note: 'Рядом с работой', url: 'https://vkusvill.ru/' },
  { id: 'azbuka', name: 'Азбука вкуса', note: 'Дополнительный магазин', url: '' },
];
