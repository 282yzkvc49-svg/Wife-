import { test } from 'node:test';
import assert from 'node:assert/strict';
import { predictCycle, cycleHistory, dayMarks } from '../../src/lib/cycle.ts';
import { DEFAULT_CYCLE } from '../../src/data/seed.ts';

const S = { ...DEFAULT_CYCLE };

test('без данных прогноза нет', () => {
  const p = predictCycle([], S, '2026-10-30');
  assert.equal(p.hasData, false);
  assert.equal(p.nextPeriod, null);
});

test('по настройкам: следующая менструация, овуляция, окно, старт тестов', () => {
  const p = predictCycle([{ id: 'a', start: '2026-10-20' }], { ...S, avgCycle: 28, regularity: 'regular' }, '2026-10-30');
  assert.equal(p.basis, 'settings');
  assert.equal(p.cycleDay, 11);
  assert.equal(p.nextPeriod, '2026-11-17');
  assert.deepEqual(p.nextPeriodRange, ['2026-11-15', '2026-11-19']);
  assert.equal(p.ovulation, '2026-11-03');
  assert.deepEqual(p.fertile, ['2026-10-29', '2026-11-04']);
  assert.equal(p.testDayOfCycle, 11);
  assert.equal(p.testStart, '2026-10-30');
});

test('при неизвестной регулярности неопределённость шире', () => {
  const p = predictCycle([{ id: 'a', start: '2026-10-20' }], { ...S, regularity: 'unknown' }, '2026-10-30');
  assert.equal(p.uncertainty, 3);
  const q = predictCycle([{ id: 'a', start: '2026-10-20' }], { ...S, regularity: 'irregular' }, '2026-10-30');
  assert.equal(q.uncertainty, 5);
});

test('по истории: среднее и разброс; выбросы не учитываются', () => {
  const periods = [
    { id: '1', start: '2026-06-01' }, { id: '2', start: '2026-06-30' }, // 29
    { id: '3', start: '2026-07-31' }, // 31
    { id: '4', start: '2026-08-30' }, // 30
    { id: '5', start: '2026-10-30' }, // 61 — выброс
  ];
  const h = cycleHistory(periods);
  assert.equal(h.find((c) => c.start === '2026-08-30')!.outlier, true);
  const p = predictCycle(periods, S, '2026-11-01');
  assert.equal(p.basis, 'history');
  assert.equal(p.avgLen, 30);
  assert.equal(p.historyCount, 3);
  assert.equal(p.uncertainty, 2);
  assert.equal(p.nextPeriod, '2026-11-29');
});

test('пересчёт при изменении дат', () => {
  const a = predictCycle([{ id: 'x', start: '2026-10-20' }], S, '2026-10-30');
  const b = predictCycle([{ id: 'x', start: '2026-10-22' }], S, '2026-10-30');
  assert.notEqual(a.nextPeriod, b.nextPeriod);
});

test('день менструации и задержка', () => {
  const p = predictCycle([{ id: 'x', start: '2026-10-29' }], S, '2026-10-30');
  assert.equal(p.periodDayToday, 2);
  const late = predictCycle([{ id: 'x', start: '2026-09-01' }], S, '2026-10-30');
  assert.equal(late.late, true);
});

test('режим беременности: прогноз овуляции приостановлен', () => {
  const p = predictCycle([{ id: 'x', start: '2026-10-20' }], S, '2026-10-30', true);
  assert.equal(p.paused, true);
  assert.equal(p.ovulation, null);
  assert.equal(p.fertile, null);
  assert.equal(p.testStart, null);
});

test('отметки календаря: факт и прогноз различаются', () => {
  const periods = [{ id: 'x', start: '2026-10-20', end: '2026-10-24' }];
  const p = predictCycle(periods, S, '2026-10-30');
  assert.deepEqual(dayMarks('2026-10-21', periods, p), ['period']);
  assert.ok(dayMarks('2026-11-03', periods, p).includes('ovulation'));
  assert.ok(dayMarks('2026-11-17', periods, p).includes('period-forecast'));
});
