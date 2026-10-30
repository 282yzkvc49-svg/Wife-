import { useEffect, useState } from 'react';
import { LuBaby, LuCamera, LuChevronLeft, LuChevronRight, LuDroplet, LuPencil, LuTestTube, LuTrash2 } from 'react-icons/lu';
import type { MenstrualEvent, OvulationTest, SymptomEntry } from '../data/types';
import { dayMarks, type DayMark } from '../lib/cycle';
import { WEEKDAYS_SHORT, addDays, addMonths, daysInMonth, diffDays, fmtDay, fmtMonth, fmtShort, plural, startOfMonth, weekday, type DayKey } from '../lib/date';
import {
  addPeriod, addPregnancyTest, deleteEvent, deleteOvulationTest, emptySymptoms, saveCycleSettings, saveOvulationTest, savePrefs, saveSymptoms, setModule, updatePeriod,
} from '../store/actions';
import { useRec, useTable, useToday } from '../store/hooks';
import { parseHash } from '../app/router';
import { useCycle } from '../app/derive';
import { Button, Card, Chip, Field, Note, NumberInput, Segmented, Sheet, SwitchRow, confirmAction, cx, toast } from '../ui/kit';

const MARK_STYLE: Record<DayMark, { label: string; cls: string; sym: string }> = {
  period: { label: 'Менструация (отмечено)', cls: 'bg-powder-strong text-ink', sym: '●' },
  'period-forecast': { label: 'Менструация (прогноз)', cls: 'border-2 border-dashed border-powder-strong', sym: '○' },
  fertile: { label: 'Фертильное окно (оценка)', cls: 'bg-mint', sym: '◇' },
  ovulation: { label: 'Овуляция (оценка)', cls: 'bg-mint-strong', sym: '◆' },
  pms: { label: 'Возможный ПМС', cls: 'bg-lilac', sym: '·' },
};

export function Cycle() {
  const today = useToday();
  const { prefs, periods, settings, pred } = useCycle(today);
  const tests = useTable<OvulationTest>('ovulation_tests');
  const events = useTable<MenstrualEvent>('menstrual_events');
  const [periodOpen, setPeriodOpen] = useState<{ id: string | null; start: DayKey; end?: DayKey } | null>(null);
  const [symOpen, setSymOpen] = useState<DayKey | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const [ptestOpen, setPtestOpen] = useState(false);
  const [month, setMonth] = useState(startOfMonth(today));
  useEffect(() => { if (parseHash(location.hash).query.get('test') === '1') setTestOpen(true); }, []);

  const last = [...periods].sort((a, b) => (a.start < b.start ? 1 : -1))[0];
  const ongoing = last && !last.end && diffDays(today, last.start) < 10;
  const pregnant = prefs.goal === 'pregnant';
  const firstMonthOver = diffDays(today, prefs.startDate) > 31;
  const testsLeft = Math.max(0, prefs.testsTotal - tests.length);
  const showTests = prefs.modules.ovulationTests && !pregnant && (!firstMonthOver || prefs.testsAfterFirstMonth === 'tests');
  const lastPositivePreg = events.filter((e) => e.data.type === 'pregnancy_test' && (e.data as any).result === 'positive').sort((a, b) => ((a.data as any).date < (b.data as any).date ? 1 : -1))[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr] lg:items-start">
      <div className="grid gap-4">
        <h1 className="text-3xl font-bold lg:col-span-2">Цикл и овуляция</h1>

        {pregnant ? (
          <Card tint="powder" petal>
            <div className="flex items-center gap-2 font-semibold"><LuBaby size={20} aria-hidden />Режим беременности</div>
            <p className="text-sm mt-1">Прогнозы овуляции и тесты приостановлены, история цикла сохранена. План нагрузок стал бережнее, а в «Знаниях» первым показывается материал о безопасности продуктов. Назначения не меняются — обсуждайте их с врачом.</p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => { if (confirmAction('Вернуть режим подготовки? Данные не потеряются.')) savePrefs({ goal: 'preparing' }); }}>Вернуть режим подготовки</Button>
          </Card>
        ) : lastPositivePreg && diffDays(today, (lastPositivePreg.data as any).date) < 30 && (
          <Card tint="powder" petal>
            <div className="font-semibold">Положительный тест на беременность</div>
            <p className="text-sm mt-1">Можно переключить приложение в режим беременности: приостановить прогнозы овуляции, сохранить историю и пересмотреть нагрузки. Рекомендуем обсудить дальнейшие шаги и все назначения с врачом.</p>
            <Button size="sm" variant="primary" className="mt-3" onClick={() => { savePrefs({ goal: 'pregnant' }); toast('Режим беременности включён. Вернуть можно в любой момент.'); }}>Включить режим беременности</Button>
          </Card>
        )}

        <Card petal tint={pregnant ? undefined : 'powder'}>
          {!pred.hasData ? (
            <>
              <h2 className="text-lg font-semibold">Начните с одной даты</h2>
              <p className="text-sm mt-1">Отметьте первый день последней менструации. Прогноз появится сразу и будет уточняться с каждым новым циклом.</p>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-3">
                <span className="font-display text-5xl font-bold tabular">{pred.cycleDay ?? '—'}</span>
                <span className="text-sm">{pred.cycleDay ? 'день цикла' : ''}{pred.periodDayToday ? ` · ${pred.periodDayToday}-й день менструации` : ''}</span>
              </div>
              <dl className="grid gap-1.5 mt-3 text-sm">
                {pred.late ? <div className="font-medium">Цикл идёт дольше прогноза. Это бывает; отметьте начало менструации, когда она начнётся. Если задержка вас беспокоит — обратитесь к врачу.</div> : pred.nextPeriodRange && (
                  <div className="flex justify-between gap-3"><dt>Следующая менструация</dt><dd className="m-0 font-medium text-right">{fmtShort(pred.nextPeriodRange[0])}–{fmtShort(pred.nextPeriodRange[1])}<span className="text-ink-soft"> (около {fmtShort(pred.nextPeriod!)})</span></dd></div>
                )}
                {!pregnant && pred.ovulationRange && !pred.late && <div className="flex justify-between gap-3"><dt>Овуляция, оценка</dt><dd className="m-0 font-medium text-right">{fmtShort(pred.ovulationRange[0])}–{fmtShort(pred.ovulationRange[1])}</dd></div>}
                {!pregnant && pred.fertile && !pred.late && <div className="flex justify-between gap-3"><dt>Фертильное окно, оценка</dt><dd className="m-0 font-medium text-right">{fmtShort(pred.fertile[0])}–{fmtShort(pred.fertile[1])}</dd></div>}
              </dl>
              <p className="text-xs mt-3">
                {pred.basis === 'history' ? `Прогноз по истории: ${pred.historyCount} ${plural(pred.historyCount, 'цикл', 'цикла', 'циклов')}, в среднем ${pred.avgLen} дней, неопределённость ±${pred.uncertainty} дн. Среднее — не гарантия.` : `Прогноз по вашим настройкам: цикл ${pred.avgLen} дней, неопределённость ±${pred.uncertainty} дн.`}
                {' '}Календарный прогноз — приблизительная оценка, он не подтверждает овуляцию.
              </p>
            </>
          )}
          <div className="flex flex-wrap gap-2 mt-4">
            {ongoing ? (
              <Button variant="primary" icon={<LuDroplet size={16} />} onClick={() => { updatePeriod(last.id, last.start, today); toast('Отмечено окончание менструации'); }}>Менструация закончилась</Button>
            ) : (
              <Button variant="primary" icon={<LuDroplet size={16} />} onClick={() => setPeriodOpen({ id: null, start: today })}>Началась менструация</Button>
            )}
            <Button variant="ghost" onClick={() => setSymOpen(today)}>Самочувствие</Button>
          </div>
        </Card>

        <CycleMonth month={month} setMonth={setMonth} today={today} periods={periods} pred={pred} onDay={setSymOpen} />
      </div>

      <div className="grid gap-4">
        {prefs.modules.ovulationTests && !pregnant && !showTests && (
          <Card>
            <h2 className="font-semibold">Тесты на овуляцию</h2>
            <p className="text-sm text-ink-soft mt-1">Первый месяц прошёл: прогноз продолжается по календарю и истории цикла. Тесты можно вернуть, если захочется.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" variant="ghost" onClick={() => savePrefs({ testsAfterFirstMonth: 'tests' })}>Продолжить тесты</Button>
              <Button size="sm" variant="quiet" onClick={() => setModule('ovulationTests', false)}>Скрыть совсем</Button>
            </div>
          </Card>
        )}
        {showTests && (
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold inline-flex items-center gap-2"><LuTestTube size={20} aria-hidden />Тесты на овуляцию</h2>
              <Button size="sm" variant="quiet" onClick={() => { setModule('ovulationTests', false); toast('Модуль скрыт. История тестов сохранена — вернуть можно в настройках.'); }}>Скрыть</Button>
            </div>
            <p className="text-sm mt-1">Тест определяет всплеск ЛГ — гормона, который обычно повышается примерно за 1–1,5 дня до овуляции. Он не подтверждает, что овуляция состоялась.</p>
            {pred.testStart && <Note className="mt-3">Ориентировочно начать тестирование: {fmtDay(pred.testStart)} — {pred.testDayOfCycle}-й день цикла (для цикла {pred.avgLen} дней). Сверьтесь с инструкцией производителя вашего теста.</Note>}
            <div className="flex items-center justify-between mt-3">
              <div className="text-sm">Осталось: <span className="font-semibold tabular">{testsLeft}</span> из
                <span className="inline-block w-16 ml-2 align-middle"><NumberInput value={prefs.testsTotal} onChange={(v) => v !== undefined && savePrefs({ testsTotal: v })} min={0} max={60} aria-label="Всего тестов куплено" /></span>
              </div>
              <Button size="sm" variant="primary" onClick={() => setTestOpen(true)}>Записать результат</Button>
            </div>
            <ul className="divide-y divide-line mt-3">
              {[...tests].sort((a, b) => (a.data.date + a.data.time < b.data.date + b.data.time ? 1 : -1)).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2">
                  {t.data.photo && <img src={t.data.photo} alt="Фото теста" className="w-12 h-12 rounded-xl object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{fmtDay(t.data.date)} {t.data.time} — {t.data.result === 'positive' ? 'положительный' : t.data.result === 'negative' ? 'отрицательный' : 'сомнительный'}</div>
                    <div className="text-xs text-ink-soft">{[t.data.maker, t.data.note].filter(Boolean).join(' · ')}</div>
                  </div>
                  <Button size="sm" variant="quiet" aria-label="Удалить запись теста" icon={<LuTrash2 size={16} />} onClick={() => { if (confirmAction('Удалить запись теста?')) deleteOvulationTest(t.id); }} />
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <h2 className="text-lg font-semibold mb-2">История циклов</h2>
          {pred.cycles.length === 0 && <p className="text-sm text-ink-soft">Пока нет отмеченных менструаций.</p>}
          <ul className="divide-y divide-line">
            {[...pred.cycles].reverse().map((c) => {
              const p = periods.find((x) => x.start === c.start)!;
              return (
                <li key={c.start} className="flex items-center gap-2 py-2">
                  <div className="flex-1">
                    <div className="font-medium">{fmtDay(c.start, { year: true })}{p?.end ? ` — ${fmtShort(p.end)}` : ''}</div>
                    <div className="text-xs text-ink-soft">{c.length ? `цикл ${c.length} дн.${c.outlier ? ' (необычная длина — в прогнозе не учитывается)' : ''}` : 'текущий цикл'}{c.periodLength ? ` · менструация ${c.periodLength} дн.` : ''}</div>
                  </div>
                  <Button size="sm" variant="quiet" aria-label="Изменить даты" icon={<LuPencil size={16} />} onClick={() => setPeriodOpen({ id: p.id, start: p.start, end: p.end })} />
                </li>
              );
            })}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setPeriodOpen({ id: null, start: addDays(today, -28) })}>Добавить прошлую менструацию</Button>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">Настройки цикла</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Обычная длина цикла"><NumberInput value={settings.avgCycle} onChange={(v) => v && saveCycleSettings({ avgCycle: v })} min={18} max={50} /></Field>
            <Field label="Менструация, дней"><NumberInput value={settings.avgPeriod} onChange={(v) => v && saveCycleSettings({ avgPeriod: v })} min={1} max={10} /></Field>
          </div>
          <div className="field mt-3"><span>Регулярность</span>
            <Segmented label="Регулярность" value={settings.regularity} onChange={(v) => saveCycleSettings({ regularity: v })} options={[{ value: 'regular', label: 'Регулярный' }, { value: 'irregular', label: 'Нерегулярный' }, { value: 'unknown', label: 'Не знаю' }]} />
          </div>
          <SwitchRow title="Учитывать историю циклов" hint="Когда накопится 2+ цикла, прогноз будет опираться на них" checked={settings.useHistory} onChange={(v) => saveCycleSettings({ useHistory: v })} />
          {!pregnant && <Button size="sm" variant="ghost" icon={<LuBaby size={16} />} onClick={() => setPtestOpen(true)}>Тест на беременность</Button>}
        </Card>
      </div>

      {periodOpen && <PeriodSheet {...periodOpen} today={today} onClose={() => setPeriodOpen(null)} />}
      {symOpen && <SymptomsSheet date={symOpen} onClose={() => setSymOpen(null)} />}
      {testOpen && <TestSheet today={today} onClose={() => setTestOpen(false)} />}
      {ptestOpen && (
        <Sheet open onClose={() => setPtestOpen(false)} title="Тест на беременность">
          <p className="text-sm text-ink-soft mb-3">Результат сохранится в истории. При положительном результате приложение предложит режим беременности — решать вам.</p>
          <div className="grid gap-2">
            <Button variant="powder" onClick={() => { addPregnancyTest(today, 'positive'); setPtestOpen(false); }}>Положительный</Button>
            <Button variant="ghost" onClick={() => { addPregnancyTest(today, 'negative'); setPtestOpen(false); }}>Отрицательный</Button>
            <Button variant="ghost" onClick={() => { addPregnancyTest(today, 'unclear'); setPtestOpen(false); }}>Непонятный</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}

function CycleMonth({ month, setMonth, today, periods, pred, onDay }: { month: DayKey; setMonth: (m: DayKey) => void; today: DayKey; periods: any[]; pred: any; onDay: (d: DayKey) => void }) {
  const symptoms = useTable<SymptomEntry>('symptoms');
  const symDays = new Set(symptoms.filter((s) => s.data.pelvicPain || s.data.backPain || s.data.pms || s.data.energy || s.data.wellbeing || s.data.note || s.data.other.length).map((s) => s.data.date));
  const lead = weekday(month) - 1;
  const cells: Array<DayKey | null> = [...Array(lead).fill(null), ...Array.from({ length: daysInMonth(month) }, (_, i) => addDays(month, i))];
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <Button variant="quiet" aria-label="Предыдущий месяц" icon={<LuChevronLeft size={20} />} onClick={() => setMonth(addMonths(month, -1))} />
        <div className="font-semibold">{fmtMonth(month)}</div>
        <Button variant="quiet" aria-label="Следующий месяц" icon={<LuChevronRight size={20} />} onClick={() => setMonth(addMonths(month, 1))} />
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-ink-soft mb-1">{WEEKDAYS_SHORT.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const marks = dayMarks(d, periods, pred);
          const main = marks.includes('period') ? 'period' : marks.includes('ovulation') ? 'ovulation' : marks.includes('fertile') ? 'fertile' : marks.includes('period-forecast') ? 'period-forecast' : null;
          const label = [fmtDay(d), ...marks.map((m) => MARK_STYLE[m].label), symDays.has(d) ? 'есть отметки самочувствия' : ''].filter(Boolean).join(', ');
          return (
            <button key={d} type="button" onClick={() => onDay(d)} aria-label={label}
              className={cx('aspect-square min-h-10 rounded-xl text-sm flex flex-col items-center justify-center relative', main ? MARK_STYLE[main].cls : '', d === today && 'ring-2 ring-ink')}>
              <span className="tabular font-medium">{Number(d.slice(8))}</span>
              <span className="text-[9px] leading-none h-2" aria-hidden>{main ? MARK_STYLE[main].sym : ''}{symDays.has(d) ? '•' : ''}</span>
            </button>
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs">
        {(['period', 'period-forecast', 'fertile', 'ovulation'] as DayMark[]).filter((m) => !(pred.paused && (m === 'fertile' || m === 'ovulation'))).map((m) => (
          <li key={m} className="inline-flex items-center gap-1.5"><span className={cx('inline-grid place-items-center w-5 h-5 rounded-md text-[10px]', MARK_STYLE[m].cls)} aria-hidden>{MARK_STYLE[m].sym}</span>{MARK_STYLE[m].label}</li>
        ))}
        <li className="inline-flex items-center gap-1.5"><span aria-hidden>•</span>самочувствие</li>
      </ul>
      <p className="text-xs text-ink-soft mt-2">Нажмите на день, чтобы отметить самочувствие.</p>
    </Card>
  );
}

function PeriodSheet({ id, start: s0, end: e0, today, onClose }: { id: string | null; start: DayKey; end?: DayKey; today: DayKey; onClose: () => void }) {
  const [start, setStart] = useState(s0);
  const [end, setEnd] = useState(e0 ?? '');
  const valid = start && start <= today && (!end || end >= start);
  return (
    <Sheet open onClose={onClose} title={id ? 'Даты менструации' : 'Менструация'}
      footer={<>
        {id && <Button variant="danger" onClick={() => { if (confirmAction('Удалить эту запись? Прогноз пересчитается.')) { deleteEvent(id); onClose(); } }}>Удалить</Button>}
        <Button variant="primary" disabled={!valid} onClick={() => { if (id) updatePeriod(id, start, end || undefined); else addPeriod(start, end || undefined); onClose(); toast('Сохранено. Прогноз пересчитан.', { tone: 'ok' }); }}>Сохранить</Button>
      </>}>
      <div className="grid gap-3">
        <Field label="Первый день"><input className="input" type="date" max={today} value={start} onChange={(e: any) => setStart(e.target.value)} /></Field>
        <Field label="Последний день (можно отметить позже)"><input className="input" type="date" min={start} max={today} value={end} onChange={(e: any) => setEnd(e.target.value)} /></Field>
        <p className="text-sm text-ink-soft">В первый и второй дни йога и интенсивные нагрузки по умолчанию не планируются.</p>
      </div>
    </Sheet>
  );
}

const OTHER = ['Головная боль', 'Вздутие', 'Тошнота', 'Чувствительность груди', 'Плохой сон', 'Раздражительность', 'Усталость'];
const PAIN = ['нет', 'слабая', 'заметная', 'сильная'];

function SymptomsSheet({ date, onClose }: { date: DayKey; onClose: () => void }) {
  const cur = useRec<SymptomEntry>('symptoms', `sym:${date}`) ?? emptySymptoms(date);
  const set = (p: Partial<SymptomEntry>) => saveSymptoms(date, p);
  return (
    <Sheet open onClose={onClose} title={`Самочувствие: ${fmtDay(date)}`} footer={<Button variant="primary" onClick={onClose}>Готово</Button>}>
      <div className="grid gap-4">
        <div className="field"><span>Тянущая боль внизу живота</span>
          <div className="flex flex-wrap gap-2">{PAIN.map((l, i) => <Chip key={l} on={cur.pelvicPain === i} onClick={() => set({ pelvicPain: i as 0 })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><span>Дискомфорт в пояснице</span>
          <div className="flex flex-wrap gap-2">{PAIN.map((l, i) => <Chip key={l} on={cur.backPain === i} onClick={() => set({ backPain: i as 0 })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><span>Уровень энергии</span>
          <div className="flex flex-wrap gap-2">{['очень мало', 'мало', 'средне', 'хорошо', 'много'].map((l, i) => <Chip key={l} on={cur.energy === i + 1} onClick={() => set({ energy: (cur.energy === i + 1 ? 0 : i + 1) as 0 })}>{l}</Chip>)}</div>
        </div>
        <div className="field"><span>Общее самочувствие</span>
          <div className="flex flex-wrap gap-2">{['плохо', 'так себе', 'нормально', 'хорошо', 'отлично'].map((l, i) => <Chip key={l} on={cur.wellbeing === i + 1} onClick={() => set({ wellbeing: (cur.wellbeing === i + 1 ? 0 : i + 1) as 0 })}>{l}</Chip>)}</div>
        </div>
        <SwitchRow title="Предменструальный период" hint="План на этот день станет щадящим" checked={cur.pms} onChange={(v) => set({ pms: v })} />
        <div className="field"><span>Другое</span>
          <div className="flex flex-wrap gap-2">{OTHER.map((o) => <Chip key={o} on={cur.other.includes(o)} onClick={() => set({ other: cur.other.includes(o) ? cur.other.filter((x) => x !== o) : [...cur.other, o] })}>{o}</Chip>)}</div>
        </div>
        <Field label="Заметка"><textarea className="input" value={cur.note} onChange={(e: any) => set({ note: e.target.value })} /></Field>
        {(cur.pelvicPain >= 3 || cur.backPain >= 3) && <Note tone="warn">При сильной, необычной или нарастающей боли рекомендуем обратиться к врачу.</Note>}
        <p className="text-xs text-ink-soft">Симптомы можно отмечать в любой день. Приложение не считает боль автоматически связанной с циклом и не ставит диагнозов.</p>
      </div>
    </Sheet>
  );
}

async function compressPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const max = 800;
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.7);
  } finally { URL.revokeObjectURL(url); }
}

function TestSheet({ today, onClose }: { today: DayKey; onClose: () => void }) {
  const [t, setT] = useState<OvulationTest>({ date: today, time: new Date().toTimeString().slice(0, 5), maker: '', result: 'negative' });
  return (
    <Sheet open onClose={onClose} title="Результат теста на овуляцию"
      footer={<Button variant="primary" onClick={() => { saveOvulationTest(null, t); onClose(); toast('Записано', { tone: 'ok' }); }}>Сохранить</Button>}>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Дата"><input className="input" type="date" max={today} value={t.date} onChange={(e: any) => setT({ ...t, date: e.target.value })} /></Field>
          <Field label="Время"><input className="input" type="time" value={t.time} onChange={(e: any) => setT({ ...t, time: e.target.value })} /></Field>
        </div>
        <Field label="Производитель"><input className="input" value={t.maker} onChange={(e: any) => setT({ ...t, maker: e.target.value })} placeholder="Название теста" /></Field>
        <div className="field"><span>Результат</span><Segmented label="Результат" value={t.result} onChange={(v) => setT({ ...t, result: v })} options={[{ value: 'negative', label: 'Отрицательный' }, { value: 'positive', label: 'Положительный' }, { value: 'unclear', label: 'Сомнительный' }]} /></div>
        <label className="btn btn-ghost cursor-pointer">
          <LuCamera size={18} aria-hidden />{t.photo ? 'Заменить фото' : 'Фото теста (по желанию)'}
          <input type="file" accept="image/*" className="sr-only" onChange={async (e: any) => { const f = e.target.files?.[0]; if (f) setT({ ...t, photo: await compressPhoto(f) }); }} />
        </label>
        {t.photo && <img src={t.photo} alt="Фото теста" className="max-h-40 rounded-2xl object-contain" />}
        <Field label="Заметка"><input className="input" value={t.note ?? ''} onChange={(e: any) => setT({ ...t, note: e.target.value })} /></Field>
        {t.result === 'positive' && <Note>Положительный тест означает всплеск ЛГ: овуляция вероятна в ближайшие 1–1,5 дня. Он не подтверждает, что овуляция произошла.</Note>}
      </div>
    </Sheet>
  );
}
