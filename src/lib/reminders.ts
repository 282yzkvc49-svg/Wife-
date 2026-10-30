import type { Prefs, Reminder, Supplement } from '../data/types';
import { addDays, timeToMin, weekday, type DayKey } from './date';
import { weekdaysRule, type IcsEvent } from './ics';

export interface ReminderDayInfo {
  workDay: boolean;
  yogaPlanned: boolean;
  testsWindow: boolean;
  mute: boolean;
  /** задача уже выполнена — напоминать не нужно */
  satisfied: (r: { id: string; data: Reminder }) => boolean;
}

export function reminderAppliesOn(r: Reminder, date: DayKey, info: Pick<ReminderDayInfo, 'workDay' | 'yogaPlanned' | 'testsWindow'>, prefs: Prefs): boolean {
  if (!r.enabled) return false;
  switch (r.repeat.kind) {
    case 'daily': break;
    case 'workdays': if (!info.workDay) return false; break;
    case 'yogaDays': if (!info.yogaPlanned) return false; break;
    case 'weekdays': if (!r.repeat.days.includes(weekday(date))) return false; break;
  }
  if (r.kind === 'warmup' && (!info.workDay || !prefs.modules.warmups)) return false;
  if (r.kind === 'yoga' && (!info.yogaPlanned || !prefs.modules.yoga)) return false;
  if (r.kind === 'tests' && (!info.testsWindow || !prefs.modules.ovulationTests || !prefs.modules.cycle)) return false;
  if (r.kind === 'supplement' && !prefs.modules.supplements) return false;
  if (r.kind === 'water' && !prefs.modules.water) return false;
  if (r.kind === 'produce' && !prefs.modules.produce) return false;
  if ((r.kind === 'menu' || r.kind === 'shopping' || r.kind === 'meal') && !prefs.modules.nutrition) return false;
  return true;
}

export const firedKey = (id: string, date: DayKey) => `${id}@${date}`;

/** Напоминания, которые пора показать сейчас. Каждое — не больше одного раза в день (без дублей). */
export function dueReminders(
  reminders: Array<{ id: string; data: Reminder }>, date: DayKey, nowMinutes: number, nowIso: string,
  fired: Set<string>, info: ReminderDayInfo, prefs: Prefs,
): Array<{ id: string; data: Reminder }> {
  if (info.mute) return [];
  const seen = new Set<string>();
  return reminders.filter((r) => {
    const t = timeToMin(r.data.time);
    if (t === null || t > nowMinutes) return false;
    if (nowMinutes - t > 180) return false; // давно прошедшие не показываем — это не долг
    if (fired.has(firedKey(r.id, date))) return false;
    if (r.data.snoozedUntil && r.data.snoozedUntil > nowIso) return false;
    if (!reminderAppliesOn(r.data, date, info, prefs)) return false;
    if (info.satisfied(r)) return false;
    const dedupe = `${r.data.kind}|${r.data.refId ?? ''}|${r.data.time}`;
    if (seen.has(dedupe)) return false;
    seen.add(dedupe);
    return true;
  });
}

/** Напоминания о назначениях следуют за временем приёма в карточке средства. */
export function supplementReminderPlan(sups: Array<{ id: string; data: Supplement }>, existing: Array<{ id: string; data: Reminder }>) {
  const want = new Map<string, Reminder>();
  for (const { id, data } of sups) {
    if (!data.active) continue;
    for (const t of data.times) {
      const rid = `rem-sup-${id}-${t.replace(':', '')}`;
      const prev = existing.find((e) => e.id === rid)?.data;
      want.set(rid, {
        kind: 'supplement', title: data.name, time: t, refId: id,
        repeat: data.frequency === 'daily' ? { kind: 'daily' } : { kind: 'weekdays', days: data.days ?? [] },
        enabled: prev ? prev.enabled : true,
      });
    }
  }
  const upsert = [...want.entries()].filter(([id, r]) => {
    const prev = existing.find((e) => e.id === id)?.data;
    return !prev || JSON.stringify({ ...prev, snoozedUntil: undefined }) !== JSON.stringify({ ...r, snoozedUntil: undefined });
  });
  const remove = existing.filter((e) => e.data.kind === 'supplement' && !want.has(e.id)).map((e) => e.id);
  return { upsert, remove };
}

/** События для выгрузки в системный календарь (.ics). */
export function remindersToIcs(
  reminders: Array<{ id: string; data: Reminder }>, prefs: Prefs, today: DayKey, workDays: DayKey[], yogaDates: DayKey[], testDates: DayKey[],
): IcsEvent[] {
  const ev: IcsEvent[] = [];
  let medIndex = 0;
  for (const { id, data: r } of reminders) {
    if (!r.enabled) continue;
    if (r.kind === 'supplement' && !prefs.modules.supplements) continue;
    const title = r.kind === 'supplement' && prefs.calendarHideMedNames ? `Назначение ${++medIndex}` : r.title;
    const base = { title, time: r.time, alarm: true, description: 'Напоминание из приложения «Бережно». Можно пропустить — это не долг.' };
    if (r.kind === 'warmup' || r.repeat.kind === 'workdays') {
      for (const d of workDays) ev.push({ ...base, uid: `${id}-${d}@berezhno`, date: d, durationMin: 5 });
      continue;
    }
    if (r.kind === 'yoga' || r.repeat.kind === 'yogaDays') {
      for (const d of yogaDates) ev.push({ ...base, uid: `${id}-${d}@berezhno`, date: d, durationMin: 25 });
      continue;
    }
    if (r.kind === 'tests') {
      for (const d of testDates) ev.push({ ...base, uid: `${id}-${d}@berezhno`, date: d });
      continue;
    }
    const rrule = r.repeat.kind === 'daily' ? 'FREQ=DAILY' : r.repeat.kind === 'weekdays' && r.repeat.days.length ? weekdaysRule(r.repeat.days) : undefined;
    if (!rrule) continue;
    // первая дата — сегодня или ближайший подходящий день
    let start = today;
    if (r.repeat.kind === 'weekdays') {
      for (let i = 0; i < 7; i++) { const d = addDays(today, i); if (r.repeat.days.includes(weekday(d))) { start = d; break; } }
    }
    ev.push({ ...base, uid: `${id}@berezhno`, date: start, rrule });
  }
  return ev;
}
