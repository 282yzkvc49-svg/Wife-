// Минимальный клиент Supabase: Auth (GoTrue) и вызов RPC-функций (PostgREST).
// Используется только публичный anon-ключ; доступ к данным ограничен RLS на сервере.

export interface AuthUser { id: string; email?: string }
export interface Session { access_token: string; refresh_token: string; expires_at: number; user: AuthUser }

export interface CloudConfig { url: string; anonKey: string }

export class CloudError extends Error {
  constructor(message: string, public code: 'network' | 'auth' | 'server' | 'config' | 'confirm' = 'server', public status = 0) { super(message); }
}

type FetchLike = (input: string, init?: any) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>;

const SESSION_KEY = 'berezhno:session';

function translateAuthError(status: number, body: any): CloudError {
  const code = body?.error_code || body?.code || body?.error || '';
  const msg = String(body?.msg || body?.message || body?.error_description || body?.error || '');
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg) || code === 'invalid_grant') return new CloudError('Неверная почта или пароль.', 'auth', status);
  if (code === 'user_already_exists' || /already registered/i.test(msg)) return new CloudError('Этот адрес уже зарегистрирован — войдите с паролем.', 'auth', status);
  if (code === 'weak_password' || /password should be at least/i.test(msg)) return new CloudError('Пароль слишком простой: нужно не меньше 6 символов (лучше 10+).', 'auth', status);
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return new CloudError('Адрес ещё не подтверждён — откройте письмо от Supabase и перейдите по ссылке.', 'confirm', status);
  if (code === 'over_email_send_rate_limit' || status === 429) return new CloudError('Слишком много попыток. Подождите пару минут.', 'auth', status);
  if (/invalid.*email|validation_failed/i.test(code + msg)) return new CloudError('Проверьте адрес почты.', 'auth', status);
  if (/refresh token/i.test(msg)) return new CloudError('Сессия истекла — войдите снова.', 'auth', status);
  return new CloudError(msg ? `Облако ответило: ${msg}` : `Ошибка облака (${status})`, status === 401 || status === 403 ? 'auth' : 'server', status);
}

export class SupaClient {
  session: Session | null = null;
  private refreshing: Promise<void> | null = null;
  onSession: (s: Session | null) => void = () => {};

  constructor(public config: CloudConfig, private fetcher: FetchLike = (globalThis.fetch as any)?.bind(globalThis), private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.config = { url: config.url.replace(/\/+$/, ''), anonKey: config.anonKey.trim() };
    try {
      const raw = this.storage?.getItem(SESSION_KEY);
      if (raw) this.session = JSON.parse(raw);
    } catch { this.session = null; }
  }

  get user(): AuthUser | null { return this.session?.user ?? null; }

  private setSession(s: Session | null) {
    this.session = s;
    try {
      if (s) this.storage?.setItem(SESSION_KEY, JSON.stringify(s));
      else this.storage?.removeItem(SESSION_KEY);
    } catch { /* хранилище недоступно */ }
    this.onSession(s);
  }

  private headers(token?: string) {
    const h: Record<string, string> = {
      apikey: this.config.anonKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    // Новые publishable-ключи (sb_publishable_…) не являются JWT и в Authorization не передаются.
    if (token) h.Authorization = `Bearer ${token}`;
    else if (this.config.anonKey.split('.').length === 3) h.Authorization = `Bearer ${this.config.anonKey}`;
    return h;
  }

  private async call(path: string, init: any): Promise<{ status: number; body: any }> {
    let res;
    try {
      res = await this.fetcher(this.config.url + path, init);
    } catch {
      throw new CloudError('Нет связи с облаком. Изменения сохранены на устройстве и отправятся позже.', 'network');
    }
    const text = await res.text();
    let body: any = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    return { status: res.status, body };
  }

  private toSession(body: any): Session {
    const expiresAt = body.expires_at ?? Math.floor(Date.now() / 1000) + Number(body.expires_in || 3600);
    return { access_token: body.access_token, refresh_token: body.refresh_token, expires_at: expiresAt, user: { id: body.user?.id, email: body.user?.email } };
  }

  async signUp(email: string, password: string, redirectTo?: string): Promise<{ session: Session | null }> {
    const q = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : '';
    const { status, body } = await this.call(`/auth/v1/signup${q}`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ email, password }) });
    if (status >= 400) throw translateAuthError(status, body);
    if (body?.access_token) { const s = this.toSession(body); this.setSession(s); return { session: s }; }
    // Включено подтверждение почты: сессии ещё нет
    if (Array.isArray(body?.identities) && body.identities.length === 0) throw new CloudError('Этот адрес уже зарегистрирован — войдите с паролем.', 'auth', status);
    return { session: null };
  }

  async signIn(email: string, password: string): Promise<Session> {
    const { status, body } = await this.call('/auth/v1/token?grant_type=password', { method: 'POST', headers: this.headers(), body: JSON.stringify({ email, password }) });
    if (status >= 400 || !body?.access_token) throw translateAuthError(status, body);
    const s = this.toSession(body);
    this.setSession(s);
    return s;
  }

  /** Принять сессию из ссылки письма (#access_token=…&refresh_token=…&type=recovery|signup) */
  async acceptRedirect(params: URLSearchParams): Promise<Session | null> {
    const at = params.get('access_token');
    const rt = params.get('refresh_token');
    if (!at || !rt) return null;
    const { status, body } = await this.call('/auth/v1/user', { method: 'GET', headers: this.headers(at) });
    if (status >= 400) throw translateAuthError(status, body);
    const s: Session = { access_token: at, refresh_token: rt, expires_at: Number(params.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(params.get('expires_in') || 3600), user: { id: body.id, email: body.email } };
    this.setSession(s);
    return s;
  }

  async requestPasswordReset(email: string, redirectTo: string) {
    const { status, body } = await this.call(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ email }) });
    if (status >= 400) throw translateAuthError(status, body);
  }

  async updatePassword(password: string) {
    const token = await this.token();
    const { status, body } = await this.call('/auth/v1/user', { method: 'PUT', headers: this.headers(token), body: JSON.stringify({ password }) });
    if (status >= 400) throw translateAuthError(status, body);
  }

  async signOut() {
    const s = this.session;
    this.setSession(null);
    if (s) {
      try { await this.call('/auth/v1/logout', { method: 'POST', headers: this.headers(s.access_token) }); } catch { /* офлайн — сессия уже забыта на устройстве */ }
    }
  }

  async refresh(): Promise<void> {
    if (!this.session) throw new CloudError('Нужно войти в облако.', 'auth');
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const { status, body } = await this.call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: this.headers(), body: JSON.stringify({ refresh_token: this.session!.refresh_token }) });
      if (status >= 400 || !body?.access_token) {
        if (status === 400 || status === 401) this.setSession(null);
        throw translateAuthError(status, body);
      }
      this.setSession(this.toSession(body));
    })().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  async token(): Promise<string> {
    if (!this.session) throw new CloudError('Нужно войти в облако.', 'auth');
    if (this.session.expires_at - 60 < Date.now() / 1000) await this.refresh();
    return this.session!.access_token;
  }

  async rpc<T = any>(fn: string, args: Record<string, unknown>, retried = false): Promise<T> {
    const token = await this.token();
    const { status, body } = await this.call(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: this.headers(token), body: JSON.stringify(args) });
    if (status === 401 && !retried) { await this.refresh(); return this.rpc<T>(fn, args, true); }
    if (status === 404 && /could not find the function|PGRST202/i.test(JSON.stringify(body))) {
      throw new CloudError('В облаке не найдены функции приложения. Выполните SQL-скрипт из инструкции (supabase/migrations/001_init.sql).', 'config', status);
    }
    if (status >= 400) {
      const msg = body?.message || body?.msg || body?.hint || '';
      throw new CloudError(msg ? `Облако: ${msg}` : `Ошибка облака (${status})`, status === 401 || status === 403 ? 'auth' : 'server', status);
    }
    return body as T;
  }
}

export function validateConfig(url: string, key: string): string | null {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(url.trim()) && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url.trim())) {
    return 'Адрес проекта должен выглядеть как https://xxxx.supabase.co';
  }
  if (key.trim().length < 20) return 'Вставьте публичный ключ (anon / publishable) целиком';
  if (/service_role|sb_secret_/i.test(key) || keyRole(key) === 'service_role') return 'Это секретный ключ service_role — его нельзя использовать в приложении. Нужен публичный anon (publishable) ключ.';
  return null;
}

function keyRole(key: string): string | null {
  try {
    const part = key.split('.')[1];
    if (!part) return null;
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return json.role ?? null;
  } catch { return null; }
}
