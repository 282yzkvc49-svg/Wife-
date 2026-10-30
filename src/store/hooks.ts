import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CycleSettings, Prefs, TableName } from '../data/types';
import { CYCLE_SETTINGS_ID, DEFAULT_CYCLE, PREFS_ID, defaultPrefs } from '../data/seed';
import { dayKey, type DayKey } from '../lib/date';
import { app, getCoreVersion, subscribeCore } from './app';
import type { Row } from './db';

export function useTableVersion(t: TableName): number {
  return useSyncExternalStore(app.store.subscribe, () => app.store.tableVersion(t));
}

export function useTable<T>(t: TableName): Row<T>[] {
  const v = useTableVersion(t);
  return useMemo(() => app.store.all<T>(t), [v, t]);
}

export function useRec<T>(t: TableName, id: string): T | undefined {
  const v = useTableVersion(t);
  return useMemo(() => app.store.get<T>(t, id), [v, t, id]);
}

export function mergePrefs(p: Partial<Prefs> | undefined): Prefs {
  const d = defaultPrefs();
  if (!p) return d;
  return { ...d, ...p, modules: { ...d.modules, ...(p.modules ?? {}) }, mealTimes: { ...d.mealTimes, ...(p.mealTimes ?? {}) } };
}

export function usePrefs(): Prefs {
  const raw = useRec<Prefs>('user_preferences', PREFS_ID);
  return useMemo(() => mergePrefs(raw), [raw]);
}

export function getPrefs(): Prefs { return mergePrefs(app.store.get<Prefs>('user_preferences', PREFS_ID)); }

export function useCycleSettings(): CycleSettings {
  const raw = useRec<CycleSettings>('menstrual_cycles', CYCLE_SETTINGS_ID);
  return useMemo(() => ({ ...DEFAULT_CYCLE, ...(raw ?? {}) }), [raw]);
}

export function useSyncStatus() {
  return useSyncExternalStore(app.sync.subscribe, app.sync.getStatus);
}

export function useCore() {
  return useSyncExternalStore(subscribeCore, getCoreVersion);
}

/** Текущий день; обновляется после полуночи и при возвращении в приложение. */
export function useToday(): DayKey {
  const [d, setD] = useState(dayKey());
  useEffect(() => {
    const tick = () => setD((prev) => (prev === dayKey() ? prev : dayKey()));
    const t = setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', tick); };
  }, []);
  return d;
}

export function useNow(intervalMs = 30_000): Date {
  const [n, setN] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setN(new Date()), intervalMs); return () => clearInterval(t); }, [intervalMs]);
  return n;
}
