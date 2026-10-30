import { useState } from 'react';
import { LuBell, LuCalendarClock, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';
import type { Reminder } from '../data/types';
import { WEEKDAYS_SHORT, addDays, localTimeZone } from '../lib/date';
import { buildIcs } from '../lib/ics';
import { remindersToIcs } from '../lib/reminders';
import { deleteReminder, saveReminder, savePrefs } from '../store/actions';
import { app } from '../store/app';
import { usePrefs, useTable, useToday } from '../store/hooks';
import { cycleNow, workDaysBetween, yogaDatesBetween } from '../app/derive';
import { Button, Card, Chip, Field, Note, Segmented, Sheet, Switch, SwitchRow, confirmAction, toast } from '../ui/kit';

const KIND_LABEL: Record<Reminder['kind'], string> = { water: 'Вода', supplement: 'Назначение', produce: 'Фрукты и овощи', meal: 'Питание', yoga: 'Йога', warmup: 'Разминка', menu: 'Меню', shopping: 'Покупки', tests: 'Тесты на овуляцию', custom: 'Своё' };

function repeatLabel(r: Reminder) {
  switch (r.repeat.kind) {
    case 'daily': return 'каждый день';
    case 'workdays': return 'в рабочие дни';
    case 'yogaDays': return 'в дни йоги';
    case 'weekdays': return r.repeat.days.map((d) => WEEKDAYS_SHORT[d - 1]).join(', ') || 'дни не выбраны';
  }
}

export function Reminders() {
  const today = useToday();
  const prefs = usePrefs();
  const rows = useTable<Reminder>('reminders');
  const [edit, setEdit] = useState<{ id: string | null; r: Reminder } | null>(null);
  const [perm, setPerm] = useState<string>(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  const list = [...rows].filter((r) => (r.data.kind !== 'tests' || prefs.modules.ovulationTests) && (r.data.kind !== 'supplement' || prefs.modules.supplements))
    .sort((a, b) => a.data.time.localeCompare(b.data.time));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = (navigator as any).standalone === true || matchMedia('(display-mode: standalone)').matches;

  const exportIcs = () => {
    const to = addDays(today, 56);
    const cycle = cycleNow(app.store, prefs, today);
    const testDates: string[] = [];
    if (cycle.testStart && prefs.modules.ovulationTests) for (let i = 0; i < Math.max(4, prefs.testsTotal); i++) { const d = addDays(cycle.testStart, i); if (d >= today) testDates.push(d); }
    const events = remindersToIcs(rows, prefs, today, workDaysBetween(app.store, today, to), yogaDatesBetween(app.store, prefs, today, to), testDates);
    if (!events.length) { toast('Нет включённых напоминаний для выгрузки'); return; }
    const ics = buildIcs(events, 'Бережно — напоминания');
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'berezhno-napominaniya.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast(`Файл календаря готов: событий ${events.length}`, { tone: 'ok' });
  };

  return (
    <div className="grid gap-4 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Напоминания</h1>
          <p className="text-ink-soft mt-1 measure">Время задаёте вы. Можно выключить любое, отложить или изменить расписание. Пропущенное напоминание не становится долгом.</p>
        </div>
        <Button variant="primary" icon={<LuPlus size={18} />} onClick={() => setEdit({ id: null, r: { kind: 'custom', title: '', time: '12:00', repeat: { kind: 'daily' }, enabled: true } })}>Своё</Button>
      </div>

      <Card tint="lilac">
        <h2 className="font-semibold inline-flex items-center gap-2"><LuBell size={18} aria-hidden />Как приходят напоминания</h2>
        <ul className="text-sm mt-2 grid gap-1.5 list-disc pl-5">
          <li><b>В приложении</b> — пока приложение открыто: всплывающая подсказка с кнопками «Открыть» и «Через 15 минут».</li>
          <li><b>В системном календаре</b> — в фоне, даже когда приложение закрыто: выгрузите напоминания в Календарь iPhone, Mac или Outlook на Windows (кнопка ниже).</li>
          <li>Фоновые push-уведомления на iPhone требуют серверной части; в этой версии их нет — поэтому мы их и не обещаем.</li>
        </ul>
        {'Notification' in window && perm !== 'granted' && perm !== 'denied' && (!isIOS || standalone) && (
          <Button size="sm" variant="ghost" className="mt-3" onClick={async () => { try { setPerm(await Notification.requestPermission()); } catch { /* ignore */ } }}>Разрешить уведомления, пока приложение открыто</Button>
        )}
        {perm === 'granted' && <p className="text-xs mt-2">Уведомления разрешены: пока приложение открыто, напоминания будут приходить и системными уведомлениями.</p>}
      </Card>

      <Card>
        <h2 className="font-semibold inline-flex items-center gap-2"><LuCalendarClock size={18} aria-hidden />Выгрузить в календарь</h2>
        <p className="text-sm text-ink-soft mt-1">Создаст файл с напоминаниями на 8 недель (разминки — по отмеченным рабочим дням, йога — по плану). На iPhone откройте файл и нажмите «Добавить все». После изменений выгрузите снова, а старые события удалите, чтобы не было дублей; удобнее всего добавлять в отдельный календарь «Бережно».</p>
        <SwitchRow title="Не показывать названия назначений в календаре" hint="В календаре будет «Назначение 1», «Назначение 2»" checked={prefs.calendarHideMedNames} onChange={(v) => savePrefs({ calendarHideMedNames: v })} />
        <Button variant="mint" onClick={exportIcs}>Скачать файл календаря (.ics)</Button>
      </Card>

      <Card>
        <h2 className="font-semibold mb-1">Все напоминания</h2>
        <p className="text-xs text-ink-soft mb-2">Часовой пояс устройства: {localTimeZone()}. Напоминания идут по местному времени.</p>
        <ul className="divide-y divide-line">
          {list.map(({ id, data: r }) => (
            <li key={id} className="flex items-center gap-3 py-2.5">
              <div className="font-display text-xl font-bold tabular w-16">{r.time}</div>
              <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setEdit({ id, r })}>
                <div className="font-medium">{r.title}</div>
                <div className="text-xs text-ink-soft">{KIND_LABEL[r.kind]} · {repeatLabel(r)}{r.snoozedUntil && r.snoozedUntil > new Date().toISOString() ? ` · отложено до ${new Date(r.snoozedUntil).toTimeString().slice(0, 5)}` : ''}</div>
              </button>
              <Button size="sm" variant="quiet" aria-label={`Изменить: ${r.title}`} icon={<LuPencil size={16} />} onClick={() => setEdit({ id, r })} />
              <Switch checked={r.enabled} onChange={(v) => saveReminder(id, { ...r, enabled: v })} label={`Включено: ${r.title}`} />
            </li>
          ))}
        </ul>
        {!list.length && <p className="text-sm text-ink-soft">Напоминаний пока нет.</p>}
      </Card>
      <Note>Напоминания о назначениях создаются автоматически по времени приёма в «Моих назначениях». Разминки напоминают только в рабочие дни, тесты — только в окно тестирования и если модуль включён.</Note>
      {edit && <ReminderEditor id={edit.id} initial={edit.r} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ReminderEditor({ id, initial, onClose }: { id: string | null; initial: Reminder; onClose: () => void }) {
  const [r, setR] = useState<Reminder>(initial);
  const fixedRepeat = r.kind === 'warmup' || r.kind === 'yoga' || r.kind === 'supplement';
  const days = r.repeat.kind === 'weekdays' ? r.repeat.days : [];
  return (
    <Sheet open onClose={onClose} title={id ? 'Напоминание' : 'Новое напоминание'}
      footer={<>
        {id && (r.kind === 'custom' || r.kind === 'meal') && <Button variant="danger" icon={<LuTrash2 size={16} />} onClick={() => { if (confirmAction('Удалить напоминание?')) { deleteReminder(id); onClose(); } }}>Удалить</Button>}
        <Button variant="primary" disabled={!r.title.trim()} onClick={() => { saveReminder(id, { ...r, title: r.title.trim(), snoozedUntil: undefined }); onClose(); }}>Сохранить</Button>
      </>}>
      <div className="grid gap-3">
        <Field label="Текст"><input className="input" value={r.title} onChange={(e: any) => setR({ ...r, title: e.target.value })} disabled={r.kind === 'supplement'} /></Field>
        <Field label="Время"><input className="input" type="time" value={r.time} onChange={(e: any) => setR({ ...r, time: e.target.value })} disabled={r.kind === 'supplement'} /></Field>
        {r.kind === 'supplement' && <p className="text-sm text-ink-soft">Время меняется в карточке назначения.</p>}
        {!fixedRepeat && (
          <>
            <div className="field"><span>Повтор</span><Segmented label="Повтор" value={r.repeat.kind === 'weekdays' ? 'weekdays' : r.repeat.kind === 'workdays' ? 'workdays' : 'daily'}
              onChange={(v) => setR({ ...r, repeat: v === 'weekdays' ? { kind: 'weekdays', days: days.length ? days : [7] } : { kind: v } as Reminder['repeat'] })}
              options={[{ value: 'daily', label: 'Каждый день' }, { value: 'workdays', label: 'Рабочие дни' }, { value: 'weekdays', label: 'По дням' }]} /></div>
            {r.repeat.kind === 'weekdays' && <div className="flex flex-wrap gap-2">{WEEKDAYS_SHORT.map((d, i) => { const on = days.includes(i + 1); return <Chip key={d} on={on} onClick={() => setR({ ...r, repeat: { kind: 'weekdays', days: on ? days.filter((x) => x !== i + 1) : [...days, i + 1] } })}>{d}</Chip>; })}</div>}
          </>
        )}
        {r.kind === 'warmup' && <p className="text-sm text-ink-soft">Разминки напоминают только в отмеченные рабочие дни.</p>}
        {r.kind === 'yoga' && <p className="text-sm text-ink-soft">Йога напоминает только в запланированные дни — не в дни отдыха, менструации или при низкой энергии.</p>}
        <SwitchRow title="Включено" checked={r.enabled} onChange={(v) => setR({ ...r, enabled: v })} />
      </div>
    </Sheet>
  );
}
