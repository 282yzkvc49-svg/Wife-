import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { handleAuthRedirect, initApp } from './store/app';
import { toast } from './ui/kit';

async function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    const notify = (w: ServiceWorker | null) => { if (w) window.dispatchEvent(new CustomEvent('sw-update', { detail: w })); };
    if (reg.waiting && navigator.serviceWorker.controller) notify(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => { if (nw.state === 'installed' && navigator.serviceWorker.controller) notify(nw); });
    });
    // Перезагружаем страницу только когда пользователь сам нажал «Обновить»,
    // а не при первой установке service worker (иначе потерялся бы ввод).
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!(window as any).__swUpdateRequested || reloading) return;
      reloading = true;
      location.reload();
    });
    setInterval(() => reg.update().catch(() => {}), 30 * 60_000);
  } catch { /* офлайн-режим недоступен — приложение всё равно работает */ }
}

async function start() {
  const root = createRoot(document.getElementById('root')!);
  try {
    await initApp();
  } catch (e) {
    root.render(<div style={{ padding: 24, fontFamily: 'system-ui' }}>Не удалось открыть хранилище на устройстве: {String((e as Error).message)}</div>);
    return;
  }
  root.render(<App />);
  handleAuthRedirect()
    .then((t) => { if (t === 'signup') toast('Почта подтверждена, вы вошли в облако', { tone: 'ok' }); })
    .catch((e) => toast(String((e as Error).message), { tone: 'warn', ms: 8000 }));
  void registerSW();
}

void start();
