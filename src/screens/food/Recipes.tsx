import { useState } from 'react';
import { LuArrowRightLeft, LuChevronLeft, LuMinus, LuPencil, LuPlus, LuStar, LuTrash2, LuTriangleAlert } from 'react-icons/lu';
import { SLOT_LABEL, TAG_LABEL } from '../../data/recipes';
import { categorize } from '../../data/food';
import type { FoodTag, Ingredient, MealSlot, Recipe } from '../../data/types';
import { dayKey } from '../../lib/date';
import { recipeNutrition } from '../../lib/nutrition';
import { fmtAmount } from '../../lib/shopping';
import { deleteRecipe, saveRecipe, setMeal } from '../../store/actions';
import { usePrefs, useRec, useTable } from '../../store/hooks';
import { go } from '../../app/router';
import { Button, Card, Chip, Empty, Field, Note, NumberInput, Segmented, Sheet, confirmAction, cx, toast } from '../../ui/kit';
import { recipeWarnings } from './Menu';

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const EQUIPMENT = ['плита', 'кастрюля', 'сковорода', 'аэрогриль', 'грильница'];
const UNITS = ['', 'г', 'мл', 'шт', 'ст. л.', 'ч. л.'];
const TAGS: FoodTag[] = ['veg', 'fruit', 'legumes', 'wholegrain', 'grain', 'fish', 'seafood', 'poultry', 'redmeat', 'eggs', 'dairy', 'nuts', 'healthyfat', 'sweet'];

export function RecipesTab() {
  const rows = useTable<Recipe>('recipes');
  const [kind, setKind] = useState<'favorite' | 'new'>('favorite');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<{ id: string | null; r: Recipe } | null>(null);
  const list = rows.filter((r) => r.data.kind === kind && !r.data.archived && (!q || r.data.title.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(!!b.data.pinned) - Number(!!a.data.pinned) || a.data.title.localeCompare(b.data.title, 'ru'));
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <Segmented label="Тип рецептов" value={kind} onChange={setKind} options={[{ value: 'favorite', label: 'Любимые' }, { value: 'new', label: 'Новые' }]} />
        <Button variant="primary" icon={<LuPlus size={18} />} onClick={() => setEdit({ id: null, r: { kind, title: '', slots: ['lunch'], ingredients: [], steps: [], equipment: ['плита'], tags: [], servings: kind === 'new' ? 2 : undefined } })}>Рецепт</Button>
      </div>
      <p className="text-sm text-ink-soft">{kind === 'favorite' ? 'Ваши привычные блюда — без обязательной граммовки: «по вкусу», «на глаз» — нормально.' : 'Рецепты с точной граммовкой и пошаговой инструкцией. Только плита, аэрогриль и грильница — без духовки.'}</p>
      <input className="input" placeholder="Найти рецепт" value={q} onChange={(e: any) => setQ(e.target.value)} />
      {list.length === 0 && <Empty title="Ничего не найдено" />}
      <div className="grid gap-2 md:grid-cols-2">
        {list.map((r) => (
          <a key={r.id} href={`#/food/recipe/${r.id}`} className="surface px-4 py-3 no-underline text-ink block">
            <div className="flex items-start gap-2">
              <div className="font-medium flex-1">{r.data.title}</div>
              {r.data.pinned && <LuStar size={16} className="text-beige-ink fill-current mt-0.5" aria-label="Закреплено" />}
            </div>
            <div className="text-sm text-ink-soft mt-0.5">{r.data.slots.map((s) => SLOT_LABEL[s]).join(', ')}{r.data.kind === 'new' && r.data.prepMin !== undefined ? ` · ${(r.data.prepMin ?? 0) + (r.data.cookMin ?? 0)} мин` : ''}{r.data.rating ? ` · ${'★'.repeat(r.data.rating)}` : ''}</div>
          </a>
        ))}
      </div>
      {edit && <RecipeEditor id={edit.id} initial={edit.r} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function RecipeView({ id }: { id: string }) {
  const r = useRec<Recipe>('recipes', id);
  const prefs = usePrefs();
  const [servings, setServings] = useState<number | null>(null);
  const [edit, setEdit] = useState(false);
  const [toMenu, setToMenu] = useState(false);
  if (!r) return <Empty title="Рецепт не найден" action={<Button onClick={() => go('food/recipes')}>К рецептам</Button>} />;
  const base = r.servings ?? 0;
  const sv = servings ?? base;
  const k = base ? sv / base : 1;
  const nutr = r.kind === 'new' ? recipeNutrition(r) : null;
  const warn = recipeWarnings(r, prefs);
  return (
    <div className="grid gap-4 max-w-3xl">
      <div><Button variant="quiet" size="sm" icon={<LuChevronLeft size={18} />} onClick={() => history.length > 1 ? history.back() : go('food/recipes')}>Назад</Button></div>
      <div>
        <div className={cx('inline-flex rounded-full px-3 py-1 text-xs font-semibold', r.kind === 'favorite' ? 'bg-beige text-beige-ink' : 'bg-lilac text-lilac-ink')}>{r.kind === 'favorite' ? 'Любимый рецепт · количества на глаз' : 'Новый рецепт · точная граммовка'}</div>
        <h1 className="text-3xl font-bold mt-2">{r.title}</h1>
        <p className="text-ink-soft mt-1">{r.slots.map((s) => SLOT_LABEL[s]).join(', ')}{r.equipment.length ? ` · ${r.equipment.join(', ')}` : ' · без готовки'}{r.kind === 'new' ? ` · подготовка ${r.prepMin ?? 0} мин, готовка ${r.cookMin ?? 0} мин` : ''}</p>
        {r.tags.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{r.tags.map((t) => <span key={t} className="text-xs rounded-full bg-mint text-mint-ink px-2.5 py-1">{TAG_LABEL[t]}</span>)}</div>}
      </div>
      {(warn.excluded.length > 0 || warn.limited.length > 0) && (
        <Note tone="warn">
          {warn.excluded.length > 0 && <p className="m-0">Есть продукты, которые вы не любите: {warn.excluded.join(', ')}.</p>}
          {warn.limited.length > 0 && <p className="m-0">Есть продукты, которые вы ограничиваете: {warn.limited.join(', ')}.</p>}
        </Note>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="mint" onClick={() => setToMenu(true)}>Добавить в меню</Button>
        <Button variant="ghost" icon={<LuStar size={16} />} onClick={() => saveRecipe(id, { ...r, pinned: !r.pinned })}>{r.pinned ? 'Открепить' : 'Закрепить'}</Button>
        <Button variant="ghost" icon={<LuPencil size={16} />} onClick={() => setEdit(true)}>Изменить</Button>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3 mb-2">
          <h2 className="text-lg font-semibold">Ингредиенты</h2>
          {base > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" aria-label="Меньше порций" icon={<LuMinus size={16} />} onClick={() => setServings(Math.max(1, sv - 1))} />
              <span className="tabular text-sm font-semibold">{sv} {sv === 1 ? 'порция' : sv < 5 ? 'порции' : 'порций'}</span>
              <Button size="sm" variant="ghost" aria-label="Больше порций" icon={<LuPlus size={16} />} onClick={() => setServings(sv + 1)} />
            </div>
          )}
        </div>
        <ul className="divide-y divide-line">
          {r.ingredients.map((ing, i) => (
            <li key={i} className="flex justify-between gap-3 py-2">
              <span>{ing.name}{ing.optional ? <span className="text-ink-soft"> (по желанию)</span> : ''}</span>
              <span className="text-ink-soft text-right tabular">{ing.amount && ing.unit ? fmtAmount(ing.amount * k, ing.unit) : ''}{ing.note ? `${ing.amount ? ' · ' : ''}${ing.note}` : ''}</span>
            </li>
          ))}
        </ul>
      </Card>

      {r.steps.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-2">Как готовить</h2>
          <ol className="grid gap-2.5">
            {r.steps.map((s, i) => <li key={i} className="flex gap-3"><span className="grid place-items-center w-7 h-7 rounded-full bg-mint text-mint-ink text-sm font-semibold shrink-0">{i + 1}</span><span className="pt-0.5">{s}</span></li>)}
          </ol>
        </Card>
      )}

      <Card tint="beige">
        <h2 className="text-lg font-semibold mb-1">Пищевая ценность</h2>
        {nutr ? (
          <>
            <dl className="grid grid-cols-5 gap-2 text-center mt-2">
              {[['ккал', nutr.perServing.kcal], ['белки', nutr.perServing.p], ['жиры', nutr.perServing.f], ['углев.', nutr.perServing.c], ['клетч.', nutr.perServing.fib]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-card px-1 py-2"><dd className="font-display text-xl font-bold m-0 tabular">≈{v}</dd><dt className="text-[11px] text-ink-soft">{l}{l === 'ккал' ? '' : ', г'}</dt></div>
              ))}
            </dl>
            <p className="text-xs text-beige-ink mt-2">Примерная оценка на 1 порцию по справочным таблицам состава продуктов. Реальные значения зависят от конкретных продуктов и способа приготовления.</p>
          </>
        ) : (
          <p className="text-sm">{r.kind === 'favorite' ? 'Не рассчитывается: количества ингредиентов на глаз, поэтому точные калории и нутриенты определить нельзя.' : 'Недостаточно данных для оценки.'}</p>
        )}
      </Card>

      {(r.substitutions || r.pairings || r.comment) && (
        <Card>
          {r.substitutions && <p className="m-0"><span className="font-medium inline-flex items-center gap-1.5"><LuArrowRightLeft size={16} aria-hidden />Замены:</span> {r.substitutions}</p>}
          {r.pairings && <p className="mt-2 mb-0"><span className="font-medium">Сочетания:</span> {r.pairings}</p>}
          {r.comment && <p className="mt-2 mb-0"><span className="font-medium">Комментарий:</span> {r.comment}</p>}
        </Card>
      )}

      {edit && <RecipeEditor id={id} initial={r} onClose={() => setEdit(false)} />}
      {toMenu && <ToMenuSheet id={id} title={r.title} slots={r.slots} onClose={() => setToMenu(false)} />}
    </div>
  );
}

function ToMenuSheet({ id, title, slots, onClose }: { id: string; title: string; slots: MealSlot[]; onClose: () => void }) {
  const [date, setDate] = useState(dayKey());
  const [slot, setSlot] = useState<MealSlot>(slots[0] ?? 'lunch');
  const [servings, setServings] = useState<number | undefined>(2);
  return (
    <Sheet open onClose={onClose} title={`В меню: ${title}`} footer={<Button variant="primary" onClick={() => { setMeal(null, { date, slot, recipeId: id, servings: servings ?? 1 }); onClose(); toast('Добавлено в меню', { tone: 'ok' }); }}>Добавить</Button>}>
      <div className="grid gap-3">
        <Field label="Дата"><input className="input" type="date" value={date} onChange={(e: any) => setDate(e.target.value)} /></Field>
        <div className="field"><span>Приём пищи</span><Segmented label="Приём пищи" value={slot} onChange={setSlot} options={SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s] }))} /></div>
        <Field label="Порций"><NumberInput value={servings} onChange={setServings} min={1} max={20} /></Field>
      </div>
    </Sheet>
  );
}

export function RecipeEditor({ id, initial, onClose }: { id: string | null; initial: Recipe; onClose: () => void }) {
  const [r, setR] = useState<Recipe>(structuredClone(initial));
  const [stepsText, setStepsText] = useState(initial.steps.join('\n'));
  const set = (p: Partial<Recipe>) => setR({ ...r, ...p });
  const setIng = (i: number, p: Partial<Ingredient>) => set({ ingredients: r.ingredients.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const oven = /духовк/i.test(stepsText + r.equipment.join(' '));
  const missingGrams = r.kind === 'new' && r.ingredients.some((i) => !i.optional && (!i.amount || !i.unit));
  const save = () => {
    const ingredients = r.ingredients.filter((i) => i.name.trim()).map((i) => ({ ...i, name: i.name.trim(), category: categorize(i.name) }));
    const rid = saveRecipe(id, { ...r, title: r.title.trim(), ingredients, steps: stepsText.split('\n').map((s) => s.trim()).filter(Boolean) });
    onClose();
    toast('Рецепт сохранён', { tone: 'ok' });
    if (!id) go(`food/recipe/${rid}`);
  };
  return (
    <Sheet open onClose={onClose} title={id ? 'Изменить рецепт' : 'Новый рецепт'} wide
      footer={<>
        {id && <Button variant="danger" icon={<LuTrash2 size={16} />} onClick={() => { if (confirmAction(r.kind === 'favorite' ? 'Удалить любимый рецепт? Это действие нельзя отменить.' : 'Удалить рецепт?')) { deleteRecipe(id); onClose(); go('food/recipes'); } }}>Удалить</Button>}
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button variant="primary" disabled={!r.title.trim()} onClick={save}>Сохранить</Button>
      </>}>
      <div className="grid gap-3">
        <Field label="Название"><input className="input" value={r.title} onChange={(e: any) => set({ title: e.target.value })} /></Field>
        <div className="field"><span>Тип</span><Segmented label="Тип" value={r.kind} onChange={(v) => set({ kind: v, servings: v === 'new' ? r.servings ?? 2 : r.servings })} options={[{ value: 'favorite', label: 'Любимый (на глаз)' }, { value: 'new', label: 'Новый (с граммовкой)' }]} /></div>
        <div className="field"><span>Приём пищи</span>
          <div className="flex flex-wrap gap-2">{SLOTS.map((s) => <Chip key={s} on={r.slots.includes(s)} onClick={() => set({ slots: r.slots.includes(s) ? r.slots.filter((x) => x !== s) : [...r.slots, s] })}>{SLOT_LABEL[s]}</Chip>)}</div>
        </div>
        {r.kind === 'new' && (
          <div className="grid grid-cols-3 gap-2">
            <Field label="Порций"><NumberInput value={r.servings} onChange={(v) => set({ servings: v })} min={1} /></Field>
            <Field label="Подготовка, мин"><NumberInput value={r.prepMin} onChange={(v) => set({ prepMin: v })} min={0} /></Field>
            <Field label="Готовка, мин"><NumberInput value={r.cookMin} onChange={(v) => set({ cookMin: v })} min={0} /></Field>
          </div>
        )}
        <div className="field"><span>Ингредиенты</span>
          <div className="grid gap-2">
            {r.ingredients.map((ing, i) => (
              <div key={i} className="grid grid-cols-[1fr_5.5rem_5rem_auto] gap-1.5 items-center">
                <input className="input" aria-label="Ингредиент" value={ing.name} onChange={(e: any) => setIng(i, { name: e.target.value })} placeholder="Продукт" />
                <NumberInput aria-label="Количество" value={ing.amount} onChange={(v) => setIng(i, { amount: v })} placeholder={r.kind === 'new' ? 'кол-во' : '—'} />
                <select className="input px-1" aria-label="Единица" value={ing.unit ?? ''} onChange={(e: any) => setIng(i, { unit: e.target.value || undefined })}>{UNITS.map((u) => <option key={u} value={u}>{u || '—'}</option>)}</select>
                <Button variant="quiet" aria-label="Удалить ингредиент" icon={<LuTrash2 size={16} />} onClick={() => set({ ingredients: r.ingredients.filter((_, k) => k !== i) })} />
                <input className="input col-span-4 text-sm" aria-label="Примечание" value={ing.note ?? ''} onChange={(e: any) => setIng(i, { note: e.target.value || undefined })} placeholder={r.kind === 'favorite' ? 'по вкусу, немного, на глаз…' : 'примечание (необязательно)'} />
              </div>
            ))}
            <Button variant="ghost" size="sm" icon={<LuPlus size={16} />} onClick={() => set({ ingredients: [...r.ingredients, { name: '', note: r.kind === 'favorite' ? 'по вкусу' : undefined }] })}>Ингредиент</Button>
          </div>
        </div>
        {missingGrams && <Note tone="warn">Для нового рецепта укажите количество в граммах или миллилитрах у каждого основного ингредиента.</Note>}
        <Field label="Шаги приготовления" hint="Каждый шаг — с новой строки"><textarea className="input min-h-32" value={stepsText} onChange={(e: any) => setStepsText(e.target.value)} /></Field>
        <div className="field"><span>Оборудование</span>
          <div className="flex flex-wrap gap-2">{EQUIPMENT.map((e) => <Chip key={e} on={r.equipment.includes(e)} onClick={() => set({ equipment: r.equipment.includes(e) ? r.equipment.filter((x) => x !== e) : [...r.equipment, e] })}>{e}</Chip>)}</div>
        </div>
        {oven && <Note tone="warn" ><span className="inline-flex items-center gap-1.5"><LuTriangleAlert size={16} aria-hidden />Духовки нет — укажите альтернативу: аэрогриль, сковорода под крышкой или грильница.</span></Note>}
        <div className="field"><span>Состав (для анализа рациона)</span>
          <div className="flex flex-wrap gap-1.5">{TAGS.map((t) => <Chip key={t} on={r.tags.includes(t)} onClick={() => set({ tags: r.tags.includes(t) ? r.tags.filter((x) => x !== t) : [...r.tags, t] })}>{TAG_LABEL[t]}</Chip>)}</div>
        </div>
        {r.kind === 'new' && <Field label="Варианты замены"><input className="input" value={r.substitutions ?? ''} onChange={(e: any) => set({ substitutions: e.target.value })} /></Field>}
        <Field label="Привычные сочетания"><input className="input" value={r.pairings ?? ''} onChange={(e: any) => set({ pairings: e.target.value })} /></Field>
        <Field label="Комментарий"><textarea className="input" value={r.comment ?? ''} onChange={(e: any) => set({ comment: e.target.value })} /></Field>
        <div className="field"><span>Оценка</span>
          <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} из 5`} aria-pressed={(r.rating ?? 0) >= n} onClick={() => set({ rating: r.rating === n ? undefined : n })} className="w-11 h-11 grid place-items-center"><LuStar size={22} className={(r.rating ?? 0) >= n ? 'text-beige-ink fill-current' : 'text-ink-soft'} aria-hidden /></button>)}</div>
        </div>
      </div>
    </Sheet>
  );
}
