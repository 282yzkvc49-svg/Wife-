import type { CycleSettings } from '../data/types';
import { addDays, diffDays, type DayKey } from './date';

export interface PeriodRec { id: string; start: DayKey; end?: DayKey }

export interface CycleInfo { start: DayKey; length: number | null; periodLength: number | null; outlier: boolean }

export interface CyclePrediction {
  hasData: boolean;
  paused: boolean;
  lastStart: DayKey | null;
  cycleDay: number | null;
  avgLen: number;
  avgPeriod: number;
  uncertainty: number;
  basis: 'history' | 'settings';
  historyCount: number;
  nextPeriod: DayKey | null;
  nextPeriodRange: [DayKey, DayKey] | null;
  ovulation: DayKey | null;
  ovulationRange: [DayKey, DayKey] | null;
  fertile: [DayKey, DayKey] | null;
  pmsWindow: [DayKey, DayKey] | null;
  testStart: DayKey | null;
  testDayOfCycle: number | null;
  late: boolean;
  periodDayToday: number | null;
  cycles: CycleInfo[];
}

const MIN_LEN = 15;
const MAX_LEN = 60;

export function sortPeriods(periods: PeriodRec[]): PeriodRec[] {
  const seen = new Set<string>();
  return [...periods]
    .filter((p) => p.start && !seen.has(p.start) && (seen.add(p.start), true))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export function cycleHistory(periods: PeriodRec[]): CycleInfo[] {
  const s = sortPeriods(periods);
  return s.map((p, i) => {
    const next = s[i + 1];
    const length = next ? diffDays(next.start, p.start) : null;
    const periodLength = p.end ? diffDays(p.end, p.start) + 1 : null;
    return { start: p.start, length, periodLength, outlier: length !== null && (length < MIN_LEN || length > MAX_LEN) };
  });
}

/**
 * Календарный прогноз. Это оценка по прошлым циклам или настройкам — не подтверждение овуляции.
 * Овуляция оценивается как «следующая менструация − 14 дней», фертильное окно — 5 дней до и день после.
 */
export function predictCycle(periods: PeriodRec[], settings: CycleSettings, today: DayKey, paused = false): CyclePrediction {
  const sorted = sortPeriods(periods);
  const cycles = cycleHistory(sorted);
  const lengths = cycles.filter((c) => c.length !== null && !c.outlier).map((c) => c.length!) .slice(-6);
  const periodLens = cycles.filter((c) => c.periodLength && c.periodLength > 0 && c.periodLength <= 12).map((c) => c.periodLength!).slice(-6);

  let avgLen = clamp(Math.round(settings.avgCycle || 28), 20, 45);
  let uncertainty = settings.regularity === 'regular' ? 2 : settings.regularity === 'irregular' ? 5 : 3;
  let basis: 'history' | 'settings' = 'settings';
  if (settings.useHistory && lengths.length >= 2) {
    avgLen = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length);
    const spread = Math.max(...lengths) - Math.min(...lengths);
    uncertainty = Math.max(2, Math.ceil(spread / 2) + 1);
    basis = 'history';
  } else if (settings.useHistory && lengths.length === 1) {
    avgLen = Math.round((lengths[0] + avgLen) / 2);
    uncertainty = Math.max(uncertainty, 3);
    basis = 'history';
  }
  const avgPeriod = periodLens.length >= 2
    ? Math.round(periodLens.reduce((a, b) => a + b, 0) / periodLens.length)
    : clamp(Math.round(settings.avgPeriod || 5), 2, 10);

  const last = sorted[sorted.length - 1];
  const base: CyclePrediction = {
    hasData: !!last, paused, lastStart: last?.start ?? null, cycleDay: null, avgLen, avgPeriod, uncertainty, basis,
    historyCount: lengths.length, nextPeriod: null, nextPeriodRange: null, ovulation: null, ovulationRange: null,
    fertile: null, pmsWindow: null, testStart: null, testDayOfCycle: null, late: false, periodDayToday: null, cycles,
  };
  if (!last) return base;

  const cycleDay = diffDays(today, last.start) + 1;
  base.cycleDay = cycleDay >= 1 ? cycleDay : null;

  const periodEnd = last.end ?? addDays(last.start, avgPeriod - 1);
  if (today >= last.start && today <= periodEnd) base.periodDayToday = diffDays(today, last.start) + 1;
  // также предыдущая менструация с явной датой окончания
  for (const p of sorted) {
    if (p.end && today >= p.start && today <= p.end) base.periodDayToday = diffDays(today, p.start) + 1;
  }

  const next = addDays(last.start, avgLen);
  base.nextPeriod = next;
  base.nextPeriodRange = [addDays(next, -uncertainty), addDays(next, uncertainty)];
  base.late = today > base.nextPeriodRange[1];
  base.pmsWindow = [addDays(next, -5), addDays(next, -1)];

  if (!paused) {
    const ov = addDays(next, -14);
    base.ovulation = ov;
    base.ovulationRange = [addDays(ov, -(uncertainty + 1)), addDays(ov, uncertainty + 1)];
    base.fertile = [addDays(ov, -5), addDays(ov, 1)];
    const testDay = Math.max(6, avgLen - 17);
    base.testDayOfCycle = testDay;
    base.testStart = addDays(last.start, testDay - 1);
  }
  return base;
}

/** Будущие циклы для календаря (не дальше `count` циклов вперёд). */
export function projectCycles(pred: CyclePrediction, count: number): Array<{ period: DayKey; ovulation: DayKey | null; fertile: [DayKey, DayKey] | null }> {
  if (!pred.nextPeriod || pred.late) return [];
  const out = [];
  for (let k = 0; k < count; k++) {
    const period = addDays(pred.nextPeriod, pred.avgLen * k);
    const ov = pred.paused ? null : addDays(period, -14);
    out.push({ period, ovulation: ov, fertile: ov ? [addDays(ov, -5), addDays(ov, 1)] as [DayKey, DayKey] : null });
  }
  return out;
}

export type DayMark = 'period' | 'period-forecast' | 'fertile' | 'ovulation' | 'pms';

/** Отметки цикла на конкретный день: факт и прогноз отдельно. */
export function dayMarks(date: DayKey, periods: PeriodRec[], pred: CyclePrediction, horizonCycles = 3): DayMark[] {
  const marks: DayMark[] = [];
  for (const p of periods) {
    const end = p.end ?? addDays(p.start, pred.avgPeriod - 1);
    if (date >= p.start && date <= end) { marks.push('period'); break; }
  }
  if (!pred.hasData) return marks;
  const proj = projectCycles(pred, horizonCycles);
  const lastStart = pred.lastStart!;
  // овуляция текущего цикла (до первой прогнозной менструации)
  const curOv = pred.ovulation;
  const windows: Array<{ period: DayKey; ovulation: DayKey | null; fertile: [DayKey, DayKey] | null }> = [];
  if (curOv && pred.fertile && pred.nextPeriod) windows.push({ period: pred.nextPeriod, ovulation: curOv, fertile: pred.fertile });
  for (const w of proj.slice(1)) windows.push(w);
  for (const w of windows) {
    if (w.fertile && date >= w.fertile[0] && date <= w.fertile[1] && date > lastStart) marks.push(date === w.ovulation ? 'ovulation' : 'fertile');
  }
  if (!marks.includes('period')) {
    for (const w of proj) {
      const end = addDays(w.period, pred.avgPeriod - 1);
      if (date >= w.period && date <= end) { marks.push('period-forecast'); break; }
    }
  }
  return marks;
}

function clamp(n: number, a: number, b: number) { return Math.min(b, Math.max(a, n)); }
