import { useMemo, useState } from 'react';
import type { ActivityLog, DailyPlan, ExerciseLog, Habit, HabitLog, MealPlanItem, OvulationTest, Recipe, SymptomEntry, WorkDay, YogaSessionRec } from '../data/types';
import { addDays, fmtShort, range } from '../lib/date';
import { activityWeekly, favoriteFrequency, habitStats, habitWeekly, produceDaily, warmupWeekly, weeksBack, yogaWeekly } from '../lib/stats';
import { useTable, useToday } from '../store/hooks';
import { useCycle } from '../app/derive';
import { BarChart } from '../ui/charts';
import { Card, Note, Segmented } from '../ui/kit';

export function Stats() {
  const today = useToday();
  const [weeks, setWeeks] = useState<'4' | '8' | '12'>('8');
  const n = Number(weeks);
  const habits = useTable<Habit>('habits');
  const hlogs = useTable<HabitLog>('habit_logs');
  const plans = useTable<DailyPlan>('daily_plans');
  const yoga = useTable<YogaSessionRec>('yoga_sessions');
  const ex = useTable<ExerciseLog>('exercise_logs');
  const act = useTable<ActivityLog>('activity_logs');
  const meals = useTable<MealPlanItem>('meal_plan_items');
  const recipes = useTable<Recipe>('recipes');
  const work = useTable<WorkDay>('work_calendar');
  const tests = useTable<OvulationTest>('ovulation_tests');
  const symptoms = useTable<SymptomEntry>('symptoms');
  const { pred } = useCycle(today);
  const from = weeksBack(today, n)[0];

  const d = useMemo(() => {
    const logs = hlogs.map((l) => l.data);
    const wmap = new Map(work.map((w) => [w.data.date, w.data]));
    const rmap = new Map(recipes.map((r) => [r.id, r.data]));
    const pl = plans.map((p) => p.data);
    const days14 = range(addDays(today, -13), 14);
    const mealsIn = meals.map((m) => m.data).filter((m) => m.date >= from && m.date <= today && m.eaten !== false);
    const produceWeeks = weeksBack(today, n).map((w) => {
      const names = new Set(pl.filter((p) => p.date >= w && p.date <= addDays(w, 6)).flatMap((p) => p.produce.map((x) => x.name)));
      return { week: w, value: names.size };
    });
    const menuWeeks = weeksBack(today, n).map((w) => ({ week: w, value: meals.filter((m) => m.data.date >= w && m.data.date <= addDays(w, 6)).length }));
    const sym = symptoms.map((s) => s.data).filter((s) => s.date >= from);
    return {
      hstats: habitStats(habits, logs, from, today, wmap),
      hweekly: habitWeekly(logs, today, n),
      produce: produceDaily(pl, days14),
      produceWeeks, menuWeeks,
      yoga: yogaWeekly(yoga.map((y) => y.data), today, n),
      warm: warmupWeekly(ex.map((e) => e.data), pl, today, n),
      activity: activityWeekly(act.map((a) => a.data), today, n),
      fav: favoriteFrequency(mealsIn, rmap).slice(0, 6),
      minUsed: logs.filter((l) => l.date >= from && l.status === 'min').length,
      sym: {
        days: sym.length,
        pelvic: sym.filter((s) => s.pelvicPain > 0).length,
        back: sym.filter((s) => s.backPain > 0).length,
        pms: sym.filter((s) => s.pms).length,
        lowEnergy: sym.filter((s) => s.energy > 0 && s.energy <= 2).length,
      },
    };
  }, [habits, hlogs, plans, yoga, ex, act, meals, recipes, work, symptoms, today, n, from]);

  const wl = (w: string) => fmtShort(w);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Статистика</h1>
          <p className="text-ink-soft mt-1 measure">Только по реальным отметкам. Дни без отметок — не провал и не «минус»: их просто нет в данных.</p>
        </div>
        <Segmented label="Период" value={weeks} onChange={setWeeks} options={[{ value: '4', label: '4 нед.' }, { value: '8', label: '8 нед.' }, { value: '12', label: '12 нед.' }]} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold mb-2">Привычки по неделям</h2>
          <BarChart ariaLabel="Выполнение привычек по неделям" data={d.hweekly.map((p) => ({ label: wl(p.week), value: p.value, secondary: p.secondary }))} primaryLabel="полная версия" secondaryLabel="минимальная версия" />
          <p className="text-sm mt-3">Минимальных версий за период: <b className="tabular">{d.minUsed}</b> — они засчитываются как выполнение.</p>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-2">По каждой привычке</h2>
          <ul className="divide-y divide-line">
            {d.hstats.filter((h) => h.scheduled).map((h) => (
              <li key={h.id} className="py-2">
                <div className="flex justify-between gap-2"><span className="font-medium">{h.title}</span><span className="text-sm tabular">{h.full + h.min} из {h.scheduled}</span></div>
                <div className="text-xs text-ink-soft">полностью {h.full} · коротко {h.min} · пропущено {h.skipped} · без отметки {h.unmarked}{h.stable ? ' · устойчивая' : ''}{h.oftenSkipped ? ' · часто пропускается — может, стоит упростить или поставить на паузу?' : ''}</div>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">Фрукты и овощи, 14 дней</h2>
          <BarChart ariaLabel="Фрукты и овощи по дням" data={d.produce.map((p) => ({ label: p.date.slice(8), value: p.veg, secondary: p.fruit }))} primaryLabel="овощи" secondaryLabel="фрукты" />
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-2">Разнообразие фруктов и овощей</h2>
          <BarChart ariaLabel="Разных фруктов и овощей по неделям" data={d.produceWeeks.map((p) => ({ label: wl(p.week), value: p.value }))} primaryLabel="разных видов за неделю" />
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-2">Меню</h2>
          <BarChart ariaLabel="Блюд в меню по неделям" data={d.menuWeeks.map((p) => ({ label: wl(p.week), value: p.value }))} primaryLabel="блюд запланировано" />
          {d.fav.length > 0 && <>
            <h3 className="font-semibold mt-4 mb-1">Частые блюда</h3>
            <ol className="grid gap-1 text-sm">{d.fav.map((f) => <li key={f.title} className="flex justify-between gap-2"><span>{f.title}{f.favorite ? ' ♥' : ''}</span><span className="tabular">{f.count}</span></li>)}</ol>
          </>}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">Йога</h2>
          <BarChart ariaLabel="Занятия йогой по неделям" data={d.yoga.map((p) => ({ label: wl(p.week), value: p.value, secondary: p.secondary }))} primaryLabel="полное занятие" secondaryLabel="короткая версия" />
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-2">Рабочие разминки</h2>
          <BarChart ariaLabel="Разминки по неделям" data={d.warm.map((p) => ({ label: wl(p.week), value: p.value }))} primaryLabel="разминок" />
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-2">Прогулки и тренировки</h2>
          <BarChart ariaLabel="Минуты активности по неделям" unit=" мин" data={d.activity.map((p) => ({ label: wl(p.week), value: p.value }))} primaryLabel="минут (внесено вручную)" />
          {d.activity.some((p) => p.secondary) && <p className="text-sm mt-2">Шагов за период: <b className="tabular">{d.activity.reduce((s, p) => s + (p.secondary ?? 0), 0).toLocaleString('ru')}</b></p>}
          <p className="text-xs text-ink-soft mt-2">Шаги из Apple Health автоматически не загружаются — только то, что внесено вручную.</p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-2">Цикл</h2>
          {pred.cycles.length === 0 ? <p className="text-sm text-ink-soft">Нет отмеченных менструаций.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-ink-soft"><th className="font-medium py-1">Начало</th><th className="font-medium">Цикл</th><th className="font-medium">Менструация</th></tr></thead>
              <tbody>{[...pred.cycles].reverse().slice(0, 12).map((c) => <tr key={c.start} className="border-t border-line"><td className="py-1.5">{fmtShort(c.start)}</td><td className="tabular">{c.length ? `${c.length} дн.` : 'идёт'}</td><td className="tabular">{c.periodLength ? `${c.periodLength} дн.` : '—'}</td></tr>)}</tbody>
            </table>
          )}
          {pred.hasData && <p className="text-xs text-ink-soft mt-2">Средняя длина для прогноза: {pred.avgLen} дн. (±{pred.uncertainty}). Это не диагностический показатель.</p>}
          {tests.length > 0 && <p className="text-sm mt-3">Тестов на овуляцию: {tests.length} · положительных: {tests.filter((t) => t.data.result === 'positive').length} · сомнительных: {tests.filter((t) => t.data.result === 'unclear').length}</p>}
          {d.sym.days > 0 && <p className="text-sm mt-2">Отметок самочувствия: {d.sym.days} · боль внизу живота: {d.sym.pelvic} · поясница: {d.sym.back} · ПМС: {d.sym.pms} · мало энергии: {d.sym.lowEnergy}</p>}
        </Card>
      </div>
      <Note>Статистика не используется для диагностики. Если что-то в самочувствии беспокоит — обсудите это с врачом.</Note>
    </div>
  );
}
