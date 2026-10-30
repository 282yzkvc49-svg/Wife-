import { useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuCopy, LuMinus, LuPlus, LuShoppingBasket, LuStar, LuTriangleAlert } from 'react-icons/lu';
import { SLOT_LABEL } from '../../data/recipes';
import type { MealPlanItem, MealSlot, Prefs, Recipe } from '../../data/types';
import { addDays, dayKey, fmtDay, fmtShort, range, type DayKey } from '../../lib/date';
import { copyMenu, deleteMeal, moveMeal, savePrefs, setMeal } from '../../store/actions';
import { usePrefs, useTable } from '../../store/hooks';
import { go } from '../../app/router';
import { Button, Card, Chip, Field, Note, Segmented, Sheet, confirmAction, cx, toast } from '../../ui/kit';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export function recipeWarnings(r: Recipe, prefs: Prefs): { excluded: string[]; limited: string[] } {
  const names = r.ingredients.map((i) => i.name.toLowerCase());
  const has = (f: string) => names.some((n) => n.includes(f.toLowerCase().slice(0, Math.max(4, f.length - 2))));
  return { excluded: prefs.excludedFoods.filter(has), limited: prefs.limitFoods.filter(has) };
}

export function MenuTab() {
  const prefs = usePrefs();
  const [start, setStart] = useState(dayKey());
  const horizon = prefs.menuHorizon;
  const days = range(start, horizon);
  const end = days[days.length - 1];
  const items = useTable<MealPlanItem>('meal_plan_items');
  const recipesRows = useTable<Recipe>('recipes');
  const recipes = useMemo(() => new Map(recipesRows.map((r) => [r.id, r.data])), [recipesRows]);
  const inRange = items.filter((i) => i.data.date >= start && i.data.date <= end);
  const [add, setAdd] = useState<{ date: DayKey; slot: MealSlot } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const repeat = () => {
    const prevStart = addDays(start, -horizon);
    const prevCount = items.filter((i) => i.data.date >= prevStart && i.data.date < start).length;
    if (!prevCount) { toast('В предыдущем периоде меню не было'); return; }
    if (inRange.length && !confirmAction('В этом периоде уже есть блюда. Добавить к ним блюда из прошлого периода?')) return;
    const n = copyMenu(prevStart, start, horizon);
    toast(`Добавлено блюд: ${n}`, { tone: 'ok' });
  };

  return (
    <div className="grid gap-4">
      <Card>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-1">
            <Button variant="quiet" aria-label="Предыдущий период" icon={<LuChevronLeft size={20} />} onClick={() => setStart(addDays(start, -horizon))} />
            <div className="font-semibold tabular px-1">{fmtShort(start)} — {fmtShort(end)}</div>
            <Button variant="quiet" aria-label="Следующий период" icon={<LuChevronRight size={20} />} onClick={() => setStart(addDays(start, horizon))} />
            {start !== dayKey() && <Button size="sm" variant="quiet" onClick={() => setStart(dayKey())}>Сегодня</Button>}
          </div>
          <Segmented label="Горизонт меню" value={String(horizon) as '7' | '14'} onChange={(v) => savePrefs({ menuHorizon: Number(v) as 7 | 14 })} options={[{ value: '7', label: '7 дней' }, { value: '14', label: '14 дней' }]} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button size="sm" variant="beige" icon={<LuCopy size={16} />} onClick={repeat}>Повторить прошлое меню</Button>
          <Button size="sm" variant="mint" icon={<LuShoppingBasket size={16} />} onClick={() => go(`food/shopping?from=${start}&to=${end}`)}>Список покупок</Button>
        </div>
        <p className="text-xs text-ink-soft mt-2">Меню можно планировать на 7–10 дней вперёд. Строгих диет и обязательной калорийности здесь нет.</p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {days.map((d) => (
          <Card key={d} className={cx(d === dayKey() && 'border-mint-strong')}>
            <div className="font-semibold mb-2 first-letter:uppercase">{fmtDay(d, { weekday: true })}{d === dayKey() && <span className="ml-2 text-xs text-mint-ink">сегодня</span>}</div>
            <div className="grid gap-1.5">
              {SLOTS.map((slot) => {
                const list = inRange.filter((i) => i.data.date === d && i.data.slot === slot);
                return (
                  <div key={slot} className="flex items-start gap-2">
                    <div className="w-[4.6rem] shrink-0 text-sm text-ink-soft pt-2">{SLOT_LABEL[slot]}</div>
                    <div className="flex-1 flex flex-wrap gap-1.5 min-h-10 items-center">
                      {list.map((it) => {
                        const r = it.data.recipeId ? recipes.get(it.data.recipeId) : undefined;
                        return (
                          <button key={it.id} type="button" onClick={() => setOpen(it.id)}
                            className={cx('rounded-xl px-2.5 py-1.5 text-sm text-left', r?.kind === 'new' ? 'bg-lilac text-lilac-ink' : 'bg-beige text-beige-ink', it.data.eaten === false && 'opacity-60 line-through')}>
                            {r?.title ?? it.data.text ?? '—'}<span className="opacity-70"> · {it.data.servings} п.</span>{it.data.leftovers ? ' · остатки' : ''}
                          </button>
                        );
                      })}
                      <Button size="sm" variant="quiet" aria-label={`Добавить: ${SLOT_LABEL[slot]}, ${fmtDay(d)}`} icon={<LuPlus size={16} />} onClick={() => setAdd({ date: d, slot })} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {add && <AddMeal {...add} recipes={recipesRows} prefs={prefs} onClose={() => setAdd(null)} />}
      {open && <MealSheet id={open} item={items.find((i) => i.id === open)?.data} recipe={(() => { const it = items.find((i) => i.id === open); return it?.data.recipeId ? recipes.get(it.data.recipeId) : undefined; })()} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AddMeal({ date, slot, recipes, prefs, onClose }: { date: DayKey; slot: MealSlot; recipes: Array<{ id: string; data: Recipe }>; prefs: Prefs; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [servings, setServings] = useState(slot === 'breakfast' || slot === 'snack' ? 1 : 2);
  const [text, setText] = useState('');
  const list = recipes.filter((r) => !r.data.archived && (!q || r.data.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned) || Number(b.data.slots.includes(slot)) - Number(a.data.slots.includes(slot)) || Number(a.data.kind === 'new') - Number(b.data.kind === 'new') || a.data.title.localeCompare(b.data.title, 'ru'));
  const addRecipe = (id: string) => { setMeal(null, { date, slot, recipeId: id, servings }); onClose(); toast('Добавлено в меню', { tone: 'ok' }); };
  return (
    <Sheet open onClose={onClose} title={`${SLOT_LABEL[slot]}, ${fmtDay(date)}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm font-medium">Порций</span>
        <Button size="sm" variant="ghost" aria-label="Меньше порций" icon={<LuMinus size={16} />} onClick={() => setServings(Math.max(1, servings - 1))} />
        <span className="font-semibold tabular w-6 text-center">{servings}</span>
        <Button size="sm" variant="ghost" aria-label="Больше порций" icon={<LuPlus size={16} />} onClick={() => setServings(servings + 1)} />
      </div>
      <input className="input mb-3" placeholder="Найти блюдо" value={q} onChange={(e: any) => setQ(e.target.value)} />
      <ul className="grid gap-1.5 max-h-[45dvh] overflow-y-auto">
        {list.map((r) => {
          const w = recipeWarnings(r.data, prefs);
          return (
            <li key={r.id}>
              <button type="button" onClick={() => addRecipe(r.id)} className="w-full text-left surface px-3.5 py-2.5 flex items-center gap-2">
                {r.data.pinned && <LuStar size={14} className="text-beige-ink" aria-label="Закреплено" />}
                <span className="flex-1">{r.data.title}</span>
                <span className="text-xs text-ink-soft">{r.data.kind === 'favorite' ? 'любимое' : 'новое'}</span>
                {(w.excluded.length > 0 || w.limited.length > 0) && <LuTriangleAlert size={14} className="text-amber-ink" aria-label={`Есть: ${[...w.excluded, ...w.limited].join(', ')}`} />}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 grid gap-2">
        <Field label="Или просто текстом"><input className="input" value={text} onChange={(e: any) => setText(e.target.value)} placeholder="Например, ужин в гостях" /></Field>
        <Button variant="ghost" disabled={!text.trim()} onClick={() => { setMeal(null, { date, slot, text: text.trim(), servings }); onClose(); }}>Добавить текстом</Button>
      </div>
    </Sheet>
  );
}

function MealSheet({ id, item, recipe, onClose }: { id: string; item?: MealPlanItem; recipe?: Recipe; onClose: () => void }) {
  const [moveDate, setMoveDate] = useState(item?.date ?? dayKey());
  const [moveSlot, setMoveSlot] = useState<MealSlot>(item?.slot ?? 'lunch');
  if (!item) return null;
  const upd = (p: Partial<MealPlanItem>) => setMeal(id, { ...item, ...p });
  return (
    <Sheet open onClose={onClose} title={recipe?.title ?? item.text ?? 'Блюдо'}>
      <div className="grid gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium flex-1">Порций</span>
          <Button size="sm" variant="ghost" aria-label="Меньше" icon={<LuMinus size={16} />} onClick={() => upd({ servings: Math.max(1, item.servings - 1) })} />
          <span className="font-semibold tabular w-6 text-center">{item.servings}</span>
          <Button size="sm" variant="ghost" aria-label="Больше" icon={<LuPlus size={16} />} onClick={() => upd({ servings: item.servings + 1 })} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip on={item.eaten === false} onClick={() => upd({ eaten: item.eaten === false ? undefined : false })}>Не получилось приготовить</Chip>
          <Chip on={!!item.leftovers} onClick={() => upd({ leftovers: !item.leftovers })}>Остались остатки</Chip>
        </div>
        <div className="field"><span>Оценка блюда</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" aria-label={`${n} из 5`} aria-pressed={(item.rating ?? 0) >= n} onClick={() => upd({ rating: item.rating === n ? undefined : n })} className="w-11 h-11 grid place-items-center">
                <LuStar size={22} className={(item.rating ?? 0) >= n ? 'text-beige-ink fill-current' : 'text-ink-soft'} aria-hidden />
              </button>
            ))}
          </div>
        </div>
        <div className="surface p-3 grid gap-2">
          <div className="text-sm font-medium">Перенести</div>
          <div className="grid grid-cols-2 gap-2">
            <input className="input" type="date" value={moveDate} onChange={(e: any) => setMoveDate(e.target.value)} aria-label="Дата" />
            <select className="input" value={moveSlot} onChange={(e: any) => setMoveSlot(e.target.value)} aria-label="Приём пищи">
              {SLOTS.map((s) => <option key={s} value={s}>{SLOT_LABEL[s]}</option>)}
            </select>
          </div>
          <Button variant="ghost" onClick={() => { moveMeal(id, moveDate, moveSlot); onClose(); toast('Перенесено'); }}>Перенести</Button>
        </div>
        {recipe && <Button variant="lilac" onClick={() => { onClose(); go(`food/recipe/${item.recipeId}`); }}>Открыть рецепт</Button>}
        {item.eaten === false && <Note>Отмеченные «не получилось» блюда не учитываются в анализе рациона.</Note>}
        <Button variant="danger" onClick={() => { deleteMeal(id); onClose(); }}>Убрать из меню</Button>
      </div>
    </Sheet>
  );
}
