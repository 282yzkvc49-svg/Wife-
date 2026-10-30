import { useState } from 'react';
import { LuExternalLink, LuHeart, LuPlay, LuPlus, LuTrash2, LuX } from 'react-icons/lu';
import { SAFETY_NOTE, SHORT, WARMUPS, YOGA, type Routine } from '../data/movement';
import type { ActivityLog, CustomExercise, ExerciseLog, YogaSessionRec } from '../data/types';
import { WEEKDAYS_SHORT, addDays, fmtDay, fmtShort, relativeDay, startOfWeek, type DayKey } from '../lib/date';
import { uid } from '../lib/id';
import { yogaPlanned } from '../lib/plan';
import { deleteActivity, getDay, logExercise, moveYoga, planExtraYoga, saveActivity, savePrefs, setItemDone, setYoga } from '../store/actions';
import { app } from '../store/app';
import { usePrefs, useTable, useToday } from '../store/hooks';
import { useDerivedDay } from '../app/derive';
import { Button, Card, Chip, Field, Note, NumberInput, Segmented, Sheet, confirmAction, cx, toast } from '../ui/kit';
import { RoutinePlayer } from '../ui/Player';

const TABS = [{ id: '', label: 'Йога' }, { id: 'warmups', label: 'Разминки' }, { id: 'activity', label: 'Активность' }];

export function Movement({ tab }: { tab?: string }) {
  const t = TABS.find((x) => x.id === (tab ?? '')) ? (tab ?? '') : '';
  const today = useToday();
  const [player, setPlayer] = useState<Routine | null>(null);
  const { plan, prefs } = useDerivedDay(today);

  const finish = (r: Routine, minutes: number, partial: boolean) => {
    logExercise(today, r.id, minutes, partial);
    if (r.kind === 'yoga' || r.id === 's-yoga5') setYoga(today, partial || r.kind !== 'yoga' ? 'min' : 'done', r.id, minutes);
    else if (r.kind === 'warmup' && plan.workDay) {
      const slot = [...plan.items, ...plan.optional].find((i) => i.kind === 'warmup' && i.status === 'pending');
      if (slot) setItemDone(today, slot.key, partial ? 'min' : 'full');
    }
    setPlayer(null);
    toast('Отмечено. Спасибо телу за заботу!', { tone: 'ok' });
  };

  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-bold">Движение</h1>
      <nav className="flex flex-wrap gap-2" aria-label="Разделы движения">
        {TABS.map((x) => <a key={x.id} href={`#/move${x.id ? '/' + x.id : ''}`} aria-current={t === x.id ? 'page' : undefined} className={cx('chip no-underline', t === x.id && 'is-on')}>{x.label}</a>)}
      </nav>
      {plan.modes.gentle && <Note>Сегодня бережный режим: подойдут мягкая растяжка, дыхание или отдых. Интенсивные занятия лучше перенести.</Note>}
      {t === '' && <YogaTab today={today} onPlay={setPlayer} />}
      {t === 'warmups' && <WarmupsTab today={today} onPlay={setPlayer} workDay={plan.workDay} />}
      {t === 'activity' && <ActivityTab today={today} />}
      <RoutinePlayer open={!!player} routine={player} onClose={() => setPlayer(null)} onFinish={(m, p) => player && finish(player, m, p)}
        extraNote={prefs.goal === 'pregnant' ? 'Режим беременности: перед занятиями обсудите нагрузку с врачом, избегайте горячей йоги, долгого лежания на спине и положений на животе.' : undefined} />
    </div>
  );
}

function RoutineCard({ r, onPlay, fav, onFav }: { r: Routine; onPlay: () => void; fav?: boolean; onFav?: () => void }) {
  return (
    <div className="surface px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium">{r.title}</div>
          <div className="text-sm text-ink-soft">{r.minutes} мин · {r.focus} · {r.level}{r.gentle ? ' · бережно' : ''}</div>
        </div>
        {onFav && <Button size="sm" variant="quiet" aria-pressed={!!fav} aria-label={fav ? `Убрать из избранного: ${r.title}` : `В избранное: ${r.title}`} icon={<LuHeart size={16} className={fav ? 'fill-current text-powder-ink' : ''} />} onClick={onFav} />}
        <Button size="sm" variant="mint" icon={<LuPlay size={16} />} onClick={onPlay}>Начать</Button>
      </div>
      <details className="mt-1">
        <summary className="text-sm text-lilac-ink cursor-pointer min-h-8 flex items-center">Последовательность</summary>
        <ol className="text-sm mt-1 grid gap-1 list-decimal pl-5">{r.steps.map((s, i) => <li key={i}><span className="font-medium">{s.title}</span> — {Math.round(s.sec / 6) / 10} мин{s.bothSides ? ', обе стороны' : ''}</li>)}</ol>
        {r.warnings.length > 0 && <ul className="text-xs text-ink-soft mt-2 list-disc pl-5">{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
      </details>
    </div>
  );
}

function YogaTab({ today, onPlay }: { today: DayKey; onPlay: (r: Routine) => void }) {
  const prefs = usePrefs();
  const recs = useTable<YogaSessionRec>('yoga_sessions');
  const lib = useTable<CustomExercise>('exercise_library');
  const yogaMap = new Map(recs.map((r) => [r.id, r.data]));
  const week = Array.from({ length: 14 }, (_, i) => addDays(startOfWeek(today), i));
  const [move, setMove] = useState<{ from: DayKey; sessionId: string } | null>(null);
  const [moveTo, setMoveTo] = useState(addDays(today, 1));
  const [videoOpen, setVideoOpen] = useState(false);
  const favs = new Set(lib.filter((x) => x.data.favorite && x.id.startsWith('fav:')).map((x) => x.id.slice(4)));
  const toggleFav = (id: string) => {
    const rid = `fav:${id}`;
    if (favs.has(id)) app.store.remove('exercise_library', rid);
    else app.store.put<CustomExercise>('exercise_library', rid, { title: id, kind: 'yoga', favorite: true });
  };
  const history = recs.filter((r) => r.data.status === 'done' || r.data.status === 'min').sort((a, b) => (a.data.date < b.data.date ? 1 : -1)).slice(0, 10);
  const videos = lib.filter((x) => x.data.kind === 'video');
  const allRoutines = [...YOGA, ...SHORT];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
      <div className="grid gap-4">
        <Card>
          <h2 className="text-lg font-semibold">Расписание йоги</h2>
          <p className="text-sm text-ink-soft mt-0.5">Две тренировки в неделю по 20–25 минут. Не планируется в дни менструации, при низкой энергии и в день отдыха.</p>
          <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Дни йоги">
            {WEEKDAYS_SHORT.map((d, i) => { const on = prefs.yogaDays.includes(i + 1); return <Chip key={d} on={on} onClick={() => savePrefs({ yogaDays: on ? prefs.yogaDays.filter((x) => x !== i + 1) : [...prefs.yogaDays, i + 1] })}>{d}</Chip>; })}
          </div>
          {prefs.yogaDays.length > 2 && <p className="text-xs text-ink-soft mt-2">Выбрано больше двух дней — это нормально, если вам так удобно.</p>}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Время"><input className="input" type="time" value={prefs.yogaTime} onChange={(e: any) => savePrefs({ yogaTime: e.target.value })} /></Field>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">Ближайшие две недели</h2>
          <ul className="divide-y divide-line">
            {week.map((d) => {
              const y = yogaPlanned(d, prefs, yogaMap);
              const rec = yogaMap.get(`yoga:${d}`);
              if (!y && rec?.status !== 'moved') return null;
              const r = allRoutines.find((x) => x.id === (y?.sessionId ?? rec?.sessionId));
              return (
                <li key={d} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className={cx('font-medium first-letter:uppercase', d === today && 'text-mint-ink')}>{fmtDay(d, { weekday: true })}</div>
                    <div className="text-sm text-ink-soft">
                      {rec?.status === 'moved' ? `перенесено на ${fmtShort(rec.movedTo!)}` : y?.status === 'done' ? `выполнено: ${r?.title ?? ''}` : y?.status === 'min' ? 'короткая версия' : y?.status === 'skipped' ? 'пропущено' : r?.title ?? 'йога'}
                      {y?.movedFrom ? ` · перенесено с ${fmtShort(y.movedFrom)}` : ''}
                    </div>
                  </div>
                  {y && y.status === 'planned' && d >= today && <Button size="sm" variant="ghost" onClick={() => { setMove({ from: d, sessionId: y.sessionId }); setMoveTo(addDays(d, 1)); }}>Перенести</Button>}
                  {y && y.status === 'planned' && d === today && r && <Button size="sm" variant="mint" icon={<LuPlay size={14} />} onClick={() => onPlay(r)}>Начать</Button>}
                </li>
              );
            })}
          </ul>
          {!prefs.yogaDays.length && <p className="text-sm text-ink-soft">Выберите дни йоги выше — занятия появятся здесь и на главной.</p>}
          <Button size="sm" variant="quiet" className="mt-2" icon={<LuPlus size={16} />} onClick={() => { planExtraYoga(today, YOGA[0].id); toast('Йога добавлена на сегодня'); }}>Добавить занятие на сегодня</Button>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">История</h2>
          {history.length ? <ul className="text-sm grid gap-1">{history.map((h) => <li key={h.id} className="flex justify-between gap-3"><span>{fmtDay(h.data.date)} — {allRoutines.find((r) => r.id === h.data.sessionId)?.title ?? 'йога'}</span><span className="text-ink-soft">{h.data.status === 'min' ? 'коротко' : `${h.data.minutes ?? ''} мин`}</span></li>)}</ul> : <p className="text-sm text-ink-soft">Здесь появятся выполненные занятия.</p>}
        </Card>
      </div>

      <div className="grid gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-2">Каталог для новичка</h2>
          <div className="grid gap-2">
            {[...YOGA].sort((a, b) => Number(favs.has(b.id)) - Number(favs.has(a.id))).map((r) => <RoutineCard key={r.id} r={r} onPlay={() => onPlay(r)} fav={favs.has(r.id)} onFav={() => toggleFav(r.id)} />)}
          </div>
          <h3 className="font-semibold mt-4 mb-2">Короткие и бережные практики</h3>
          <div className="grid gap-2">{SHORT.map((r) => <RoutineCard key={r.id} r={r} onPlay={() => onPlay(r)} fav={favs.has(r.id)} onFav={() => toggleFav(r.id)} />)}</div>
          <Note tone="warn" className="mt-3">{SAFETY_NOTE}</Note>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Мои видео</h2>
            <Button size="sm" variant="primary" icon={<LuPlus size={16} />} onClick={() => setVideoOpen(true)}>Видео</Button>
          </div>
          <p className="text-sm text-ink-soft mt-1">Добавляйте ссылки на занятия, которые вам подходят. Перед занятием проверьте, что ссылка открывается: сервисы бывают недоступны, а платный контент требует подписки.</p>
          <ul className="divide-y divide-line mt-2">
            {videos.map((v) => (
              <li key={v.id} className="flex items-center gap-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{v.data.title}</div>
                  <div className="text-xs text-ink-soft">{[v.data.minutes ? `${v.data.minutes} мин` : null, v.data.free === false ? 'платно (по подписке)' : v.data.free ? 'бесплатно' : null, v.data.note].filter(Boolean).join(' · ')}</div>
                </div>
                {v.data.url && <a className="btn btn-ghost btn-sm" href={v.data.url} target="_blank" rel="noopener noreferrer" aria-label={`Открыть видео: ${v.data.title}`}><LuExternalLink size={16} aria-hidden /></a>}
                <Button size="sm" variant="quiet" aria-label={`Удалить: ${v.data.title}`} icon={<LuTrash2 size={16} />} onClick={() => { if (confirmAction('Удалить ссылку?')) app.store.remove('exercise_library', v.id); }} />
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {move && (
        <Sheet open onClose={() => setMove(null)} title="Перенести йогу" footer={<Button variant="primary" onClick={() => { moveYoga(move.from, moveTo, move.sessionId); setMove(null); toast(`Перенесено на ${relativeDay(moveTo)}`); }}>Перенести</Button>}>
          <Field label="Новая дата"><input className="input" type="date" value={moveTo} min={today} onChange={(e: any) => setMoveTo(e.target.value)} /></Field>
          <p className="text-sm text-ink-soft mt-2">Общий прогресс не теряется.</p>
        </Sheet>
      )}
      {videoOpen && <VideoSheet onClose={() => setVideoOpen(false)} />}
    </div>
  );
}

function VideoSheet({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState<CustomExercise>({ title: '', kind: 'video', url: '', minutes: 20, free: true });
  const ok = v.title.trim() && /^https:\/\//.test(v.url ?? '');
  return (
    <Sheet open onClose={onClose} title="Ссылка на видео" footer={<Button variant="primary" disabled={!ok} onClick={() => { app.store.put<CustomExercise>('exercise_library', `vid-${uid()}`, { ...v, title: v.title.trim() }); onClose(); }}>Сохранить</Button>}>
      <div className="grid gap-3">
        <Field label="Название"><input className="input" value={v.title} onChange={(e: any) => setV({ ...v, title: e.target.value })} /></Field>
        <Field label="Ссылка" hint="Начинается с https://"><input className="input" value={v.url} onChange={(e: any) => setV({ ...v, url: e.target.value.trim() })} inputMode="url" autoCapitalize="off" /></Field>
        <Field label="Длительность, мин"><NumberInput value={v.minutes} onChange={(m) => setV({ ...v, minutes: m })} min={1} max={180} /></Field>
        <div className="field"><span>Доступ</span><Segmented label="Доступ" value={v.free === false ? 'paid' : 'free'} onChange={(x) => setV({ ...v, free: x === 'free' })} options={[{ value: 'free', label: 'Бесплатно' }, { value: 'paid', label: 'По подписке' }]} /></div>
        <Field label="Заметка"><input className="input" value={v.note ?? ''} onChange={(e: any) => setV({ ...v, note: e.target.value })} /></Field>
      </div>
    </Sheet>
  );
}

function WarmupsTab({ today, onPlay, workDay }: { today: DayKey; onPlay: (r: Routine) => void; workDay: boolean }) {
  const prefs = usePrefs();
  const logs = useTable<ExerciseLog>('exercise_logs');
  useTable('daily_plans');
  const todayDone = Object.keys(getDay(today).done).filter((k) => k.startsWith('warmup:')).length;
  const [newTime, setNewTime] = useState('13:00');
  const neckModule = WARMUPS.filter((w) => ['neck', 'shoulders', 'relax', 'eyes'].includes(w.group ?? ''));
  const other = WARMUPS.filter((w) => !neckModule.includes(w));
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="grid gap-4">
        <Card tint="mint">
          <h2 className="text-lg font-semibold">Перерывы в рабочие дни</h2>
          <p className="text-sm text-mint-ink mt-0.5">{workDay ? `Сегодня рабочий день · сделано перерывов: ${todayDone}` : 'Сегодня не отмечен как рабочий — напоминаний о разминках не будет.'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {prefs.warmupTimes.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-card pl-3 pr-1 min-h-9 tabular">{t}
                <button type="button" aria-label={`Убрать время ${t}`} className="grid place-items-center w-8 h-8 rounded-full" onClick={() => savePrefs({ warmupTimes: prefs.warmupTimes.filter((x) => x !== t) })}><LuX size={14} aria-hidden /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2 mt-3 items-end">
            <Field label="Добавить время"><input className="input" type="time" value={newTime} onChange={(e: any) => setNewTime(e.target.value)} /></Field>
            <Button variant="primary" onClick={() => { if (!prefs.warmupTimes.includes(newTime)) savePrefs({ warmupTimes: [...prefs.warmupTimes, newTime].sort() }); }}>Добавить</Button>
          </div>
          <p className="text-xs text-mint-ink mt-2">Рабочие дни отмечаются вручную в разделе «Рабочий график». В нерабочие дни напоминаний нет.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold">Шея и плечи</h2>
          <p className="text-sm text-ink-soft mt-0.5 mb-3">Мягкие варианты упражнений: медленно, без боли, без помощи рук и без обязательного запрокидывания головы. Начинайте с 2–3 повторений. В дни низкой энергии весь комплекс можно заменить расслаблением.</p>
          <div className="grid gap-2">{neckModule.map((r) => <RoutineCard key={r.id} r={r} onPlay={() => onPlay(r)} />)}</div>
        </Card>
      </div>
      <div className="grid gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3">Другие пятиминутки</h2>
          <div className="grid gap-2">{other.map((r) => <RoutineCard key={r.id} r={r} onPlay={() => onPlay(r)} />)}</div>
        </Card>
        <Note tone="warn">
          <p className="m-0 font-medium">Безопасность</p>
          <p className="mt-1 mb-0">Не делайте форсированное запрокидывание головы, сильное давление руками на голову, усиление поворота через сопротивление, резкие круговые движения и движения через боль. При ухудшении самочувствия, головокружении, онемении или слабости в руках прекратите упражнение и обратитесь к врачу.</p>
        </Note>
        <Card>
          <h2 className="text-lg font-semibold mb-2">Последние разминки</h2>
          {logs.length ? <ul className="text-sm grid gap-1">{[...logs].sort((a, b) => (a.data.at < b.data.at ? 1 : -1)).slice(0, 8).map((l) => <li key={l.id} className="flex justify-between"><span>{fmtShort(l.data.date)} — {[...WARMUPS, ...SHORT, ...YOGA].find((r) => r.id === l.data.routineId)?.title ?? l.data.routineId}</span><span className="text-ink-soft">{l.data.minutes} мин</span></li>)}</ul> : <p className="text-sm text-ink-soft">Пока пусто.</p>}
        </Card>
      </div>
    </div>
  );
}

function ActivityTab({ today }: { today: DayKey }) {
  const rows = useTable<ActivityLog>('activity_logs');
  const [a, setA] = useState<ActivityLog>({ date: today, type: 'walk', minutes: 20, source: 'manual' });
  const list = [...rows].sort((x, y) => (x.data.date < y.data.date ? 1 : -1));
  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <Card>
        <h2 className="text-lg font-semibold mb-3">Добавить вручную</h2>
        <div className="grid gap-3">
          <div className="field"><span>Что было</span><Segmented label="Тип" value={a.type} onChange={(v) => setA({ ...a, type: v })} options={[{ value: 'walk', label: 'Прогулка' }, { value: 'steps', label: 'Шаги' }, { value: 'workout', label: 'Тренировка' }, { value: 'other', label: 'Другое' }]} /></div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Дата"><input className="input" type="date" max={today} value={a.date} onChange={(e: any) => setA({ ...a, date: e.target.value })} /></Field>
            {a.type === 'steps'
              ? <Field label="Шагов"><NumberInput value={a.steps} onChange={(v) => setA({ ...a, steps: v })} min={0} /></Field>
              : <Field label="Минут"><NumberInput value={a.minutes} onChange={(v) => setA({ ...a, minutes: v })} min={1} max={600} /></Field>}
          </div>
          <Field label="Заметка"><input className="input" value={a.note ?? ''} onChange={(e: any) => setA({ ...a, note: e.target.value })} /></Field>
          <Button variant="primary" onClick={() => { saveActivity(null, { ...a, minutes: a.type === 'steps' ? undefined : a.minutes, steps: a.type === 'steps' ? a.steps : undefined }); toast('Сохранено', { tone: 'ok' }); setA({ ...a, note: '' }); }}>Сохранить</Button>
        </div>
        <ul className="divide-y divide-line mt-4">
          {list.slice(0, 20).map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2">
              <span className="flex-1">{fmtShort(r.data.date)} · {r.data.type === 'walk' ? 'прогулка' : r.data.type === 'steps' ? 'шаги' : r.data.type === 'workout' ? 'тренировка' : 'другое'} · {r.data.steps ? `${r.data.steps} шагов` : `${r.data.minutes ?? 0} мин`}{r.data.note ? ` · ${r.data.note}` : ''}</span>
              <Button size="sm" variant="quiet" aria-label="Удалить запись" icon={<LuTrash2 size={16} />} onClick={() => deleteActivity(r.id)} />
            </li>
          ))}
        </ul>
      </Card>
      <Card tint="beige">
        <h2 className="text-lg font-semibold">Apple Watch и «Здоровье»</h2>
        <p className="text-sm mt-1">Не подключено. Веб-приложение не может само читать данные Apple Health — Apple даёт такой доступ только отдельным приложениям для iPhone.</p>
        <ul className="text-sm mt-2 list-disc pl-5 grid gap-1">
          <li>Сейчас: шаги и тренировки можно внести вручную — всё остальное работает без интеграции.</li>
          <li>Возможный следующий этап: отдельное приложение для iPhone с разрешением на каждый тип данных (шаги, тренировки, активная энергия). Подробности — в инструкции «Ограничения».</li>
        </ul>
        <p className="mt-3 text-sm font-medium">Статус: данные вносятся вручную</p>
      </Card>
    </div>
  );
}
