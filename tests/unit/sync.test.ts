// Интеграционные тесты: локальное хранилище + офлайн-очередь + синхронизация двух устройств через модель сервера.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../../src/store/db.ts';
import { MemoryBackend } from '../../src/store/backend.ts';
import { SyncEngine, mergeRemote } from '../../src/store/sync.ts';
import { CloudError } from '../../src/store/supabase.ts';
import { makeBackup, parseBackup, planImport } from '../../src/lib/backup.ts';
import { ServerCore } from '../mock/server-core.mjs';

function device(server: ServerCore, uid = 'u1') {
  const backend = new MemoryBackend();
  const store = new Store(backend);
  let online = true;
  const client: any = {
    user: { id: uid },
    rpc: async (fn: string, args: any) => {
      if (!online) throw new CloudError('нет сети', 'network');
      return server.rpc(client.user?.id, fn, structuredClone(args));
    },
  };
  const sync = new SyncEngine({ store, client: () => client, deviceId: 'd-' + Math.random() });
  return { store, sync, backend, client, setOnline: (v: boolean) => { online = v; } };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('данные сохраняются на устройстве и переживают «перезагрузку»', async () => {
  const backend = new MemoryBackend();
  const s1 = new Store(backend);
  s1.put('habits', 'h1', { title: 'Вода' });
  await s1.flush();
  const s2 = new Store(backend);
  await s2.load();
  assert.equal(s2.get<any>('habits', 'h1').title, 'Вода');
  assert.equal(s2.pendingCount(), 1, 'неотправленное остаётся в очереди');
});

test('два устройства одного аккаунта видят изменения друг друга', async () => {
  const server = new ServerCore();
  const a = device(server), b = device(server);
  a.store.put('habits', 'h1', { title: 'Прогулка' });
  await a.sync.syncNow();
  assert.equal(a.store.pendingCount(), 0);
  await b.sync.syncNow();
  assert.equal(b.store.get<any>('habits', 'h1').title, 'Прогулка');
  b.store.put('habits', 'h1', { title: 'Прогулка 20 минут' });
  await b.sync.syncNow();
  await a.sync.syncNow();
  assert.equal(a.store.get<any>('habits', 'h1').title, 'Прогулка 20 минут');
});

test('удаление доходит до другого устройства', async () => {
  const server = new ServerCore();
  const a = device(server), b = device(server);
  a.store.put('recipes', 'r1', { title: 'Суп' });
  await a.sync.syncNow(); await b.sync.syncNow();
  b.store.remove('recipes', 'r1');
  await b.sync.syncNow(); await a.sync.syncNow();
  assert.equal(a.store.get('recipes', 'r1'), undefined);
});

test('офлайн: изменения копятся и отправляются при появлении сети', async () => {
  const server = new ServerCore();
  const a = device(server);
  a.setOnline(false);
  a.store.put('habit_logs', 'hl:h1:2026-11-03', { status: 'full' });
  await a.sync.syncNow();
  assert.equal(a.sync.status.state, 'offline');
  assert.equal(a.store.pendingCount(), 1);
  a.setOnline(true);
  await a.sync.syncNow();
  assert.equal(a.sync.status.state, 'idle');
  assert.equal(a.store.pendingCount(), 0);
  assert.equal(server.pull('u1', null).length, 1);
});

test('конфликт: побеждает более позднее изменение, проигравшая версия сохраняется', async () => {
  const server = new ServerCore();
  const a = device(server), b = device(server);
  a.store.put('supplements', 's1', { name: 'Витамин D', dose: '' });
  await a.sync.syncNow(); await b.sync.syncNow();
  a.setOnline(false); b.setOnline(false);
  a.store.put('supplements', 's1', { name: 'Витамин D', dose: 'A' });
  await sleep(5);
  b.store.put('supplements', 's1', { name: 'Витамин D', dose: 'B' });
  b.setOnline(true); await b.sync.syncNow();
  a.setOnline(true); await a.sync.syncNow();
  assert.equal(a.store.get<any>('supplements', 's1').dose, 'B');
  const lost = await a.store.conflicts();
  assert.equal(lost.length, 1);
  assert.equal((lost[0].data as any).dose, 'A');
  await b.sync.syncNow();
  assert.equal(b.store.get<any>('supplements', 's1').dose, 'B');
});

test('одинаковая отметка на двух устройствах сливается в одну запись', async () => {
  const server = new ServerCore();
  const a = device(server), b = device(server);
  a.store.put('habit_logs', 'hl:h-water:2026-11-03', { status: 'full' });
  b.store.put('habit_logs', 'hl:h-water:2026-11-03', { status: 'full' });
  await a.sync.syncNow(); await b.sync.syncNow(); await a.sync.syncNow();
  assert.equal(server.pull('u1', null).filter((r: any) => r.t === 'habit_logs').length, 1);
  assert.equal((await b.store.conflicts()).length, 0, 'одинаковое содержимое — не конфликт');
});

test('первый вход на новом устройстве: облачные данные важнее несинхронизированных', async () => {
  const server = new ServerCore();
  const a = device(server);
  a.store.put('user_preferences', 'prefs', { name: 'Аня', onboarded: true });
  await a.sync.syncNow();
  const b = device(server);
  await sleep(3);
  b.store.put('user_preferences', 'prefs', { name: '', onboarded: true }); // локальная настройка до входа
  b.store.put('habits', 'h-local', { title: 'Только на B' });
  await b.store.setMeta('preferRemoteOnce', true);
  await b.sync.syncNow();
  assert.equal(b.store.get<any>('user_preferences', 'prefs').name, 'Аня');
  assert.equal((await b.store.conflicts()).length, 1, 'локальная версия не потерялась');
  await a.sync.syncNow();
  assert.equal(a.store.get<any>('habits', 'h-local').title, 'Только на B');
});

test('mergeRemote: правила слияния', () => {
  const base = { t: 'habits' as const, id: 'x', created_at: '2026-01-01T00:00:00.000Z', deleted_at: null };
  const remote = { ...base, data: { v: 2 }, updated_at: '2026-11-03T10:00:00.000Z', server_updated_at: '2026-11-03T10:00:01.000Z' };
  assert.equal(mergeRemote(undefined, remote).action, 'apply');
  assert.equal(mergeRemote({ ...base, data: { v: 1 }, updated_at: '2026-11-03T11:00:00.000Z', dirty: 1 }, remote).action, 'keep-local');
  assert.equal(mergeRemote({ ...base, data: { v: 1 }, updated_at: '2026-11-03T09:00:00.000Z', dirty: 1 }, remote).action, 'conflict-apply');
  assert.equal(mergeRemote({ ...base, data: { v: 1 }, updated_at: '2026-11-03T09:00:00.000Z', dirty: 0 }, remote).action, 'apply');
});

test('изоляция аккаунтов на модели сервера', async () => {
  const server = new ServerCore();
  const a = device(server, 'u1'), c = device(server, 'u2');
  a.store.put('habits', 'h1', { title: 'A' });
  await a.sync.syncNow(); await c.sync.syncNow();
  assert.equal(c.store.get('habits', 'h1'), undefined);
});

test('экспорт и импорт: копия восстанавливает данные, более старое не перезаписывает новое', async () => {
  const s = new Store(new MemoryBackend());
  s.put('recipes', 'r1', { title: 'Плов' });
  s.put('habits', 'h1', { title: 'Вода' });
  s.put('habits', 'gone', { title: 'x' }); s.remove('habits', 'gone');
  const file = JSON.stringify(makeBackup(s.rawAll(), '1.0.0'));
  const b = parseBackup(file);
  assert.equal(b.records.length, 2);
  const t = new Store(new MemoryBackend());
  t.put('recipes', 'r1', { title: 'Плов (новее)' });
  const plan = planImport(b, (tt, id) => t.rec(tt as any, id));
  assert.equal(plan.apply.length, 1);
  assert.equal(plan.skipped, 1);
  assert.throws(() => parseBackup('{"app":"other"}'));
  assert.throws(() => parseBackup('not json'));
});
