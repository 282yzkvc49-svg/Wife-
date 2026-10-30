import { useMemo, useSyncExternalStore } from 'react';
import type {
  CycleSettings, DailyContext, DailyPlan, Habit, HabitLog, MenstrualEvent, OvulationTest, Prefs, Reminder, Supplement,
  SupplementLog, SymptomEntry, WorkDay, YogaSessionRec,
} from '../data/types';
import { CYCLE_SETTINGS_ID, DEFAULT_CYCLE } from '../data/seed';
import { predictCycle, type CyclePrediction, type PeriodRec } from '../lib/cycle';
import { addDays, type DayKey } from '../lib/date';
import { buildDayPlan, yogaPlanned, type DayPlanResult } from '../lib/plan';
import type { ReminderDayInfo } from '../lib/reminders';
import { isWorkDay } from '../lib/schedule';
import { app } from '../store/app';
import type { Store } from '../store/db';
import { getPrefs } from '../store/hooks';

export function periodsFrom(store: Store): Array<PeriodRec & { note?: string }> {
  return store.all<MenstrualEvent>('menstrual_events')
    .filter((r) => r.data.type === 'period')
    .map((r) => ({ id: r.id, start: (r.data as any).start, end: (r.data as any).end, note: (r.data as any).note }));
}

export function cycleSettings(store: Store): CycleSettings {
  return { ...DEFAULT_CYCLE, ...(store.get<CycleSettings>('menstrual_cycles', CYCLE_SETTINGS_ID) ?? {}) };
}

export function cycleNow(store: Store, prefs: Prefs, today: DayKey): CyclePrediction {
  return predictCycle(periodsFrom(store), cycleSettings(store), today, prefs.goal === 'pregnant');
}

export function testsInfo(store: Store, prefs: Prefs, date: DayKey) {
  const tests = store.all<OvulationTest>('ovulation_tests');
  return { tests, left: Math.max(0, prefs.testsTotal - tests.length), today: tests.filter((t) => t.data.date === date).length };
}

export function planFor(store: Store, prefs: Prefs, date: DayKey, cycle: CyclePrediction): DayPlanResult {
  const habitLogs = new Map<string, HabitLog>();
  const movedIn: HabitLog[] = [];
  for (const r of store.all<HabitLog>('habit_logs')) {
    if (r.data.date === date) habitLogs.set(r.id, r.data);
    if (r.data.status === 'moved' && r.data.movedTo === date) movedIn.push(r.data);
  }
  const supplementLogs = new Map<string, SupplementLog>();
  for (const r of store.all<SupplementLog>('supplement_logs')) if (r.data.date === date) supplementLogs.set(r.id, r.data);
  const yoga = new Map<string, YogaSessionRec>(store.all<YogaSessionRec>('yoga_sessions').map((r) => [r.id, r.data]));
  const t = testsInfo(store, prefs, date);
  return buildDayPlan({
    date, prefs, cycle,
    habits: store.all<Habit>('habits'),
    habitLogs, movedIn,
    ctx: store.get<DailyContext>('daily_context', `ctx:${date}`),
    day: store.get<DailyPlan>('daily_plans', `day:${date}`),
    work: store.get<WorkDay>('work_calendar', `work:${date}`),
    symptoms: store.get<SymptomEntry>('symptoms', `sym:${date}`),
    supplements: store.all<Supplement>('supplements'),
    supplementLogs, yoga, testsLeft: t.left, testsToday: t.today,
  });
}

export function reminderInfo(store: Store, prefs: Prefs, date: DayKey, cycle: CyclePrediction, plan: DayPlanResult): ReminderDayInfo {
  const yoga = new Map<string, YogaSessionRec>(store.all<YogaSessionRec>('yoga_sessions').map((r) => [r.id, r.data]));
  const yrec = yogaPlanned(date, prefs, yoga);
  const testItem = [...plan.items, ...plan.optional].find((i) => i.kind === 'test');
  const yogaItem = [...plan.items, ...plan.optional].find((i) => i.kind === 'yoga');
  const day = store.get<DailyPlan>('daily_plans', `day:${date}`);
  void cycle;
  return {
    workDay: plan.workDay,
    yogaPlanned: !!yrec && !!yogaItem && yogaItem.priority !== 'optional',
    testsWindow: !!testItem,
    mute: plan.modes.mute,
    satisfied: ({ data: r }) => {
      const all = [...plan.items, ...plan.optional];
      if (r.kind === 'supplement') return all.filter((i) => i.kind === 'supplement' && i.refId === r.refId && i.time === r.time).every((i) => i.status !== 'pending');
      if (r.kind === 'yoga') return !yogaItem || yogaItem.status !== 'pending';
      if (r.kind === 'tests') return !testItem || testItem.status !== 'pending';
      if (r.kind === 'water') return all.some((i) => i.refId === 'h-water' && i.status !== 'pending');
      if (r.kind === 'produce') return (day?.produce.length ?? 0) > 0;
      if (r.kind === 'warmup') return all.filter((i) => i.kind === 'warmup' && i.time === r.time).every((i) => i.status !== 'pending');
      return false;
    },
  };
}

/** Рабочие дни в диапазоне (для календаря и выгрузки). */
export function workDaysBetween(store: Store, from: DayKey, to: DayKey): DayKey[] {
  return store.all<WorkDay>('work_calendar').filter((r) => isWorkDay(r.data) && r.data.date >= from && r.data.date <= to).map((r) => r.data.date).sort();
}

export function yogaDatesBetween(store: Store, prefs: Prefs, from: DayKey, to: DayKey): DayKey[] {
  const yoga = new Map<string, YogaSessionRec>(store.all<YogaSessionRec>('yoga_sessions').map((r) => [r.id, r.data]));
  const out: DayKey[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) { const y = yogaPlanned(d, prefs, yoga); if (y && y.status !== 'skipped') out.push(d); }
  return out;
}

// ——— Хук: пересчитывать при любом изменении данных ———
export function useStoreVersion() { return useSyncExternalStore(app.store.subscribe, app.store.getVersion); }

export function useDerivedDay(date: DayKey) {
  const v = useStoreVersion();
  return useMemo(() => {
    const prefs = getPrefs();
    const cycle = cycleNow(app.store, prefs, date);
    const plan = planFor(app.store, prefs, date, cycle);
    return { prefs, cycle, plan };
  }, [v, date]);
}

export function useCycle(today: DayKey) {
  const v = useStoreVersion();
  return useMemo(() => {
    const prefs = getPrefs();
    return { prefs, periods: periodsFrom(app.store), settings: cycleSettings(app.store), pred: cycleNow(app.store, prefs, today) };
  }, [v, today]);
}

export function remindersAll(): Array<{ id: string; data: Reminder }> { return app.store.all<Reminder>('reminders'); }
