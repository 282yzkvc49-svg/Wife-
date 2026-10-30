import { TABLES, type StoredRecord, type TableName } from '../data/types';
import { normIso } from '../lib/id';
import type { Store } from './db';
import { CloudError, type SupaClient } from './supabase';

export interface ServerRow {
  t: TableName;
  id: string;
  data: unknown;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  server_updated_at: string;
}

export type SyncState = 'local' | 'signed-out' | 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncStatus { state: SyncState; pending: number; lastSync: string | null; error: string | null }

const known = new Set<string>(TABLES);

function toLocal(row: ServerRow): StoredRecord {
  return {
    t: row.t, id: row.id, data: row.data,
    created_at: normIso(row.created_at) ?? normIso(row.updated_at)!,
    updated_at: normIso(row.updated_at)!,
    deleted_at: normIso(row.deleted_at),
    dirty: 0,
    server_updated_at: row.server_updated_at,
  };
}

export type MergeDecision =
  | { action: 'apply'; record: StoredRecord }
  | { action: 'keep-local'; serverUpdatedAt: string }
  | { action: 'conflict-apply'; record: StoredRecord; lost: StoredRecord };

/** Слияние записи из облака с локальной. Побеждает более позднее изменение; проигравшая версия сохраняется. */
export function mergeRemote(local: StoredRecord | undefined, remote: ServerRow, preferRemote = false): MergeDecision {
  const incoming = toLocal(remote);
  if (!local) return { action: 'apply', record: incoming };
  // первый вход на устройстве: данные из облака важнее локальных, которые ещё ни разу не синхронизировались
  if (preferRemote && local.dirty && !local.server_updated_at) {
    if (sameContent(local, incoming)) return { action: 'apply', record: incoming };
    return { action: 'conflict-apply', record: incoming, lost: local };
  }
  if (!local.dirty) {
    if (incoming.updated_at >= local.updated_at) return { action: 'apply', record: incoming };
    return { action: 'keep-local', serverUpdatedAt: remote.server_updated_at };
  }
  if (local.updated_at > incoming.updated_at) return { action: 'keep-local', serverUpdatedAt: remote.server_updated_at };
  if (local.updated_at === incoming.updated_at) return { action: 'apply', record: incoming };
  // локальная неотправленная правка старше облачной — облачная побеждает, локальную сохраняем в журнал
  if (sameContent(local, incoming)) return { action: 'apply', record: incoming };
  return { action: 'conflict-apply', record: incoming, lost: local };
}

/** Результат отправки: сервер вернул итоговое состояние записи. */
export function reconcilePushed(localNow: StoredRecord | undefined, sent: StoredRecord, server: ServerRow): MergeDecision {
  const srv = toLocal(server);
  if (localNow && localNow.updated_at > sent.updated_at) {
    // пока шла отправка, запись снова изменили — оставляем её неотправленной
    return { action: 'keep-local', serverUpdatedAt: server.server_updated_at };
  }
  if (srv.updated_at === sent.updated_at) return { action: 'apply', record: srv };
  if (srv.updated_at > sent.updated_at) {
    if (sameContent(sent, srv)) return { action: 'apply', record: srv };
    return { action: 'conflict-apply', record: srv, lost: sent };
  }
  // сервер старше отправленного — не должно случаться; отправим снова
  return { action: 'keep-local', serverUpdatedAt: server.server_updated_at };
}

function sameContent(a: StoredRecord, b: StoredRecord) {
  return !!a.deleted_at === !!b.deleted_at && JSON.stringify(a.data) === JSON.stringify(b.data);
}

export interface SyncDeps {
  store: Store;
  client: () => SupaClient | null;
  deviceId: string;
  online?: () => boolean;
  onSynced?: () => void | Promise<void>;
}

const PUSH_BATCH = 200;
const PULL_LIMIT = 1000;
const OVERLAP_MS = 10_000;

export class SyncEngine {
  status: SyncStatus = { state: 'local', pending: 0, lastSync: null, error: null };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;

  constructor(private deps: SyncDeps) {
    deps.store.onChange(() => { this.updatePending(); this.schedule(); });
  }

  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  getStatus = () => this.status;
  private set(p: Partial<SyncStatus>) { this.status = { ...this.status, ...p }; for (const l of this.listeners) l(); }
  updatePending() { this.set({ pending: this.deps.store.pendingCount() }); }

  refreshState() {
    const c = this.deps.client();
    if (!c) this.set({ state: 'local', error: null });
    else if (!c.user) this.set({ state: 'signed-out', error: null });
    else if (this.status.state === 'local' || this.status.state === 'signed-out') this.set({ state: 'idle' });
    this.updatePending();
  }

  schedule(delay = 1500) {
    const c = this.deps.client();
    if (!c?.user) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; void this.syncNow(); }, delay);
  }

  async syncNow(): Promise<void> {
    if (this.running) { this.again = true; return this.running; }
    const c = this.deps.client();
    if (!c?.user) { this.refreshState(); return; }
    if (this.deps.online && !this.deps.online()) { this.set({ state: 'offline' }); return; }
    this.running = (async () => {
      this.set({ state: 'syncing', error: null });
      try {
        const preferRemote = !!(await this.deps.store.getMeta<boolean>('preferRemoteOnce'));
        if (preferRemote) await this.pull(c, true);
        await this.push(c);
        await this.pull(c);
        if (preferRemote) await this.deps.store.setMeta('preferRemoteOnce', false);
        await this.deps.store.flush();
        const now = new Date().toISOString();
        await this.deps.store.setMeta('lastSync', now);
        this.set({ state: 'idle', lastSync: now, error: null });
        await this.deps.onSynced?.();
      } catch (e) {
        const err = e as CloudError;
        if (err.code === 'network') this.set({ state: 'offline', error: null });
        else this.set({ state: c.user ? 'error' : 'signed-out', error: err.message || 'Ошибка синхронизации' });
      } finally {
        this.updatePending();
      }
    })().finally(() => {
      this.running = null;
      if (this.again) { this.again = false; this.schedule(300); }
    });
    return this.running;
  }

  private async push(c: SupaClient) {
    const { store, deviceId } = this.deps;
    for (let guard = 0; guard < 50; guard++) {
      const dirty = store.dirty().filter((r) => known.has(r.t)).slice(0, PUSH_BATCH);
      if (!dirty.length) return;
      const sent = dirty.map((r) => structuredClone(r));
      const rows = sent.map((r) => ({ t: r.t, id: r.id, data: r.data, created_at: r.created_at, updated_at: r.updated_at, deleted_at: r.deleted_at, device_id: deviceId }));
      const result = await c.rpc<ServerRow[]>('push_changes', { rows });
      const byKey = new Map((result ?? []).map((r) => [r.t + '\u0000' + r.id, r]));
      let progressed = false;
      for (const s of sent) {
        const srv = byKey.get(s.t + '\u0000' + s.id);
        if (!srv) continue;
        const d = reconcilePushed(store.rec(s.t, s.id), s, srv);
        if (d.action !== 'keep-local') progressed = true;
        await this.applyDecision(d, s.t, s.id);
      }
      if (!progressed) return; // нечего больше отправлять в этом проходе
    }
  }

  private async pull(c: SupaClient, preferRemote = false) {
    const { store } = this.deps;
    let since = (await store.getMeta<string>('cursor')) ?? null;
    for (let guard = 0; guard < 100; guard++) {
      const sinceParam = since ? new Date(new Date(since).getTime() - OVERLAP_MS).toISOString() : null;
      const rows = (await c.rpc<ServerRow[]>('pull_changes', { since: sinceParam, max_rows: PULL_LIMIT })) ?? [];
      let maxCursor = since;
      for (const row of rows) {
        if (!known.has(row.t)) continue;
        const d = mergeRemote(store.rec(row.t, row.id), row, preferRemote);
        await this.applyDecision(d, row.t, row.id);
        if (!maxCursor || new Date(row.server_updated_at) > new Date(maxCursor)) maxCursor = row.server_updated_at;
      }
      if (maxCursor && maxCursor !== since) await store.setMeta('cursor', maxCursor);
      const advanced = maxCursor !== since;
      since = maxCursor;
      if (rows.length < PULL_LIMIT || !advanced) return;
    }
  }

  private async applyDecision(d: MergeDecision, t: TableName, id: string) {
    const { store } = this.deps;
    if (d.action === 'apply') store.applyRaw(d.record);
    else if (d.action === 'conflict-apply') {
      await store.addConflict({ t, id, data: d.lost.data, updated_at: d.lost.updated_at, deleted_at: d.lost.deleted_at, lostAt: new Date().toISOString(), winnerUpdatedAt: d.record.updated_at });
      store.applyRaw(d.record);
    } else {
      const cur = store.rec(t, id);
      if (cur && cur.server_updated_at !== d.serverUpdatedAt) store.applyRaw({ ...cur, server_updated_at: d.serverUpdatedAt });
    }
  }

  async resetCursor() { await this.deps.store.setMeta('cursor', null); }
}
