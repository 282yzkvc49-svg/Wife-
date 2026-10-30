import { YEAR_PLAN } from '../data/seed';
import type { DailyPlan, ExerciseLog, HabitLog, Recipe, YogaSessionRec } from '../data/types';
import { diffDays, fmtDay } from '../lib/date';
import { savePrefs } from '../store/actions';
import { usePrefs, useTable, useToday } from '../store/hooks';
import { useCycle } from '../app/derive';
import { Card, Field, Note, cx } from '../ui/kit';

export function YearPlan() {
  const today = useToday();
  const prefs = usePrefs();
  const month = Math.max(1, Math.floor(diffDays(today, prefs.startDate) / 30.44) + 1);
  const checks = prefs.yearPlanChecks;
  const hlogs = useTable<HabitLog>('habit_logs');
  const yoga = useTable<YogaSessionRec>('yoga_sessions');
  const ex = useTable<ExerciseLog>('exercise_logs');
  const plans = useTable<DailyPlan>('daily_plans');
  const recipes = useTable<Recipe>('recipes');
  const { pred } = useCycle(today);
  const summary = [
    ['Отметок привычек', hlogs.filter((l) => l.data.status === 'full' || l.data.status === 'min').length],
    ['Занятий йогой', yoga.filter((y) => y.data.status === 'done' || y.data.status === 'min').length],
    ['Разминок', ex.filter((e) => e.data.routineId.startsWith('w-')).length],
    ['Фруктов и овощей отмечено', plans.reduce((s, p) => s + p.data.produce.length, 0)],
    ['Своих рецептов', recipes.filter((r) => !r.data.seed).length],
    ['Отмеченных циклов', pred.cycles.length],
  ] as const;

  return (
    <div className="grid gap-4 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Годовой план</h1>
        <p className="text-ink-soft mt-1 measure">План использования приложения на 12 месяцев — не медицинский прогноз и не обещание беременности. Отмечайте то, что сделано, и пропускайте то, что не нужно.</p>
      </div>
      <Card tint="lilac">
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div><div className="text-sm text-lilac-ink">Сейчас</div><div className="font-display text-3xl font-bold">{month > 12 ? 'Второй год' : `Месяц ${month}`}</div></div>
          <Field label="Начало плана"><input className="input" type="date" value={prefs.startDate} max={today} onChange={(e: any) => e.target.value && savePrefs({ startDate: e.target.value })} /></Field>
        </div>
        <p className="text-sm mt-2">Начало: {fmtDay(prefs.startDate, { year: true })}</p>
      </Card>

      {month >= 4 && (
        <Card>
          <h2 className="text-lg font-semibold mb-2">{month >= 10 ? 'Годовой обзор' : 'Промежуточный обзор'}</h2>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {summary.map(([l, v]) => <div key={l} className="rounded-2xl bg-beige px-3 py-2.5"><dd className="font-display text-2xl font-bold m-0 tabular">{v}</dd><dt className="text-xs text-beige-ink">{l}</dt></div>)}
          </dl>
          <p className="text-sm text-ink-soft mt-2">Подробности — в разделе «Статистика».</p>
        </Card>
      )}

      <ol className="grid gap-3">
        {YEAR_PLAN.map((ph) => {
          const current = month >= ph.months[0] && month <= ph.months[1];
          const done = ph.items.filter((i) => checks[i.id]).length;
          return (
            <li key={ph.id}>
              <Card className={cx(current && 'border-lilac-strong')}>
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="text-lg font-semibold">{ph.months[0] === ph.months[1] ? `Месяц ${ph.months[0]}` : `Месяцы ${ph.months[0]}–${ph.months[1]}`} — {ph.title}</h2>
                  <span className="text-sm text-ink-soft tabular">{done}/{ph.items.length}</span>
                </div>
                {current && <div className="text-xs font-semibold text-lilac-ink mt-0.5">текущий этап</div>}
                <ul className="mt-2 grid gap-1">
                  {ph.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 min-h-11">
                      <input type="checkbox" className="w-5 h-5 accent-[var(--color-mint-ink)]" checked={!!checks[i.id]} onChange={(e: any) => savePrefs({ yearPlanChecks: { ...checks, [i.id]: e.target.checked } })} aria-label={i.text} id={`yp-${i.id}`} />
                      <label htmlFor={`yp-${i.id}`} className={cx('flex-1', checks[i.id] && 'done-strike text-ink-soft')}>{i.text}</label>
                      {i.link && <a href={i.link} className="text-sm underline text-lilac-ink">Открыть</a>}
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          );
        })}
      </ol>
      <Note>Если цель изменится (например, наступит беременность), план можно пересмотреть в настройках — данные не потеряются.</Note>
    </div>
  );
}
