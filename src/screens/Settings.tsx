import { useEffect, useRef, useState } from 'react';
import { LuDownload, LuLogOut, LuRefreshCw, LuShieldCheck, LuTrash2, LuUpload, LuX } from 'react-icons/lu';
import type { Goal, Prefs } from '../data/types';
import { makeBackup, parseBackup, planImport } from '../lib/backup';
import { fmtDay } from '../lib/date';
import { savePrefs, setModule } from '../store/actions';
import { app, cloudSignOut, deleteAccount, deleteCloudData, setCloudConfig, wipeLocal } from '../store/app';
import type { ConflictEntry } from '../store/db';
import { useCore, usePrefs, useSyncStatus } from '../store/hooks';
import { CloudLogin } from '../ui/CloudLogin';
import { Button, Card, Chip, Field, Note, NumberInput, Segmented, Sheet, SwitchRow, confirmAction, toast } from '../ui/kit';
import { parseHash } from '../app/router';
import { storageWarning } from '../app/App';

const MODULES: Array<{ key: keyof Prefs['modules']; title: string; hint?: string }> = [
  { key: 'cycle', title: 'Цикл и овуляция' },
  { key: 'ovulationTests', title: 'Тесты на овуляцию', hint: 'Скрытие не удаляет историю тестов' },
  { key: 'supplements', title: 'Мои назначения' },
  { key: 'yoga', title: 'Йога' },
  { key: 'warmups', title: 'Разминки в рабочие дни' },
  { key: 'nutrition', title: 'Питание и меню' },
  { key: 'snacks', title: 'Перекусы' },
  { key: 'library', title: 'Библиотека знаний' },
  { key: 'water', title: 'Счётчик воды' },
  { key: 'produce', title: 'Фрукты и овощи на главной' },
  { key: 'newHabitHints', title: 'Подсказки новых привычек', hint: 'Не чаще одного раза в неделю' },
  { key: 'honey', title: 'Мёд утром', hint: 'Необязательная привычка' },
];

export function Settings({ recovery }: { recovery?: boolean }) {
  const prefs = usePrefs();
  const sync = useSyncStatus();
  useCore();
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [signOut, setSignOut] = useState(false);
  const [wipe, setWipe] = useState<'data' | 'account' | null>(null);
  const [pwOpen, setPwOpen] = useState(!!recovery);
  const fileRef = useRef<HTMLInputElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const user = app.client?.user;
  const warn = storageWarning();

  useEffect(() => { app.store.conflicts().then(setConflicts); }, [sync.lastSync, app.store.version]);
  useEffect(() => { if (parseHash(location.hash).query.get('focus') === 'cloud') cloudRef.current?.scrollIntoView({ block: 'start' }); }, []);

  const doExport = async () => {
    await app.store.flush();
    const b = makeBackup(app.store.rawAll(), __APP_VERSION__);
    const text = JSON.stringify(b, null, 1);
    const name = `berezhno-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([text], name, { type: 'application/json' });
    try {
      if ((navigator as any).canShare?.({ files: [file] })) { await (navigator as any).share({ files: [file], title: 'Резервная копия «Бережно»' }); return; }
    } catch (e) { if ((e as Error).name === 'AbortError') return; }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('Резервная копия сохранена', { tone: 'ok' });
  };

  const doImport = async (f: File) => {
    try {
      const b = parseBackup(await f.text());
      const { apply, skipped } = planImport(b, (t, id) => app.store.rec(t as any, id));
      for (const r of apply) app.store.put(r.t, r.id, r.data, { updatedAt: r.updated_at });
      await app.store.flush();
      toast(`Восстановлено записей: ${apply.length}${skipped ? `, пропущено более старых: ${skipped}` : ''}`, { tone: 'ok', ms: 6000 });
    } catch (e) { toast((e as Error).message, { tone: 'warn' }); }
  };

  return (
    <div className="grid gap-4 max-w-3xl">
      <h1 className="text-3xl font-bold">Настройки</h1>
      {warn && <Note tone="warn">{warn}</Note>}

      <Card>
        <h2 className="text-lg font-semibold mb-3">Профиль и цель</h2>
        <div className="grid gap-3">
          <Field label="Имя для приветствия"><input className="input" value={prefs.name} onChange={(e: any) => savePrefs({ name: e.target.value })} /></Field>
          <div className="field"><span>Цель</span>
            <Segmented label="Цель" value={prefs.goal} onChange={(g: Goal) => { if (g === 'pregnant' && !confirmAction('Включить режим беременности? Прогнозы овуляции будут приостановлены, история сохранится.')) return; savePrefs({ goal: g }); }}
              options={[{ value: 'preparing', label: 'Подготовка' }, { value: 'pregnant', label: 'Беременность' }, { value: 'maintain', label: 'Просто забота о себе' }]} />
          </div>
          <p className="text-xs text-ink-soft">Цель можно менять в любой момент — данные не теряются.</p>
        </div>
      </Card>

      <div ref={cloudRef} id="cloud" />
      <Card>
        <h2 className="text-lg font-semibold mb-1">Облако и синхронизация</h2>
        <p className="text-sm text-ink-soft mb-3">Один аккаунт на iPhone, Mac и Windows. Без облака всё работает на этом устройстве, а перенос возможен через резервную копию.</p>
        {!app.client && <CloudLogin />}
        {app.client && !user && (
          <>
            <CloudLogin />
            {app.configSource === 'device' && <Button size="sm" variant="quiet" className="mt-3" onClick={() => { if (confirmAction('Отключить облако на этом устройстве? Данные на устройстве останутся.')) setCloudConfig(null); }}>Изменить параметры облака</Button>}
          </>
        )}
        {app.client && user && (
          <div className="grid gap-3">
            <div className="surface px-4 py-3">
              <div className="text-sm text-ink-soft">Вы вошли как</div>
              <div className="font-medium break-all">{user.email}</div>
              <div className="text-sm mt-2">
                {sync.state === 'syncing' ? 'Синхронизация…' : sync.state === 'offline' ? 'Нет сети — изменения сохранены на устройстве и отправятся позже.' : sync.state === 'error' ? `Ошибка: ${sync.error}` : sync.pending ? `Ожидает отправки: ${sync.pending}` : 'Всё синхронизировано.'}
                {sync.lastSync && <span className="text-ink-soft"> Последняя синхронизация: {new Date(sync.lastSync).toLocaleString('ru')}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="mint" icon={<LuRefreshCw size={16} />} onClick={() => app.sync.syncNow()}>Синхронизировать сейчас</Button>
              <Button variant="ghost" onClick={() => setPwOpen(true)}>Сменить пароль</Button>
              <Button variant="ghost" icon={<LuLogOut size={16} />} onClick={() => setSignOut(true)}>Выйти</Button>
            </div>
          </div>
        )}
        {conflicts.length > 0 && (
          <div className="mt-4">
            <h3 className="font-semibold">Сохранённые версии при конфликтах ({conflicts.length})</h3>
            <p className="text-sm text-ink-soft">Если одну запись меняли на двух устройствах офлайн, побеждает более позднее изменение. Проигравшая версия хранится здесь — её можно вернуть.</p>
            <ul className="divide-y divide-line mt-2">
              {conflicts.slice(0, 20).map((c, i) => (
                <li key={i} className="py-2 flex items-center gap-2">
                  <div className="flex-1 min-w-0 text-sm"><div className="font-medium truncate">{describe(c)}</div><div className="text-xs text-ink-soft">изменено {new Date(c.updated_at).toLocaleString('ru')}</div></div>
                  <Button size="sm" variant="ghost" onClick={async () => { app.store.put(c.t, c.id, c.data); await app.store.dropConflict(i); toast('Версия восстановлена'); }}>Вернуть</Button>
                  <Button size="sm" variant="quiet" aria-label="Убрать из списка" icon={<LuX size={16} />} onClick={() => app.store.dropConflict(i)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-1">Модули</h2>
        <p className="text-sm text-ink-soft">Любой модуль можно выключить и вернуть. Выключение ничего не удаляет.</p>
        <div className="divide-y divide-line">
          {MODULES.map((m) => <SwitchRow key={m.key} title={m.title} hint={m.hint} checked={prefs.modules[m.key]} onChange={(v) => setModule(m.key, v)} />)}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-3">Питание</h2>
        <FoodList title="Не люблю — не предлагать" items={prefs.excludedFoods} onChange={(v) => savePrefs({ excludedFoods: v })} />
        <FoodList title="Лучше ограничить" items={prefs.limitFoods} onChange={(v) => savePrefs({ limitFoods: v })} hint="Например, лимон — из-за изжоги" />
        <div className="grid grid-cols-2 gap-3 mt-3">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((k) => (
            <Field key={k} label={{ breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' }[k]}><input className="input" type="time" value={prefs.mealTimes[k]} onChange={(e: any) => savePrefs({ mealTimes: { ...prefs.mealTimes, [k]: e.target.value } })} /></Field>
          ))}
        </div>
        <Field label="Цель по воде, стаканов (необязательно)"><NumberInput value={prefs.waterGoal ?? undefined} onChange={(v) => savePrefs({ waterGoal: v ?? null })} min={1} max={20} /></Field>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-1">Данные</h2>
        <p className="text-sm text-ink-soft mb-3">Резервная копия — файл со всеми вашими записями. Его можно сохранить в «Файлы» или iCloud Drive и восстановить на любом устройстве.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="mint" icon={<LuDownload size={16} />} onClick={doExport}>Экспорт данных</Button>
          <Button variant="ghost" icon={<LuUpload size={16} />} onClick={() => fileRef.current?.click()}>Восстановить из копии</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e: any) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
        </div>
        <hr className="border-line my-4" />
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" icon={<LuTrash2 size={16} />} onClick={() => setWipe('data')}>Удалить все данные</Button>
          {user && <Button variant="danger" onClick={() => setWipe('account')}>Удалить аккаунт</Button>}
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-1 inline-flex items-center gap-2"><LuShieldCheck size={20} aria-hidden />Конфиденциальность</h2>
        <ul className="text-sm grid gap-1.5 list-disc pl-5 mt-2">
          <li>Данные о цикле, назначениях и самочувствии хранятся на устройстве и — если вы вошли — в вашей собственной облачной базе Supabase. Доступ к строкам базы есть только у вашего аккаунта (Row Level Security).</li>
          <li>Нет рекламы, аналитики и сторонних трекеров. Данные не передаются никому и не используются для таргетинга.</li>
          <li>В адресах страниц нет личных данных. В приложении используется только публичный ключ облака; секретные ключи не хранятся.</li>
          <li>Ссылки на источники открываются на сайтах организаций (ВОЗ, NHS, CDC и др.) — туда ничего из приложения не передаётся.</li>
          <li>Вы можете в любой момент выгрузить все данные или удалить их вместе с аккаунтом.</li>
        </ul>
      </Card>

      <Card tint="beige">
        <h2 className="text-lg font-semibold mb-1">Ограничения этой версии</h2>
        <ul className="text-sm grid gap-1.5 list-disc pl-5 mt-2">
          <li>Фоновые push-уведомления на iPhone не поддерживаются без серверной части — используйте выгрузку в календарь.</li>
          <li>Apple Watch и «Здоровье»: веб-приложение не имеет доступа к HealthKit; шаги и тренировки вносятся вручную.</li>
          <li>Каталоги ВкусВилла и Азбуки вкуса не подключены — у них нет открытого API; товары добавляются вручную.</li>
          <li>Приложение не ставит диагнозов, не назначает лечение и не обещает наступление беременности.</li>
        </ul>
      </Card>

      <p className="text-xs text-ink-soft">Версия {__APP_VERSION__} · сборка {__BUILD_ID__.slice(0, 16).replace('T', ' ')} · хранилище: {app.storageKind === 'indexeddb' ? 'IndexedDB' : 'память'} · начало использования: {fmtDay(prefs.startDate, { year: true })}</p>

      {signOut && (
        <Sheet open onClose={() => setSignOut(false)} title="Выйти из облака">
          <p className="text-sm mb-4">Данные в облаке останутся. Что сделать с данными на этом устройстве?</p>
          <div className="grid gap-2">
            <Button variant="primary" onClick={async () => { await cloudSignOut(true); setSignOut(false); toast('Вы вышли. Данные с устройства удалены.'); }}>Выйти и удалить данные с этого устройства</Button>
            <Button variant="ghost" onClick={async () => { await cloudSignOut(false); setSignOut(false); toast('Вы вышли. Данные остались на устройстве.'); }}>Выйти, оставить данные на устройстве</Button>
          </div>
        </Sheet>
      )}
      {wipe && <WipeSheet mode={wipe} signedIn={!!user} onClose={() => setWipe(null)} />}
      {pwOpen && <PasswordSheet onClose={() => { setPwOpen(false); if (recovery) history.replaceState(null, '', location.pathname + '#/settings'); }} />}
    </div>
  );
}

function describe(c: ConflictEntry): string {
  const d: any = c.data;
  const name = d?.title || d?.name || d?.date || c.id;
  const t: Record<string, string> = { habits: 'Привычка', recipes: 'Рецепт', supplements: 'Назначение', user_preferences: 'Настройки', menstrual_events: 'Цикл', habit_logs: 'Отметка привычки', daily_plans: 'День', meal_plan_items: 'Меню' };
  return `${t[c.t] ?? c.t}: ${name}`;
}

function FoodList({ title, items, onChange, hint }: { title: string; items: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [v, setV] = useState('');
  return (
    <div className="mb-3">
      <div className="text-sm font-medium mb-1.5">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((x) => <Chip key={x} on onClick={() => onChange(items.filter((y) => y !== x))} icon={<LuX size={14} aria-hidden />} aria-label={`Убрать ${x}`}>{x}</Chip>)}
        <form className="inline-flex gap-1" onSubmit={(e: any) => { e.preventDefault(); const t = v.trim().toLowerCase(); if (t && !items.includes(t)) onChange([...items, t]); setV(''); }}>
          <input className="input min-h-9! py-1! w-36" value={v} onChange={(e: any) => setV(e.target.value)} placeholder="добавить" aria-label={`Добавить: ${title}`} />
        </form>
      </div>
      {hint && <div className="text-xs text-ink-soft mt-1">{hint}</div>}
    </div>
  );
}

function WipeSheet({ mode, signedIn, onClose }: { mode: 'data' | 'account'; signedIn: boolean; onClose: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = text.trim().toUpperCase() === 'УДАЛИТЬ';
  const run = async () => {
    setBusy(true);
    try {
      if (mode === 'account') await deleteAccount();
      else if (signedIn) await deleteCloudData();
      else await wipeLocal();
      toast(mode === 'account' ? 'Аккаунт и все данные удалены' : 'Все данные удалены');
      location.hash = '#/';
      location.reload();
    } catch (e) { toast((e as Error).message, { tone: 'warn' }); setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title={mode === 'account' ? 'Удалить аккаунт' : 'Удалить все данные'}>
      <Note tone="warn">
        {mode === 'account' ? 'Аккаунт и все связанные данные будут удалены из облака и с этого устройства без возможности восстановления.'
          : signedIn ? 'Все записи будут удалены из облака и с этого устройства. Другие устройства тоже очистятся при следующей синхронизации. Аккаунт останется.'
            : 'Все записи будут удалены с этого устройства.'}
      </Note>
      <p className="text-sm mt-3">Перед удалением можно сделать экспорт данных. Чтобы подтвердить, введите слово «УДАЛИТЬ».</p>
      <input className="input mt-2" value={text} onChange={(e: any) => setText(e.target.value)} autoCapitalize="characters" aria-label="Подтверждение" />
      <div className="flex justify-end gap-2 mt-4">
        <Button variant="ghost" onClick={onClose}>Отмена</Button>
        <Button variant="danger" disabled={!ok || busy} onClick={run}>{busy ? 'Удаляю…' : 'Удалить навсегда'}</Button>
      </div>
    </Sheet>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose} title="Новый пароль" footer={<Button variant="primary" disabled={p.length < 6} onClick={async () => { try { await app.client!.updatePassword(p); toast('Пароль изменён', { tone: 'ok' }); onClose(); } catch (e) { setErr((e as Error).message); } }}>Сохранить</Button>}>
      <Field label="Пароль" hint="Не меньше 6 символов, лучше 10 и больше"><input className="input" type="password" autoComplete="new-password" value={p} onChange={(e: any) => setP(e.target.value)} /></Field>
      {err && <Note tone="warn" className="mt-3">{err}</Note>}
    </Sheet>
  );
}
