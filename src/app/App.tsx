import { useEffect, useState } from 'react';
import {
  LuActivity, LuBell, LuBookOpen, LuCalendarDays, LuChartColumn, LuCloud, LuCloudOff, LuFlower2, LuGrid2X2, LuHouse,
  LuListChecks, LuMap, LuPill, LuRefreshCw, LuSalad, LuSettings, LuTriangleAlert, LuBriefcase,
} from 'react-icons/lu';
import { app } from '../store/app';
import { usePrefs, useSyncStatus, useCore } from '../store/hooks';
import { Toasts, cx, Button } from '../ui/kit';
import { useRoute, go } from './router';
import { ReminderWatcher } from './ReminderWatcher';
import { Onboarding } from '../screens/Onboarding';
import { Home } from '../screens/Home';
import { Food } from '../screens/Food';
import { Habits } from '../screens/Habits';
import { Movement } from '../screens/Movement';
import { Cycle } from '../screens/Cycle';
import { Meds } from '../screens/Meds';
import { CalendarScreen } from '../screens/Calendar';
import { Library } from '../screens/Library';
import { Stats } from '../screens/Stats';
import { YearPlan } from '../screens/YearPlan';
import { Reminders } from '../screens/Reminders';
import { Settings } from '../screens/Settings';
import { More } from '../screens/More';
import { WorkCalendar } from '../screens/Work';

interface NavItem { path: string; label: string; icon: any; module?: 'cycle' | 'nutrition' | 'supplements' | 'library' }
const NAV: NavItem[] = [
  { path: '', label: 'Главная', icon: LuHouse },
  { path: 'food', label: 'Питание', icon: LuSalad, module: 'nutrition' },
  { path: 'habits', label: 'Привычки', icon: LuListChecks },
  { path: 'move', label: 'Движение', icon: LuActivity },
  { path: 'cycle', label: 'Цикл и овуляция', icon: LuFlower2, module: 'cycle' },
  { path: 'meds', label: 'Назначения', icon: LuPill, module: 'supplements' },
  { path: 'calendar', label: 'Календарь', icon: LuCalendarDays },
  { path: 'work', label: 'Рабочий график', icon: LuBriefcase },
  { path: 'library', label: 'Знания', icon: LuBookOpen, module: 'library' },
  { path: 'stats', label: 'Статистика', icon: LuChartColumn },
  { path: 'year', label: 'Годовой план', icon: LuMap },
  { path: 'reminders', label: 'Напоминания', icon: LuBell },
  { path: 'settings', label: 'Настройки', icon: LuSettings },
];
const BOTTOM = ['', 'food', 'move', 'cycle'];

export function App() {
  const prefs = usePrefs();
  const route = useRoute();
  useCore();
  const section = route.path[0] ?? '';
  const visible = NAV.filter((n) => !n.module || prefs.modules[n.module]);
  const bottom = BOTTOM.map((p) => visible.find((n) => n.path === p)).filter(Boolean) as NavItem[];
  if (bottom.length < 4) {
    const extra = visible.find((n) => !BOTTOM.includes(n.path) && n.path === 'habits');
    if (extra) bottom.push(extra);
  }

  if (!prefs.onboarded) return (<><Onboarding /><Toasts /></>);

  let screen;
  switch (section) {
    case '': screen = <Home />; break;
    case 'food': screen = <Food tab={route.path[1]} param={route.path[2]} />; break;
    case 'habits': screen = <Habits />; break;
    case 'move': screen = <Movement tab={route.path[1]} />; break;
    case 'cycle': screen = <Cycle />; break;
    case 'meds': screen = <Meds />; break;
    case 'calendar': screen = <CalendarScreen initial={route.query.get('d') ?? undefined} />; break;
    case 'work': screen = <WorkCalendar />; break;
    case 'library': screen = <Library open={route.path[1]} />; break;
    case 'stats': screen = <Stats />; break;
    case 'year': screen = <YearPlan />; break;
    case 'reminders': screen = <Reminders />; break;
    case 'settings': screen = <Settings recovery={route.query.get('recovery') === '1'} />; break;
    case 'more': screen = <More items={visible.filter((n) => !bottom.some((b) => b.path === n.path))} />; break;
    default: screen = <Home />;
  }

  return (
    <div className="app-shell lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden lg:flex flex-col gap-1 sticky top-0 h-dvh px-4 py-6 border-r border-line" aria-label="Разделы">
        <a href="#/" className="font-display text-2xl font-bold px-3 mb-4 no-underline text-ink">Бережно</a>
        {visible.map((n) => {
          const I = n.icon;
          const active = section === n.path;
          return (
            <a key={n.path} href={`#/${n.path}`} aria-current={active ? 'page' : undefined}
              className={cx('flex items-center gap-3 px-3 min-h-11 rounded-2xl no-underline font-medium', active ? 'bg-lilac text-lilac-ink' : 'text-ink hover:bg-beige')}>
              <I size={20} aria-hidden />{n.label}
            </a>
          );
        })}
        <div className="mt-auto pt-4"><SyncPill /></div>
      </aside>

      <div className="min-w-0">
        <header className="app-header lg:hidden sticky top-0 z-30 bg-milk/90 backdrop-blur border-b border-line/60">
          <div className="flex items-center justify-between gap-3 px-4 h-12">
            <a href="#/" className="font-display text-lg font-bold no-underline text-ink">Бережно</a>
            <SyncPill compact />
          </div>
        </header>
        <UpdateBanner />
        <main className="app-main pt-4 lg:pt-8 mx-auto max-w-[980px]" id="main">{screen}</main>
      </div>

      <nav className="bottom-nav lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur border-t border-line" aria-label="Основные разделы">
        <div className="grid grid-cols-5 max-w-xl mx-auto">
          {[...bottom.slice(0, 4), { path: 'more', label: 'Ещё', icon: LuGrid2X2 }].map((n) => {
            const I = n.icon;
            const active = section === n.path || (n.path === 'more' && !bottom.slice(0, 4).some((b) => b.path === section));
            return (
              <a key={n.path} href={`#/${n.path}`} aria-current={active ? 'page' : undefined}
                className={cx('flex flex-col items-center justify-center gap-0.5 min-h-14 pt-1.5 no-underline text-[11px] font-semibold', active ? 'text-lilac-ink' : 'text-ink-soft')}>
                <span className={cx('grid place-items-center w-12 h-7 rounded-full', active && 'bg-lilac')}><I size={21} aria-hidden /></span>
                {n.label === 'Цикл и овуляция' ? 'Цикл' : n.label}
              </a>
            );
          })}
        </div>
      </nav>
      <ReminderWatcher />
      <Toasts />
    </div>
  );
}

export function SyncPill({ compact }: { compact?: boolean }) {
  const s = useSyncStatus();
  useCore();
  const map = {
    local: { icon: LuCloudOff, text: 'Сохранено на устройстве', tone: 'bg-beige text-beige-ink' },
    'signed-out': { icon: LuCloudOff, text: 'Войти в облако', tone: 'bg-beige text-beige-ink' },
    idle: { icon: LuCloud, text: s.pending ? `Ожидает отправки: ${s.pending}` : 'Всё синхронизировано', tone: 'bg-mint text-mint-ink' },
    syncing: { icon: LuRefreshCw, text: 'Синхронизация…', tone: 'bg-lilac text-lilac-ink' },
    offline: { icon: LuCloudOff, text: 'Нет сети — изменения отправятся позже', tone: 'bg-amber text-amber-ink' },
    error: { icon: LuTriangleAlert, text: 'Ошибка синхронизации', tone: 'bg-powder text-powder-ink' },
  } as const;
  const m = map[s.state];
  const I = m.icon;
  const short = compact ? ({ local: 'На устройстве', 'signed-out': 'Войти', idle: s.pending ? 'Отправляю…' : 'Синхронизировано', syncing: 'Синхр…', offline: 'Офлайн', error: 'Ошибка' } as const)[s.state] : m.text;
  return (
    <button type="button" onClick={() => go('settings?focus=cloud')} title={s.error ?? m.text} aria-label={`Статус синхронизации: ${m.text}${s.error ? '. ' + s.error : ''}`}
      className={cx('inline-flex items-center gap-1.5 px-3 min-h-8 text-xs font-semibold max-w-full', compact ? 'rounded-full' : 'rounded-2xl py-1.5 text-left', m.tone)}>
      <I size={14} aria-hidden className={cx('shrink-0', s.state === 'syncing' && 'animate-spin')} /><span className={compact ? 'truncate' : ''}>{short}</span>
    </button>
  );
}

function UpdateBanner() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const on = (e: Event) => setWaiting((e as CustomEvent).detail);
    window.addEventListener('sw-update', on);
    return () => window.removeEventListener('sw-update', on);
  }, []);
  if (!waiting) return null;
  return (
    <div className="mx-4 lg:mx-8 mt-3 surface tint-lilac flex items-center gap-3 px-4 py-3" role="status">
      <span className="flex-1 text-sm font-medium">Доступна новая версия приложения</span>
      <Button size="sm" variant="primary" onClick={() => { (window as any).__swUpdateRequested = true; waiting.postMessage('SKIP_WAITING'); }}>Обновить</Button>
    </div>
  );
}

export function storageWarning(): string | null {
  return app.storageKind === 'memory' ? 'Браузер не дал доступ к хранилищу: данные сохранятся только в облаке. Если вы в режиме «Частный доступ», откройте приложение в обычном режиме.' : null;
}
