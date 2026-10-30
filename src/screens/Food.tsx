import { cx } from '../ui/kit';
import { MenuTab } from './food/Menu';
import { RecipesTab, RecipeView } from './food/Recipes';
import { ShoppingTab } from './food/Shopping';
import { SnacksTab } from './food/Snacks';
import { AnalysisTab } from './food/Analysis';

const TABS = [
  { id: '', label: 'Меню' },
  { id: 'recipes', label: 'Рецепты' },
  { id: 'shopping', label: 'Покупки' },
  { id: 'snacks', label: 'Перекусить' },
  { id: 'analysis', label: 'Анализ' },
];

export function Food({ tab, param }: { tab?: string; param?: string }) {
  const t = tab?.split('?')[0] ?? '';
  if (t === 'recipe' && param) return <RecipeView id={param} />;
  const active = TABS.find((x) => x.id === t) ? t : '';
  return (
    <div className="grid gap-4">
      <h1 className="text-3xl font-bold">Питание</h1>
      <nav className="scroll-x -mx-4 px-4" aria-label="Разделы питания">
        <div className="flex gap-2 w-max">
          {TABS.map((x) => (
            <a key={x.id} href={`#/food${x.id ? '/' + x.id : ''}`} aria-current={active === x.id ? 'page' : undefined}
              className={cx('chip no-underline', active === x.id && 'is-on')}>{x.label}</a>
          ))}
        </div>
      </nav>
      {active === '' && <MenuTab />}
      {active === 'recipes' && <RecipesTab />}
      {active === 'shopping' && <ShoppingTab />}
      {active === 'snacks' && <SnacksTab />}
      {active === 'analysis' && <AnalysisTab />}
    </div>
  );
}
