import { useMemo, useState } from 'react';
import {
  LuBatteryLow, LuCheck, LuChevronRight, LuCircle, LuDroplet, LuEllipsis, LuFlower2, LuMinus, LuPlane, LuPlus, LuSparkles, LuUtensils, LuX, LuEyeOff,
} from 'react-icons/lu';
import { ALL_ROUTINES, routineById, type Routine } from '../data/movement';
import { HABIT_IDEAS } from '../data/seed';
import { PRODUCE_FRUIT, PRODUCE_VEG } from '../data/food';
import type { ContextKind, DailyPlan, Habit, HabitLog, MealPlanItem, Recipe } from '../data/types';
import { addDays, diffDays, fmtDay, fmtShort, greeting, nowMin, plural, relativeDay, startOfWeek, type DayKey } from '../lib/date';
import { CONTEXT_LABEL, nextMeal, type PlanItem } from '../lib/plan';
import {
  addProduce, getContext, getDay, hideItem, hideRecommendation, isRecoHidden, logExercise, moveYoga, removeProduce, saveContext, saveHabit,
  setHabitStatus, setItemDone, setSupplementStatus, setWater, setYoga, skipItem, toggleContext, unhideAll,
} from '../store/actions';
import { app } from '../store/app';
import { usePrefs, useToday } from '../store/hooks';
import { go } from '../app/router';
import { useDerivedDay, useStoreVersion } from '../app/derive';
import { Button, Card, Chip, Note, Ring, Sheet, cx, toast } from '../ui/kit';
import { RoutinePlayer } from '../ui/Player';
import { SLOT_LABEL } from '../data/recipes';

export function Home() {
  const today = useToday();
  const { prefs, cycle, plan } = useDerivedDay(today);
  const [sheet, setSheet] = useState<PlanItem | null>(null);
  const [ctxOpen, setCtxOpen] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [player, setPlayer] = useState<{ routine: Routine; item: PlanItem } | null>(null);
  const has = (k: ContextKind) => plan.contexts.includes(k);
  const now = new Date();

  const finishRoutine = (item: PlanItem, routine: Routine, minutes: number, partial: boolean) => {
    if (item.kind === 'yoga') setYoga(today, partial || routine.kind !== 'yoga' ? 'min' : 'done', routine.id, minutes);
    else setItemDone(today, item.key, partial ? 'min' : 'full');
    logExercise(today, routine.id, minutes, partial);
    setPlayer(null);
    toast(partial ? 'Отмечено как короткая версия — это тоже засчитывается' : 'Отмечено. Хорошая работа!', { tone: 'ok' });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr] lg:items-start">
      <div className="grid gap-4">
        {/* Приветствие и прогресс */}
        <Card petal tint="mint" className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-mint-ink font-medium first-letter:uppercase">{fmtDay(today, { weekday: true })}</p>
            <h1 className="text-[1.7rem] leading-tight font-bold mt-0.5">{greeting(now)}{prefs.name ? `, ${prefs.name}` : ''}</h1>
            <p className="text-sm mt-1.5">
              {plan.progress.total === 0 ? 'На сегодня ничего обязательного — можно просто отдыхать.' : plan.progress.done >= plan.progress.total ? 'Всё главное на сегодня сделано.' : `Сделано ${plan.progress.done} из ${plan.progress.total}`}
            </p>
            {prefs.modules.cycle && cycle.cycleDay && !cycle.paused && (
              <p className="text-sm text-mint-ink mt-1 inline-flex items-center gap-1.5"><LuFlower2 size={15} aria-hidden />День цикла {cycle.cycleDay}{cycle.periodDayToday ? ` · ${cycle.periodDayToday}-й день менструации` : ''}</p>
            )}
          </div>
          <Ring value={plan.progress.done} total={plan.progress.total} label={`Выполнено ${plan.progress.done} из ${plan.progress.total}`} />
        </Card>

        {/* Контексты дня */}
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={has('lowEnergy')} onClick={() => toggleContext(today, 'lowEnergy', plan.autoContexts)}
            className={cx('surface flex items-center gap-2.5 px-4 min-h-14 text-left font-semibold', has('lowEnergy') && 'tint-lilac text-lilac-ink')}>
            <LuBatteryLow size={22} aria-hidden /><span className="leading-tight">У меня мало сил</span>
          </button>
          <button type="button" aria-pressed={has('travel')} onClick={() => toggleContext(today, 'travel', plan.autoContexts)}
            className={cx('surface flex items-center gap-2.5 px-4 min-h-14 text-left font-semibold', has('travel') && 'tint-beige text-beige-ink')}>
            <LuPlane size={22} aria-hidden /><span className="leading-tight">Я в разъездах</span>
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 -mt-1">
          {plan.contexts.filter((c) => c !== 'lowEnergy' && c !== 'travel').map((c) => (
            <Chip key={c} on onClick={() => toggleContext(today, c, plan.autoContexts)} aria-label={`Снять: ${CONTEXT_LABEL[c]}`} icon={<LuX size={14} aria-hidden />}>{CONTEXT_LABEL[c]}</Chip>
          ))}
          <Chip onClick={() => setCtxOpen(true)} icon={<LuEllipsis size={16} aria-hidden />}>Какой сегодня день?</Chip>
        </div>

        {plan.notes.length > 0 && <Note>{plan.notes.map((n) => <p key={n} className="m-0 [&+p]:mt-1.5">{n}</p>)}</Note>}

        {/* План дня */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">План на сегодня</h2>
            {plan.hiddenCount > 0 && <Button size="sm" variant="quiet" onClick={() => unhideAll(today)}>Показать скрытое ({plan.hiddenCount})</Button>}
          </div>
          {plan.items.length === 0 && <p className="text-sm text-ink-soft py-3">Обязательных пунктов нет. Если хочется — загляните в «По желанию».</p>}
          <ul className="divide-y divide-line">
            {plan.items.map((it) => <PlanRow key={it.key} item={it} date={today} onOpen={() => setSheet(it)} />)}
          </ul>
          {plan.optional.length > 0 && (
            <div className="mt-2">
              <Button variant="quiet" size="sm" aria-expanded={showOptional} onClick={() => setShowOptional(!showOptional)}>
                По желанию ({plan.optional.length}) <LuChevronRight size={16} className={cx('transition-transform', showOptional && 'rotate-90')} aria-hidden />
              </Button>
              {showOptional && <ul className="divide-y divide-line">{plan.optional.map((it) => <PlanRow key={it.key} item={it} date={today} onOpen={() => setSheet(it)} />)}</ul>}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4">
        {(prefs.modules.water || prefs.modules.produce) && <WaterProduce date={today} water={prefs.modules.water} produce={prefs.modules.produce} goal={prefs.waterGoal} />}
        {prefs.modules.nutrition && <NextMeal date={today} travel={has('travel')} />}
        {prefs.modules.cycle && <CycleCard today={today} />}
        <HabitHint today={today} hidden={plan.modes.lowEnergy || !prefs.modules.newHabitHints} />
        <WeekCard today={today} />
      </div>

      <ContextSheet open={ctxOpen} onClose={() => setCtxOpen(false)} date={today} contexts={plan.contexts} auto={plan.autoContexts} />
      <ItemSheet item={sheet} date={today} onClose={() => setSheet(null)} onPlay={(routine, item) => { setSheet(null); setPlayer({ routine, item }); }} />
      <RoutinePlayer open={!!player} routine={player?.routine ?? null} onClose={() => setPlayer(null)}
        onFinish={(m, partial) => player && finishRoutine(player.item, player.routine, m, partial)} />
    </div>
  );
}

function statusIcon(it: PlanItem) {
  if (it.status === 'full') return <span className="grid place-items-center w-9 h-9 rounded-full bg-mint-ink text-card"><LuCheck size={20} aria-hidden /></span>;
  if (it.status === 'min') return <span className="grid place-items-center w-9 h-9 rounded-full bg-mint text-mint-ink border-2 border-mint-ink"><LuCheck size={18} aria-hidden /></span>;
  if (it.status === 'skipped') return <span className="grid place-items-center w-9 h-9 rounded-full bg-beige text-beige-ink"><LuMinus size={18} aria-hidden /></span>;
  return <span className="grid place-items-center w-9 h-9 rounded-full border-2 border-line text-ink-soft"><LuCircle size={0} aria-hidden /></span>;
}

const STATUS_TEXT: Record<string, string> = { full: 'выполнено', min: 'короткая версия', skipped: 'пропущено сегодня', moved: 'перенесено', pending: '' };

function PlanRow({ item, date, onOpen }: { item: PlanItem; date: DayKey; onOpen: () => void }) {
  const quick = () => {
    if (item.kind === 'habit') setHabitStatus(item.refId, date, item.status === 'pending' ? (item.suggest === 'min' ? 'min' : 'full') : null);
    else if (item.kind === 'supplement') { const t = item.key.split(':')[2]; setSupplementStatus(item.refId, date, t === 'any' ? '' : t, item.status === 'pending' ? 'taken' : null); }
    else if (item.kind === 'warmup') setItemDone(date, item.key, item.status === 'pending' ? 'full' : null);
    else { onOpen(); return; }
  };
  const label = item.kind === 'supplement' ? (item.status === 'pending' ? `Отметить «Принято»: ${item.title}` : `Снять отметку: ${item.title}`) : (item.status === 'pending' ? `Отметить выполненным: ${item.title}` : `Снять отметку: ${item.title}`);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <button type="button" onClick={quick} aria-label={label} className="shrink-0 min-w-11 min-h-11 grid place-items-center">{statusIcon(item)}</button>
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left min-h-11">
        <div className={cx('font-medium leading-snug', (item.status === 'full' || item.status === 'min') && 'text-ink-soft')}>{item.title}</div>
        <div className="text-sm text-ink-soft leading-snug">
          {[item.time && (item.shifted ? `${item.time} (сдвинуто)` : item.time), item.status !== 'pending' ? STATUS_TEXT[item.status] : item.subtitle].filter(Boolean).join(' · ')}
        </div>
        {item.note && item.status === 'pending' && <div className="text-xs text-lilac-ink mt-0.5">{item.note}</div>}
      </button>
      <LuChevronRight size={18} className="text-ink-soft shrink-0" aria-hidden />
    </li>
  );
}

function ItemSheet({ item, date, onClose, onPlay }: { item: PlanItem | null; date: DayKey; onClose: () => void; onPlay: (r: Routine, it: PlanItem) => void }) {
  const [moveTo, setMoveTo] = useState(addDays(date, 1));
  if (!item) return null;
  const close = (msg?: string) => { onClose(); if (msg) toast(msg, { tone: 'ok' }); };
  const supTime = item.kind === 'supplement' ? (item.key.split(':')[2] === 'any' ? '' : item.key.split(':')[2]) : '';
  const routine = item.routineId ? routineById(item.routineId) : undefined;
  const alts = (item.alternatives ?? []).map((id) => ALL_ROUTINES.find((r) => r.id === id)).filter(Boolean) as Routine[];
  return (
    <Sheet open={!!item} onClose={onClose} title={item.title}>
      {item.subtitle && <p className="text-ink-soft -mt-2 mb-3">{item.subtitle}</p>}
      {item.note && <Note className="mb-3">{item.note}</Note>}
      <div className="grid gap-2">
        {item.kind === 'habit' && <>
          <Button variant="mint" icon={<LuCheck size={18} />} onClick={() => { setHabitStatus(item.refId, date, 'full'); close('Выполнено'); }}>Выполнено</Button>
          {item.minText && <Button variant="lilac" onClick={() => { setHabitStatus(item.refId, date, 'min'); close('Короткая версия засчитана'); }}>Короткая версия: {item.minText}</Button>}
        </>}
        {item.kind === 'supplement' && <>
          <Button variant="mint" icon={<LuCheck size={18} />} onClick={() => { setSupplementStatus(item.refId, date, supTime, 'taken'); close('Отмечено: принято'); }}>Принято</Button>
          <Button variant="beige" onClick={() => { setSupplementStatus(item.refId, date, supTime, 'skipped'); close(); }}>Пропущено</Button>
          <Note>Если не отмечать — останется «Не отмечено». Это не считается пропуском.</Note>
        </>}
        {(item.kind === 'yoga' || item.kind === 'warmup') && routine && (
          <Button variant="primary" onClick={() => onPlay(routine, item)}>Начать: {routine.title} ({routine.minutes} мин)</Button>
        )}
        {(item.kind === 'yoga' || item.kind === 'warmup') && alts.length > 1 && (
          <details className="surface px-4 py-2">
            <summary className="cursor-pointer min-h-10 flex items-center font-medium">Выбрать другое</summary>
            <div className="grid gap-1.5 pb-2 pt-1">
              {alts.filter((a) => a.id !== routine?.id).map((a) => (
                <Button key={a.id} variant="ghost" size="sm" className="justify-start" onClick={() => onPlay(a, item)}>{a.title} · {a.minutes} мин</Button>
              ))}
            </div>
          </details>
        )}
        {item.kind === 'yoga' && <Button variant="lilac" onClick={() => { setYoga(date, 'min', 's-yoga5', 5); close('Короткая версия засчитана'); }}>Короткая версия: 5 минут</Button>}
        {item.kind === 'warmup' && item.status === 'pending' && <Button variant="mint" icon={<LuCheck size={18} />} onClick={() => { setItemDone(date, item.key, 'full'); close('Выполнено'); }}>Выполнено</Button>}
        {item.kind === 'test' && <Button variant="primary" onClick={() => { onClose(); go('cycle?test=1'); }}>Записать результат теста</Button>}

        {item.actions.includes('move') && (
          <div className="surface px-4 py-3 grid gap-2">
            <label className="field"><span>Перенести на</span>
              <input className="input" type="date" value={moveTo} min={addDays(date, 1)} onChange={(e: any) => setMoveTo(e.target.value)} />
            </label>
            <Button variant="ghost" onClick={() => {
              if (item.kind === 'habit') setHabitStatus(item.refId, date, 'moved', moveTo);
              else if (item.kind === 'yoga') moveYoga(date, moveTo, item.routineId && item.routineId.startsWith('y-') ? item.routineId : 'y-gentle-start');
              close(`Перенесено на ${relativeDay(moveTo, date)} — общий прогресс не теряется`);
            }}>Перенести</Button>
          </div>
        )}
        {item.actions.includes('skip') && item.status === 'pending' && (
          <Button variant="ghost" onClick={() => {
            if (item.kind === 'habit') setHabitStatus(item.refId, date, 'skipped');
            else if (item.kind === 'yoga') setYoga(date, 'skipped', item.routineId ?? 'y-gentle-start');
            else if (item.kind === 'supplement') setSupplementStatus(item.refId, date, supTime, 'skipped');
            else skipItem(date, item.key);
            close('Пропущено сегодня — завтра начнём с чистого листа');
          }}>Пропустить сегодня</Button>
        )}
        {item.status !== 'pending' && (
          <Button variant="quiet" onClick={() => {
            if (item.kind === 'habit') setHabitStatus(item.refId, date, null);
            else if (item.kind === 'supplement') setSupplementStatus(item.refId, date, supTime, null);
            else if (item.kind === 'yoga') setYoga(date, null, item.routineId ?? 'y-gentle-start');
            else { setItemDone(date, item.key, null); skipItem(date, item.key, false); }
            close();
          }}>Снять отметку</Button>
        )}
        {item.actions.includes('schedule') && (
          <Button variant="quiet" onClick={() => { onClose(); go(item.kind === 'supplement' ? 'meds' : `habits?edit=${item.refId}`); }}>Изменить расписание</Button>
        )}
        {item.kind === 'yoga' && <Button variant="quiet" onClick={() => { onClose(); go('move'); }}>Изменить дни йоги</Button>}
        {item.kind === 'warmup' && <Button variant="quiet" onClick={() => { onClose(); go('move/warmups'); }}>Изменить время разминок</Button>}
        {item.actions.includes('hide') && (
          <Button variant="quiet" icon={<LuEyeOff size={16} />} onClick={() => { hideItem(date, item.key); close('Скрыто на сегодня'); }}>Скрыть на сегодня</Button>
        )}
      </div>
    </Sheet>
  );
}

function ContextSheet({ open, onClose, date, contexts, auto }: { open: boolean; onClose: () => void; date: DayKey; contexts: ContextKind[]; auto: ContextKind[] }) {
  useStoreVersion();
  const ctx = getContext(date);
  const kinds: ContextKind[] = ['normal', 'busy', 'travel', 'lowEnergy', 'lateWake', 'badSleep', 'pms', 'period1', 'period2', 'rest'];
  return (
    <Sheet open={open} onClose={onClose} title="Какой сегодня день?">
      <p className="text-sm text-ink-soft -mt-2 mb-3">Можно выбрать несколько. План подстроится, а пропущенное не станет долгом.</p>
      <div className="flex flex-wrap gap-2">
        {kinds.map((k) => (
          <Chip key={k} on={k === 'normal' ? contexts.length === 0 : contexts.includes(k)} onClick={() => toggleContext(date, k, auto)}>
            {CONTEXT_LABEL[k]}{auto.includes(k) ? ' (по циклу)' : ''}
          </Chip>
        ))}
      </div>
      {(contexts.includes('lateWake') || contexts.includes('badSleep')) && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Сдвинуть утро на</div>
          <div className="flex gap-2">
            {[60, 120, 180].map((m) => <Chip key={m} on={(ctx.wakeShiftMin || 120) === m} onClick={() => saveContext(date, { wakeShiftMin: m })}>{m / 60} ч</Chip>)}
          </div>
        </div>
      )}
      {contexts.includes('travel') && (
        <div className="mt-4 surface px-4 py-2">
          <label className="flex items-center justify-between gap-3 min-h-11">
            <span className="font-medium">Не напоминать сегодня</span>
            <input type="checkbox" className="w-5 h-5" checked={ctx.muteReminders} onChange={(e: any) => saveContext(date, { muteReminders: e.target.checked })} />
          </label>
        </div>
      )}
      {(contexts.includes('travel') || contexts.includes('lowEnergy') || contexts.some((c) => c === 'period1' || c === 'period2' || c === 'pms')) && (
        <div className="mt-3 surface px-4 py-2">
          <label className="flex items-center justify-between gap-3 min-h-11">
            <span className="font-medium">Всё равно хочу полноценную тренировку</span>
            <input type="checkbox" className="w-5 h-5" checked={!!ctx.allowWorkout} onChange={(e: any) => saveContext(date, { allowWorkout: e.target.checked })} />
          </label>
        </div>
      )}
      <div className="flex justify-end mt-5"><Button variant="primary" onClick={onClose}>Готово</Button></div>
    </Sheet>
  );
}

function WaterProduce({ date, water, produce, goal }: { date: DayKey; water: boolean; produce: boolean; goal: number | null }) {
  useStoreVersion();
  const d: DailyPlan = getDay(date);
  const [pick, setPick] = useState<'fruit' | 'veg' | null>(null);
  const fruit = d.produce.filter((p) => p.kind === 'fruit').length;
  const veg = d.produce.filter((p) => p.kind === 'veg').length;
  return (
    <Card>
      {water && (
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-10 h-10 rounded-full bg-lilac text-lilac-ink"><LuDroplet size={20} aria-hidden /></span>
          <div className="flex-1">
            <div className="font-medium">Вода</div>
            <div className="text-sm text-ink-soft tabular">{d.water} {plural(d.water, 'стакан', 'стакана', 'стаканов')}{goal ? ` из ${goal}` : ''}</div>
          </div>
          <Button variant="ghost" aria-label="Убрать стакан" icon={<LuMinus size={18} />} onClick={() => setWater(date, d.water - 1)} disabled={!d.water} />
          <Button variant="lilac" aria-label="Добавить стакан" icon={<LuPlus size={18} />} onClick={() => setWater(date, d.water + 1)} />
        </div>
      )}
      {water && produce && <hr className="border-line my-3" />}
      {produce && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">Фрукты и овощи</div>
              <div className="text-sm text-ink-soft whitespace-nowrap">Фрукты {fruit} · овощи {veg}</div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="powder" icon={<LuPlus size={16} />} onClick={() => setPick(pick === 'fruit' ? null : 'fruit')} aria-expanded={pick === 'fruit'}>Фрукт</Button>
              <Button size="sm" variant="mint" icon={<LuPlus size={16} />} onClick={() => setPick(pick === 'veg' ? null : 'veg')} aria-expanded={pick === 'veg'}>Овощ</Button>
            </div>
          </div>
          {pick && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(pick === 'fruit' ? PRODUCE_FRUIT : PRODUCE_VEG).map((n) => (
                <Chip key={n} onClick={() => { addProduce(date, n, pick); setPick(null); }}>{n}</Chip>
              ))}
            </div>
          )}
          {d.produce.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {d.produce.map((p, i) => (
                <span key={i} className={cx('inline-flex items-center gap-1 rounded-full pl-3 pr-1 min-h-8 text-sm', p.kind === 'fruit' ? 'bg-powder text-powder-ink' : 'bg-mint text-mint-ink')}>
                  {p.name}
                  <button type="button" className="grid place-items-center w-7 h-7 rounded-full" aria-label={`Убрать ${p.name}`} onClick={() => removeProduce(date, i)}><LuX size={14} aria-hidden /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function NextMeal({ date, travel }: { date: DayKey; travel: boolean }) {
  useStoreVersion();
  const items = app.store.all<MealPlanItem>('meal_plan_items').filter((m) => m.data.date === date);
  const recipes = new Map(app.store.all<Recipe>('recipes').map((r) => [r.id, r.data]));
  const prefs = usePrefs();
  const nm = nextMeal(items, recipes, prefs, nowMin());
  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-full bg-beige text-beige-ink"><LuUtensils size={20} aria-hidden /></span>
        <div className="flex-1 min-w-0">
          {nm ? <>
            <div className="text-sm text-ink-soft">{SLOT_LABEL[nm.slot]} · {nm.time}</div>
            <div className="font-medium truncate">{nm.title}</div>
          </> : items.length ? <div className="font-medium">Все приёмы пищи по меню на сегодня прошли</div> : <>
            <div className="font-medium">Меню на сегодня не составлено</div>
            <div className="text-sm text-ink-soft">Можно выбрать блюда за пару минут</div>
          </>}
        </div>
        <Button size="sm" variant="ghost" onClick={() => go('food')}>{items.length ? 'Меню' : 'Составить'}</Button>
      </div>
      {travel && <Button className="mt-3 w-full" variant="beige" onClick={() => go('food/snacks?where=travel')}>Что перекусить вне дома</Button>}
    </Card>
  );
}

function CycleCard({ today }: { today: DayKey }) {
  const { cycle: p, prefs } = useDerivedDay(today);
  if (p.paused) return (
    <Card tint="powder"><div className="font-medium">Режим беременности</div><p className="text-sm mt-1">Прогнозы овуляции приостановлены. История цикла сохранена.</p></Card>
  );
  if (!p.hasData) return (
    <Card>
      <div className="font-medium">Цикл</div>
      <p className="text-sm text-ink-soft mt-1">Отметьте первый день последней менструации — появится приблизительный прогноз.</p>
      <Button size="sm" variant="powder" className="mt-3" onClick={() => go('cycle')}>Открыть цикл</Button>
    </Card>
  );
  const lines: string[] = [];
  if (p.late) lines.push('Цикл идёт дольше прогноза. Отметьте начало менструации, когда она начнётся.');
  else if (p.nextPeriodRange && p.nextPeriod) {
    const n = diffDays(p.nextPeriod, today);
    if (n > 0) lines.push(`Следующая менструация — примерно через ${n} ${plural(n, 'день', 'дня', 'дней')} (${fmtShort(p.nextPeriodRange[0])}–${fmtShort(p.nextPeriodRange[1])}).`);
    else lines.push(`Менструация ожидается в эти дни (${fmtShort(p.nextPeriodRange[0])}–${fmtShort(p.nextPeriodRange[1])}).`);
  }
  if (p.fertile && today <= p.fertile[1]) {
    if (today >= p.fertile[0]) lines.push(`Сейчас — вероятное фертильное окно (оценка до ${fmtShort(p.fertile[1])}).`);
    else lines.push(`Фертильное окно — ориентировочно ${fmtShort(p.fertile[0])}–${fmtShort(p.fertile[1])}.`);
  }
  if (prefs.modules.ovulationTests && p.testStart && today <= addDays(p.testStart, prefs.testsTotal + 2)) lines.push(`Тесты на овуляцию — ориентир с ${fmtShort(p.testStart)} (день ${p.testDayOfCycle}), по инструкции производителя.`);
  return (
    <Card tint="powder">
      <div className="flex items-center justify-between">
        <div className="font-medium inline-flex items-center gap-2"><LuFlower2 size={18} aria-hidden />Цикл{p.cycleDay ? `: день ${p.cycleDay}` : ''}</div>
        <Button size="sm" variant="quiet" onClick={() => go('cycle')}>Подробнее</Button>
      </div>
      <ul className="text-sm mt-1.5 space-y-1">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
      <p className="text-xs mt-2 text-powder-ink">Календарный прогноз — оценка, он не подтверждает овуляцию.</p>
    </Card>
  );
}

function HabitHint({ today, hidden }: { today: DayKey; hidden: boolean }) {
  useStoreVersion();
  const habits = app.store.all<Habit>('habits');
  const idea = useMemo(() => {
    if (hidden) return null;
    const active = habits.filter((h) => h.data.status === 'active' && h.data.seed !== 'warm-water' && h.data.seed !== 'honey');
    const latest = active.map((h) => h.data.startedAt).filter(Boolean).sort().pop();
    if (active.length >= 4) return null;
    if (latest && diffDays(today, latest) < 7) return null;
    const started = app.store.get<{ startDate: string }>('user_preferences', 'prefs')?.startDate;
    if (started && diffDays(today, started) < 7) return null;
    const used = new Set(habits.map((h) => h.data.seed));
    return HABIT_IDEAS.find((i) => !used.has(i.key) && !isRecoHidden(`idea:${i.key}`)) ?? null;
  }, [habits, today, hidden]);
  if (!idea) return null;
  return (
    <Card tint="lilac">
      <div className="flex items-start gap-3">
        <LuSparkles size={20} className="mt-0.5 text-lilac-ink shrink-0" aria-hidden />
        <div className="flex-1">
          <div className="text-sm text-lilac-ink">Можно попробовать, если захочется</div>
          <div className="font-semibold">{idea.habit.title}</div>
          <div className="text-sm mt-0.5">{idea.why}. Короткая версия: {idea.habit.minVersion.toLowerCase()}.</div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" variant="primary" onClick={() => { saveHabit(`h-${idea.key}`, { ...idea.habit, startedAt: today }); toast('Привычка добавлена. Её можно изменить или поставить на паузу.', { tone: 'ok' }); }}>Добавить</Button>
            <Button size="sm" variant="quiet" onClick={() => hideRecommendation(`idea:${idea.key}`)}>Скрыть рекомендацию</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function WeekCard({ today }: { today: DayKey }) {
  useStoreVersion();
  const from = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const logs = app.store.all<HabitLog>('habit_logs').map((r) => r.data).filter((l) => l.date >= from && l.date <= today);
  const plans = new Map(app.store.all<DailyPlan>('daily_plans').map((r) => [r.data.date, r.data]));
  const yoga = app.store.all<any>('yoga_sessions').filter((r) => r.data.date >= from && r.data.date <= today && (r.data.status === 'done' || r.data.status === 'min')).length;
  const warmups = days.reduce((s, d) => s + Object.keys(plans.get(d)?.done ?? {}).filter((k) => k.startsWith('warmup:')).length, 0);
  const produce = days.reduce((s, d) => s + (plans.get(d)?.produce.length ?? 0), 0);
  const habitsDone = logs.filter((l) => l.status === 'full' || l.status === 'min').length;
  const stats = [
    { label: 'Отметок привычек', value: habitsDone },
    { label: 'Йога', value: yoga },
    { label: 'Разминки', value: warmups },
    { label: 'Фрукты и овощи', value: produce },
  ];
  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Эта неделя</h2>
        <Button size="sm" variant="quiet" onClick={() => go('stats')}>Статистика</Button>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-beige px-3 py-2.5">
            <dt className="text-xs text-beige-ink">{s.label}</dt>
            <dd className="font-display text-2xl font-bold tabular m-0">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
