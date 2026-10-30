import type { MealPlanItem, PantryItem, Recipe, ShopCategory, ShoppingListItem } from '../data/types';
import { CATEGORY_ORDER, categorize } from '../data/food';

export interface ShopLine {
  key: string;
  name: string;
  /** суммы по единицам: { г: 300, мл: 200 } */
  amounts: Record<string, number>;
  /** есть позиции без точного количества */
  unknown: boolean;
  optional: boolean;
  category: ShopCategory;
  sources: string[];
  checked: boolean;
  needMore: boolean;
  pantryNote?: string;
  manual: boolean;
  recordId?: string;
}

export interface ShopResult {
  groups: Array<{ category: ShopCategory; lines: ShopLine[] }>;
  atHome: ShopLine[];
  removed: ShopLine[];
  total: number;
  checkedCount: number;
}

const SKIP = new Set(['вода']);
export const normName = (s: string) => s.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

export function genKey(listId: string, name: string) { return `gen:${listId}:${normName(name)}`; }

export function computeShopping(
  listId: string,
  items: MealPlanItem[],
  recipes: Map<string, Recipe>,
  pantry: PantryItem[],
  states: Array<{ id: string; data: ShoppingListItem }>,
): ShopResult {
  const lines = new Map<string, ShopLine>();
  for (const it of items) {
    if (!it.recipeId) continue;
    const r = recipes.get(it.recipeId);
    if (!r) continue;
    for (const ing of r.ingredients) {
      const n = normName(ing.name);
      if (!n || SKIP.has(n)) continue;
      let line = lines.get(n);
      if (!line) {
        line = { key: n, name: ing.name.trim(), amounts: {}, unknown: false, optional: true, category: ing.category ?? categorize(ing.name), sources: [], checked: false, needMore: false, manual: false };
        lines.set(n, line);
      }
      if (!ing.optional) line.optional = false;
      if (ing.amount && ing.unit && r.servings) {
        const scaled = (ing.amount * (it.servings || r.servings)) / r.servings;
        line.amounts[ing.unit] = round((line.amounts[ing.unit] ?? 0) + scaled);
      } else {
        line.unknown = true;
      }
      if (!line.sources.includes(r.title)) line.sources.push(r.title);
    }
  }

  // Домашние запасы
  const atHome: ShopLine[] = [];
  const pantryMap = new Map(pantry.map((p) => [normName(p.name), p]));
  for (const [k, line] of [...lines]) {
    const p = pantryMap.get(k);
    if (!p) continue;
    if (p.enough) { atHome.push({ ...line, pantryNote: 'есть дома' }); lines.delete(k); continue; }
    if (p.amount && p.unit && line.amounts[p.unit] !== undefined) {
      const need = round(line.amounts[p.unit] - p.amount);
      if (need <= 0 && !line.unknown && Object.keys(line.amounts).length === 1) { atHome.push({ ...line, pantryNote: `дома ${fmtAmount(p.amount, p.unit)}` }); lines.delete(k); continue; }
      line.amounts[p.unit] = Math.max(0, need);
      line.pantryNote = `с учётом запасов (дома ${fmtAmount(p.amount, p.unit)})`;
    }
  }

  // Отметки «куплено» и удалённые позиции
  const stateByKey = new Map(states.filter((s) => s.data.listId === listId).map((s) => [s.data.key, s]));
  const removed: ShopLine[] = [];
  for (const [k, line] of [...lines]) {
    const st = stateByKey.get(`gen:${listId}:${k}`);
    if (!st) continue;
    line.recordId = st.id;
    if (st.data.removed) { removed.push(line); lines.delete(k); continue; }
    if (st.data.checked) {
      const total = sumAmounts(line.amounts);
      if (st.data.checkedAmount !== undefined && total > st.data.checkedAmount + 0.5) { line.checked = false; line.needMore = true; }
      else line.checked = true;
    }
  }

  // Ручные позиции
  for (const s of states) {
    if (s.data.listId !== listId || s.data.source !== 'manual' || s.data.removed) continue;
    const name = s.data.name ?? '';
    const amounts: Record<string, number> = {};
    if (s.data.amount && s.data.unit) amounts[s.data.unit] = s.data.amount;
    lines.set('manual:' + s.id, {
      key: 'manual:' + s.id, name, amounts, unknown: !s.data.amount, optional: false, category: s.data.category ?? categorize(name),
      sources: ['добавлено вручную'], checked: s.data.checked, needMore: false, manual: true, recordId: s.id,
    });
  }

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    lines: [...lines.values()].filter((l) => l.category === category).sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name, 'ru')),
  })).filter((g) => g.lines.length);
  const all = groups.flatMap((g) => g.lines);
  return { groups, atHome, removed, total: all.length, checkedCount: all.filter((l) => l.checked).length };
}

export function sumAmounts(a: Record<string, number>): number { return Object.values(a).reduce((s, x) => s + x, 0); }
function round(n: number) { return Math.round(n * 10) / 10; }

export function fmtAmount(n: number, unit: string): string {
  if (unit === 'г' && n >= 1000) return `${round(n / 1000)} кг`;
  if (unit === 'мл' && n >= 1000) return `${round(n / 1000)} л`;
  return `${Math.round(n)} ${unit}`;
}

export function lineAmountText(l: ShopLine): string {
  const parts = Object.entries(l.amounts).filter(([, v]) => v > 0).map(([u, v]) => fmtAmount(v, u));
  if (l.unknown) parts.push(parts.length ? '+ по необходимости' : 'по необходимости');
  return parts.join(' ');
}
