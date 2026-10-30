import { TABLES, type StoredRecord, type TableName } from '../data/types';
import { nowIso } from '../lib/id';
import type { Backend } from './backend';

export interface Row<T> { id: string; data: T; updated_at: string; created_at: string }

export interface ConflictEntry {
  t: TableName;
  id: string;
  data: unknown;
  updated_at: string;
  deleted_at: string | null;
  lostAt: string;
  winnerUpdatedAt: string;
}

const key = (t: string, id: string) => t + '\u0000' + id;

/**
 * Локальное хранилище: все записи держатся в памяти (данных одного человека немного),
 * каждое изменение сразу уходит в IndexedDB и помечается для отправки в облако.
 */
export class Store {
  private map = new Map<string, StoredRecord>();
  private byTable = new Map<TableName, Map<string, StoredRecord>>();
  private listeners = new Set<() => void>();
  private changeHooks = new Set<(r: StoredRecord) => void>();
  private pending = new Map<string, StoredRecord>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> = Promise.resolve();
  version = 0;
  loaded = false;
  private tver = new Map<string, number>();
  tableVersion = (t: TableName) => this.tver.get(t) ?? 0;

  constructor(public backend: Backend) {
    for (const t of TABLES) this.byTable.set(t, new Map());
  }

  async load() {
    const all = await this.backend.loadAll();
    for (const r of all) { this.index(r); this.tver.set(r.t, (this.tver.get(r.t) ?? 0) + 1); }
    this.loaded = true;
    this.bump();
  }

  private index(r: StoredRecord) {
    if (!this.byTable.has(r.t)) this.byTable.set(r.t, new Map());
    this.map.set(key(r.t, r.id), r);
    this.byTable.get(r.t)!.set(r.id, r);
  }

  // ——— Подписка для React ———
  subscribe = (cb: () => void) => { this.listeners.add(cb); return () => { this.listeners.delete(cb); }; };
  getVersion = () => this.version;
  onChange(cb: (r: StoredRecord) => void) { this.changeHooks.add(cb); return () => { this.changeHooks.delete(cb); }; }
  private bump() { this.version++; for (const l of this.listeners) l(); }

  // ——— Чтение ———
  rec(t: TableName, id: string): StoredRecord | undefined { return this.map.get(key(t, id)); }
  get<T>(t: TableName, id: string): T | undefined {
    const r = this.rec(t, id);
    return r && !r.deleted_at ? (r.data as T) : undefined;
  }
  all<T>(t: TableName): Row<T>[] {
    const out: Row<T>[] = [];
    for (const r of this.byTable.get(t)?.values() ?? []) {
      if (!r.deleted_at) out.push({ id: r.id, data: r.data as T, updated_at: r.updated_at, created_at: r.created_at });
    }
    return out;
  }
  rawAll(): StoredRecord[] { return [...this.map.values()]; }
  dirty(): StoredRecord[] { return [...this.map.values()].filter((r) => r.dirty === 1); }
  pendingCount(): number { let n = 0; for (const r of this.map.values()) if (r.dirty) n++; return n; }

  // ——— Запись ———
  put<T>(t: TableName, id: string, data: T, opts: { updatedAt?: string; clean?: boolean } = {}): T {
    const prev = this.rec(t, id);
    const now = opts.updatedAt ?? nowIso();
    const r: StoredRecord = {
      t, id, data: structuredClone(data),
      created_at: prev?.created_at ?? now,
      updated_at: prev && !opts.updatedAt && prev.updated_at >= now ? new Date(new Date(prev.updated_at).getTime() + 1).toISOString() : now,
      deleted_at: null,
      dirty: opts.clean ? 0 : 1,
      server_updated_at: prev?.server_updated_at ?? null,
    };
    this.commit(r);
    return data;
  }

  patch<T extends object>(t: TableName, id: string, partial: Partial<T>, fallback?: T): T {
    const cur = this.get<T>(t, id) ?? fallback;
    if (!cur) throw new Error(`Нет записи ${t}/${id}`);
    return this.put<T>(t, id, { ...cur, ...partial });
  }

  remove(t: TableName, id: string) {
    const prev = this.rec(t, id);
    if (!prev || prev.deleted_at) return;
    const now = nowIso();
    this.commit({ ...prev, deleted_at: now, updated_at: prev.updated_at >= now ? new Date(new Date(prev.updated_at).getTime() + 1).toISOString() : now, dirty: 1 });
  }

  /** Записать без пометки «изменено» (для данных, пришедших из облака) */
  applyRaw(r: StoredRecord) { this.commit(r, false); }

  private commit(r: StoredRecord, notifyHooks = true) {
    this.index(r);
    this.tver.set(r.t, (this.tver.get(r.t) ?? 0) + 1);
    this.pending.set(key(r.t, r.id), r);
    this.scheduleFlush();
    this.bump();
    if (notifyHooks) for (const h of this.changeHooks) h(r);
  }

  // ——— Сохранение на диск ———
  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => { this.flushTimer = null; void this.flush(); }, 30);
  }
  flush(): Promise<void> {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    const batch = [...this.pending.values()];
    this.pending.clear();
    if (!batch.length) return this.flushing;
    this.flushing = this.flushing.then(() => this.backend.putMany(batch)).catch((e) => {
      // вернуть в очередь, чтобы не потерять
      for (const r of batch) if (!this.pending.has(key(r.t, r.id))) this.pending.set(key(r.t, r.id), r);
      console.error('Не удалось сохранить на устройстве', e);
    });
    return this.flushing;
  }

  // ——— Метаданные ———
  getMeta<T>(k: string) { return this.backend.getMeta<T>(k); }
  setMeta(k: string, v: unknown) { return this.backend.setMeta(k, v); }

  async addConflict(c: ConflictEntry) {
    const list = (await this.getMeta<ConflictEntry[]>('conflicts')) ?? [];
    list.unshift(c);
    await this.setMeta('conflicts', list.slice(0, 100));
    this.bump();
  }
  async conflicts(): Promise<ConflictEntry[]> { return (await this.getMeta<ConflictEntry[]>('conflicts')) ?? []; }
  async dropConflict(index: number) {
    const list = await this.conflicts();
    list.splice(index, 1);
    await this.setMeta('conflicts', list);
    this.bump();
  }

  /** Пометить все записи как неотправленные (после входа в облако) */
  markAllDirty() {
    for (const r of this.map.values()) { r.dirty = 1; this.pending.set(key(r.t, r.id), r); }
    this.scheduleFlush();
    this.bump();
  }

  async wipe() {
    this.map.clear();
    for (const t of this.byTable.keys()) { this.byTable.set(t, new Map()); this.tver.set(t, (this.tver.get(t) ?? 0) + 1); }
    this.pending.clear();
    await this.flushing;
    await this.backend.clear();
    this.bump();
  }
}
