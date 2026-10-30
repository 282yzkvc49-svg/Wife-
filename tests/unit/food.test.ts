import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeShopping, lineAmountText } from '../../src/lib/shopping.ts';
import { recipeNutrition, analyzeDiet } from '../../src/lib/nutrition.ts';
import { FAVORITES, NEW_RECIPES } from '../../src/data/recipes.ts';
import type { Recipe } from '../../src/data/types.ts';

const recipes = new Map<string, Recipe>([...FAVORITES, ...NEW_RECIPES].map((r) => [r.id, r.recipe]));
const L = 'list:x';

test('новые рецепты: граммовка у основных ингредиентов, без духовки и нелюбимых продуктов', () => {
  for (const { recipe } of NEW_RECIPES) {
    assert.equal(recipe.kind, 'new');
    assert.ok(recipe.servings && recipe.servings > 0, recipe.title);
    for (const i of recipe.ingredients) assert.ok(i.optional || (i.amount && (i.unit === 'г' || i.unit === 'мл')), `${recipe.title}: ${i.name}`);
    const text = JSON.stringify(recipe).toLowerCase();
    assert.ok(!/духовк/.test(text), recipe.title);
    for (const bad of ['печен', 'имбир', 'сельдере', 'лимон']) assert.ok(!text.includes(bad), `${recipe.title} содержит ${bad}`);
    assert.ok(recipe.steps.length >= 2);
  }
});

test('любимые рецепты без точной граммовки', () => {
  assert.equal(FAVORITES.length, 14);
  for (const { recipe } of FAVORITES) {
    assert.equal(recipe.kind, 'favorite');
    assert.ok(recipe.ingredients.every((i) => !i.amount));
    assert.equal(recipeNutrition(recipe), null, 'калории не рассчитываются');
  }
});

test('пищевая ценность новых рецептов — приблизительная и правдоподобная', () => {
  for (const { recipe } of NEW_RECIPES) {
    const n = recipeNutrition(recipe);
    assert.ok(n, recipe.title);
    assert.ok(n!.perServing.kcal > 80 && n!.perServing.kcal < 900, `${recipe.title}: ${n!.perServing.kcal}`);
  }
  const soup = recipeNutrition(recipes.get('new-lentil-soup')!)!;
  assert.ok(soup.perServing.p >= 8 && soup.perServing.p <= 14);
});

test('список покупок: объединение, порции, «по необходимости», запасы', () => {
  const items = [
    { date: '2026-11-01', slot: 'lunch' as const, recipeId: 'new-lentil-soup', servings: 4 },
    { date: '2026-11-02', slot: 'dinner' as const, recipeId: 'new-beans-tomato', servings: 6 }, // ×2
    { date: '2026-11-03', slot: 'dinner' as const, recipeId: 'fav-plov', servings: 2 },
  ];
  const res = computeShopping(L, items, recipes, [], []);
  const lines = res.groups.flatMap((g) => g.lines);
  const onion = lines.find((l) => l.name === 'Лук репчатый')!;
  assert.equal(onion.amounts['г'], 100 + 200);
  const turkey = lines.find((l) => l.name === 'Индейка')!;
  assert.equal(lineAmountText(turkey), 'по необходимости');
  assert.ok(!lines.some((l) => l.name === 'Вода'));
  const garlic = lines.find((l) => l.name === 'Чеснок')!;
  assert.equal(lineAmountText(garlic), '18 г + по необходимости');

  const withPantry = computeShopping(L, items, recipes, [{ name: 'Соль', enough: true }, { name: 'Лук репчатый', amount: 100, unit: 'г', enough: false }], []);
  assert.ok(withPantry.atHome.some((l) => l.name === 'Соль'));
  const onion2 = withPantry.groups.flatMap((g) => g.lines).find((l) => l.name === 'Лук репчатый')!;
  assert.equal(onion2.amounts['г'], 200);
});

test('список пересчитывается при изменении меню; купленное снимается, если нужно больше', () => {
  const items = [{ date: '2026-11-01', slot: 'lunch' as const, recipeId: 'new-lentil-soup', servings: 4 }];
  const states = [{ id: 's1', data: { listId: L, key: `gen:${L}:красная чечевица`, source: 'gen' as const, checked: true, checkedAmount: 150 } }];
  const a = computeShopping(L, items, recipes, [], states);
  assert.equal(a.groups.flatMap((g) => g.lines).find((l) => l.name === 'Красная чечевица')!.checked, true);
  const b = computeShopping(L, [{ ...items[0], servings: 8 }], recipes, [], states);
  const lent = b.groups.flatMap((g) => g.lines).find((l) => l.name === 'Красная чечевица')!;
  assert.equal(lent.amounts['г'], 300);
  assert.equal(lent.checked, false);
  assert.equal(lent.needMore, true);
});

test('ручные и удалённые позиции', () => {
  const items = [{ date: '2026-11-01', slot: 'lunch' as const, recipeId: 'new-lentil-soup', servings: 4 }];
  const states = [
    { id: 'm1', data: { listId: L, key: 'm1', source: 'manual' as const, name: 'Хлебцы', checked: false } },
    { id: 's2', data: { listId: L, key: `gen:${L}:морковь`, source: 'gen' as const, checked: false, removed: true } },
  ];
  const r = computeShopping(L, items, recipes, [], states);
  const lines = r.groups.flatMap((g) => g.lines);
  assert.ok(lines.some((l) => l.name === 'Хлебцы' && l.manual));
  assert.ok(!lines.some((l) => l.name === 'Морковь'));
  assert.ok(r.removed.some((l) => l.name === 'Морковь'));
});

test('анализ рациона: мягкие подсказки и без выводов при малом объёме данных', () => {
  const few = analyzeDiet([{ date: '2026-11-01', slot: 'lunch', recipeId: 'fav-plov', servings: 2 }], recipes, [], 14);
  assert.equal(few.enoughData, false);
  assert.equal(few.tips.length, 0);
  const meals = Array.from({ length: 10 }, (_, i) => ({ date: `2026-11-${String(i + 1).padStart(2, '0')}`, slot: 'dinner' as const, recipeId: i % 2 ? 'fav-chicken-honey' : 'fav-pasta', servings: 2 }));
  const a = analyzeDiet(meals, recipes, [{ name: 'Яблоко', kind: 'fruit', at: '' }, { name: 'Яблоко', kind: 'fruit', at: '' }, { name: 'Огурец', kind: 'veg', at: '' }], 14);
  const ids = a.tips.map((t) => t.id);
  assert.ok(ids.includes('fish'));
  assert.ok(ids.includes('legumes'));
  assert.ok(a.tips.every((t) => !/дефицит|вредн/i.test(t.text)));
});
