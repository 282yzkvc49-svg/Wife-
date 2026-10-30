import { useEffect, useRef, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuPause, LuPlay, LuRotateCcw } from 'react-icons/lu';
import { SAFETY_NOTE, routineSeconds, type Routine } from '../data/movement';
import { Button, Note, Sheet } from './kit';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/** Пошаговый плеер разминки или йоги с таймером. */
export function RoutinePlayer({ routine, open, onClose, onFinish, extraNote }: {
  routine: Routine | null; open: boolean; onClose: () => void; onFinish: (minutes: number, partial: boolean) => void; extraNote?: string;
}) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (routine && open) { setI(0); setLeft(routine.steps[0]?.sec ?? 0); setRunning(false); setElapsed(0); }
  }, [routine?.id, open]);

  useEffect(() => {
    if (!running) { if (tick.current) clearInterval(tick.current); return; }
    tick.current = setInterval(() => {
      setElapsed((e) => e + 1);
      setLeft((l) => l - 1);
    }, 1000);
    return () => { if (tick.current) clearInterval(tick.current); };
  }, [running]);

  useEffect(() => {
    if (!routine || left > 0 || !running) return;
    if (i < routine.steps.length - 1) {
      try { navigator.vibrate?.(120); } catch { /* нет вибрации */ }
      setI(i + 1); setLeft(routine.steps[i + 1].sec);
    } else { setRunning(false); }
  }, [left, running]);

  if (!routine) return null;
  const step = routine.steps[i];
  const total = routineSeconds(routine);
  const finished = i === routine.steps.length - 1 && left <= 0;
  const go = (n: number) => { const k = Math.max(0, Math.min(routine.steps.length - 1, n)); setI(k); setLeft(routine.steps[k].sec); };

  return (
    <Sheet open={open} onClose={onClose} title={routine.title}
      footer={<>
        <Button variant="ghost" onClick={() => { onFinish(Math.max(1, Math.round(elapsed / 60)), true); }}>Сделала часть</Button>
        <Button variant="primary" onClick={() => onFinish(Math.max(1, Math.round(Math.max(elapsed, finished ? total : elapsed) / 60)) || routine.minutes, false)}>Готово</Button>
      </>}>
      <p className="text-sm text-ink-soft -mt-2 mb-3">{routine.minutes} мин · {routine.focus} · уровень: {routine.level}</p>
      <ol className="flex gap-1 mb-4" aria-label="Шаги">
        {routine.steps.map((s, k) => (
          <li key={k} className="flex-1 h-1.5 rounded-full" style={{ background: k < i ? 'var(--color-mint-ink)' : k === i ? 'var(--color-mint-strong)' : 'var(--color-line)' }} aria-label={`${k + 1}. ${s.title}${k === i ? ' — сейчас' : ''}`} />
        ))}
      </ol>
      <div className="surface surface-petal tint-mint p-5 text-center">
        <div className="text-sm text-mint-ink font-medium">Шаг {i + 1} из {routine.steps.length}{step.bothSides ? ' · на обе стороны' : ''}</div>
        <h3 className="text-xl font-semibold mt-1">{step.title}</h3>
        {step.reps && <div className="text-sm mt-1">{step.reps}</div>}
        <div className="font-display text-5xl font-bold tabular my-4" aria-live="off">{fmt(left)}</div>
        <p className="text-left measure mx-auto">{step.how}</p>
        <div className="flex justify-center gap-2 mt-5">
          <Button variant="ghost" aria-label="Предыдущий шаг" icon={<LuChevronLeft size={20} />} onClick={() => go(i - 1)} disabled={i === 0} />
          <Button variant="primary" icon={running ? <LuPause size={18} /> : <LuPlay size={18} />} onClick={() => setRunning(!running)}>{running ? 'Пауза' : left <= 0 ? 'Ещё раз' : 'Старт'}</Button>
          <Button variant="ghost" aria-label="Начать шаг заново" icon={<LuRotateCcw size={18} />} onClick={() => setLeft(step.sec)} />
          <Button variant="ghost" aria-label="Следующий шаг" icon={<LuChevronRight size={20} />} onClick={() => go(i + 1)} disabled={i === routine.steps.length - 1} />
        </div>
      </div>
      {routine.warnings.length > 0 && (
        <ul className="mt-4 text-sm list-disc pl-5 space-y-1">{routine.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
      <Note tone="warn" className="mt-4">{SAFETY_NOTE}</Note>
      {extraNote && <Note className="mt-2">{extraNote}</Note>}
    </Sheet>
  );
}
