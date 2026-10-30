import { useState } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import type { WorkDay } from '../data/types';
import { WEEKDAYS_SHORT, addDays, addMonths, daysInMonth, fmtDay, fmtMonth, startOfMonth, weekday, type DayKey } from '../lib/date';
import { savePrefs, setWorkDay } from '../store/actions';
import { usePrefs, useTable, useToday } from '../store/hooks';
import { Button, Card, Chip, Field, Note, Segmented, Sheet, cx, toast } from '../ui/kit';

const STATUS: Record<WorkDay['status'], { label: string; short: string; cls: string }> = {
  office: { label: 'В офисе', short: 'Офис', cls: 'bg-mint text-mint-ink' },
  remote: { label: 'Работа вне офиса', short: 'Вне оф.', cls: 'bg-lilac text-lilac-ink' },
  trip: { label: 'Командировка, разъезды', short: 'Поездка', cls: 'bg-beige text-beige-ink' },
  off: { label: 'Выходной', short: '', cls: '' },
};
const CYCLE: Array<WorkDay['status'] | null> = [null, 'office', 'remote', 'trip'];

export function WorkCalendar() {
  const today = useToday();
  const prefs = usePrefs();
  const rows = useTable<WorkDay>('work_calendar');
  const map = new Map(rows.map((r) => [r.data.date, r.data]));
  const [month, setMonth] = useState(startOfMonth(today));
  const [edit, setEdit] = useState<DayKey | null>(null);
  const [bulk, setBulk] = useState(false);
  const first = month;
  const lead = weekday(first) - 1;
  const cells: Array<DayKey | null> = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => addDays(first, i))];
  const tap = (d: DayKey) => {
    const cur = map.get(d)?.status ?? null;
    const next = CYCLE[(CYCLE.indexOf(cur === 'off' ? null : cur) + 1) % CYCLE.length];
    setWorkDay(d, next ? { status: next, start: prefs.workStart, end: prefs.workEnd } : null);
  };
  const workCount = cells.filter((d) => d && map.get(d) && map.get(d)!.status !== 'off').length;

  return (
    <div className="grid gap-4 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Рабочий график</h1>
        <p className="text-ink-soft mt-1 measure">Рабочие дни плавающие, поэтому отмечаются вручную. Касание дня по кругу меняет: офис → вне офиса → поездка → выходной. Долгое редактирование — кнопкой «Подробнее».</p>
      </div>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <Button variant="quiet" aria-label="Предыдущий месяц" icon={<LuChevronLeft size={20} />} onClick={() => setMonth(addMonths(month, -1))} />
          <div className="font-semibold">{fmtMonth(month)} · рабочих дней: {workCount}</div>
          <Button variant="quiet" aria-label="Следующий месяц" icon={<LuChevronRight size={20} />} onClick={() => setMonth(addMonths(month, 1))} />
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-soft mb-1">{WEEKDAYS_SHORT.map((d) => <div key={d}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const w = map.get(d);
            const st = w && w.status !== 'off' ? STATUS[w.status] : null;
            return (
              <button key={d} type="button" onClick={() => tap(d)} aria-label={`${fmtDay(d, { weekday: true })}: ${st ? st.label : 'не рабочий'}`}
                className={cx('aspect-square min-h-11 rounded-xl flex flex-col items-center justify-center text-sm border', st ? `${st.cls} border-transparent` : 'border-line', d === today && 'ring-2 ring-ink')}>
                <span className="font-semibold tabular">{Number(d.slice(8))}</span>
                {st && <span className="text-[10px] leading-none mt-0.5">{st.short}</span>}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button size="sm" variant="ghost" onClick={() => setEdit(today)}>Подробнее о сегодня</Button>
          <Button size="sm" variant="ghost" onClick={() => setBulk(true)}>Заполнить несколько недель</Button>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold mb-2">Обычные часы</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Начало"><input className="input" type="time" value={prefs.workStart} onChange={(e: any) => savePrefs({ workStart: e.target.value })} /></Field>
          <Field label="Конец"><input className="input" type="time" value={prefs.workEnd} onChange={(e: any) => savePrefs({ workEnd: e.target.value })} /></Field>
        </div>
        <p className="text-xs text-ink-soft mt-2">Ориентир — 09:00–18:00. Часы конкретного дня можно изменить отдельно. Разминки и рабочие напоминания бывают только в отмеченные рабочие дни.</p>
      </Card>
      {edit && <DaySheet date={edit} w={map.get(edit)} onClose={() => setEdit(null)} />}
      {bulk && <BulkSheet onClose={() => setBulk(false)} today={today} />}
    </div>
  );
}

function DaySheet({ date, w, onClose }: { date: DayKey; w?: WorkDay; onClose: () => void }) {
  const prefs = usePrefs();
  const [s, setS] = useState<WorkDay['status']>(w?.status ?? 'office');
  const [start, setStart] = useState(w?.start ?? prefs.workStart);
  const [end, setEnd] = useState(w?.end ?? prefs.workEnd);
  const [note, setNote] = useState(w?.note ?? '');
  return (
    <Sheet open onClose={onClose} title={fmtDay(date, { weekday: true })}
      footer={<>
        {w && <Button variant="ghost" onClick={() => { setWorkDay(date, null); onClose(); }}>Отменить смену</Button>}
        <Button variant="primary" onClick={() => { setWorkDay(date, { status: s, start, end, note }); onClose(); }}>Сохранить</Button>
      </>}>
      <div className="grid gap-3">
        <div className="field"><span>День</span><Segmented label="Статус" value={s} onChange={setS} options={[{ value: 'office', label: 'Офис' }, { value: 'remote', label: 'Вне офиса' }, { value: 'trip', label: 'Поездка' }, { value: 'off', label: 'Выходной' }]} /></div>
        {s !== 'off' && <div className="grid grid-cols-2 gap-3">
          <Field label="Начало"><input className="input" type="time" value={start} onChange={(e: any) => setStart(e.target.value)} /></Field>
          <Field label="Конец"><input className="input" type="time" value={end} onChange={(e: any) => setEnd(e.target.value)} /></Field>
        </div>}
        <Field label="Заметка"><input className="input" value={note} onChange={(e: any) => setNote(e.target.value)} /></Field>
        {s === 'trip' && <Note>В день поездки можно включить на главной режим «Я в разъездах».</Note>}
      </div>
    </Sheet>
  );
}

function BulkSheet({ onClose, today }: { onClose: () => void; today: DayKey }) {
  const prefs = usePrefs();
  const [from, setFrom] = useState(today);
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const apply = () => {
    let n = 0;
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(from, i);
      if (days.includes(weekday(d))) { setWorkDay(d, { status: 'office', start: prefs.workStart, end: prefs.workEnd }); n++; }
    }
    toast(`Отмечено рабочих дней: ${n}. Отдельные дни можно поправить касанием.`, { tone: 'ok' });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Заполнить несколько недель" footer={<Button variant="primary" onClick={apply}>Отметить</Button>}>
      <div className="grid gap-3">
        <p className="text-sm text-ink-soft">Удобно, если график на ближайшие недели уже известен. Стандартная пятидневка не предполагается — выберите свои дни.</p>
        <Field label="Начиная с"><input className="input" type="date" value={from} onChange={(e: any) => setFrom(e.target.value)} /></Field>
        <div className="field"><span>Недель</span><Segmented label="Недель" value={String(weeks) as any} onChange={(v: string) => setWeeks(Number(v))} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }, { value: '4', label: '4' }, { value: '6', label: '6' }]} /></div>
        <div className="field"><span>Дни недели</span>
          <div className="flex flex-wrap gap-2">{WEEKDAYS_SHORT.map((d, i) => { const on = days.includes(i + 1); return <Chip key={d} on={on} onClick={() => setDays(on ? days.filter((x) => x !== i + 1) : [...days, i + 1])}>{d}</Chip>; })}</div>
        </div>
      </div>
    </Sheet>
  );
}
