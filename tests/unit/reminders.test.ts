import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, foldLine, escapeText } from '../../src/lib/ics.ts';
import { dueReminders, firedKey, remindersToIcs, supplementReminderPlan } from '../../src/lib/reminders.ts';
import { duplicateComponents, normalizeComponent } from '../../src/lib/schedule.ts';
import { defaultPrefs, defaultReminders } from '../../src/data/seed.ts';
import type { Reminder, Supplement } from '../../src/data/types.ts';

const prefs = { ...defaultPrefs(), yogaDays: [2, 6] };
const rems = defaultReminders(prefs).map((x) => ({ id: x.id, data: x.r }));
const info = { workDay: true, yogaPlanned: true, testsWindow: false, mute: false, satisfied: () => false };

test('напоминания: по времени, без дублей и без повторного показа', () => {
  const morning = dueReminders(rems, '2026-11-03', 9 * 60, '2026-11-03T06:00:00Z', new Set(), info, prefs);
  assert.ok(morning.some((r) => r.id === 'rem-water'));
  const due = dueReminders(rems, '2026-11-03', 11 * 60 + 45, '2026-11-03T09:00:00Z', new Set(), info, prefs);
  const ids = due.map((r) => r.id);
  assert.ok(!ids.includes('rem-water'), 'давно прошедшее не показывается — это не долг');
  assert.ok(ids.includes('rem-produce'));
  assert.ok(ids.includes('rem-warmup-0'));
  assert.ok(!ids.includes('rem-warmup-1'), 'ещё не время');
  assert.ok(!ids.includes('rem-tests'), 'не окно тестов');
  const again = dueReminders(rems, '2026-11-03', 12 * 60, '2026-11-03T09:00:00Z', new Set(ids.map((i) => firedKey(i, '2026-11-03'))), info, prefs);
  assert.equal(again.length, 0);
  const dup = [...rems, { id: 'copy', data: { ...rems[0].data } }];
  const d2 = dueReminders(dup, '2026-11-03', 9 * 60, '2026-11-03T06:00:00Z', new Set(), info, prefs);
  assert.equal(d2.filter((r) => r.data.kind === 'water').length, 1);
});

test('рабочие напоминания не приходят в нерабочие дни; отключение и тишина в разъездах', () => {
  const off = dueReminders(rems, '2026-11-03', 16 * 60, 'x', new Set(), { ...info, workDay: false }, prefs);
  assert.ok(!off.some((r) => r.data.kind === 'warmup'));
  const mute = dueReminders(rems, '2026-11-03', 16 * 60, 'x', new Set(), { ...info, mute: true }, prefs);
  assert.equal(mute.length, 0);
  const disabled = rems.map((r) => (r.id === 'rem-water' ? { ...r, data: { ...r.data, enabled: false } } : r));
  assert.ok(!dueReminders(disabled, '2026-11-03', 9 * 60, 'x', new Set(), info, prefs).some((r) => r.id === 'rem-water'));
});

test('отложенное напоминание появляется позже', () => {
  const snoozed = rems.map((r) => (r.id === 'rem-water' ? { ...r, data: { ...r.data, snoozedUntil: '2026-11-03T09:15:00.000Z' } } : r));
  assert.ok(!dueReminders(snoozed, '2026-11-03', 9 * 60, '2026-11-03T09:05:00.000Z', new Set(), info, prefs).some((r) => r.id === 'rem-water'));
  assert.ok(dueReminders(snoozed, '2026-11-03', 9 * 60 + 20, '2026-11-03T09:20:00.000Z', new Set(), info, prefs).some((r) => r.id === 'rem-water'));
});

test('напоминания о назначениях следуют за временем приёма', () => {
  const sups: Array<{ id: string; data: Supplement }> = [{ id: 's1', data: { name: 'Фолиевая кислота', dose: '', unit: '', times: ['09:00', '21:00'], frequency: 'daily', comment: '', source: '', components: [], active: true, order: 0 } }];
  const p1 = supplementReminderPlan(sups, []);
  assert.equal(p1.upsert.length, 2);
  const existing = p1.upsert.map(([id, r]) => ({ id, data: r as Reminder }));
  const p2 = supplementReminderPlan([{ id: 's1', data: { ...sups[0].data, times: ['09:00'] } }], existing);
  assert.equal(p2.upsert.length, 0);
  assert.deepEqual(p2.remove, ['rem-sup-s1-2100']);
});

test('ICS: корректный формат, повторы, сигнал, экранирование и перенос строк', () => {
  const ev = remindersToIcs(rems, prefs, '2026-11-03', ['2026-11-03', '2026-11-05'], ['2026-11-03', '2026-11-07'], []);
  const ics = buildIcs(ev, 'Бережно', new Date('2026-11-01T00:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('RRULE:FREQ=DAILY'));
  assert.ok(ics.includes('RRULE:FREQ=WEEKLY;BYDAY=SU'));
  assert.ok(ics.includes('BEGIN:VALARM'));
  assert.equal(ics.match(/UID:rem-warmup-0-/g)?.length, 2, 'разминки только в рабочие дни');
  assert.ok(!ics.includes('rem-lunch'), 'выключенные не выгружаются');
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(escapeText('a,b;c\nd'), 'a\\,b\\;c\\nd');
  assert.ok(foldLine('Ж'.repeat(80)).includes('\r\n '));
});

test('скрытие названий назначений в календаре', () => {
  const r = [{ id: 'rem-sup-x', data: { kind: 'supplement' as const, title: 'Инозитол', time: '09:00', repeat: { kind: 'daily' as const }, enabled: true } }];
  const ics = buildIcs(remindersToIcs(r, { ...prefs, calendarHideMedNames: true }, '2026-11-03', [], [], []), 'x');
  assert.ok(!ics.includes('Инозитол'));
  assert.ok(ics.includes('Назначение 1'));
});

test('дублирование компонентов в назначениях', () => {
  assert.equal(normalizeComponent('Витамин D3'), 'витамин D');
  assert.equal(normalizeComponent('холекальциферол'), 'витамин D');
  const mk = (name: string, components: string[]) => ({ id: name, data: { name, dose: '', unit: '', times: [], frequency: 'daily' as const, comment: '', source: '', components, active: true, order: 0 } });
  const d = duplicateComponents([mk('Витамин D', ['витамин D']), mk('Мультивитамин для беременных', ['фолиевая кислота', 'холекальциферол']), mk('Фолиевая кислота', ['фолиевая кислота'])]);
  const comps = d.map((x) => x.component).sort();
  assert.deepEqual(comps, ['витамин D', 'фолиевая кислота (фолаты)']);
});
