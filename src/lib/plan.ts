import type {
  ContextKind, DailyContext, DailyPlan, Habit, HabitLog, MealPlanItem, Prefs, Recipe, Supplement, SupplementLog,
  SymptomEntry, WorkDay, YogaSessionRec,
} from '../data/types';
import { WARMUPS, YOGA, SHORT, type Routine } from '../data/movement';
import type { CyclePrediction } from './cycle';
import { addDays, diffDays, minToTime, timeToMin, weekday, type DayKey } from './date';
import { isHabitScheduled, isWorkDay, supplementLogId, supplementScheduledOn } from './schedule';

export type ItemKind = 'habit' | 'supplement' | 'yoga' | 'warmup' | 'test';
export type ItemStatus = 'pending' | 'full' | 'min' | 'skipped' | 'moved';
export type ItemAction = 'done' | 'min' | 'move' | 'skip' | 'schedule' | 'hide' | 'open';

export interface PlanItem {
  key: string;
  kind: ItemKind;
  refId: string;
  title: string;
  subtitle?: string;
  minText?: string;
  time?: string;
  shifted?: boolean;
  priority: 'core' | 'normal' | 'optional';
  /** что предлагается по умолчанию: полная версия, короткая или бережная замена */
  suggest: 'full' | 'min' | 'gentle';
  status: ItemStatus;
  note?: string;
  routineId?: string;
  alternatives?: string[];
  actions: ItemAction[];
}

export interface PlanInput {
  date: DayKey;
  prefs: Prefs;
  habits: Array<{ id: string; data: Habit }>;
  habitLogs: Map<string, HabitLog>;
  /** записи с переносом на эту дату */
  movedIn: HabitLog[];
  ctx?: DailyContext;
  day?: DailyPlan;
  work?: WorkDay;
  cycle: CyclePrediction;
  symptoms?: SymptomEntry;
  supplements: Array<{ id: string; data: Supplement }>;
  supplementLogs: Map<string, SupplementLog>;
  yoga: Map<string, YogaSessionRec>;
  testsLeft: number;
  testsToday: number;
}

export interface DayModes {
  lowEnergy: boolean; busy: boolean; travel: boolean; gentle: boolean; rest: boolean;
  shiftMin: number; mute: boolean; strongPain: boolean;
}

export interface DayPlanResult {
  contexts: ContextKind[];
  autoContexts: ContextKind[];
  modes: DayModes;
  notes: string[];
  items: PlanItem[];
  optional: PlanItem[];
  hiddenCount: number;
  progress: { done: number; total: number };
  workDay: boolean;
}

export const CONTEXT_LABEL: Record<ContextKind, string> = {
  normal: 'Обычный день', busy: 'Загруженный день', travel: 'Разъезды', lowEnergy: 'Мало сил', lateWake: 'Поздний подъём',
  badSleep: 'Сбитый сон', pms: 'Предменструальный период', period1: '1-й день менструации', period2: '2-й день менструации', rest: 'День отдыха',
};

export function habitLogId(habitId: string, date: DayKey) { return `hl:${habitId}:${date}`; }
export function yogaId(date: DayKey) { return `yoga:${date}`; }

/** Автоматически предлагаемые контексты (пользователь может их снять). */
export function autoContexts(cycle: CyclePrediction, symptoms?: SymptomEntry): ContextKind[] {
  const out: ContextKind[] = [];
  if (!cycle.paused) {
    if (cycle.periodDayToday === 1) out.push('period1');
    if (cycle.periodDayToday === 2) out.push('period2');
  }
  if (symptoms?.pms) out.push('pms');
  return out;
}

export function effectiveContexts(ctx: DailyContext | undefined, auto: ContextKind[]): ContextKind[] {
  const set = new Set<ContextKind>(ctx?.contexts ?? []);
  for (const a of auto) if (!(ctx?.dismissedAuto ?? []).includes(a)) set.add(a);
  set.delete('normal');
  return [...set];
}

export function computeModes(contexts: ContextKind[], ctx: DailyContext | undefined, symptoms?: SymptomEntry): DayModes {
  const has = (k: ContextKind) => contexts.includes(k);
  const pain = !!symptoms && (symptoms.pelvicPain >= 2 || symptoms.backPain >= 2);
  const lowEnergyBySymptoms = !!symptoms && symptoms.energy > 0 && symptoms.energy <= 1;
  const shift = has('lateWake') || has('badSleep') ? (ctx?.wakeShiftMin || 120) : 0;
  return {
    lowEnergy: has('lowEnergy') || lowEnergyBySymptoms,
    busy: has('busy'),
    travel: has('travel'),
    gentle: has('period1') || has('period2') || has('pms') || pain,
    rest: has('rest'),
    shiftMin: shift,
    mute: !!ctx?.muteReminders,
    strongPain: !!symptoms && (symptoms.pelvicPain >= 3 || symptoms.backPain >= 3),
  };
}

/** Какое занятие йогой предложить в этот день (по очереди из каталога). */
export function yogaRoutineFor(date: DayKey, yogaDays: number[]): Routine {
  const weekIndex = Math.floor(diffDays(date, '2026-01-05') / 7);
  const order = [...yogaDays].sort();
  const pos = Math.max(0, order.indexOf(weekday(date)));
  return YOGA[((weekIndex * Math.max(1, order.length) + pos) % YOGA.length + YOGA.length) % YOGA.length];
}

const WARMUP_ROTATION = ['w-neck', 'w-eyes', 'w-shoulders', 'w-back', 'w-wrists', 'w-general', 'w-walk', 'w-relax'];
export function warmupFor(date: DayKey, index: number): Routine {
  const n = diffDays(date, '2026-01-01') * 2 + index;
  const id = WARMUP_ROTATION[((n % WARMUP_ROTATION.length) + WARMUP_ROTATION.length) % WARMUP_ROTATION.length];
  return WARMUPS.find((w) => w.id === id)!;
}

/** Запланирована ли йога на дату (с учётом переносов). */
export function yogaPlanned(date: DayKey, prefs: Prefs, yoga: Map<string, YogaSessionRec>): YogaSessionRec | null {
  const rec = yoga.get(yogaId(date));
  if (rec) return rec.status === 'moved' ? null : rec;
  if (prefs.modules.yoga && prefs.yogaDays.includes(weekday(date))) {
    return { date, sessionId: yogaRoutineFor(date, prefs.yogaDays).id, status: 'planned' };
  }
  return null;
}

export function buildDayPlan(inp: PlanInput): DayPlanResult {
  const { date, prefs, day } = inp;
  const workDay = isWorkDay(inp.work);
  const auto = autoContexts(inp.cycle, inp.symptoms);
  const contexts = effectiveContexts(inp.ctx, auto);
  const m = computeModes(contexts, inp.ctx, inp.symptoms);
  const hidden = new Set(day?.hidden ?? []);
  const skipped = new Set(day?.skipped ?? []);
  const doneMap = day?.done ?? {};
  const items: PlanItem[] = [];
  const notes: string[] = [];

  // ——— Заметки об адаптации ———
  if (m.lowEnergy) notes.push('Сегодня бережный день: оставлено главное и короткие версии привычек. Остальное подождёт — это не долг.');
  if (m.travel) notes.push('В разъездах: длительных тренировок нет, короткая разминка — по возможности. Варианты еды вне дома — в «Перекусить сейчас».');
  if (contexts.includes('period1') || contexts.includes('period2')) notes.push('Первые дни менструации: йога и интенсивные нагрузки не запланированы. Можно отдохнуть, выбрать медитацию или мягкую растяжку.');
  else if (m.gentle) notes.push('Отмечен дискомфорт: план переключён на щадящий режим.');
  if (m.strongPain) notes.push('Если боль сильная, необычная или нарастает — лучше обратиться к врачу.');
  if (m.shiftMin) notes.push(`Утро сдвинуто на ${Math.round(m.shiftMin / 60 * 10) / 10} ч — ничего не просрочено и не нужно ничего компенсировать.`);
  if (m.rest) notes.push('День отдыха: тренировки не запланированы.');
  if (m.busy && !m.lowEnergy) notes.push('Загруженный день: можно выбирать короткие версии.');

  const shiftTime = (t: string | undefined, morning: boolean) => {
    if (!t) return { time: undefined, shifted: false };
    if (m.shiftMin && morning) return { time: minToTime((timeToMin(t) ?? 0) + m.shiftMin), shifted: true };
    return { time: t, shifted: false };
  };

  // ——— Назначения (всегда в плане, не сокращаются) ———
  if (prefs.modules.supplements) {
    for (const { id, data } of [...inp.supplements].sort((a, b) => a.data.order - b.data.order)) {
      if (!supplementScheduledOn(data, date)) continue;
      const times = data.times.length ? data.times : [''];
      for (const t of times) {
        const key = `sup:${id}:${t || 'any'}`;
        if (hidden.has(key)) continue;
        const log = inp.supplementLogs.get(supplementLogId(id, date, t));
        const st: ItemStatus = log?.status === 'taken' ? 'full' : log?.status === 'skipped' ? 'skipped' : 'pending';
        const dose = [data.dose, data.unit].filter(Boolean).join(' ');
        const tt = shiftTime(t || undefined, (timeToMin(t) ?? 720) < 720);
        items.push({
          key, kind: 'supplement', refId: id, title: data.name, subtitle: dose || undefined, time: tt.time, shifted: tt.shifted,
          priority: 'core', suggest: 'full', status: st,
          note: dose ? undefined : 'Дозировка не указана — заполните по назначению врача',
          actions: ['done', 'skip', 'schedule'],
        });
      }
    }
  }

  // ——— Привычки ———
  const habitMap = new Map(inp.habits.map((h) => [h.id, h.data]));
  const habitList: Array<{ id: string; data: Habit; moved?: boolean }> = [];
  for (const h of inp.habits) {
    if (h.data.seed === 'honey' && !prefs.modules.honey) continue;
    if (isHabitScheduled(h.data, date, workDay)) habitList.push(h);
  }
  for (const l of inp.movedIn) {
    const h = habitMap.get(l.habitId);
    if (h && h.status === 'active' && !habitList.some((x) => x.id === l.habitId)) habitList.push({ id: l.habitId, data: h, moved: true });
  }
  for (const { id, data, moved } of habitList.sort((a, b) => a.data.order - b.data.order)) {
    const key = `habit:${id}`;
    if (hidden.has(key)) continue;
    const log = inp.habitLogs.get(habitLogId(id, date));
    const st: ItemStatus = log ? log.status : 'pending';
    const reduced = m.lowEnergy || (m.busy && !data.core);
    const optional = !!data.optional || (m.lowEnergy && !data.core);
    const tt = shiftTime(data.time, data.timeOfDay === 'morning');
    items.push({
      key, kind: 'habit', refId: id, title: data.title, subtitle: reduced ? data.minVersion : data.fullVersion,
      minText: data.minVersion, time: tt.time, shifted: tt.shifted,
      priority: data.core ? 'core' : optional ? 'optional' : 'normal',
      suggest: reduced ? 'min' : 'full', status: st,
      note: moved ? 'Перенесено на сегодня' : data.note && data.optional ? data.note : undefined,
      actions: ['done', 'min', 'move', 'skip', 'schedule', 'hide'],
    });
  }

  // ——— Йога ———
  const yrec = prefs.modules.yoga ? yogaPlanned(date, prefs, inp.yoga) : null;
  if (yrec && !hidden.has('yoga')) {
    const routine = YOGA.find((r) => r.id === yrec.sessionId) ?? SHORT.find((r) => r.id === yrec.sessionId) ?? YOGA[0];
    const st: ItemStatus = yrec.status === 'done' ? 'full' : yrec.status === 'min' ? 'min' : yrec.status === 'skipped' ? 'skipped' : 'pending';
    const allow = !!inp.ctx?.allowWorkout;
    const base = { key: 'yoga', kind: 'yoga' as const, refId: yogaId(date), status: st, time: prefs.yogaTime, minText: '5 минут или отдых' };
    if (m.rest && st === 'pending') {
      // в день отдыха йога не планируется; можно перенести
      items.push({ ...base, title: 'Йога — не сегодня', subtitle: 'День отдыха. Перенесите занятие на другой день, если хочется.', priority: 'optional', suggest: 'gentle', actions: ['move', 'skip'] });
    } else if (m.gentle && !allow && st === 'pending') {
      items.push({ ...base, title: 'Бережная практика вместо йоги', subtitle: 'Мягкая растяжка, медитация или отдых — на выбор', priority: 'optional', suggest: 'gentle',
        routineId: 'g-stretch10', alternatives: ['g-stretch10', 'm-relax10', 's-breath5'], note: 'Полное занятие можно перенести на другой день', actions: ['open', 'min', 'move', 'skip'] });
    } else if ((m.lowEnergy || m.travel) && !allow && st === 'pending') {
      items.push({ ...base, title: `Йога — по желанию`, subtitle: m.travel ? 'В разъездах без длительных тренировок. Можно 5 минут или перенести.' : 'Можно 5 минут или просто отдохнуть',
        priority: 'optional', suggest: 'min', routineId: 's-yoga5', alternatives: [routine.id, 's-yoga5', 'm-relax10'], actions: ['open', 'min', 'move', 'skip'] });
    } else {
      items.push({ ...base, title: `Йога: ${routine.title}`, subtitle: `${routine.minutes} мин · ${routine.focus}`, priority: 'normal', suggest: 'full',
        routineId: routine.id, note: yrec.movedFrom ? 'Перенесено с другого дня' : undefined, actions: ['open', 'min', 'move', 'skip'] });
    }
  }

  // ——— Разминки в рабочие дни ———
  if (prefs.modules.warmups && workDay) {
    const times = m.travel ? prefs.warmupTimes.slice(0, 1) : prefs.warmupTimes;
    times.forEach((t, i) => {
      const key = `warmup:${i}`;
      if (hidden.has(key)) return;
      let r = warmupFor(date, i);
      if (m.lowEnergy && !r.gentle) r = WARMUPS.find((w) => w.id === 'w-relax')!;
      if (m.gentle && r.id === 'w-general') r = WARMUPS.find((w) => w.id === 'w-neck')!;
      const st: ItemStatus = skipped.has(key) ? 'skipped' : doneMap[key] === 'full' ? 'full' : doneMap[key] === 'min' ? 'min' : 'pending';
      items.push({
        key, kind: 'warmup', refId: key, title: `Перерыв: ${r.title.toLowerCase()}`, subtitle: `${r.minutes} мин`, time: t,
        priority: m.lowEnergy || m.travel || m.rest ? 'optional' : 'normal', suggest: 'full', status: st, routineId: r.id,
        alternatives: ['w-neck', 'w-shoulders', 'w-eyes', 'w-back', 'w-wrists', 'w-general', 'w-walk', 'w-relax', 'm-relax10'],
        note: m.travel ? 'Если будет возможность' : undefined, actions: ['open', 'done', 'skip', 'hide'],
      });
    });
  }

  // ——— Тест на овуляцию (если модуль включён и сейчас окно тестирования) ———
  if (prefs.modules.ovulationTests && prefs.modules.cycle && prefs.goal === 'preparing' && inp.cycle.testStart && inp.testsLeft > 0 && !hidden.has('test')) {
    const from = inp.cycle.testStart;
    const to = addDays(from, Math.max(prefs.testsTotal, 4) + 2);
    if (date >= from && date <= to) {
      items.push({
        key: 'test', kind: 'test', refId: 'test', title: 'Тест на овуляцию — по желанию', subtitle: `Осталось тестов: ${inp.testsLeft}. Время — по инструкции производителя.`,
        priority: 'optional', suggest: 'full', status: inp.testsToday > 0 ? 'full' : skipped.has('test') ? 'skipped' : 'pending',
        actions: ['open', 'skip', 'hide'],
      });
    }
  }

  // ——— Пропуски дня ———
  for (const it of items) if (it.status === 'pending' && skipped.has(it.key)) it.status = 'skipped';

  const main = items.filter((i) => i.priority !== 'optional');
  const optional = items.filter((i) => i.priority === 'optional');
  const sortByTime = (a: PlanItem, b: PlanItem) => (timeToMin(a.time) ?? 2000) - (timeToMin(b.time) ?? 2000);
  main.sort(sortByTime);
  optional.sort(sortByTime);
  const counted = [...main.filter((i) => i.status !== 'skipped' && i.status !== 'moved'), ...optional.filter((i) => i.status === 'full' || i.status === 'min')];
  const done = counted.filter((i) => i.status === 'full' || i.status === 'min').length;

  return {
    contexts, autoContexts: auto, modes: m, notes, items: main, optional,
    hiddenCount: hidden.size, progress: { done, total: counted.length }, workDay,
  };
}

/** Ближайший приём пищи по меню. */
export function nextMeal(items: Array<{ id: string; data: MealPlanItem }>, recipes: Map<string, Recipe>, prefs: Prefs, now: number) {
  const order = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const list = items
    .map((x) => ({ ...x, at: timeToMin(prefs.mealTimes[x.data.slot]) ?? 0 }))
    .sort((a, b) => a.at - b.at || order.indexOf(a.data.slot) - order.indexOf(b.data.slot));
  const upcoming = list.find((x) => !x.data.eaten && x.at + 60 >= now) ?? null;
  if (!upcoming) return null;
  const r = upcoming.data.recipeId ? recipes.get(upcoming.data.recipeId) : undefined;
  return { id: upcoming.id, slot: upcoming.data.slot, title: r?.title ?? upcoming.data.text ?? 'Без названия', time: prefs.mealTimes[upcoming.data.slot] };
}
