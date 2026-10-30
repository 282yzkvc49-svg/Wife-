import { useState } from 'react';
import { LuBookmark, LuChevronLeft, LuEyeOff, LuExternalLink, LuPlus, LuRotateCcw } from 'react-icons/lu';
import { ARTICLES, CATEGORY_LABEL, EVIDENCE_LABEL, type Article, type ArticleCategory, type Evidence } from '../data/articles';
import { HABIT_IDEAS } from '../data/seed';
import type { Habit, SavedArticle } from '../data/types';
import { dayKey, fmtDay } from '../lib/date';
import { saveHabit, setArticleState } from '../store/actions';
import { usePrefs, useTable } from '../store/hooks';
import { go } from '../app/router';
import { Button, Card, Chip, Empty, cx, toast } from '../ui/kit';

const EV_STYLE: Record<Evidence, { cls: string; bars: number }> = {
  strong: { cls: 'bg-mint text-mint-ink', bars: 4 },
  consensus: { cls: 'bg-lilac text-lilac-ink', bars: 3 },
  preliminary: { cls: 'bg-beige text-beige-ink', bars: 2 },
  insufficient: { cls: 'bg-amber text-amber-ink', bars: 1 },
};

export function EvidenceBadge({ e }: { e: Evidence }) {
  const s = EV_STYLE[e];
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', s.cls)}>
      <span className="inline-flex items-end gap-[2px]" aria-hidden>{[1, 2, 3, 4].map((b) => <i key={b} className="block w-[3px] rounded-sm" style={{ height: 3 + b * 2, background: b <= s.bars ? 'currentColor' : 'color-mix(in srgb, currentColor 25%, transparent)' }} />)}</span>
      {EVIDENCE_LABEL[e]}
    </span>
  );
}

export function Library({ open }: { open?: string }) {
  const prefs = usePrefs();
  const states = useTable<SavedArticle>('saved_articles');
  const habits = useTable<Habit>('habits');
  const st = new Map(states.map((s) => [s.data.articleId, s.data]));
  const [cat, setCat] = useState<ArticleCategory | 'saved' | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const pregnant = prefs.goal === 'pregnant';
  const sorted = [...ARTICLES].sort((a, b) => (pregnant ? Number(!!b.pregnancyFocus) - Number(!!a.pregnancyFocus) : 0));
  const visible = sorted.filter((a) => !st.get(a.id)?.hidden && (!cat || (cat === 'saved' ? st.get(a.id)?.saved : a.categories.includes(cat))));
  const hidden = sorted.filter((a) => st.get(a.id)?.hidden);

  if (open) {
    const a = ARTICLES.find((x) => x.id === open);
    if (!a) return <Empty title="Материал не найден" action={<Button onClick={() => go('library')}>К библиотеке</Button>} />;
    return <ArticleView a={a} state={st.get(a.id)} hasHabit={!!a.habitIdea && habits.some((h) => h.data.seed === a.habitIdea)} />;
  }

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Знания</h1>
        <p className="text-ink-soft mt-1 measure">Короткие материалы, пересказанные по проверенным источникам. У каждого — уровень доказательности, источник и дата проверки. Общие рекомендации не заменяют назначение врача.</p>
      </div>
      <div className="scroll-x -mx-4 px-4">
        <div className="flex gap-2 w-max">
          <Chip on={!cat} onClick={() => setCat(null)}>Все</Chip>
          <Chip on={cat === 'saved'} onClick={() => setCat('saved')} icon={<LuBookmark size={14} aria-hidden />}>Сохранённые</Chip>
          {(Object.keys(CATEGORY_LABEL) as ArticleCategory[]).filter((c) => ARTICLES.some((a) => a.categories.includes(c))).map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{CATEGORY_LABEL[c]}</Chip>)}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((a) => (
          <a key={a.id} href={`#/library/${a.id}`} className="surface p-4 no-underline text-ink block">
            <div className="flex items-start gap-2">
              <h2 className="text-lg font-semibold flex-1">{a.title}</h2>
              {st.get(a.id)?.saved && <LuBookmark size={18} className="text-lilac-ink fill-current shrink-0" aria-label="Сохранено" />}
            </div>
            <p className="text-sm text-ink-soft mt-1 line-clamp-3">{a.summary}</p>
            <div className="mt-2"><EvidenceBadge e={a.evidence} /></div>
          </a>
        ))}
        {!visible.length && <Card><p className="text-sm text-ink-soft">В этой подборке пока ничего нет.</p></Card>}
      </div>
      {hidden.length > 0 && (
        <div>
          <Button size="sm" variant="quiet" onClick={() => setShowHidden(!showHidden)}>Скрытые материалы ({hidden.length})</Button>
          {showHidden && <ul className="mt-2 grid gap-1">{hidden.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><span>{a.title}</span><Button size="sm" variant="quiet" icon={<LuRotateCcw size={14} />} onClick={() => setArticleState(a.id, { hidden: false })}>Вернуть</Button></li>)}</ul>}
        </div>
      )}
    </div>
  );
}

function ArticleView({ a, state, hasHabit }: { a: Article; state?: SavedArticle; hasHabit: boolean }) {
  const idea = a.habitIdea ? HABIT_IDEAS.find((h) => h.key === a.habitIdea) : undefined;
  return (
    <article className="grid gap-4 max-w-2xl">
      <div><Button variant="quiet" size="sm" icon={<LuChevronLeft size={18} />} onClick={() => go('library')}>Все материалы</Button></div>
      <div>
        <div className="text-sm text-ink-soft">{a.categories.map((c) => CATEGORY_LABEL[c]).join(' · ')}</div>
        <h1 className="text-3xl font-bold mt-1">{a.title}</h1>
        <div className="mt-2"><EvidenceBadge e={a.evidence} /></div>
      </div>
      <p className="text-[17px] leading-relaxed measure">{a.summary}</p>
      <Card tint="mint">
        <h2 className="font-semibold">Что можно сделать</h2>
        <p className="mt-1 mb-0">{a.practice}</p>
      </Card>
      <Card tint="beige">
        <h2 className="font-semibold">Ограничения</h2>
        <p className="mt-1 mb-0">{a.limits}</p>
      </Card>
      <div>
        <h2 className="font-semibold mb-1">Источники</h2>
        <ul className="grid gap-2">
          {a.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">{s.title}<LuExternalLink size={14} aria-hidden /></a>
              <div className="text-sm text-ink-soft">{s.publisher} · {s.published}</div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-ink-soft mt-2">Дата проверки материала: {fmtDay(a.checked, { year: true })}. Источники на английском языке; текст выше — краткий пересказ.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {idea && <Button variant="mint" icon={<LuPlus size={16} />} disabled={hasHabit} onClick={() => { saveHabit(`h-${idea.key}`, { ...idea.habit, startedAt: dayKey() }); toast('Привычка добавлена', { tone: 'ok' }); }}>{hasHabit ? 'Уже в привычках' : 'Добавить в привычки'}</Button>}
        <Button variant="lilac" icon={<LuBookmark size={16} />} onClick={() => setArticleState(a.id, { saved: !state?.saved })}>{state?.saved ? 'Убрать из сохранённых' : 'Сохранить'}</Button>
        <Button variant="quiet" icon={<LuEyeOff size={16} />} onClick={() => { setArticleState(a.id, { hidden: true }); go('library'); toast('Материал скрыт. Вернуть можно внизу библиотеки.'); }}>Не показывать</Button>
      </div>
      <p className="text-xs text-ink-soft">Приложение не ставит диагнозов, не назначает лечение и не обещает наступление беременности.</p>
    </article>
  );
}
