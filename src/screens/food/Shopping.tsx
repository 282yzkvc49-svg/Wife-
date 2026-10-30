import { useMemo, useState } from 'react';
import { LuHouse, LuPlus, LuRotateCcw, LuTrash2, LuX } from 'react-icons/lu';
import { CATEGORY_NAMES, categorize } from '../../data/food';
import type { MealPlanItem, PantryItem, Recipe, ShoppingListItem } from '../../data/types';
import { addDays, dayKey, fmtShort } from '../../lib/date';
import { computeShopping, lineAmountText, sumAmounts } from '../../lib/shopping';
import { addManualItem, deleteManual, deletePantry, ensureList, removeGenLine, savePantry, toggleGenLine, toggleManual } from '../../store/actions';
import { usePrefs, useTable } from '../../store/hooks';
import { parseHash } from '../../app/router';
import { Button, Card, Empty, Field, Note, NumberInput, Sheet, Switch, cx } from '../../ui/kit';

export function ShoppingTab() {
  const prefs = usePrefs();
  const q = parseHash(location.hash).query;
  const [from, setFrom] = useState(q.get('from') ?? dayKey());
  const to = q.get('to') && q.get('from') === from ? q.get('to')! : addDays(from, prefs.menuHorizon - 1);
  const items = useTable<MealPlanItem>('meal_plan_items');
  const recipesRows = useTable<Recipe>('recipes');
  const pantry = useTable<PantryItem>('pantry_items');
  const states = useTable<ShoppingListItem>('shopping_list_items');
  const listId = `list:${from}:${to}`;
  const recipes = useMemo(() => new Map(recipesRows.map((r) => [r.id, r.data])), [recipesRows]);
  const res = useMemo(() => computeShopping(listId, items.filter((i) => i.data.date >= from && i.data.date <= to && i.data.eaten !== false).map((i) => i.data), recipes, pantry.map((p) => p.data), states),
    [items, recipes, pantry, states, listId, from, to]);
  const [manual, setManual] = useState('');
  const [pantryOpen, setPantryOpen] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
      <div className="grid gap-3">
        <Card>
          <div className="flex flex-wrap items-end gap-3 justify-between">
            <Field label="Меню с"><input className="input" type="date" value={from} onChange={(e: any) => setFrom(e.target.value)} /></Field>
            <div className="text-sm text-ink-soft pb-3">по {fmtShort(to)} · {prefs.menuHorizon} дней</div>
          </div>
          <p className="text-sm mt-2">Куплено {res.checkedCount} из {res.total}. Список пересчитывается автоматически, когда меняется меню или запасы.</p>
          <form className="flex gap-2 mt-3" onSubmit={(e: any) => { e.preventDefault(); if (!manual.trim()) return; ensureList(from, to); addManualItem(listId, manual.trim()); setManual(''); }}>
            <input className="input" placeholder="Добавить свою позицию" value={manual} onChange={(e: any) => setManual(e.target.value)} enterKeyHint="done" />
            <Button variant="primary" type="submit" aria-label="Добавить позицию" icon={<LuPlus size={18} />} />
          </form>
        </Card>

        {res.total === 0 && <Card><Empty title="Список пуст" action={<Button variant="mint" onClick={() => (location.hash = '#/food')}>Составить меню</Button>}>Добавьте блюда в меню на эти дни — продукты соберутся сюда сами. Для любимых рецептов без граммовки количество будет «по необходимости».</Empty></Card>}

        {res.groups.map((g) => (
          <Card key={g.category}>
            <h2 className="font-semibold mb-1">{CATEGORY_NAMES[g.category]}</h2>
            <ul className="divide-y divide-line">
              {g.lines.map((l) => (
                <li key={l.key} className="flex items-center gap-3 py-2">
                  <input type="checkbox" className="w-6 h-6 accent-[var(--color-mint-ink)] shrink-0" checked={l.checked} aria-label={`Куплено: ${l.name}`}
                    onChange={(e: any) => { ensureList(from, to); if (l.manual) toggleManual(l.recordId!, e.target.checked); else toggleGenLine(listId, l.name, e.target.checked, sumAmounts(l.amounts)); }} />
                  <div className={cx('flex-1 min-w-0', l.checked && 'done-strike text-ink-soft')}>
                    <div>{l.name}{l.optional ? <span className="text-ink-soft"> (по желанию)</span> : ''}</div>
                    <div className="text-xs text-ink-soft truncate">{lineAmountText(l)}{l.needMore ? ' · нужно ещё — меню изменилось' : ''}{l.pantryNote ? ` · ${l.pantryNote}` : ''}{!l.manual ? ` · ${l.sources.join(', ')}` : ''}</div>
                  </div>
                  <Button size="sm" variant="quiet" aria-label={`Убрать: ${l.name}`} icon={<LuX size={16} />} onClick={() => { if (l.manual) deleteManual(l.recordId!); else { ensureList(from, to); removeGenLine(listId, l.name); } }} />
                </li>
              ))}
            </ul>
          </Card>
        ))}

        {res.removed.length > 0 && (
          <Card tint="beige">
            <h2 className="font-semibold mb-1">Убрано из списка</h2>
            <ul>{res.removed.map((l) => (
              <li key={l.key} className="flex items-center justify-between py-1.5"><span>{l.name}</span><Button size="sm" variant="quiet" icon={<LuRotateCcw size={16} />} onClick={() => removeGenLine(listId, l.name, false)}>Вернуть</Button></li>
            ))}</ul>
          </Card>
        )}
      </div>

      <div className="grid gap-3">
        {res.atHome.length > 0 && (
          <Card tint="mint">
            <h2 className="font-semibold mb-1 inline-flex items-center gap-2"><LuHouse size={18} aria-hidden />Есть дома</h2>
            <ul className="text-sm">{res.atHome.map((l) => <li key={l.key} className="py-1">{l.name} <span className="text-mint-ink">— {l.pantryNote}</span></li>)}</ul>
          </Card>
        )}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Домашние запасы</h2>
            <Button size="sm" variant="mint" icon={<LuPlus size={16} />} onClick={() => setPantryOpen(true)}>Добавить</Button>
          </div>
          <p className="text-xs text-ink-soft mt-1">То, что есть дома, не попадёт в список покупок.</p>
          <ul className="divide-y divide-line mt-2">
            {pantry.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <div>{p.data.name}</div>
                  <div className="text-xs text-ink-soft">{p.data.enough ? 'достаточно' : p.data.amount ? `${p.data.amount} ${p.data.unit ?? ''}` : 'есть немного'}</div>
                </div>
                <Switch checked={p.data.enough} onChange={(v) => savePantry(p.id, { ...p.data, enough: v })} label={`Достаточно: ${p.data.name}`} />
                <Button size="sm" variant="quiet" aria-label={`Удалить: ${p.data.name}`} icon={<LuTrash2 size={16} />} onClick={() => deletePantry(p.id)} />
              </li>
            ))}
          </ul>
          {!pantry.length && <p className="text-sm text-ink-soft mt-2">Например: соль, растительное масло, специи, гречка.</p>}
        </Card>
        <Note>Количество для любимых рецептов не придумывается: если в рецепте «на глаз», в списке будет «по необходимости».</Note>
      </div>
      {pantryOpen && <PantrySheet onClose={() => setPantryOpen(false)} />}
    </div>
  );
}

function PantrySheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState<number | undefined>();
  const [unit, setUnit] = useState('г');
  const [enough, setEnough] = useState(true);
  return (
    <Sheet open onClose={onClose} title="Продукт дома" footer={<Button variant="primary" disabled={!name.trim()} onClick={() => { savePantry(null, { name: name.trim(), amount: enough ? undefined : amount, unit: enough ? undefined : unit, enough, category: categorize(name) }); onClose(); }}>Сохранить</Button>}>
      <div className="grid gap-3">
        <Field label="Продукт"><input className="input" value={name} onChange={(e: any) => setName(e.target.value)} placeholder="Например, гречка" /></Field>
        <div className="flex items-center justify-between gap-3"><span className="font-medium">Достаточно, не покупать</span><Switch checked={enough} onChange={setEnough} label="Достаточно" /></div>
        {!enough && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Сколько есть"><NumberInput value={amount} onChange={setAmount} min={0} /></Field>
            <Field label="Единица"><select className="input" value={unit} onChange={(e: any) => setUnit(e.target.value)}><option>г</option><option>мл</option><option>шт</option></select></Field>
          </div>
        )}
      </div>
    </Sheet>
  );
}
