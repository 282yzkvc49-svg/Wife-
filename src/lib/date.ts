// Даты храним как «ключ дня» YYYY-MM-DD в местном времени пользователя.
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(d: Date = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

export function diffDays(a: DayKey, b: DayKey): number {
  // a - b в днях
  return Math.round((parseDay(a).getTime() - parseDay(b).getTime()) / 86400000);
}

export function isValidDay(key: unknown): key is DayKey {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(parseDay(key).getTime());
}

/** День недели: 1 = понедельник … 7 = воскресенье */
export function weekday(key: DayKey): number {
  const w = parseDay(key).getDay();
  return w === 0 ? 7 : w;
}

export function startOfWeek(key: DayKey): DayKey {
  return addDays(key, 1 - weekday(key));
}

export function startOfMonth(key: DayKey): DayKey {
  return key.slice(0, 8) + '01';
}

export function daysInMonth(key: DayKey): number {
  const d = parseDay(key);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function addMonths(key: DayKey, n: number): DayKey {
  const d = parseDay(startOfMonth(key));
  d.setMonth(d.getMonth() + n);
  return dayKey(d);
}

export function range(from: DayKey, days: number): DayKey[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

export function rangeInclusive(from: DayKey, to: DayKey): DayKey[] {
  const n = diffDays(to, from);
  return n < 0 ? [] : range(from, n + 1);
}

export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const WEEKDAYS_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

export function fmtDay(key: DayKey, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const d = parseDay(key);
  let s = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  if (opts.year) s += ` ${d.getFullYear()}`;
  if (opts.weekday) s = `${WEEKDAYS_FULL[weekday(key) - 1]}, ${s}`;
  return s;
}

export function fmtShort(key: DayKey): string {
  const d = parseDay(key);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
}

export function fmtMonth(key: DayKey): string {
  const d = parseDay(key);
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
}

export function relativeDay(key: DayKey, today: DayKey = dayKey()): string {
  const n = diffDays(key, today);
  if (n === 0) return 'сегодня';
  if (n === 1) return 'завтра';
  if (n === -1) return 'вчера';
  if (n > 1 && n < 7) return `через ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  return fmtDay(key);
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

/** "HH:MM" → минуты от полуночи */
export function timeToMin(t: string | undefined | null): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minToTime(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export function nowMin(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function localTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Moscow'; } catch { return 'Europe/Moscow'; }
}
