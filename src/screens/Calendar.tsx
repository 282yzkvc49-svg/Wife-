import { useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { routineById } from '../data/movement';
import { SLOT_LABEL } from '../data/recipes';
import type { ActivityLog, DailyNote, DailyPlan, MealPlanItem, OvulationTest, Prefs, Recipe, Reminder, Supplement, SupplementLog, SymptomEntry, WorkDay, YogaSessionRec } from '../data/types';
import { dayMarks, type CyclePrediction, type PeriodRec } from '../lib/cycle';
import { WEEKDAYS_SHORT, addDays, addMonths, daysInMonth, fmtDay, fmtMonth, startOfMonth, startOfWeek, weekday, type DayKey } from '../lib/date';
import { yogaPlanned } from '../lib/plan';
import { isWorkDay, supplementLogId, supplementScheduledOn } from '../lib/schedule';
import { saveNote, savePrefs } from '../store/actions';
import { app } from '../store/app';
import { useToday } from '../store/hooks';
import { go } from '../app/router';
import { useCycle, useStoreVersion } from '../app/derive';
import { Button, Card, Chip, Segmented, cx } from '../ui/kit';

type Cat = 'cycle' | 'tests' | 'symptoms' | 'meds' | 'yoga' | 'work' | 'warmups' | 'activity' | 'menu' | 'shopping' | 'notes';
const CATS: Record<Cat, { label: string; dot: string; sym: string; link: string }> = {
  cycle: { label: 'Цикл', dot: 'bg-powder-strong', sym: '●', link: 'cycle' },
  tests: { label: 'Тесты', dot: 'bg-powder-ink', sym: '▲', link: 'cycle' },
  symptoms: { label: 'Самочувствие', dot: 'bg-lilac-strong', sym: '♦', link: 'cycle' },
  meds: { label: 'Назначения', dot: 'bg-lilac-ink', sym: '■', link: 'meds' },
  yoga: { label: 'Йога', dot: 'bg-mint-ink', sym: '✿', link: 'move' },
  work: { label: 'Работа', dot: 'bg-beige-strong', sym: '▬', link: 'work' },
  warmups: { label: 'Разминки', dot: 'bg-mint-strong', sym: '◦', link: 'move/warmups' },
  activity: { label: 'Прогулки и тренировки', dot: 'bg-mint', sym: '⟡', link: 'move/activity' },
  menu: { label: 'Меню', dot: 'bg-beige-ink', sym: '◐', link: 'food' },
  shopping: { label: 'Покупки', dot: 'bg-amber-ink', sym: '◇', link: 'food/shopping' },
  notes: { label: 'Заметки', dot: 'bg-ink-soft', sym: '✎', link: '' },
};

interface Ev { cat: Cat; text: string }

function eventsFor(d: DayKey, ctx: { prefs: Prefs; periods: PeriodRec[]; pred: CyclePrediction; today: DayKey }): Ev[] {
  const s = app.store;
  const { prefs, periods, pred, today } = ctx;
  const out: Ev[] = [];
  if (prefs.modules.cycle) {
    for (const m of dayMarks(d, periods, pred)) out.push({ cat: 'cycle', text: m === 'period' ? 'Менструация' : m === 'period-forecast' ? 'Менструация (прогноз)' : m === 'ovulation' ? 'Овуляция (оценка)' : m === 'fertile' ? 'Фертильное окно (оценка)' : 'Возможный ПМС' });
    for (const t of s.all<OvulationTest>('ovulation_tests')) if (t.data.date === d) out.push({ cat: 'tests', text: `Тест ${t.data.time}: ${t.data.result === 'positive' ? 'положительный' : t.data.result === 'negative' ? 'отрицательный' : 'сомнительный'}` });
    const sym = s.get<SymptomEntry>('symptoms', `sym:${d}`);
    if (sym) {
      const parts = [sym.pelvicPain ? 'боль внизу живота' : '', sym.backPain ? 'поясница' : '', sym.pms ? 'ПМС' : '', sym.energy ? `энергия ${sym.energy}/5` : '', ...sym.other].filter(Boolean);
      if (parts.length || sym.note) out.push({ cat: 'symptoms', text: parts.join(', ') || sym.note });
    }
  }
  if (prefs.modules.supplements) {
    for (const sp of s.all<Supplement>('supplements')) {
      if (!supplementScheduledOn(sp.data, d)) continue;
      const times = sp.data.times.length ? sp.data.times : [''];
      const sts = times.map((t) => s.get<SupplementLog>('supplement_logs', supplementLogId(sp.id, d, t))?.status);
      const name = prefs.calendarHideMedNames ? 'Назначение' : sp.data.name;
      const st = sts.every((x) => x === 'taken') ? 'принято' : sts.some((x) => x === 'skipped') ? 'пропущено' : d <= today ? 'не отмечено' : 'запланировано';
      out.push({ cat: 'meds', text: `${name}${times[0] ? ` ${times.join(', ')}` : ''} — ${st}` });
    }
  }
  const yoga = new Map(s.all<YogaSessionRec>('yoga_sessions').map((r) => [r.id, r.data]));
  const y = yogaPlanned(d, prefs, yoga);
  const moved = yoga.get(`yoga:${d}`);
  if (y) out.push({ cat: 'yoga', text: `${routineById(y.sessionId)?.title ?? 'Йога'} — ${y.status === 'done' ? 'выполнено' : y.status === 'min' ? 'коротко' : y.status === 'skipped' ? 'пропущено' : 'план'}` });
  else if (moved?.status === 'moved') out.push({ cat: 'yoga', text: `Йога перенесена на ${fmtDay(moved.movedTo!)}` });
  const w = s.get<WorkDay>('work_calendar', `work:${d}`);
  if (w && isWorkDay(w)) {
    out.push({ cat: 'work', text: `${w.status === 'office' ? 'Офис' : w.status === 'remote' ? 'Работа вне офиса' : 'Поездка'}${w.start ? ` ${w.start}–${w.end}` : ''}` });
    if (prefs.modules.warmups) {
      const done = Object.keys(s.get<DailyPlan>('daily_plans', `day:${d}`)?.done ?? {}).filter((k) => k.startsWith('warmup:')).length;
      out.push({ cat: 'warmups', text: `Перерывы: ${done} из ${prefs.warmupTimes.length}` });
    }
  }
  for (const a of s.all<ActivityLog>('activity_logs')) if (a.data.date === d) out.push({ cat: 'activity', text: `${a.data.type === 'walk' ? 'Прогулка' : a.data.type === 'steps' ? 'Шаги' : a.data.type === 'workout' ? 'Тренировка' : 'Активность'}: ${a.data.steps ? `${a.data.steps} шагов` : `${a.data.minutes ?? 0} мин`}` });
  if (prefs.modules.nutrition) {
    const recipes = new Map(s.all<Recipe>('recipes').map((r) => [r.id, r.data.title]));
    for (const m of s.all<MealPlanItem>('meal_plan_items')) if (m.data.date === d) out.push({ cat: 'menu', text: `${SLOT_LABEL[m.data.slot]}: ${m.data.recipeId ? recipes.get(m.data.recipeId) ?? '—' : m.data.text}` });
    const shop = s.all<Reminder>('reminders').find((r) => r.data.kind === 'shopping' && r.data.enabled && r.data.repeat.kind === 'weekdays' && r.data.repeat.days.includes(weekday(d)));
    if (shop) out.push({ cat: 'shopping', text: `Покупки ${shop.data.time}` });
  }
  const note = s.get<DailyNote>('daily_notes', `note:${d}`);
  if (note?.text) out.push({ cat: 'notes', text: note.text });
  return out;
}

export function CalendarScreen({ initial }: { initial?: string }) {
  const today = useToday();
  const v = useStoreVersion();
  const { prefs, periods, pred } = useCycle(today);
  const [mode, setMode] = useState<'day' | 'week' | 'month'>('month');
  const [cursor, setCursor] = useState<DayKey>(initial ?? today);
  const [sel, setSel] = useState<DayKey>(initial ?? today);
  const hidden = new Set(prefs.hiddenCalendarCategories as Cat[]);
  const ctx = { prefs, periods, pred, today };
  const ev = (d: DayKey) => eventsFor(d, ctx).filter((e) => !hidden.has(e.cat));

  const monthStart = startOfMonth(cursor);
  const monthCells = useMemo(() => {
    const lead = weekday(monthStart) - 1;
    return [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(monthStart) }, (_, i) => addDays(monthStart, i))] as Array<DayKey | null>;
  }, [monthStart]);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i));
  const step = (n: number) => setCursor(mode === 'month' ? addMonths(cursor, n) : addDays(cursor, (mode === 'week' ? 7 : 1) * n));
  void v;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr] lg:items-start">
      <div className="grid gap-3">
        <h1 className="text-3xl font-bold">Календарь</h1>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <Segmented label="Вид" value={mode} onChange={setMode} options={[{ value: 'day', label: 'День' }, { value: 'week', label: 'Неделя' }, { value: 'month', label: 'Месяц' }]} />
          <div className="flex flex-wrap items-center gap-1">
            <Button variant="quiet" aria-label="Назад" icon={<LuChevronLeft size={20} />} onClick={() => step(-1)} />
            <span className="font-semibold text-center">{mode === 'month' ? fmtMonth(cursor) : mode === 'week' ? `${fmtDay(weekDays[0])} — ${fmtDay(weekDays[6])}` : fmtDay(cursor)}</span>
            <Button variant="quiet" aria-label="Вперёд" icon={<LuChevronRight size={20} />} onClick={() => step(1)} />
            <Button size="sm" variant="quiet" onClick={() => { setCursor(today); setSel(today); }}>Сегодня</Button>
          </div>
        </div>

        {mode === 'month' && (
          <Card className="p-3">
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-soft mb-1">{WEEKDAYS_SHORT.map((d) => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((d, i) => {
                if (!d) return <div key={`e${i}`} />;
                const list = ev(d);
                // назначения в будущих днях не отмечаем точками, чтобы месяц не был перегружен
                const cats = [...new Set(list.filter((e) => !(e.cat === 'meds' && d > today)).map((e) => e.cat))];
                return (
                  <button key={d} type="button" onClick={() => setSel(d)} aria-pressed={sel === d} aria-label={`${fmtDay(d, { weekday: true })}: ${list.length ? list.map((e) => e.text).join('; ') : 'нет событий'}`}
                    className={cx('min-h-14 rounded-xl p-1 flex flex-col items-center gap-1 border', sel === d ? 'border-lilac-strong bg-lilac' : 'border-transparent', d === today && 'ring-2 ring-ink')}>
                    <span className="text-sm font-semibold tabular">{Number(d.slice(8))}</span>
                    <span className="flex flex-wrap justify-center gap-0.5" aria-hidden>{cats.slice(0, 6).map((c) => <i key={c} className={cx('block w-1.5 h-1.5 rounded-full', CATS[c].dot)} />)}</span>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {mode === 'week' && (
          <div className="grid gap-2">
            {weekDays.map((d) => (
              <Card key={d} className={cx('p-3', sel === d && 'border-lilac-strong')}>
                <button type="button" className="w-full text-left" onClick={() => setSel(d)}>
                  <div className={cx('font-semibold first-letter:uppercase', d === today && 'text-mint-ink')}>{fmtDay(d, { weekday: true })}</div>
                  <ul className="text-sm mt-1 grid gap-0.5">{ev(d).slice(0, 6).map((e, i) => <li key={i} className="flex gap-2"><span aria-hidden className="text-ink-soft">{CATS[e.cat].sym}</span><span><span className="sr-only">{CATS[e.cat].label}: </span>{e.text}</span></li>)}</ul>
                  {ev(d).length === 0 && <div className="text-sm text-ink-soft">—</div>}
                </button>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <div className="text-sm font-medium mb-2">Показывать</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(CATS) as Cat[]).map((c) => (
              <Chip key={c} on={!hidden.has(c)} onClick={() => savePrefs({ hiddenCalendarCategories: hidden.has(c) ? [...hidden].filter((x) => x !== c) : [...hidden, c] })}
                icon={<i className={cx('block w-2.5 h-2.5 rounded-full', CATS[c].dot)} aria-hidden />}>{CATS[c].label}</Chip>
            ))}
          </div>
        </Card>
      </div>

      <DayPanel date={mode === 'day' ? cursor : sel} events={ev(mode === 'day' ? cursor : sel)} today={today} />
    </div>
  );
}

function DayPanel({ date, events, today }: { date: DayKey; events: Ev[]; today: DayKey }) {
  const note = app.store.get<DailyNote>('daily_notes', `note:${date}`)?.text ?? '';
  const [draft, setDraft] = useState<{ d: string; t: string } | null>(null);
  const text = draft && draft.d === date ? draft.t : note;
  const grouped = (Object.keys(CATS) as Cat[]).map((c) => ({ c, items: events.filter((e) => e.cat === c && c !== 'notes') })).filter((g) => g.items.length);
  return (
    <Card className="lg:sticky lg:top-6">
      <h2 className="text-xl font-semibold first-letter:uppercase">{fmtDay(date, { weekday: true, year: true })}</h2>
      {date === today && <Button size="sm" variant="mint" className="mt-2" onClick={() => go('')}>План на сегодня</Button>}
      {grouped.length === 0 && <p className="text-sm text-ink-soft mt-3">В этот день ничего не отмечено.</p>}
      <div className="grid gap-3 mt-3">
        {grouped.map(({ c, items }) => (
          <div key={c}>
            <a href={`#/${CATS[c].link}`} className="text-sm font-semibold inline-flex items-center gap-2 no-underline text-ink"><i className={cx('block w-2.5 h-2.5 rounded-full', CATS[c].dot)} aria-hidden />{CATS[c].label}</a>
            <ul className="text-sm mt-1 grid gap-0.5 pl-4.5">{items.map((e, i) => <li key={i}>{e.text}</li>)}</ul>
          </div>
        ))}
      </div>
      <label className="field mt-4"><span>Заметка дня</span>
        <textarea className="input" value={text} onChange={(e: any) => setDraft({ d: date, t: e.target.value })} onBlur={() => { if (draft && draft.d === date) { saveNote(date, draft.t); } }} placeholder="Например, вопросы к врачу" />
      </label>
      {draft && draft.d === date && draft.t !== note && <Button size="sm" variant="primary" className="mt-2" onClick={() => { saveNote(date, draft.t); setDraft(null); }}>Сохранить заметку</Button>}
      <p className="text-xs text-ink-soft mt-3">Чтобы изменить событие, откройте его раздел — ссылка в названии категории.</p>
    </Card>
  );
}
