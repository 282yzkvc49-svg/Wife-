import { useState } from 'react';
import { LuExternalLink, LuPencil, LuPlus, LuStore, LuTrash2 } from 'react-icons/lu';
import { SNACK_IDEAS, STORES, type SnackIdea } from '../../data/seed';
import type { StoreProduct } from '../../data/types';
import { dayKey, fmtShort } from '../../lib/date';
import { uid } from '../../lib/id';
import { app } from '../../store/app';
import { useTable } from '../../store/hooks';
import { parseHash } from '../../app/router';
import { Button, Card, Chip, Field, Note, NumberInput, Segmented, Sheet, Switch, confirmAction } from '../../ui/kit';

type TypeF = 'light' | 'hearty' | 'sweet' | 'salty';
const TYPE_LABEL: Record<TypeF, string> = { light: 'лёгкий', hearty: 'сытный', sweet: 'сладкий', salty: 'солёный' };
const CAT_LABEL: Record<SnackIdea['category'], string> = { fruit: 'Фрукты', yogurt: 'Йогурты и творог', nuts: 'Орехи', bread: 'Хлебцы и хлеб', cheese: 'Сыр', sandwich: 'Сэндвичи', ready: 'Готовые салаты и блюда', other: 'Другое' };

export function SnacksTab() {
  const where0 = parseHash(location.hash).query.get('where');
  const [minutes, setMinutes] = useState<'any' | '2' | '5' | '15'>('any');
  const [type, setType] = useState<TypeF | null>(null);
  const [where, setWhere] = useState<'any' | 'store' | 'home' | 'travel'>((where0 as any) ?? 'any');
  const [store, setStore] = useState<'any' | 'vkusvill' | 'azbuka'>('any');
  const [fridge, setFridge] = useState(true);
  const [heat, setHeat] = useState(false);
  const products = useTable<StoreProduct>('store_products');
  const [edit, setEdit] = useState<{ id: string | null; p: StoreProduct } | null>(null);

  const fits = (x: { minutes: number; type: TypeF[]; needsFridge: boolean; needsHeat: boolean }) =>
    (minutes === 'any' || x.minutes <= Number(minutes)) && (!type || x.type.includes(type)) && (fridge || !x.needsFridge) && (heat || !x.needsHeat);
  const ideas = SNACK_IDEAS.filter((i) => fits(i) && (where === 'any' || i.where.includes(where)));
  const mine = products.filter((p) => fits(p.data) && (store === 'any' || p.data.store === store) && (where === 'any' || where === 'store' || where === 'travel'));

  return (
    <div className="grid gap-4">
      <Card tint="beige">
        <h2 className="text-lg font-semibold">Перекусить сейчас</h2>
        <p className="text-sm text-beige-ink mt-0.5">Перекус — нормальная часть дня. Его не нужно ничем «компенсировать».</p>
        <div className="grid gap-3 mt-3">
          <div className="field"><span>Сколько есть времени</span><Segmented label="Время" value={minutes} onChange={setMinutes} options={[{ value: 'any', label: 'Любое' }, { value: '2', label: '2 мин' }, { value: '5', label: '5 мин' }, { value: '15', label: '15 мин' }]} /></div>
          <div className="field"><span>Какой</span>
            <div className="flex flex-wrap gap-2">{(Object.keys(TYPE_LABEL) as TypeF[]).map((t) => <Chip key={t} on={type === t} onClick={() => setType(type === t ? null : t)}>{TYPE_LABEL[t]}</Chip>)}</div>
          </div>
          <div className="field"><span>Где</span><Segmented label="Где" value={where} onChange={setWhere} options={[{ value: 'any', label: 'Везде' }, { value: 'store', label: 'В магазине' }, { value: 'home', label: 'Дома' }, { value: 'travel', label: 'В дороге' }]} /></div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-3 min-h-11"><Switch checked={fridge} onChange={setFridge} label="Есть холодильник" /><span>Есть холодильник</span></label>
            <label className="flex items-center gap-3 min-h-11"><Switch checked={heat} onChange={setHeat} label="Можно разогреть" /><span>Можно разогреть</span></label>
          </div>
        </div>
      </Card>

      <div className="grid gap-2 md:grid-cols-2">
        {ideas.map((i) => (
          <Card key={i.id}>
            <div className="font-medium">{i.title}</div>
            <div className="text-sm text-ink-soft mt-0.5">{i.detail}</div>
            <div className="text-xs text-ink-soft mt-1.5">{CAT_LABEL[i.category]} · до {i.minutes} мин · {i.type.map((t) => TYPE_LABEL[t]).join(', ')}{i.needsHeat ? ' · нужен разогрев' : ''}</div>
          </Card>
        ))}
        {!ideas.length && <Card><p className="text-sm text-ink-soft">Под эти условия идей нет — попробуйте убрать один из фильтров.</p></Card>}
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold inline-flex items-center gap-2"><LuStore size={20} aria-hidden />Мои товары из магазинов</h2>
          <Button size="sm" variant="primary" icon={<LuPlus size={16} />} onClick={() => setEdit({ id: null, p: { name: '', store: 'vkusvill', category: 'other', type: ['light'], minutes: 2, needsFridge: false, needsHeat: false } })}>Товар</Button>
        </div>
        <div className="mt-2"><Segmented label="Магазин" value={store} onChange={setStore} options={[{ value: 'any', label: 'Все' }, { value: 'vkusvill', label: 'ВкусВилл' }, { value: 'azbuka', label: 'Азбука вкуса' }]} /></div>
        <Note className="mt-3">У магазинов нет открытого API, поэтому названия, цены и наличие не подгружаются автоматически. Добавляйте проверенные товары сами — с ценой и датой проверки. Приоритетный магазин — ВкусВилл рядом с работой{STORES[0].url ? <> (<a href={STORES[0].url} target="_blank" rel="noopener noreferrer" className="underline">сайт</a>)</> : null}.</Note>
        {mine.length === 0 && <p className="text-sm text-ink-soft mt-3">Пока пусто. Например: любимый йогурт, хлебцы или готовый салат из ВкусВилла.</p>}
        <ul className="divide-y divide-line mt-2">
          {mine.map((p) => (
            <li key={p.id} className="py-3 flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <div className="font-medium">{p.data.name}</div>
                <div className="text-sm text-ink-soft">
                  {[p.data.store === 'vkusvill' ? 'ВкусВилл' : p.data.store === 'azbuka' ? 'Азбука вкуса' : p.data.storeName || 'Другой магазин', p.data.pack, p.data.price ? `${p.data.price} ₽${p.data.checkedAt ? ` (проверено ${fmtShort(p.data.checkedAt)})` : ''}` : null,
                    p.data.available === 'yes' ? 'обычно в наличии' : p.data.available === 'no' ? 'бывает нет в наличии' : null].filter(Boolean).join(' · ')}
                </div>
                {p.data.composition && <div className="text-xs text-ink-soft mt-0.5">Состав: {p.data.composition}</div>}
                {p.data.url && <a className="text-sm underline inline-flex items-center gap-1 mt-1" href={p.data.url} target="_blank" rel="noopener noreferrer">Ссылка <LuExternalLink size={14} aria-hidden /></a>}
              </div>
              <Button size="sm" variant="quiet" aria-label={`Изменить: ${p.data.name}`} icon={<LuPencil size={16} />} onClick={() => setEdit({ id: p.id, p: p.data })} />
            </li>
          ))}
        </ul>
      </Card>
      {edit && <ProductSheet id={edit.id} initial={edit.p} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ProductSheet({ id, initial, onClose }: { id: string | null; initial: StoreProduct; onClose: () => void }) {
  const [p, setP] = useState<StoreProduct>(initial);
  const set = (x: Partial<StoreProduct>) => setP({ ...p, ...x });
  const urlOk = !p.url || /^https:\/\//.test(p.url);
  return (
    <Sheet open onClose={onClose} title={id ? 'Товар' : 'Новый товар'}
      footer={<>
        {id && <Button variant="danger" icon={<LuTrash2 size={16} />} onClick={() => { if (confirmAction('Удалить товар?')) { app.store.remove('store_products', id); onClose(); } }}>Удалить</Button>}
        <Button variant="primary" disabled={!p.name.trim() || !urlOk} onClick={() => { app.store.put<StoreProduct>('store_products', id ?? `prod-${uid()}`, { ...p, name: p.name.trim(), checkedAt: p.price && !p.checkedAt ? dayKey() : p.checkedAt }); onClose(); }}>Сохранить</Button>
      </>}>
      <div className="grid gap-3">
        <Field label="Название"><input className="input" value={p.name} onChange={(e: any) => set({ name: e.target.value })} /></Field>
        <div className="field"><span>Магазин</span><Segmented label="Магазин" value={p.store} onChange={(v) => set({ store: v })} options={[{ value: 'vkusvill', label: 'ВкусВилл' }, { value: 'azbuka', label: 'Азбука вкуса' }, { value: 'other', label: 'Другой' }]} /></div>
        {p.store === 'other' && <Field label="Какой магазин"><input className="input" value={p.storeName ?? ''} onChange={(e: any) => set({ storeName: e.target.value })} /></Field>}
        <div className="field"><span>Категория</span>
          <select className="input" value={p.category} onChange={(e: any) => set({ category: e.target.value })}>{Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="field"><span>Какой перекус</span><div className="flex flex-wrap gap-2">{(Object.keys(TYPE_LABEL) as TypeF[]).map((t) => <Chip key={t} on={p.type.includes(t)} onClick={() => set({ type: p.type.includes(t) ? p.type.filter((x) => x !== t) : [...p.type, t] })}>{TYPE_LABEL[t]}</Chip>)}</div></div>
        <div className="field"><span>Время</span><Segmented label="Время" value={String(p.minutes) as '2' | '5' | '15'} onChange={(v) => set({ minutes: Number(v) as 2 | 5 | 15 })} options={[{ value: '2', label: '2 мин' }, { value: '5', label: '5 мин' }, { value: '15', label: '15 мин' }]} /></div>
        <div className="flex flex-wrap gap-x-6"><label className="flex items-center gap-3 min-h-11"><Switch checked={p.needsFridge} onChange={(v) => set({ needsFridge: v })} label="Нужен холодильник" />Нужен холодильник</label>
          <label className="flex items-center gap-3 min-h-11"><Switch checked={p.needsHeat} onChange={(v) => set({ needsHeat: v })} label="Нужен разогрев" />Нужен разогрев</label></div>
        <p className="text-sm text-ink-soft">Необязательные поля — показываются, только если вы их заполнили и проверили:</p>
        <Field label="Состав"><textarea className="input" value={p.composition ?? ''} onChange={(e: any) => set({ composition: e.target.value || undefined })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Упаковка"><input className="input" value={p.pack ?? ''} onChange={(e: any) => set({ pack: e.target.value || undefined })} placeholder="250 г" /></Field>
          <Field label="Цена, ₽"><NumberInput value={p.price} onChange={(v) => set({ price: v, checkedAt: dayKey() })} min={0} /></Field>
        </div>
        <Field label="Ссылка" hint={urlOk ? undefined : 'Ссылка должна начинаться с https://'}><input className="input" value={p.url ?? ''} onChange={(e: any) => set({ url: e.target.value.trim() || undefined })} inputMode="url" autoCapitalize="off" placeholder="https://vkusvill.ru/…" /></Field>
        <div className="field"><span>Наличие</span><Segmented label="Наличие" value={p.available ?? 'unknown'} onChange={(v) => set({ available: v })} options={[{ value: 'unknown', label: 'Не знаю' }, { value: 'yes', label: 'Обычно есть' }, { value: 'no', label: 'Бывает нет' }]} /></div>
      </div>
    </Sheet>
  );
}
