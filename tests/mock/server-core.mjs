// Модель серверной логики (повторяет SQL-функции push_changes / pull_changes / delete_my_data)
// для unit-тестов синхронизации и e2e-проверки двух устройств без доступа к настоящему Supabase.
// Поведение самих SQL-функций проверяется отдельно на PostgreSQL (tests/sql).

export const TABLES = [
  'user_preferences', 'habits', 'habit_logs', 'daily_plans', 'daily_context', 'supplements', 'supplement_logs', 'recipes',
  'meal_plans', 'meal_plan_items', 'shopping_lists', 'shopping_list_items', 'pantry_items', 'menstrual_cycles', 'menstrual_events',
  'symptoms', 'ovulation_tests', 'yoga_sessions', 'exercise_library', 'exercise_logs', 'activity_logs', 'work_calendar', 'reminders',
  'saved_articles', 'user_feedback', 'daily_notes', 'store_products',
];

export class ServerCore {
  constructor() { this.data = new Map(); this.clock = Date.now(); this.calls = []; }
  tick() { this.clock = Math.max(Date.now(), this.clock + 1); return new Date(this.clock).toISOString(); }
  userMap(uid) { if (!this.data.has(uid)) this.data.set(uid, new Map()); return this.data.get(uid); }

  push(uid, rows) {
    this.calls.push({ fn: 'push', n: rows.length });
    if (!uid) throw Object.assign(new Error('not authenticated'), { status: 401 });
    if (rows.length > 500) throw new Error('too many rows');
    const m = this.userMap(uid);
    const out = [];
    for (const r of rows) {
      if (!TABLES.includes(r.t)) throw new Error('unknown table: ' + r.t);
      const k = r.t + '|' + r.id;
      const cur = m.get(k);
      if (!cur) {
        m.set(k, { t: r.t, id: r.id, data: r.data ?? {}, created_at: r.created_at ?? r.updated_at, updated_at: r.updated_at, deleted_at: r.deleted_at ?? null, server_updated_at: this.tick(), rev: 1 });
      } else if (new Date(cur.updated_at) < new Date(r.updated_at)) {
        Object.assign(cur, { data: r.data, updated_at: r.updated_at, deleted_at: r.deleted_at ?? null, server_updated_at: this.tick(), rev: cur.rev + 1 });
      }
      const s = m.get(k);
      out.push({ t: s.t, id: s.id, data: s.data, created_at: s.created_at, updated_at: s.updated_at, deleted_at: s.deleted_at, server_updated_at: s.server_updated_at });
    }
    return structuredClone(out);
  }

  pull(uid, since, max = 1000) {
    this.calls.push({ fn: 'pull', since });
    if (!uid) throw Object.assign(new Error('not authenticated'), { status: 401 });
    const rows = [...this.userMap(uid).values()]
      .filter((r) => !since || new Date(r.server_updated_at) > new Date(since))
      .sort((a, b) => (a.server_updated_at < b.server_updated_at ? -1 : 1))
      .slice(0, max)
      .map(({ rev, ...r }) => r);
    return structuredClone(rows);
  }

  deleteData(uid) {
    const at = this.tick();
    this.data.set(uid, new Map());
    this.userMap(uid).set('user_preferences|__wiped__', { t: 'user_preferences', id: '__wiped__', data: { wipedAt: at }, created_at: at, updated_at: at, deleted_at: null, server_updated_at: at, rev: 1 });
    return { wipedAt: at };
  }

  deleteAccount(uid) { this.data.delete(uid); }

  rpc(uid, fn, args) {
    if (fn === 'push_changes') return this.push(uid, args.rows);
    if (fn === 'pull_changes') return this.pull(uid, args.since, args.max_rows);
    if (fn === 'delete_my_data') return this.deleteData(uid);
    if (fn === 'delete_my_account') { this.deleteAccount(uid); return null; }
    throw Object.assign(new Error('Could not find the function'), { status: 404 });
  }
}
