import { TABLES, type StoredRecord } from '../data/types';
import { normIso } from './id';

export interface BackupFile {
  app: 'berezhno';
  format: 1;
  version: string;
  exportedAt: string;
  records: Array<Pick<StoredRecord, 't' | 'id' | 'data' | 'created_at' | 'updated_at'>>;
}

export function makeBackup(records: StoredRecord[], version: string, now = new Date()): BackupFile {
  return {
    app: 'berezhno', format: 1, version, exportedAt: now.toISOString(),
    records: records.filter((r) => !r.deleted_at && r.id !== '__wiped__').map((r) => ({ t: r.t, id: r.id, data: r.data, created_at: r.created_at, updated_at: r.updated_at })),
  };
}

export function parseBackup(text: string): BackupFile {
  let j: any;
  try { j = JSON.parse(text); } catch { throw new Error('Файл не похож на резервную копию: это не JSON.'); }
  if (!j || j.app !== 'berezhno' || !Array.isArray(j.records)) throw new Error('Это не резервная копия «Бережно».');
  const known = new Set<string>(TABLES);
  const records = j.records.filter((r: any) => r && known.has(r.t) && typeof r.id === 'string' && r.data !== undefined && normIso(r.updated_at));
  return { ...j, records };
}

/** Какие записи из копии нужно применить: только новее локальных (ничего не теряется). */
export function planImport(backup: BackupFile, local: (t: string, id: string) => StoredRecord | undefined) {
  const apply: BackupFile['records'] = [];
  let skipped = 0;
  for (const r of backup.records) {
    const cur = local(r.t, r.id);
    const ts = normIso(r.updated_at)!;
    if (!cur || cur.updated_at < ts || (cur.deleted_at && cur.deleted_at < ts)) apply.push({ ...r, updated_at: ts });
    else skipped++;
  }
  return { apply, skipped };
}
