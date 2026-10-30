import type { StoredRecord } from '../data/types';

/** Постоянное хранилище на устройстве. В браузере — IndexedDB, в тестах — память. */
export interface Backend {
  readonly kind: 'indexeddb' | 'memory';
  loadAll(): Promise<StoredRecord[]>;
  putMany(recs: StoredRecord[]): Promise<void>;
  clear(): Promise<void>;
  getMeta<T = unknown>(k: string): Promise<T | undefined>;
  setMeta(k: string, v: unknown): Promise<void>;
}

export class MemoryBackend implements Backend {
  readonly kind = 'memory' as const;
  recs = new Map<string, StoredRecord>();
  meta = new Map<string, unknown>();
  async loadAll() { return [...this.recs.values()].map((r) => structuredClone(r)); }
  async putMany(recs: StoredRecord[]) { for (const r of recs) this.recs.set(r.t + '\u0000' + r.id, structuredClone(r)); }
  async clear() { this.recs.clear(); this.meta.clear(); }
  async getMeta<T>(k: string) { return structuredClone(this.meta.get(k)) as T | undefined; }
  async setMeta(k: string, v: unknown) { this.meta.set(k, structuredClone(v)); }
}

const DB_NAME = 'berezhno';
const DB_VERSION = 1;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class IdbBackend implements Backend {
  readonly kind = 'indexeddb' as const;
  private dbp: Promise<IDBDatabase>;
  constructor(name = DB_NAME) {
    this.dbp = new Promise((resolve, reject) => {
      const open = indexedDB.open(name, DB_VERSION);
      open.onupgradeneeded = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains('records')) {
          const s = db.createObjectStore('records', { keyPath: ['t', 'id'] });
          s.createIndex('t', 't');
          s.createIndex('dirty', 'dirty');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error('Хранилище занято другой вкладкой'));
    });
  }
  async loadAll() {
    const db = await this.dbp;
    return req(db.transaction('records').objectStore('records').getAll()) as Promise<StoredRecord[]>;
  }
  async putMany(recs: StoredRecord[]) {
    if (!recs.length) return;
    const db = await this.dbp;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const s = tx.objectStore('records');
      for (const r of recs) s.put(r);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  async clear() {
    const db = await this.dbp;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['records', 'meta'], 'readwrite');
      tx.objectStore('records').clear();
      tx.objectStore('meta').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async getMeta<T>(k: string) {
    const db = await this.dbp;
    const row = await req(db.transaction('meta').objectStore('meta').get(k)) as { k: string; v: T } | undefined;
    return row?.v;
  }
  async setMeta(k: string, v: unknown) {
    const db = await this.dbp;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ k, v });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function openBestBackend(): Promise<Backend> {
  try {
    if (typeof indexedDB === 'undefined') throw new Error('no idb');
    const b = new IdbBackend();
    await b.getMeta('probe');
    return b;
  } catch {
    return new MemoryBackend();
  }
}
