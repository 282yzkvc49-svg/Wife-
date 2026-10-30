// Простые адаптивные SVG-графики. Значения подписаны — цвет не единственный носитель смысла.

export interface BarDatum { label: string; value: number; secondary?: number; title?: string }

export function BarChart({ data, height = 140, unit = '', primaryLabel, secondaryLabel, ariaLabel }: {
  data: BarDatum[]; height?: number; unit?: string; primaryLabel?: string; secondaryLabel?: string; ariaLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value + (d.secondary ?? 0)));
  const w = 100 / Math.max(1, data.length);
  const empty = data.every((d) => !d.value && !d.secondary);
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={ariaLabel} className="block overflow-visible">
        <line x1="0" x2="100" y1={height - 18} y2={height - 18} stroke="var(--color-line)" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const inner = height - 34;
          const h1 = (d.value / max) * inner;
          const h2 = ((d.secondary ?? 0) / max) * inner;
          const x = i * w + w * 0.18;
          const bw = w * 0.64;
          const yBase = height - 18;
          return (
            <g key={i}>
              <title>{d.title ?? `${d.label}: ${d.value}${unit}${d.secondary ? ` + ${d.secondary}` : ''}`}</title>
              {h1 > 0 && <rect x={x} y={yBase - h1} width={bw} height={h1} rx="1.2" fill="var(--color-mint-ink)" />}
              {h2 > 0 && <rect x={x} y={yBase - h1 - h2} width={bw} height={h2} rx="1.2" fill="var(--color-lilac-strong)" />}
            </g>
          );
        })}
      </svg>
      <div className="grid text-[11px] text-ink-soft tabular -mt-[18px]" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d, i) => <span key={i} className="text-center truncate">{d.label}</span>)}
      </div>
      <div className="grid text-[11px] font-semibold tabular" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} aria-hidden>
        {data.map((d, i) => <span key={i} className="text-center">{d.value + (d.secondary ?? 0) || ''}</span>)}
      </div>
      {(primaryLabel || secondaryLabel) && (
        <figcaption className="flex flex-wrap gap-4 mt-2 text-xs text-ink-soft">
          {primaryLabel && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--color-mint-ink)' }} />{primaryLabel}</span>}
          {secondaryLabel && <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: 'var(--color-lilac-strong)' }} />{secondaryLabel}</span>}
        </figcaption>
      )}
      {empty && <div className="text-xs text-ink-soft mt-1">Пока нет отметок за этот период — это не значит, что ничего не было.</div>}
    </figure>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label} className="h-2.5 rounded-full bg-mint overflow-hidden">
      <div className="h-full rounded-full bg-mint-ink" style={{ width: `${pct}%`, transition: 'width .3s ease' }} />
    </div>
  );
}
