// Сборка «Бережно»: esbuild (TS/React) + Tailwind CSS 4 + service worker.
// Результат — плоская папка dist/ (все файлы в корне), готовая для GitHub Pages.
//
//   node build.mjs            — production-сборка
//   node build.mjs --watch    — пересборка при изменениях
//
// Переменные окружения (необязательно):
//   SUPABASE_URL, SUPABASE_ANON_KEY — вшить параметры облака, чтобы не вводить их на каждом устройстве.
//   Публичный anon-ключ безопасен при включённом RLS; service_role-ключ сюда класть нельзя.

import { build, context, transform } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const watch = process.argv.includes('--watch');

function readLocalConfig() {
  // Необязательный файл app.config.json (не коммитится, если содержит что-то личное).
  const p = path.join(ROOT, 'app.config.json');
  if (!fs.existsSync(p)) return {};
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

function tailwindCandidates() {
  const set = new Set();
  for (const f of walk(SRC)) {
    if (!/\.(tsx?|html)$/.test(f)) continue;
    const text = fs.readFileSync(f, 'utf8');
    for (const tok of text.split(/[\s"'`{}();,<>]+/)) {
      if (tok && tok.length < 120) set.add(tok);
    }
  }
  return [...set];
}

async function buildCss() {
  const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
  const input = fs.readFileSync(path.join(SRC, 'styles', 'app.css'), 'utf8');
  const compiler = await compile(input, {
    base: SRC,
    loadStylesheet: async (id, base) => {
      let file;
      if (id === 'tailwindcss') file = path.join(twDir, 'index.css');
      else if (id.startsWith('tailwindcss/')) file = path.join(twDir, id.slice('tailwindcss/'.length) + (id.endsWith('.css') ? '' : '.css'));
      else file = path.resolve(base, id);
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
    loadModule: async (id) => { throw new Error('Модули Tailwind не поддерживаются в этой сборке: ' + id); },
  });
  const css = compiler.build(tailwindCandidates());
  const min = await transform(css, { loader: 'css', minify: true, target: ['safari16', 'chrome110', 'firefox115', 'edge110'] });
  return min.code;
}

function hash(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 10); }

async function buildAll() {
  const started = Date.now();
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  const cfg = readLocalConfig();
  const supabaseUrl = process.env.SUPABASE_URL ?? cfg.supabaseUrl ?? '';
  const supabaseKey = process.env.SUPABASE_ANON_KEY ?? cfg.supabaseAnonKey ?? '';
  if (/service_role/.test(supabaseKey)) throw new Error('В клиент нельзя вшивать service_role-ключ.');

  const js = await build({
    entryPoints: [path.join(SRC, 'main.tsx')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['safari16', 'chrome110', 'firefox115', 'edge110'],
    jsx: 'automatic',
    write: false,
    legalComments: 'none',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_ID__: JSON.stringify(new Date().toISOString()),
      __SUPABASE_URL__: JSON.stringify(supabaseUrl),
      __SUPABASE_ANON_KEY__: JSON.stringify(supabaseKey),
      'process.env.NODE_ENV': '"production"',
    },
    logLevel: 'warning',
  });
  const jsCode = js.outputFiles[0].text;
  const cssCode = await buildCss();
  const jsHash = hash(jsCode);
  const cssHash = hash(cssCode);
  fs.writeFileSync(path.join(DIST, 'app.js'), jsCode);
  fs.writeFileSync(path.join(DIST, 'app.css'), cssCode);

  for (const f of fs.readdirSync(PUBLIC)) fs.copyFileSync(path.join(PUBLIC, f), path.join(DIST, f));

  const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8')
    .replace('app.css', `app.css?v=${cssHash}`)
    .replace('app.js', `app.js?v=${jsHash}`)
    .replaceAll('%APP_VERSION%', pkg.version);
  fs.writeFileSync(path.join(DIST, 'index.html'), html);

  const assets = ['./', 'index.html', `app.js?v=${jsHash}`, `app.css?v=${cssHash}`,
    ...fs.readdirSync(PUBLIC).filter((f) => f !== 'sw.js')];
  const cacheName = `berezhno-${pkg.version}-${hash(jsHash + cssHash + assets.join())}`;
  const sw = fs.readFileSync(path.join(SRC, 'sw.template.js'), 'utf8')
    .replace('__CACHE__', cacheName)
    .replace('__ASSETS__', JSON.stringify(assets));
  fs.writeFileSync(path.join(DIST, 'sw.js'), sw);
  fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
  const kb = (n) => (n / 1024).toFixed(0) + ' КБ';
  console.log(`Готово за ${Date.now() - started} мс: app.js ${kb(jsCode.length)}, app.css ${kb(cssCode.length)}, кеш ${cacheName}`);
}

if (watch) {
  await buildAll();
  let timer = null;
  fs.watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildAll().catch((e) => console.error(e.message)), 150);
  });
  console.log('Слежу за изменениями в src/ …');
  void context;
} else {
  await buildAll();
}
