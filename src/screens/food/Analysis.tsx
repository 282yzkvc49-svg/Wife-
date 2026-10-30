import { useMemo, useState } from 'react';
import { LuCircleCheck, LuLightbulb } from 'react-icons/lu';
import { TAG_LABEL } from '../../data/recipes';
import type { DailyPlan, FoodTag, MealPlanItem, Recipe } from '../../data/types';
import { addDays, dayKey } from '../../lib/date';
import { analyzeDiet } from '../../lib/nutrition';
import { hideRecommendation, isRecoHidden } from '../../store/actions';
import { useTable } from '../../store/hooks';
import { Button, Card, Note, Segmented } from '../../ui/kit';

const PROTEIN: FoodTag[] = ['poultry', 'fish', 'seafood', 'redmeat', 'eggs', 'dairy', 'legumes'];

export function AnalysisTab() {
  const [days, setDays] = useState<'7' | '14' | '28'>('14');
  const meals = useTable<MealPlanItem>('meal_plan_items');
  const recipesRows = useTable<Recipe>('recipes');
  const plans = useTable<DailyPlan>('daily_plans');
  useTable('user_feedback');
  const today = dayKey();
  const from = addDays(today, -(Number(days) - 1));
  const a = useMemo(() => {
    const recipes = new Map(recipesRows.map((r) => [r.id, r.data]));
    const m = meals.map((x) => x.data).filter((x) => x.date >= from && x.date <= today);
    const produce = plans.map((p) => p.data).filter((p) => p.date >= from && p.date <= today).flatMap((p) => p.produce);
    return analyzeDiet(m, recipes, produce, Number(days));
  }, [meals, recipesRows, plans, from, today, days]);
  const tips = a.tips.filter((t) => !isRecoHidden(`diet:${t.id}`));

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Период" value={days} onChange={setDays} options={[{ value: '7', label: '7 дней' }, { value: '14', label: '14 дней' }, { value: '28', label: '4 недели' }]} />
        <span className="text-sm text-ink-soft">По меню (прошедшие дни) и отметкам фруктов и овощей</span>
      </div>
      {!a.enoughData && <Note>Данных пока мало для выводов. Добавляйте блюда в меню и отмечайте фрукты и овощи на главной — через неделю здесь появятся наблюдения.</Note>}

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          ['Приёмов пищи в меню', a.meals],
          ['Разных блюд', a.distinctRecipes],
          ['Фрукты и овощи в день', a.produceAvg],
          ['Разных фруктов и овощей', a.distinctProduce.length],
        ].map(([l, v]) => (
          <div key={l as string} className="surface px-4 py-3"><dd className="font-display text-3xl font-bold m-0 tabular">{v}</dd><dt className="text-sm text-ink-soft">{l}</dt></div>
        ))}
      </dl>

      {tips.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-2">Наблюдения</h2>
          <ul className="grid gap-2">
            {tips.map((t) => (
              <li key={t.id} className="flex items-start gap-3">
                <span className={t.tone === 'good' ? 'text-mint-ink mt-0.5' : 'text-lilac-ink mt-0.5'}>{t.tone === 'good' ? <LuCircleCheck size={18} aria-label="Хорошо" /> : <LuLightbulb size={18} aria-label="Идея" />}</span>
                <span className="flex-1">{t.text}</span>
                {t.tone === 'tip' && <Button size="sm" variant="quiet" onClick={() => hideRecommendation(`diet:${t.id}`)}>Скрыть</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold mb-2">Источники белка</h2>
          <ul className="grid gap-1.5">
            {PROTEIN.map((t) => <li key={t} className="flex justify-between"><span>{TAG_LABEL[t]}</span><span className="tabular font-semibold">{a.tagCounts[t] ?? 0}</span></li>)}
          </ul>
          <hr className="border-line my-3" />
          <ul className="grid gap-1.5 text-sm">
            {(['veg', 'fruit', 'wholegrain', 'legumes', 'nuts', 'healthyfat'] as FoodTag[]).map((t) => <li key={t} className="flex justify-between"><span>Блюд с компонентом «{TAG_LABEL[t]}»</span><span className="tabular">{a.tagCounts[t] ?? 0}</span></li>)}
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-2">Что ели чаще</h2>
          {a.topRecipes.length ? <ol className="grid gap-1.5">{a.topRecipes.map((r) => <li key={r.title} className="flex justify-between gap-3"><span>{r.title}</span><span className="tabular text-ink-soft">{r.count}</span></li>)}</ol> : <p className="text-sm text-ink-soft">Пока нет данных.</p>}
          {a.distinctProduce.length > 0 && <>
            <h3 className="font-semibold mt-4 mb-1.5">Фрукты и овощи за период</h3>
            <div className="flex flex-wrap gap-1.5">{a.distinctProduce.map((n) => <span key={n} className="text-sm rounded-full bg-mint text-mint-ink px-2.5 py-1">{n}</span>)}</div>
          </>}
        </Card>
      </div>
      <Note>Анализ не ставит диагнозов и не оценивает любимые блюда как «вредные». Он показывает только то, что отмечено в приложении, и не учитывает еду, которую вы не вносили. Точные калории не рассчитываются без вашего желания и данных.</Note>
    </div>
  );
}
