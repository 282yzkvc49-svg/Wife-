import type { FoodTag, MealPlanItem, ProduceEntry, Recipe } from '../data/types';
import { gramsOf, nutrFor, type Nutr } from '../data/food';

export interface RecipeNutrition { perServing: Nutr; approx: true; missing: string[] }

/** Примерная пищевая ценность на порцию. Только для рецептов с точной граммовкой. */
export function recipeNutrition(r: Recipe): RecipeNutrition | null {
  if (!r.servings || r.servings <= 0) return null;
  const sum: Nutr = { kcal: 0, p: 0, f: 0, c: 0, fib: 0 };
  const missing: string[] = [];
  let counted = 0;
  for (const ing of r.ingredients) {
    if (ing.optional) continue;
    if (!ing.amount || !ing.unit) { missing.push(ing.name); continue; }
    const grams = gramsOf(ing.name, ing.amount, ing.unit);
    const n = nutrFor(ing.name);
    if (grams === null || !n) { missing.push(ing.name); continue; }
    counted++;
    sum.kcal += (n.kcal * grams) / 100; sum.p += (n.p * grams) / 100; sum.f += (n.f * grams) / 100; sum.c += (n.c * grams) / 100; sum.fib += (n.fib * grams) / 100;
  }
  if (!counted || missing.length > Math.max(1, r.ingredients.length / 3)) return null;
  const k = 1 / r.servings;
  return {
    perServing: { kcal: Math.round(sum.kcal * k / 5) * 5, p: Math.round(sum.p * k), f: Math.round(sum.f * k), c: Math.round(sum.c * k), fib: Math.round(sum.fib * k * 10) / 10 },
    approx: true, missing,
  };
}

export interface DietAnalysis {
  days: number;
  meals: number;
  distinctRecipes: number;
  produceEntries: number;
  produceAvg: number;
  distinctProduce: string[];
  tagCounts: Partial<Record<FoodTag, number>>;
  proteinKinds: number;
  topRecipes: Array<{ title: string; count: number }>;
  enoughData: boolean;
  tips: Array<{ id: string; text: string; tone: 'tip' | 'good' }>;
}

const PROTEIN_TAGS: FoodTag[] = ['fish', 'seafood', 'poultry', 'redmeat', 'eggs', 'dairy', 'legumes'];

/**
 * Анализ по отмеченным данным. Не диагностирует дефициты и не оценивает любимые блюда как «вредные» —
 * только мягкие практические идеи. Пустые дни — это отсутствие отметок, а не плохое питание.
 */
export function analyzeDiet(meals: MealPlanItem[], recipes: Map<string, Recipe>, produce: ProduceEntry[], days: number): DietAnalysis {
  const eaten = meals.filter((m) => m.recipeId && recipes.has(m.recipeId) && m.eaten !== false);
  const tagCounts: Partial<Record<FoodTag, number>> = {};
  const freq = new Map<string, number>();
  for (const m of eaten) {
    const r = recipes.get(m.recipeId!)!;
    freq.set(r.title, (freq.get(r.title) ?? 0) + 1);
    for (const t of new Set(r.tags)) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const weeks = Math.max(1, days / 7);
  const distinctProduce = [...new Set(produce.map((p) => p.name))];
  const produceAvg = Math.round((produce.length / Math.max(1, days)) * 10) / 10;
  const proteinKinds = PROTEIN_TAGS.filter((t) => (tagCounts[t] ?? 0) > 0).length;
  const enoughData = eaten.length >= 5 || produce.length >= 5;
  const tips: DietAnalysis['tips'] = [];
  const perWeek = (t: FoodTag) => (tagCounts[t] ?? 0) / weeks;

  if (enoughData && eaten.length >= 5) {
    const fish = perWeek('fish') + perWeek('seafood');
    if (fish < 1) tips.push({ id: 'fish', tone: 'tip', text: 'Рыба в меню бывает реже раза в неделю. Можно добавить тилапию в сливках или минтай в аэрогриле.' });
    else tips.push({ id: 'fish-ok', tone: 'good', text: `Рыба и морепродукты — около ${Math.round(fish * 10) / 10} раза в неделю.` });
    if (perWeek('legumes') < 1) tips.push({ id: 'legumes', tone: 'tip', text: 'Бобовые — хороший источник белка и клетчатки. Попробуйте чечевичный суп или салат с нутом раз в неделю.' });
    const vegShare = (tagCounts.veg ?? 0) / eaten.length;
    if (vegShare < 0.5) tips.push({ id: 'veg-side', tone: 'tip', text: 'Овощи есть меньше чем в половине блюд. Простой шаг — овощной гарнир или салат к обеду или ужину.' });
    if (perWeek('wholegrain') < 2) tips.push({ id: 'wholegrain', tone: 'tip', text: 'Для разнообразия клетчатки подойдут гречка, булгур или овсянка как гарнир или завтрак.' });
    if (proteinKinds < 3) tips.push({ id: 'protein', tone: 'tip', text: 'Источники белка однообразны. Чередуйте птицу, рыбу, яйца, бобовые и молочное.' });
    else tips.push({ id: 'protein-ok', tone: 'good', text: `Разных источников белка: ${proteinKinds}.` });
  }
  if (produce.length >= 3) {
    if (produceAvg < 3) tips.push({ id: 'produce', tone: 'tip', text: 'Фруктов и овощей в отметках пока немного. Фрукт в первой половине дня — лёгкий способ добавить порцию.' });
    if (distinctProduce.length < 5 && days >= 7) tips.push({ id: 'produce-variety', tone: 'tip', text: 'Попробуйте новый фрукт или овощ на этой неделе — разные цвета дают разные полезные вещества.' });
    if (distinctProduce.length >= 8) tips.push({ id: 'produce-ok', tone: 'good', text: `Разных фруктов и овощей: ${distinctProduce.length}. Отличное разнообразие.` });
  }

  return {
    days, meals: eaten.length, distinctRecipes: freq.size, produceEntries: produce.length, produceAvg, distinctProduce,
    tagCounts, proteinKinds, topRecipes: [...freq.entries()].map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 5),
    enoughData, tips: tips.slice(0, 5),
  };
}
