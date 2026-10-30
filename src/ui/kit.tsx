import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LuX, LuCheck, LuInfo, LuTriangleAlert } from 'react-icons/lu';

export function cx(...a: Array<string | false | null | undefined>) { return a.filter(Boolean).join(' '); }

// ——— Карточка ———
export function Card({ children, className, tint, petal, as, id, ...rest }: { children: ReactNode; className?: string; tint?: 'mint' | 'powder' | 'lilac' | 'beige' | 'amber'; petal?: boolean; as?: string; id?: string; [k: string]: any }) {
  const Tag: any = as ?? 'section';
  return <Tag id={id} className={cx('surface p-4', petal && 'surface-petal p-5', tint && `tint-${tint}`, className)} {...rest}>{children}</Tag>;
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 id={id} className="text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

// ——— Кнопки ———
type BtnVariant = 'primary' | 'mint' | 'lilac' | 'powder' | 'beige' | 'ghost' | 'quiet' | 'danger';
export function Button({ children, variant = 'ghost', size, icon, className, ...rest }: { children?: ReactNode; variant?: BtnVariant; size?: 'sm'; icon?: ReactNode; className?: string; [k: string]: any }) {
  return (
    <button type="button" className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', !children && 'btn-icon', className)} {...rest}>
      {icon}{children}
    </button>
  );
}

// ——— Переключатель ———
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; id?: string }) {
  return <button type="button" id={id} role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />;
}

export function SwitchRow({ title, hint, checked, onChange }: { title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="font-medium">{title}</div>
        {hint && <div className="text-sm text-ink-soft mt-0.5">{hint}</div>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}

// ——— Чипы ———
export function Chip({ on, children, onClick, icon, className, ...rest }: { on?: boolean; children: ReactNode; onClick?: () => void; icon?: ReactNode; className?: string; [k: string]: any }) {
  return <button type="button" className={cx('chip', className)} aria-pressed={!!on} onClick={onClick} {...rest}>{icon}{children}</button>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap w-full sm:inline-flex sm:w-auto p-1 rounded-[1.4rem] bg-beige gap-1 max-w-full">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('flex-1 sm:flex-none min-w-0 min-h-9 px-2.5 sm:px-3.5 py-1 rounded-full text-sm font-semibold leading-tight text-center transition-colors', value === o.value ? 'bg-card text-ink shadow-sm' : 'text-beige-ink')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ——— Поля ———
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small className="text-xs text-ink-soft">{hint}</small>}
    </label>
  );
}

export function NumberInput({ value, onChange, min, max, step = 1, ...rest }: { value: number | undefined | null; onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number; [k: string]: any }) {
  const [txt, setTxt] = useState(value === undefined || value === null ? '' : String(value).replace('.', ','));
  useEffect(() => { setTxt(value === undefined || value === null ? '' : String(value).replace('.', ',')); }, [value]);
  return (
    <input className="input tabular" inputMode="decimal" value={txt} {...rest}
      onChange={(e: any) => {
        const t = e.target.value; setTxt(t);
        const n = parseFloat(t.replace(',', '.'));
        if (t.trim() === '') onChange(undefined);
        else if (!Number.isNaN(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
      }}
      step={step}
    />
  );
}

// ——— Нижний лист ———
export function Sheet({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => { e.preventDefault(); onClose(); };
    d.addEventListener('cancel', onCancel);
    return () => d.removeEventListener('cancel', onCancel);
  }, [onClose]);
  if (!open) return null;
  return (
    <dialog ref={ref} className={cx('sheet', wide && 'md:max-w-3xl')} aria-label={title}
      onClick={(e: any) => { if (e.target === ref.current) onClose(); }}>
      <div className="sheet-body">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold">{title}</h2>
          <Button variant="quiet" icon={<LuX size={22} />} aria-label="Закрыть" onClick={onClose} />
        </div>
        {children}
        {footer && <div className="flex flex-wrap gap-2 mt-5 justify-end">{footer}</div>}
      </div>
    </dialog>
  );
}

// ——— Кольцо прогресса ———
export function Ring({ value, total, size = 92, label }: { value: number; total: number; size?: number; label: string }) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const frac = total ? Math.min(1, value / total) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-mint)" strokeWidth="9" />
      {frac > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-mint-ink)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${c * frac} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .4s ease' }} />}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="font-display" style={{ fontSize: size * 0.24, fontWeight: 700, fill: 'var(--color-ink)' }}>
        {value}<tspan style={{ fontSize: size * 0.15, fill: 'var(--color-ink-soft)' }}>/{total}</tspan>
      </text>
    </svg>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4">
      {icon && <div className="inline-grid place-items-center w-14 h-14 rounded-full bg-lilac text-lilac-ink mb-3">{icon}</div>}
      <div className="font-semibold">{title}</div>
      {children && <div className="text-sm text-ink-soft mt-1 measure mx-auto">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Note({ children, tone = 'info', className }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok'; className?: string }) {
  const icon = tone === 'warn' ? <LuTriangleAlert size={18} aria-hidden /> : tone === 'ok' ? <LuCheck size={18} aria-hidden /> : <LuInfo size={18} aria-hidden />;
  return (
    <div className={cx('flex gap-2.5 items-start rounded-2xl px-3.5 py-3 text-sm', tone === 'warn' ? 'bg-amber text-amber-ink' : tone === 'ok' ? 'bg-mint text-mint-ink' : 'bg-lilac text-lilac-ink', className)}>
      <span className="mt-0.5 shrink-0">{icon}</span><div className="min-w-0">{children}</div>
    </div>
  );
}

// ——— Тосты ———
interface ToastAction { label: string; run: () => void }
interface ToastMsg { id: number; text: string; actions: ToastAction[]; tone?: 'ok' | 'warn' }
let toasts: ToastMsg[] = [];
const tl = new Set<() => void>();
let tid = 0;
export function toast(text: string, opts: { action?: ToastAction; actions?: ToastAction[]; tone?: ToastMsg['tone']; ms?: number } = {}) {
  const t: ToastMsg = { id: ++tid, text, actions: opts.actions ?? (opts.action ? [opts.action] : []), tone: opts.tone };
  toasts = [...toasts.slice(-2), t];
  tl.forEach((l) => l());
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l()); }, opts.ms ?? 4000);
}
export function Toasts() {
  const list = useSyncExternalStore((cb) => { tl.add(cb); return () => { tl.delete(cb); }; }, () => toasts);
  return (
    <div className="toast-wrap" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={cx('toast surface flex flex-wrap items-center gap-2 px-4 py-3 shadow-lg', t.tone === 'warn' && 'tint-amber')}>
          <span className="flex-1 text-sm min-w-[10rem]">{t.text}</span>
          {t.actions.map((a) => <Button key={a.label} size="sm" variant="lilac" onClick={() => { a.run(); toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l()); }}>{a.label}</Button>)}
        </div>
      ))}
    </div>
  );
}

export function confirmAction(text: string): boolean {
  try { return window.confirm(text); } catch { return true; }
}
