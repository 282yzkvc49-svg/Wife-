import { useState } from 'react';
import { LuCloud, LuFlower2, LuPill, LuSprout } from 'react-icons/lu';
import { HABIT_IDEAS } from '../data/seed';
import type { Habit } from '../data/types';
import { WEEKDAYS_SHORT, dayKey } from '../lib/date';
import { finishOnboarding, setModule } from '../store/actions';
import { Button, Card, Chip, Field, NumberInput, Note, Segmented, SwitchRow } from '../ui/kit';
import { CloudLogin } from '../ui/CloudLogin';

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [lastPeriod, setLastPeriod] = useState('');
  const [cycleLen, setCycleLen] = useState<number | undefined>(28);
  const [periodLen, setPeriodLen] = useState<number | undefined>(5);
  const [regularity, setRegularity] = useState<'regular' | 'irregular' | 'unknown'>('unknown');
  const [addSups, setAddSups] = useState(true);
  const [yogaDays, setYogaDays] = useState<number[]>([]);
  const [ideas, setIdeas] = useState<string[]>([]);
  const [honey, setHoney] = useState(false);
  const [login, setLogin] = useState(false);
  const today = dayKey();

  const steps = ['Знакомство', 'Цикл', 'Назначения', 'Движение', 'Привычки'];
  const next = () => setStep((s) => s + 1);
  const finish = () => {
    finishOnboarding(
      { name: name.trim(), yogaDays, modules: { honey } as any },
      {
        addSupplements: addSups,
        habitIdeas: HABIT_IDEAS.filter((i) => ideas.includes(i.key)).map((i) => i.habit as Habit),
        cycle: { avgCycle: cycleLen ?? 28, avgPeriod: periodLen ?? 5, regularity, useHistory: true },
        lastPeriod: lastPeriod && lastPeriod <= today ? lastPeriod : undefined,
      },
    );
    if (honey) setModule('honey', true);
    location.hash = '#/';
  };

  return (
    <div className="min-h-dvh px-4 py-8 app-header">
      <div className="max-w-lg mx-auto">
        {step > 0 && (
          <ol className="flex gap-1.5 mb-6" aria-label="Шаги настройки">
            {steps.map((s, i) => <li key={s} className="flex-1 h-1.5 rounded-full" style={{ background: i < step ? 'var(--color-mint-ink)' : 'var(--color-line)' }} aria-label={`${s}${i === step - 1 ? ' — сейчас' : ''}`} />)}
          </ol>
        )}

        {step === 0 && !login && (
          <div className="pt-6">
            <div className="inline-grid place-items-center w-16 h-16 rounded-[1.4rem] bg-mint text-mint-ink mb-5"><LuSprout size={32} aria-hidden /></div>
            <h1 className="text-4xl font-bold leading-tight">Бережно</h1>
            <p className="text-lg mt-3 text-ink-soft measure">Мягкая подготовка к беременности: привычки, питание, движение и цикл — по чуть-чуть и под вашу реальную жизнь.</p>
            <ul className="mt-6 space-y-2.5 text-[15px]">
              <li>Пропущенное не превращается в долг на завтра.</li>
              <li>В дни, когда мало сил, остаётся только главное.</li>
              <li>Приложение не ставит диагнозов и не назначает лечение — только помогает организовать то, что назначил врач.</li>
            </ul>
            <div className="grid gap-2 mt-8">
              <Button variant="primary" onClick={next}>Начать настройку</Button>
              <Button variant="ghost" icon={<LuCloud size={18} />} onClick={() => setLogin(true)}>Уже пользуюсь на другом устройстве</Button>
            </div>
            <p className="text-xs text-ink-soft mt-6">Настройка займёт 2 минуты. Любой шаг можно пропустить и вернуться позже.</p>
          </div>
        )}

        {step === 0 && login && (
          <Card petal>
            <h1 className="text-2xl font-semibold mb-2">Вход в облако</h1>
            <p className="text-sm text-ink-soft mb-4">После входа данные с другого устройства появятся здесь.</p>
            <CloudLogin />
            <Button variant="quiet" className="mt-3" onClick={() => setLogin(false)}>Назад</Button>
          </Card>
        )}

        {step === 1 && (
          <Card petal>
            <h1 className="text-2xl font-semibold">Как к вам обращаться?</h1>
            <p className="text-sm text-ink-soft mt-1 mb-4">Имя нужно только для приветствия.</p>
            <Field label="Имя"><input className="input" value={name} onChange={(e: any) => setName(e.target.value)} autoComplete="given-name" enterKeyHint="next" /></Field>
            <div className="flex justify-end gap-2 mt-6"><Button variant="quiet" onClick={next}>Пропустить</Button><Button variant="primary" onClick={next}>Дальше</Button></div>
          </Card>
        )}

        {step === 2 && (
          <Card petal>
            <div className="flex items-center gap-2 text-powder-ink mb-1"><LuFlower2 size={20} aria-hidden /><span className="font-medium">Цикл</span></div>
            <h1 className="text-2xl font-semibold">Данные цикла</h1>
            <p className="text-sm text-ink-soft mt-1 mb-4">Нужны для приблизительного прогноза. Всё можно изменить позже, неизвестное — пропустить.</p>
            <div className="grid gap-3">
              <Field label="Первый день последней менструации"><input className="input" type="date" max={today} value={lastPeriod} onChange={(e: any) => setLastPeriod(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Обычная длина цикла, дней"><NumberInput value={cycleLen} onChange={setCycleLen} min={18} max={50} /></Field>
                <Field label="Менструация, дней"><NumberInput value={periodLen} onChange={setPeriodLen} min={1} max={10} /></Field>
              </div>
              <div className="field"><span>Регулярность</span>
                <Segmented label="Регулярность" value={regularity} onChange={setRegularity} options={[{ value: 'regular', label: 'Регулярный' }, { value: 'irregular', label: 'Нерегулярный' }, { value: 'unknown', label: 'Не знаю' }]} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6"><Button variant="quiet" onClick={next}>Пропустить</Button><Button variant="primary" onClick={next}>Дальше</Button></div>
          </Card>
        )}

        {step === 3 && (
          <Card petal>
            <div className="flex items-center gap-2 text-lilac-ink mb-1"><LuPill size={20} aria-hidden /><span className="font-medium">Мои назначения</span></div>
            <h1 className="text-2xl font-semibold">Назначения врача</h1>
            <p className="text-sm text-ink-soft mt-1 mb-4">Добавить в список инозитол, фолиевую кислоту и витамин D? Дозировку, время и даты вы введёте сами — так, как назначил врач. Приложение их не придумывает и не меняет.</p>
            <SwitchRow title="Добавить три назначения" checked={addSups} onChange={setAddSups} />
            <div className="flex justify-end gap-2 mt-6"><Button variant="primary" onClick={next}>Дальше</Button></div>
          </Card>
        )}

        {step === 4 && (
          <Card petal>
            <h1 className="text-2xl font-semibold">Йога дважды в неделю</h1>
            <p className="text-sm text-ink-soft mt-1 mb-4">Выберите два удобных дня для занятий по 20–25 минут. Переносить можно в любой момент; в дни менструации и при низкой энергии йога не планируется.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Дни йоги">
              {WEEKDAYS_SHORT.map((d, i) => {
                const on = yogaDays.includes(i + 1);
                return <Chip key={d} on={on} onClick={() => setYogaDays(on ? yogaDays.filter((x) => x !== i + 1) : [...yogaDays, i + 1].slice(-3))}>{d}</Chip>;
              })}
            </div>
            <Note className="mt-4">Рабочие дни у вас плавающие — отметите их вручную в «Рабочем графике». В эти дни будут короткие разминки для шеи, плеч и глаз.</Note>
            <div className="flex justify-end gap-2 mt-6"><Button variant="quiet" onClick={next}>Позже</Button><Button variant="primary" onClick={next}>Дальше</Button></div>
          </Card>
        )}

        {step === 5 && (
          <Card petal>
            <h1 className="text-2xl font-semibold">Привычки — по одной</h1>
            <p className="text-sm text-ink-soft mt-1">Тёплая вода утром уже есть — это ваша привычка. Можно добавить ещё одну-две, но не обязательно.</p>
            <div className="grid gap-2 mt-4">
              {HABIT_IDEAS.slice(0, 6).map((i) => {
                const on = ideas.includes(i.key);
                return (
                  <button key={i.key} type="button" aria-pressed={on}
                    onClick={() => setIdeas(on ? ideas.filter((x) => x !== i.key) : ideas.length >= 2 ? [ideas[1], i.key] : [...ideas, i.key])}
                    className={`text-left surface px-4 py-3 ${on ? 'tint-mint' : ''}`}>
                    <div className="font-medium">{i.habit.title}</div>
                    <div className="text-sm text-ink-soft">{i.why}</div>
                  </button>
                );
              })}
            </div>
            <SwitchRow title="Ложка мёда утром" hint="Необязательная привычка; доказанного влияния на фертильность нет." checked={honey} onChange={setHoney} />
            <div className="flex justify-end gap-2 mt-6"><Button variant="primary" onClick={finish}>Готово</Button></div>
          </Card>
        )}
      </div>
    </div>
  );
}
