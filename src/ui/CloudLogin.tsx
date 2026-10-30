import { useState } from 'react';
import { LuCloud, LuLogIn } from 'react-icons/lu';
import { app, cloudSignIn, cloudSignUp, setCloudConfig } from '../store/app';
import { useCore } from '../store/hooks';
import { validateConfig } from '../store/supabase';
import { Button, Field, Note, toast } from './kit';

export function CloudConfigForm({ onDone }: { onDone?: () => void }) {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="grid gap-3" onSubmit={(e: any) => {
      e.preventDefault();
      const v = validateConfig(url, key);
      if (v) { setErr(v); return; }
      setCloudConfig({ url: url.trim(), anonKey: key.trim() });
      toast('Облако подключено. Теперь войдите или создайте аккаунт.', { tone: 'ok' });
      onDone?.();
    }}>
      <Note>Адрес проекта и публичный ключ находятся в Supabase: Project Settings → API (Data API). Подробно — в инструкции к приложению.</Note>
      <Field label="Адрес проекта (Project URL)">
        <input className="input" value={url} onChange={(e: any) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" autoCapitalize="off" spellCheck={false} inputMode="url" />
      </Field>
      <Field label="Публичный ключ (anon / publishable)">
        <input className="input" value={key} onChange={(e: any) => setKey(e.target.value)} placeholder="eyJ… или sb_publishable_…" autoComplete="off" autoCapitalize="off" spellCheck={false} />
      </Field>
      {err && <Note tone="warn">{err}</Note>}
      <Button variant="primary" type="submit" icon={<LuCloud size={18} />}>Подключить облако</Button>
    </form>
  );
}

export function CloudLogin({ onDone }: { onDone?: () => void }) {
  useCore();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!app.client) return <CloudConfigForm />;

  const submit = async (e: any) => {
    e.preventDefault();
    setErr(null); setInfo(null); setBusy(true);
    try {
      if (mode === 'in') { await cloudSignIn(email, pass); toast('Вы вошли. Данные синхронизируются.', { tone: 'ok' }); onDone?.(); }
      else {
        const r = await cloudSignUp(email, pass);
        if (r === 'confirm') setInfo('Мы отправили письмо для подтверждения. Откройте его на этом устройстве, затем войдите с паролем.');
        else { toast('Аккаунт создан, данные синхронизируются.', { tone: 'ok' }); onDone?.(); }
      }
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  const reset = async () => {
    if (!email.trim()) { setErr('Введите почту, на которую придёт ссылка.'); return; }
    try {
      await app.client!.requestPasswordReset(email.trim(), location.origin + location.pathname);
      setInfo('Если такой аккаунт есть, письмо со ссылкой для смены пароля уже отправлено.');
    } catch (x) { setErr((x as Error).message); }
  };

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <Field label="Почта">
        <input className="input" type="email" value={email} onChange={(e: any) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="off" required />
      </Field>
      <Field label="Пароль" hint={mode === 'up' ? 'Не меньше 6 символов, лучше 10 и больше' : undefined}>
        <input className="input" type="password" value={pass} onChange={(e: any) => setPass(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required />
      </Field>
      {err && <Note tone="warn">{err}</Note>}
      {info && <Note tone="ok">{info}</Note>}
      <Button variant="primary" type="submit" disabled={busy} icon={<LuLogIn size={18} />}>{busy ? 'Подождите…' : mode === 'in' ? 'Войти' : 'Создать аккаунт'}</Button>
      <div className="flex flex-wrap gap-2 justify-between">
        <Button variant="quiet" size="sm" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>{mode === 'in' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}</Button>
        {mode === 'in' && <Button variant="quiet" size="sm" onClick={reset}>Забыли пароль?</Button>}
      </div>
    </form>
  );
}
