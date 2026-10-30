import { LuChevronRight } from 'react-icons/lu';
import { usePrefs } from '../store/hooks';
import { SyncPill } from '../app/App';

export function More({ items }: { items: Array<{ path: string; label: string; icon: any }> }) {
  const prefs = usePrefs();
  return (
    <div className="grid gap-4 max-w-xl">
      <h1 className="text-3xl font-bold">Ещё</h1>
      <div><SyncPill /></div>
      <ul className="surface divide-y divide-line">
        {items.map((n) => {
          const I = n.icon;
          return (
            <li key={n.path}>
              <a href={`#/${n.path}`} className="flex items-center gap-3 px-4 min-h-14 no-underline text-ink">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-lilac text-lilac-ink"><I size={18} aria-hidden /></span>
                <span className="flex-1 font-medium">{n.label}</span>
                <LuChevronRight size={18} className="text-ink-soft" aria-hidden />
              </a>
            </li>
          );
        })}
      </ul>
      {prefs.goal === 'pregnant' && <p className="text-sm text-ink-soft">Режим беременности включён. Изменить цель можно в настройках.</p>}
    </div>
  );
}
