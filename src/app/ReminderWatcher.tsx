import { useEffect } from 'react';
import { dayKey, nowMin, timeToMin } from '../lib/date';
import { dueReminders, firedKey } from '../lib/reminders';
import { snoozeReminder } from '../store/actions';
import { app } from '../store/app';
import { getPrefs } from '../store/hooks';
import { toast } from '../ui/kit';
import { cycleNow, planFor, reminderInfo, remindersAll } from './derive';
import { go } from './router';

const FIRED_KEY = 'berezhno:fired';

function loadFired(today: string): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(FIRED_KEY) || '{}');
    return new Set(raw[today] ?? []);
  } catch { return new Set(); }
}
function saveFired(today: string, s: Set<string>) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify({ [today]: [...s] })); } catch { /* ignore */ }
}

const LINKS: Record<string, string> = { supplement: 'meds', yoga: 'move', warmup: 'move/warmups', tests: 'cycle', menu: 'food', shopping: 'food/shopping', produce: '', water: '', meal: 'food' };

/**
 * Напоминания внутри открытого приложения. Фоновые уведомления на iPhone без сервера невозможны,
 * поэтому для фона есть выгрузка в системный календарь (раздел «Напоминания»).
 */
export function ReminderWatcher() {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState !== 'visible') return;
      const today = dayKey();
      const prefs = getPrefs();
      const cycle = cycleNow(app.store, prefs, today);
      const plan = planFor(app.store, prefs, today, cycle);
      const info = reminderInfo(app.store, prefs, today, cycle, plan);
      const fired = loadFired(today);
      // В день настройки не напоминаем о том, что было запланировано раньше момента настройки
      const onboardedMin = prefs.onboardedAt && dayKey(new Date(prefs.onboardedAt)) === today ? nowMin(new Date(prefs.onboardedAt)) : -1;
      const due = dueReminders(remindersAll(), today, nowMin(), new Date().toISOString(), fired, info, prefs)
        .filter((r) => (timeToMin(r.data.time) ?? 0) > onboardedMin);
      for (const r of due) {
        fired.add(firedKey(r.id, today));
        toast(r.data.title, {
          ms: 15000,
          actions: [
            { label: 'Открыть', run: () => go(LINKS[r.data.kind] ?? '') },
            { label: 'Через 15 мин', run: () => {
              snoozeReminder(r.id, 15);
              const f = loadFired(today); f.delete(firedKey(r.id, today)); saveFired(today, f);
            } },
          ],
        });
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker?.ready.then((reg) => reg.showNotification('Бережно', { body: r.data.title, tag: firedKey(r.id, today), icon: 'icon-192.png' })).catch(() => {});
          }
        } catch { /* уведомления недоступны */ }
      }
      if (due.length) saveFired(today, fired);
    };
    const t = setInterval(check, 30_000);
    const first = setTimeout(check, 4000);
    document.addEventListener('visibilitychange', check);
    return () => { clearInterval(t); clearTimeout(first); document.removeEventListener('visibilitychange', check); };
  }, []);
  return null;
}
