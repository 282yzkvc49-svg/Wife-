import type { ActivityLog, DailyPlan, ExerciseLog, Habit, HabitLog, MealPlanItem, Recipe, YogaSessionRec, WorkDay } from '../data/types';
import { addDays, rangeInclusive, startOfWeek, type DayKey } from './date';
import { isHabitScheduled, isWorkDay } from './schedule';

export interface HabitStat {
  id: string; title: string; scheduled: number; full: number; min: number; skipped: number; unmarked: number;
  rate: number; stable: boolean; oftenSkipped: boolean;
}

/** Статистика привычек по реальным отметкам. Дни без отметок не считаются пропусками. */
export function habitStats(habits: Array<{ id: string; data: Habit }>, logs: HabitLog[], from: DayKey, to: DayKey, work: Map<DayKey, WorkDay>): HabitStat[] {
  const days = rangeInclusive(from, to);
  const byKey = new Map(logs.map((l) => [`${l.habitId}|${l.date}`, l]));
  return habits.filter((h) => h.data.status === 'active' || logs.some((l) => l.habitId === h.id)).map(({ id, data }) => {
    let scheduled = 0, full = 0, min = 0, skipped = 0, unmarked = 0;
    for (const d of days) {
      if (data.startedAt && d < data.startedAt) continue;
      const l = byKey.get(`${id}|${d}`);
      const sched = isHabitScheduled({ ...data, status: 'active' }, d, isWorkDay(work.get(d)));
      if (!sched && !l) continue;
      scheduled++;
      if (!l) unmarked++;
      else if (l.status === 'full') full++;
      else if (l.status === 'min') min++;
      else if (l.status === 'skipped') skipped++;
    }
    const done = full + min;
    const rate = scheduled ? done / scheduled : 0;
    return { id, title: data.title, scheduled, full, min, skipped, unmarked, rate, stable: scheduled >= 7 && rate >= 0.7, oftenSkipped: skipped >= 3 };
  });
}

export interface WeekPoint { week: DayKey; value: number; secondary?: number }

export function weeksBack(today: DayKey, n: number): DayKey[] {
  const w0 = startOfWeek(today);
  return Array.from({ length: n }, (_, i) => addDays(w0, -7 * (n - 1 - i)));
}

export function habitWeekly(logs: HabitLog[], today: DayKey, n = 8): WeekPoint[] {
  return weeksBack(today, n).map((w) => {
    const end = addDays(w, 6);
    const inWeek = logs.filter((l) => l.date >= w && l.date <= end);
    return { week: w, value: inWeek.filter((l) => l.status === 'full').length, secondary: inWeek.filter((l) => l.status === 'min').length };
  });
}

export function produceDaily(plans: DailyPlan[], days: DayKey[]): Array<{ date: DayKey; fruit: number; veg: number }> {
  const map = new Map(plans.map((p) => [p.date, p]));
  return days.map((d) => {
    const p = map.get(d);
    return { date: d, fruit: p?.produce.filter((x) => x.kind === 'fruit').length ?? 0, veg: p?.produce.filter((x) => x.kind === 'veg').length ?? 0 };
  });
}

export function yogaWeekly(recs: YogaSessionRec[], today: DayKey, n = 8): WeekPoint[] {
  return weeksBack(today, n).map((w) => {
    const end = addDays(w, 6);
    const inWeek = recs.filter((r) => r.date >= w && r.date <= end);
    return { week: w, value: inWeek.filter((r) => r.status === 'done').length, secondary: inWeek.filter((r) => r.status === 'min').length };
  });
}

export function warmupWeekly(logs: ExerciseLog[], plans: DailyPlan[], today: DayKey, n = 8): WeekPoint[] {
  return weeksBack(today, n).map((w) => {
    const end = addDays(w, 6);
    const fromLogs = logs.filter((l) => l.date >= w && l.date <= end && l.routineId.startsWith('w-')).length;
    const fromPlan = plans.filter((p) => p.date >= w && p.date <= end).reduce((s, p) => s + Object.keys(p.done ?? {}).filter((k) => k.startsWith('warmup:')).length, 0);
    return { week: w, value: Math.max(fromLogs, fromPlan) };
  });
}

export function activityWeekly(logs: ActivityLog[], today: DayKey, n = 8): WeekPoint[] {
  return weeksBack(today, n).map((w) => {
    const end = addDays(w, 6);
    const inWeek = logs.filter((l) => l.date >= w && l.date <= end);
    return { week: w, value: inWeek.reduce((s, l) => s + (l.minutes ?? 0), 0), secondary: inWeek.reduce((s, l) => s + (l.steps ?? 0), 0) };
  });
}

export function favoriteFrequency(items: MealPlanItem[], recipes: Map<string, Recipe>): Array<{ title: string; count: number; favorite: boolean }> {
  const m = new Map<string, number>();
  for (const it of items) if (it.recipeId && recipes.has(it.recipeId)) m.set(it.recipeId, (m.get(it.recipeId) ?? 0) + 1);
  return [...m.entries()].map(([id, count]) => ({ title: recipes.get(id)!.title, count, favorite: recipes.get(id)!.kind === 'favorite' })).sort((a, b) => b.count - a.count);
}
