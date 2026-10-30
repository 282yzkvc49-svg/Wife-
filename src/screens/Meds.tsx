import { useMemo, useState } from 'react';
import { LuPencil, LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import type { Supplement, SupplementLog } from '../data/types';
import { WEEKDAYS_SHORT, addDays, fmtShort } from '../lib/date';
import { duplicateComponents, supplementLogId, supplementScheduledOn } from '../lib/schedule';
import { deleteSupplement, saveSupplement, setSupplementStatus } from '../store/actions';
import { useTable, useToday } from '../store/hooks';
import { Button, Card, Chip, Empty, Field, Note, Segmented, Sheet, SwitchRow, confirmAction, cx } from '../ui/kit';

const blank = (): Supplement => ({ name: '', dose: '', unit: '', times: [], frequency: 'daily', comment: '', source: 'Назначение врача', components: [], active: true, order: 50 });

export function Meds() {
  const today = useToday();
  const sups = useTable<Supplement>('supplements');
  const logs = useTable<SupplementLog>('supplement_logs');
  const [edit, setEdit] = useState<{ id: string | null; s: Supplement } | null>(null);
  const logMap = useMemo(() => new Map(logs.map((l) => [l.id, l.data])), [logs]);
  const dups = duplicateComponents(sups);
  const list = [...sups].sort((a, b) => Number(b.data.active) - Number(a.data.active) || a.data.order - b.data.order);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));

  return (
    <div className="grid gap-4 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Мои назначения</h1>
          <p className="text-ink-soft mt-1 measure">Здесь хранится то, что назначил врач. Приложение не придумывает дозировки и не меняет назначения.</p>
        </div>
        <Button variant="primary" icon={<LuPlus size={18} />} onClick={() => setEdit({ id: null, s: blank() })}>Добавить</Button>
      </div>

      {dups.length > 0 && (
        <Note tone="warn">
          <p className="m-0 font-medium">Возможное дублирование компонентов</p>
          <ul className="list-disc pl-5 mt-1">{dups.map((d) => <li key={d.component}>{d.component}: {d.names.join(', ')}</li>)}</ul>
          <p className="mt-1 mb-0">Это не обязательно ошибка — уточните у врача, нужно ли принимать эти средства вместе. Не меняйте и не отменяйте назначения самостоятельно.</p>
        </Note>
      )}

      {list.length === 0 && <Card><Empty title="Назначений пока нет" action={<Button variant="mint" onClick={() => setEdit({ id: null, s: blank() })}>Добавить назначение</Button>}>Добавьте средства, которые назначил врач: название, дозировку и время приёма.</Empty></Card>}

      {list.map(({ id, data: s }) => {
        const times = s.times.length ? s.times : [''];
        const scheduledToday = supplementScheduledOn(s, today);
        return (
          <Card key={id} className={cx(!s.active && 'opacity-70')}>
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold">{s.name}</h2>
                <div className="text-sm text-ink-soft">
                  {[s.dose || s.unit ? `${s.dose} ${s.unit}`.trim() : 'дозировка не указана', s.times.length ? s.times.join(', ') : 'время не указано',
                    s.frequency === 'daily' ? 'ежедневно' : `по дням: ${(s.days ?? []).map((d) => WEEKDAYS_SHORT[d - 1]).join(', ')}`,
                    s.startDate ? `с ${fmtShort(s.startDate)}` : null, s.endDate ? `до ${fmtShort(s.endDate)}` : null, !s.active ? 'не принимается' : null].filter(Boolean).join(' · ')}
                </div>
                {s.source && <div className="text-xs text-ink-soft mt-0.5">Источник: {s.source}</div>}
                {s.comment && <div className="text-sm mt-1">{s.comment}</div>}
              </div>
              <Button size="sm" variant="quiet" aria-label={`Изменить: ${s.name}`} icon={<LuPencil size={16} />} onClick={() => setEdit({ id, s })} />
            </div>
            {!s.dose && s.active && <Note className="mt-3">Заполните дозировку так, как указано в назначении врача.</Note>}
            {s.active && scheduledToday && (
              <div className="grid gap-2 mt-3">
                {times.map((t) => {
                  const st = logMap.get(supplementLogId(id, today, t))?.status;
                  return (
                    <div key={t || 'any'} className="flex flex-wrap items-center gap-2">
                      <span className="text-sm w-24">Сегодня{t ? ` ${t}` : ''}</span>
                      <Chip on={st === 'taken'} onClick={() => setSupplementStatus(id, today, t, st === 'taken' ? null : 'taken')}>Принято</Chip>
                      <Chip on={st === 'skipped'} onClick={() => setSupplementStatus(id, today, t, st === 'skipped' ? null : 'skipped')}>Пропущено</Chip>
                      {!st && <span className="text-xs text-ink-soft">не отмечено</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3">
              <div className="text-xs text-ink-soft mb-1">Последние 14 дней</div>
              <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                {days.map((d) => {
                  const sched = supplementScheduledOn(s, d);
                  const sts = times.map((t) => logMap.get(supplementLogId(id, d, t))?.status);
                  const taken = sts.filter((x) => x === 'taken').length;
                  const skipped = sts.filter((x) => x === 'skipped').length;
                  const label = !sched ? 'не запланировано' : taken === times.length ? 'принято' : skipped ? 'пропущено' : taken ? 'частично' : 'не отмечено';
                  return (
                    <div key={d} title={`${fmtShort(d)}: ${label}`} aria-label={`${fmtShort(d)}: ${label}`}
                      className={cx('h-7 rounded-md grid place-items-center text-[10px]', !sched ? 'bg-transparent' : taken === times.length ? 'bg-mint-ink text-card' : skipped ? 'bg-beige text-beige-ink' : taken ? 'bg-mint text-mint-ink' : 'border border-line text-ink-soft')}>
                      {!sched ? '' : taken === times.length ? '✓' : skipped ? '–' : taken ? '½' : ''}
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-ink-soft mt-1">✓ принято · – пропущено · пустая клетка — не отмечено (это не пропуск)</div>
            </div>
          </Card>
        );
      })}
      <Note>Общие рекомендации из раздела «Знания» не заменяют назначение врача. Не отменяйте и не меняйте средства без консультации.</Note>
      {edit && <SupEditor id={edit.id} initial={edit.s} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SupEditor({ id, initial, onClose }: { id: string | null; initial: Supplement; onClose: () => void }) {
  const [s, setS] = useState<Supplement>(initial);
  const [time, setTime] = useState('09:00');
  const [comps, setComps] = useState(initial.components.join(', '));
  const set = (p: Partial<Supplement>) => setS({ ...s, ...p });
  return (
    <Sheet open onClose={onClose} title={id ? s.name || 'Назначение' : 'Новое назначение'}
      footer={<>
        {id && <Button variant="danger" icon={<LuTrash2 size={16} />} onClick={() => { if (confirmAction('Удалить назначение? История отметок сохранится в базе.')) { deleteSupplement(id); onClose(); } }}>Удалить</Button>}
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button variant="primary" disabled={!s.name.trim()} onClick={() => { saveSupplement(id, { ...s, name: s.name.trim(), components: comps.split(',').map((x) => x.trim()).filter(Boolean) }); onClose(); }}>Сохранить</Button>
      </>}>
      <div className="grid gap-3">
        <Field label="Название"><input className="input" value={s.name} onChange={(e: any) => set({ name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Дозировка (как в назначении)"><input className="input" value={s.dose} onChange={(e: any) => set({ dose: e.target.value })} inputMode="decimal" placeholder="—" /></Field>
          <Field label="Единицы"><input className="input" value={s.unit} onChange={(e: any) => set({ unit: e.target.value })} placeholder="мг, мкг, МЕ, таб." list="units" />
            <datalist id="units"><option value="мг" /><option value="мкг" /><option value="МЕ" /><option value="г" /><option value="таб." /><option value="капс." /><option value="саше" /></datalist></Field>
        </div>
        <div className="field"><span>Время приёма</span>
          <div className="flex flex-wrap gap-2">
            {s.times.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-full bg-lilac text-lilac-ink pl-3 pr-1 min-h-9 tabular">{t}<button type="button" aria-label={`Убрать ${t}`} className="grid place-items-center w-8 h-8 rounded-full" onClick={() => set({ times: s.times.filter((x) => x !== t) })}><LuX size={14} aria-hidden /></button></span>)}
          </div>
          <div className="flex gap-2 mt-1"><input className="input w-36" type="time" value={time} onChange={(e: any) => setTime(e.target.value)} aria-label="Время" /><Button variant="ghost" onClick={() => !s.times.includes(time) && set({ times: [...s.times, time].sort() })}>Добавить время</Button></div>
        </div>
        <div className="field"><span>Частота</span><Segmented label="Частота" value={s.frequency === 'daily' ? 'daily' : 'weekdays'} onChange={(v) => set({ frequency: v, days: v === 'weekdays' ? s.days ?? [1, 2, 3, 4, 5, 6, 7] : undefined })} options={[{ value: 'daily', label: 'Ежедневно' }, { value: 'weekdays', label: 'По дням недели' }]} /></div>
        {s.frequency !== 'daily' && <div className="flex flex-wrap gap-2">{WEEKDAYS_SHORT.map((d, i) => { const on = (s.days ?? []).includes(i + 1); return <Chip key={d} on={on} onClick={() => set({ days: on ? (s.days ?? []).filter((x) => x !== i + 1) : [...(s.days ?? []), i + 1] })}>{d}</Chip>; })}</div>}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Дата начала"><input className="input" type="date" value={s.startDate ?? ''} onChange={(e: any) => set({ startDate: e.target.value || undefined })} /></Field>
          <Field label="Дата окончания"><input className="input" type="date" value={s.endDate ?? ''} onChange={(e: any) => set({ endDate: e.target.value || undefined })} /></Field>
        </div>
        <Field label="Состав (через запятую)" hint="Нужен, чтобы заметить одинаковые компоненты в разных средствах"><input className="input" value={comps} onChange={(e: any) => setComps(e.target.value)} placeholder="например: фолиевая кислота, витамин D" /></Field>
        <Field label="Источник назначения"><input className="input" value={s.source} onChange={(e: any) => set({ source: e.target.value })} placeholder="Врач, дата приёма" /></Field>
        <Field label="Комментарий"><textarea className="input" value={s.comment} onChange={(e: any) => set({ comment: e.target.value })} placeholder="Например: во время еды" /></Field>
        <SwitchRow title="Принимаю сейчас" checked={s.active} onChange={(v) => set({ active: v })} />
      </div>
    </Sheet>
  );
}
