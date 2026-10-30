// HTTP-заглушка Supabase (Auth + RPC) для e2e-проверки входа и синхронизации двух устройств.
// Повторяет форматы ответов GoTrue/PostgREST, которые использует клиент приложения.
import http from 'node:http';
import crypto from 'node:crypto';
import { ServerCore } from './server-core.mjs';

export function startMockSupabase(port = 54400) {
  const core = new ServerCore();
  const users = new Map(); // email -> { id, password }
  const tokens = new Map(); // access -> uid
  const refresh = new Map(); // refresh -> uid
  const issue = (uid, email) => {
    const at = 'at_' + crypto.randomUUID();
    const rt = 'rt_' + crypto.randomUUID();
    tokens.set(at, uid); refresh.set(rt, uid);
    return { access_token: at, refresh_token: rt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: uid, email } };
  };
  const server = http.createServer((req, res) => {
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type, accept, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
    const send = (status, body) => { res.writeHead(status, { ...cors, 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const body = raw ? JSON.parse(raw) : {};
      if (!req.headers.apikey) return send(401, { message: 'No API key found in request' });
      const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
      const uid = tokens.get(bearer);
      const emailOf = (id) => [...users.entries()].find(([, u]) => u.id === id)?.[0];
      try {
        if (url.pathname === '/auth/v1/signup') {
          if (users.has(body.email)) return send(422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
          if (!body.password || body.password.length < 6) return send(422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
          const id = crypto.randomUUID();
          users.set(body.email, { id, password: body.password });
          return send(200, issue(id, body.email));
        }
        if (url.pathname === '/auth/v1/token') {
          const gt = url.searchParams.get('grant_type');
          if (gt === 'password') {
            const u = users.get(body.email);
            if (!u || u.password !== body.password) return send(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
            return send(200, issue(u.id, body.email));
          }
          if (gt === 'refresh_token') {
            const id = refresh.get(body.refresh_token);
            if (!id) return send(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
            refresh.delete(body.refresh_token);
            return send(200, issue(id, emailOf(id)));
          }
        }
        if (url.pathname === '/auth/v1/user') {
          if (!uid) return send(401, { code: 401, msg: 'invalid JWT' });
          if (req.method === 'PUT') { const e = emailOf(uid); users.get(e).password = body.password; }
          return send(200, { id: uid, email: emailOf(uid) });
        }
        if (url.pathname === '/auth/v1/logout') { tokens.delete(bearer); res.writeHead(204, cors); return res.end(); }
        if (url.pathname === '/auth/v1/recover') return send(200, {});
        if (url.pathname.startsWith('/rest/v1/rpc/')) {
          if (!uid) return send(401, { code: 'PGRST301', message: 'JWT expired' });
          const fn = url.pathname.slice('/rest/v1/rpc/'.length);
          if (fn === 'delete_my_account') { const e = emailOf(uid); users.delete(e); }
          return send(200, core.rpc(uid, fn, body));
        }
        return send(404, { message: 'not found' });
      } catch (e) {
        return send(e.status || 400, { message: e.message });
      }
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, core, url: `http://127.0.0.1:${port}` })));
}
