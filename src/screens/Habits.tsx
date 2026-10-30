import { useEffect, useState } from 'react';
import { LuPause, LuPencil, LuPlay, LuPlus, LuTrash2 } from 'react-icons/lu';
import { HABIT_IDEAS } from '../data/seed';
import type { Habit, HabitSchedule, TimeOfDay } from '../data/types';
import { WEEKDAYS_SHORT, dayKey } from '../lib/date';
import { scheduleLabel } from '../lib/schedule';
import { deleteHabit, saveHabit, setModule } from '../store/actions';
import { usePrefs, useTable } from '../store/hooks';
import { HABIT_ICON_NAMES, HabitIcon } from '../ui/icons';
import { Button, Card, Chip, Field, Note, Segmented, Sheet, Switch, confirmAction, cx, toast } from '../ui/kit';
import { parseHash } from '../app/router';

const blank = (): Habit => ({ title: '', fullVersion: '', minVersion: '', icon: 'sprout', schedule: { kind: 'daily' }, timeOfDay: 'any', core: false, status: 'active', order: 50, startedAt: dayKey() });

export function Habits() {
  const habits = useTable<Habit>('habits');
  const prefs = usePrefs();
  const [edit, setEdit] = useState<{ id: string | null; h: Habit } | null>(null);
  useEffect(() => {
    const id = parseHash(location.hash).query.get('edit');
    if (id) { const h = habits.find((x) => x.id === id); if (h) setEdit({ id, h: h.data }); }
  }, []);
  const list = [...habits].filter((h) => h.data.seed !== 'honey' || prefs.modules.honey).sort((a, b) => a.data.order - b.data.order);
  const active = list.filter((h) => h.data.status === 'active');
  const paused = list.filter((h) => h.data.status === 'paused');
  const used = new Set(habits.map((h) => h.data.seed));
  const ideas = HABIT_IDEAS.filter((i) => !used.has(i.key));
  const recentlyAdded = active.filter((h) => h.data.startedAt && h.data.startedAt >= dayKey(new Date(Date.now() - 14 * 86400000)) && h.data.seed !== 'warm-water').length;

  return (
    <div className="grid gap-4 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Привычки</h1>
          <p className="text-ink-soft mt-1 measure">По одной-две за раз. У каждой есть полная и короткая версия — короткая тоже считается.</p>
        </div>
        <Button variant="primary" icon={<LuPlus size={18} />} onClick={() => setEdit({ id: null, h: blank() })}>Своя</Button>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-1">Активные</h2>
        {active.length === 0 && <p className="text-sm text-ink-soft">Нет активных привычек.</p>}
        <ul className="divide-y divide-line">
          {active.map((h) => <HabitRow key={h.id} id={h.id} h={h.data} onEdit={() => setEdit({ id: h.id, h: h.data })} />)}
        </ul>
      </Card>

      {paused.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-1">На паузе</h2>
          <ul className="divide-y divide-line">{paused.map((h) => <HabitRow key={h.id} id={h.id} h={h.data} onEdit={() => setEdit({ id: h.id, h: h.data })} />)}</ul>
        </Card>
      )}

      <Card tint="beige">
        <h2 className="text-lg font-semibold">Идеи новых привычек</h2>
        <p className="text-sm text-beige-ink mt-0.5 mb-3">Ни одна не становится обязательной без вашего решения. Можно связать с тёплой водой утром — но последовательность не обязательна.</p>
        {recentlyAdded >= 2 && <Note className="mb-3">За последние две недели уже добавлено {recentlyAdded} привычки. Возможно, стоит дать им закрепиться, прежде чем добавлять новые.</Note>}
        <div className="grid gap-2 sm:grid-cols-2">
          {ideas.map((i) => (
            <div key={i.key} className="surface px-4 py-3 flex items-start gap-3">
              <span className="mt-0.5 text-mint-ink"><HabitIcon name={i.habit.icon} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-medium">{i.habit.title}</div>
                <div className="text-sm text-ink-soft">{i.why}</div>
              </div>
              <Button size="sm" variant="mint" aria-label={`Добавить: ${i.habit.title}`} icon={<LuPlus size={16} />} onClick={() => { saveHabit(`h-${i.key}`, { ...i.habit, startedAt: dayKey() }); toast('Добавлено', { tone: 'ok' }); }} />
            </div>
          ))}
        </div>
        <div className="mt-4 surface px-4">
          <div className="flex items-center justify-between gap-4 py-3">
            <div><div className="font-medium">Ложка мёда утром</div><div className="text-sm text-ink-soft">Необязательно. Доказанного влияния на фертильность нет; мёд — это сахар.</div></div>
            <Switch checked={prefs.modules.honey} onChange={(v) => setModule('honey', v)} label="Ложка мёда утром" />
          </div>
        </div>
      </Card>

      {edit && <HabitEditor key={edit.id ?? 'new'} id={edit.id} initial={edit.h} onClose={() => setEdit(null)} />}
    </div>
  );
}

function HabitRow({ id, h, onEdit }: { id: string; h: Habit; onEdit: () => void }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <span className={cx('grid place-items-center w-10 h-10 rounded-full shrink-0', h.status === 'active' ? 'bg-mint text-mint-ink' : 'bg-beige text-beige-ink')}><HabitIcon name={h.icon} /></span>
      <button type="button" className="flex-1 min-w-0 text-left" onClick={onEdit}>
        <div className="font-medium">{h.title}{h.core && <span className="ml-2 text-xs font-semibold text-mint-ink">главная</span>}</div>
        <div className="text-sm text-ink-soft">{scheduleLabel(h)}{h.time ? ` · ${h.time}` : ''} · коротко: {h.minVersion || '—'}</div>
      </button>
      <Button size="sm" variant="quiet" aria-label={h.status === 'active' ? `Пауза: ${h.title}` : `Возобновить: ${h.title}`} icon={h.status === 'active' ? <LuPause size={16} /> : <LuPlay size={16} />}
        onClick={() => { saveHabit(id, { ...h, status: h.status === 'active' ? 'paused' : 'active' }); toast(h.status === 'active' ? 'На паузе — история сохранена' : 'Возобновлено'); }} />
      <Button size="sm" variant="quiet" aria-label={`Изменить: ${h.title}`} icon={<LuPencil size={16} />} onClick={onEdit} />
    </li>
  );
}

function HabitEditor({ id, initial, onClose }: { id: string | null; initial: Habit; onClose: () => void }) {
  const [h, setH] = useState<Habit>(initial);
  const set = (p: Partial<Habit>) => setH({ ...h, ...p });
  const sched = h.schedule;
  const setKind = (kind: HabitSchedule['kind']) => set({ schedule: kind === 'weekdays' ? { kind, days: sched.kind === 'weekdays' ? sched.days : [1, 3, 5] } : { kind } as HabitSchedule });
  const valid = h.title.trim().length > 0;
  return (
    <Sheet open onClose={onClose} title={id ? 'Привычка' : 'Новая привычка'}
      footer={<>
        {id && h.seed !== 'warm-water' && <Button variant="danger" icon={<LuTrash2 size={16} />} onClick={() => { if (confirmAction('Удалить привычку? Отметки за прошлые дни останутся в статистике.')) { deleteHabit(id); onClose(); } }}>Удалить</Button>}
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button variant="primary" disabled={!valid} onClick={() => { saveHabit(id, { ...h, title: h.title.trim(), fullVersion: h.fullVersion.trim() || h.title.trim() }); onClose(); toast('Сохранено', { tone: 'ok' }); }}>Сохранить</Button>
      </>}>
      <div className="grid gap-3">
        <Field label="Название"><input className="input" value={h.title} onChange={(e: any) => set({ title: e.target.value })} /></Field>
        <Field label="Полная версия"><input className="input" value={h.fullVersion} onChange={(e: any) => set({ fullVersion: e.target.value })} placeholder="Например, 20 минут прогулки" /></Field>
        <Field label="Минимальная версия" hint="Для дней, когда мало сил. Засчитывается как выполнение минимальной привычки."><input className="input" value={h.minVersion} onChange={(e: any) => set({ minVersion: e.target.value })} placeholder="Например, 5 минут у окна" /></Field>
        <div className="field"><span>Когда</span>
          <Segmented label="Расписание" value={sched.kind} onChange={setKind} options={[{ value: 'daily', label: 'Каждый день' }, { value: 'weekdays', label: 'По дням' }, { value: 'workdays', label: 'Рабочие' }, { value: 'offdays', label: 'Выходные' }]} />
        </div>
        {sched.kind === 'weekdays' && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Дни недели">
            {WEEKDAYS_SHORT.map((d, i) => { const on = sched.days.includes(i + 1); return <Chip key={d} on={on} onClick={() => set({ schedule: { kind: 'weekdays', days: on ? sched.days.filter((x) => x !== i + 1) : [...sched.days, i + 1] } })}>{d}</Chip>; })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="field"><span>Время дня</span>
            <select className="input" value={h.timeOfDay} onChange={(e: any) => set({ timeOfDay: e.target.value as TimeOfDay })}>
              <option value="morning">Утро</option><option value="day">День</option><option value="evening">Вечер</option><option value="any">Любое</option>
            </select>
          </div>
          <Field label="Время (необязательно)"><input className="input" type="time" value={h.time ?? ''} onChange={(e: any) => set({ time: e.target.value || undefined })} /></Field>
        </div>
        <div className="surface px-4">
          <div className="flex items-center justify-between gap-4 py-3">
            <div><div className="font-medium">Главная привычка</div><div className="text-sm text-ink-soft">Остаётся в плане даже в день «мало сил»</div></div>
            <Switch checked={h.core} onChange={(v) => set({ core: v })} label="Главная привычка" />
          </div>
        </div>
        <div className="field"><span>Значок</span>
          <div className="flex flex-wrap gap-1.5">
            {HABIT_ICON_NAMES.map((n) => (
              <button key={n} type="button" aria-label={n} aria-pressed={h.icon === n} onClick={() => set({ icon: n })}
                className={cx('grid place-items-center w-11 h-11 rounded-full border', h.icon === n ? 'bg-mint border-mint-strong text-mint-ink' : 'border-line')}><HabitIcon name={n} /></button>
            ))}
          </div>
        </div>
        <Field label="Заметка"><textarea className="input" value={h.note ?? ''} onChange={(e: any) => set({ note: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}
