import type { Habit, Supplement, SupplementLog, WorkDay } from '../data/types';
import { weekday, type DayKey } from './date';

export function isWorkDay(w: WorkDay | undefined): boolean {
  return !!w && w.status !== 'off';
}

export function isHabitScheduled(h: Habit, date: DayKey, workDay: boolean): boolean {
  if (h.status !== 'active') return false;
  switch (h.schedule.kind) {
    case 'daily': return true;
    case 'weekdays': return h.schedule.days.includes(weekday(date));
    case 'workdays': return workDay;
    case 'offdays': return !workDay;
    default: return false;
  }
}

export function scheduleLabel(h: Habit): string {
  switch (h.schedule.kind) {
    case 'daily': return 'каждый день';
    case 'workdays': return 'в рабочие дни';
    case 'offdays': return 'в выходные';
    case 'weekdays': {
      const names = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
      return [...h.schedule.days].sort().map((d) => names[d - 1]).join(', ') || 'дни не выбраны';
    }
    default: return '';
  }
}

// ——— Назначения ———
export function supplementScheduledOn(s: Supplement, date: DayKey): boolean {
  if (!s.active) return false;
  if (s.startDate && date < s.startDate) return false;
  if (s.endDate && date > s.endDate) return false;
  if (s.frequency === 'weekdays' || s.frequency === 'custom') return (s.days ?? []).includes(weekday(date));
  return true;
}

export type SupStatus = 'taken' | 'skipped' | 'unmarked';
export function supplementLogId(supId: string, date: DayKey, time: string) { return `sl:${supId}:${date}:${time || 'any'}`; }
export function supplementStatus(logs: Map<string, SupplementLog>, supId: string, date: DayKey, time: string): SupStatus {
  const l = logs.get(supplementLogId(supId, date, time));
  return l ? l.status : 'unmarked';
}

const SYNONYMS: Array<[RegExp, string]> = [
  [/(витамин\s*[dд]\d?|холекальциферол|колекальциферол|эргокальциферол|vitamin\s*d|\bd3\b)/i, 'витамин D'],
  [/(фолиев|фолат|метилфолат|\bb9\b|в9|folic|folate)/i, 'фолиевая кислота (фолаты)'],
  [/(инозитол|инозит|inositol)/i, 'инозитол'],
  [/(витамин\s*a|ретинол|retinol)/i, 'витамин A'],
  [/(железо|iron|феррум)/i, 'железо'],
  [/(йод|iodine|калия йодид)/i, 'йод'],
  [/(омега|omega|dha|дгк)/i, 'омега-3'],
  [/(витамин\s*b12|b12|в12|цианокобаламин|метилкобаламин)/i, 'витамин B12'],
];

export function normalizeComponent(c: string): string {
  const t = c.trim();
  for (const [re, name] of SYNONYMS) if (re.test(t)) return name;
  return t.toLowerCase();
}

/** Компоненты, которые встречаются в нескольких активных средствах одновременно. */
export function duplicateComponents(sups: Array<{ id: string; data: Supplement }>): Array<{ component: string; names: string[] }> {
  const map = new Map<string, Set<string>>();
  for (const { data } of sups) {
    if (!data.active) continue;
    const comps = new Set([...(data.components ?? []), data.name].filter(Boolean).map(normalizeComponent));
    for (const c of comps) {
      if (!map.has(c)) map.set(c, new Set());
      map.get(c)!.add(data.name);
    }
  }
  return [...map.entries()].filter(([, s]) => s.size > 1).map(([component, s]) => ({ component, names: [...s] }));
}
