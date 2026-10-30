import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDayPlan, habitLogId, yogaId, type PlanInput } from '../../src/lib/plan.ts';
import { predictCycle } from '../../src/lib/cycle.ts';
import { BASE_HABITS, DEFAULT_CYCLE, HABIT_IDEAS, PRESCRIBED, defaultPrefs } from '../../src/data/seed.ts';
import type { Habit, Prefs } from '../../src/data/types.ts';

const D = '2026-11-03'; // вторник
function input(p: Partial<PlanInput> = {}, prefs: Partial<Prefs> = {}): PlanInput {
  const pr = { ...defaultPrefs(), yogaDays: [2, 6], ...prefs };
  const walk = HABIT_IDEAS.find((h) => h.key === 'short-walk')!.habit;
  return {
    date: D, prefs: pr,
    habits: [...BASE_HABITS.map((h) => ({ id: h.id, data: h.habit })), { id: 'h-walk', data: { ...walk, startedAt: '2026-10-01' } as Habit }],
    habitLogs: new Map(), movedIn: [],
    cycle: predictCycle([], DEFAULT_CYCLE, D),
    supplements: PRESCRIBED.map((x) => ({ id: x.id, data: { ...x.s, times: ['09:00'] } })),
    supplementLogs: new Map(), yoga: new Map(), testsLeft: 4, testsToday: 0,
    ...p,
  };
}
const all = (r: ReturnType<typeof buildDayPlan>) => [...r.items, ...r.optional];

test('обычный день: йога в день йоги, назначения, привычки; мёд выключен', () => {
  const r = buildDayPlan(input());
  const yoga = all(r).find((i) => i.kind === 'yoga')!;
  assert.equal(yoga.priority, 'normal');
  assert.equal(r.items.filter((i) => i.kind === 'supplement').length, 3);
  assert.ok(!all(r).some((i) => i.refId === 'h-honey'));
  assert.ok(all(r).some((i) => i.refId === 'h-walk' && i.suggest === 'full'));
});

test('«мало сил»: короткие версии, необязательные — в «по желанию», йога не планируется полноценно', () => {
  const r = buildDayPlan(input({ ctx: { date: D, contexts: ['lowEnergy'], dismissedAuto: [], wakeShiftMin: 0, muteReminders: false } }));
  const water = all(r).find((i) => i.refId === 'h-water')!;
  assert.equal(water.suggest, 'min');
  assert.equal(water.priority, 'core');
  const walk = all(r).find((i) => i.refId === 'h-walk')!;
  assert.equal(walk.priority, 'optional');
  const yoga = all(r).find((i) => i.kind === 'yoga')!;
  assert.equal(yoga.priority, 'optional');
  assert.equal(yoga.routineId, 's-yoga5');
  assert.equal(r.items.filter((i) => i.kind === 'supplement').length, 3, 'назначения остаются');
  assert.ok(r.notes.some((n) => n.includes('бережный день')));
});

test('«в разъездах»: без длительной тренировки, одна разминка по возможности', () => {
  const r = buildDayPlan(input({
    ctx: { date: D, contexts: ['travel'], dismissedAuto: [], wakeShiftMin: 0, muteReminders: true },
    work: { date: D, status: 'trip' },
  }));
  assert.equal(all(r).find((i) => i.kind === 'yoga')!.priority, 'optional');
  const warm = all(r).filter((i) => i.kind === 'warmup');
  assert.equal(warm.length, 1);
  assert.equal(warm[0].priority, 'optional');
  assert.equal(r.modes.mute, true);
});

test('«всё равно хочу тренировку» возвращает полноценную йогу', () => {
  const r = buildDayPlan(input({ ctx: { date: D, contexts: ['travel'], dismissedAuto: [], wakeShiftMin: 0, muteReminders: false, allowWorkout: true } }));
  assert.equal(all(r).find((i) => i.kind === 'yoga')!.priority, 'normal');
});

test('1-й день менструации: йога заменена бережной практикой (автоматически по циклу)', () => {
  const cycle = predictCycle([{ id: 'p', start: D }], DEFAULT_CYCLE, D);
  const r = buildDayPlan(input({ cycle }));
  assert.ok(r.contexts.includes('period1'));
  const yoga = all(r).find((i) => i.kind === 'yoga')!;
  assert.equal(yoga.suggest, 'gentle');
  assert.ok(yoga.alternatives!.includes('m-relax10'));
});

test('автоконтекст можно снять', () => {
  const cycle = predictCycle([{ id: 'p', start: D }], DEFAULT_CYCLE, D);
  const r = buildDayPlan(input({ cycle, ctx: { date: D, contexts: [], dismissedAuto: ['period1'], wakeShiftMin: 0, muteReminders: false } }));
  assert.ok(!r.contexts.includes('period1'));
});

test('отмеченная боль переключает щадящий режим; сильная — совет обратиться к врачу', () => {
  const r = buildDayPlan(input({ symptoms: { date: D, pelvicPain: 3, backPain: 0, energy: 0, wellbeing: 0, pms: false, other: [], note: '' } }));
  assert.equal(r.modes.gentle, true);
  assert.ok(r.notes.some((n) => n.includes('врачу')));
});

test('поздний подъём сдвигает утренние привычки и ничего не просрочено', () => {
  const r = buildDayPlan(input({ ctx: { date: D, contexts: ['lateWake'], dismissedAuto: [], wakeShiftMin: 120, muteReminders: false } }));
  const water = all(r).find((i) => i.refId === 'h-water')!;
  assert.equal(water.time, '10:00');
  assert.equal(water.shifted, true);
});

test('день отдыха: йога не планируется', () => {
  const r = buildDayPlan(input({ ctx: { date: D, contexts: ['rest'], dismissedAuto: [], wakeShiftMin: 0, muteReminders: false } }));
  const y = all(r).find((i) => i.kind === 'yoga')!;
  assert.equal(y.priority, 'optional');
  assert.ok(y.title.includes('не сегодня'));
});

test('разминки только в рабочие дни', () => {
  assert.equal(all(buildDayPlan(input())).filter((i) => i.kind === 'warmup').length, 0);
  assert.equal(all(buildDayPlan(input({ work: { date: D, status: 'office' } }))).filter((i) => i.kind === 'warmup').length, 2);
});

test('прогресс: пропуск не считается долгом, минимальная версия считается выполнением', () => {
  const logs = new Map([
    [habitLogId('h-water', D), { habitId: 'h-water', date: D, status: 'min' as const, at: '' }],
    [habitLogId('h-walk', D), { habitId: 'h-walk', date: D, status: 'skipped' as const, at: '' }],
  ]);
  const r = buildDayPlan(input({ habitLogs: logs }));
  const totalWithout = buildDayPlan(input()).progress.total;
  assert.equal(r.progress.total, totalWithout - 1, 'пропущенное исключено из знаменателя');
  assert.equal(r.progress.done, 1);
});

test('перенос привычки и йоги на другой день', () => {
  const moved = { habitId: 'h-walk', date: '2026-11-02', status: 'moved' as const, movedTo: D, at: '' };
  const prefsNoWalk = input();
  prefsNoWalk.habits = prefsNoWalk.habits.map((h) => (h.id === 'h-walk' ? { ...h, data: { ...h.data, schedule: { kind: 'weekdays', days: [1] } as any } } : h));
  const r = buildDayPlan({ ...prefsNoWalk, movedIn: [moved] });
  assert.ok(all(r).some((i) => i.refId === 'h-walk' && i.note === 'Перенесено на сегодня'));

  const yoga = new Map([[yogaId(D), { date: D, sessionId: 'y-spine', status: 'moved' as const, movedTo: '2026-11-04' }]]);
  assert.ok(!all(buildDayPlan(input({ yoga }))).some((i) => i.kind === 'yoga'));
  const yoga2 = new Map([[yogaId('2026-11-04'), { date: '2026-11-04', sessionId: 'y-spine', status: 'planned' as const, movedFrom: D }]]);
  const r2 = buildDayPlan(input({ date: '2026-11-04', yoga: yoga2 }));
  assert.ok(all(r2).some((i) => i.kind === 'yoga' && i.routineId === 'y-spine'));
});

test('скрытые пункты не показываются', () => {
  const r = buildDayPlan(input({ day: { date: D, water: 0, produce: [], hidden: ['habit:h-walk'], skipped: [], done: {} } }));
  assert.ok(!all(r).some((i) => i.refId === 'h-walk'));
  assert.equal(r.hiddenCount, 1);
});

test('тесты на овуляцию — только в окно, только если модуль включён', () => {
  const cycle = predictCycle([{ id: 'p', start: '2026-10-24' }], DEFAULT_CYCLE, D); // тесты с 03.11
  assert.ok(all(buildDayPlan(input({ cycle }))).some((i) => i.kind === 'test'));
  assert.ok(!all(buildDayPlan(input({ cycle }, { modules: { ...defaultPrefs().modules, ovulationTests: false } }))).some((i) => i.kind === 'test'));
  assert.ok(!all(buildDayPlan(input({ cycle, testsLeft: 0 }))).some((i) => i.kind === 'test'));
});
