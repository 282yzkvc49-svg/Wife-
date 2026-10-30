import { openBestBackend } from './backend';
import { Store } from './db';
import { SupaClient, type CloudConfig } from './supabase';
import { SyncEngine } from './sync';
import { uid } from '../lib/id';

const CLOUD_KEY = 'berezhno:cloud';

export interface AppCore {
  store: Store;
  sync: SyncEngine;
  client: SupaClient | null;
  deviceId: string;
  storageKind: 'indexeddb' | 'memory';
  configSource: 'build' | 'device' | 'none';
}

export let app: AppCore = null as unknown as AppCore;
const coreListeners = new Set<() => void>();
let coreVersion = 0;
export const subscribeCore = (cb: () => void) => { coreListeners.add(cb); return () => { coreListeners.delete(cb); }; };
export const getCoreVersion = () => coreVersion;
function bumpCore() { coreVersion++; for (const l of coreListeners) l(); }

export function readCloudConfig(): { cfg: CloudConfig | null; source: AppCore['configSource'] } {
  if (__SUPABASE_URL__ && __SUPABASE_ANON_KEY__) return { cfg: { url: __SUPABASE_URL__, anonKey: __SUPABASE_ANON_KEY__ }, source: 'build' };
  try {
    const raw = localStorage.getItem(CLOUD_KEY);
    if (raw) { const c = JSON.parse(raw); if (c?.url && c?.anonKey) return { cfg: c, source: 'device' }; }
  } catch { /* нет доступа к localStorage */ }
  return { cfg: null, source: 'none' };
}

export function setCloudConfig(cfg: CloudConfig | null) {
  try {
    if (cfg) localStorage.setItem(CLOUD_KEY, JSON.stringify(cfg)); else localStorage.removeItem(CLOUD_KEY);
  } catch { /* ignore */ }
  const { cfg: c, source } = readCloudConfig();
  app.client = c ? makeClient(c) : null;
  app.configSource = source;
  app.sync.refreshState();
  bumpCore();
}

function makeClient(cfg: CloudConfig) {
  const c = new SupaClient(cfg);
  c.onSession = () => { app?.sync?.refreshState(); bumpCore(); };
  return c;
}

export async function initApp(): Promise<AppCore> {
  const backend = await openBestBackend();
  const store = new Store(backend);
  await store.load();
  let deviceId = await store.getMeta<string>('deviceId');
  if (!deviceId) { deviceId = uid(); await store.setMeta('deviceId', deviceId); }
  const { cfg, source } = readCloudConfig();
  const core: AppCore = {
    store, deviceId, storageKind: backend.kind, configSource: source,
    client: null,
    sync: null as unknown as SyncEngine,
  };
  app = core;
  core.client = cfg ? makeClient(cfg) : null;
  core.sync = new SyncEngine({
    store, deviceId, client: () => app.client,
    online: () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
    onSynced: checkRemoteWipe,
  });
  core.sync.refreshState();

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => core.sync.schedule(200));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') core.sync.schedule(300);
      else void store.flush();
    });
    window.addEventListener('pagehide', () => { void store.flush(); });
    setInterval(() => { if (document.visibilityState === 'visible') void core.sync.syncNow(); }, 60_000);
    try { (navigator.storage as any)?.persist?.(); } catch { /* необязательно */ }
  }
  if (core.client?.user) core.sync.schedule(500);
  return core;
}

/** Если на другом устройстве удалили все данные, очищаем и это устройство. */
async function checkRemoteWipe() {
  const rec = app.store.rec('user_preferences', '__wiped__');
  const at = (rec?.data as any)?.wipedAt as string | undefined;
  if (!at) return;
  const seen = await app.store.getMeta<string>('wipeSeen');
  if (seen && new Date(seen) >= new Date(at)) return;
  await wipeLocal();
  await app.store.setMeta('wipeSeen', at);
  if (typeof location !== 'undefined') location.reload();
}

export async function wipeLocal() {
  const deviceId = app.deviceId;
  await app.store.wipe();
  await app.store.setMeta('deviceId', deviceId);
  bumpCore();
}

export async function cloudSignIn(email: string, password: string) {
  if (!app.client) throw new Error('Облако не настроено');
  await app.client.signIn(email.trim(), password);
  await afterLogin();
}

export async function cloudSignUp(email: string, password: string): Promise<'signed-in' | 'confirm'> {
  if (!app.client) throw new Error('Облако не настроено');
  const redirect = typeof location !== 'undefined' ? location.origin + location.pathname : undefined;
  const { session } = await app.client.signUp(email.trim(), password, redirect);
  if (!session) return 'confirm';
  await afterLogin();
  return 'signed-in';
}

export async function afterLogin() {
  await app.store.setMeta('cursor', null);
  // очистка данных, сделанная на другом устройстве до этого входа, это устройство не касается
  const seen = await app.store.getMeta<string>('wipeSeen');
  if (!seen) await app.store.setMeta('wipeSeen', new Date().toISOString());
  await app.store.setMeta('preferRemoteOnce', true);
  app.store.markAllDirty();
  app.sync.refreshState();
  bumpCore();
  await app.sync.syncNow();
}

export async function cloudSignOut(clearDevice: boolean) {
  if (!app.client) return;
  if (!clearDevice && app.store.pendingCount() > 0) await app.sync.syncNow().catch(() => {});
  await app.client.signOut();
  if (clearDevice) await wipeLocal();
  await app.store.setMeta('cursor', null);
  app.sync.refreshState();
  bumpCore();
}

/** Обработка ссылок из писем Supabase (#access_token=…&type=recovery|signup). */
export async function handleAuthRedirect(): Promise<'recovery' | 'signup' | null> {
  if (typeof location === 'undefined' || !app.client) return null;
  const h = location.hash.replace(/^#\/?/, '');
  if (!h.includes('access_token=')) {
    if (h.includes('error_description=')) {
      const p = new URLSearchParams(h);
      history.replaceState(null, '', location.pathname + '#/settings');
      throw new Error(p.get('error_description') || 'Ссылка из письма недействительна');
    }
    return null;
  }
  const params = new URLSearchParams(h);
  const type = params.get('type');
  await app.client.acceptRedirect(params);
  history.replaceState(null, '', location.pathname + (type === 'recovery' ? '#/settings?recovery=1' : '#/'));
  await afterLogin();
  return type === 'recovery' ? 'recovery' : 'signup';
}

export async function deleteCloudData() {
  if (!app.client?.user) return;
  const res = await app.client.rpc<{ wipedAt: string }>('delete_my_data', {});
  await wipeLocal();
  await app.store.setMeta('wipeSeen', res?.wipedAt ?? new Date().toISOString());
}

export async function deleteAccount() {
  if (!app.client?.user) return;
  await app.client.rpc('delete_my_account', {});
  await app.client.signOut();
  await wipeLocal();
}

export function notifyCore() { bumpCore(); }
