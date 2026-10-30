import type {
  ActivityLog, ContextKind, CycleSettings, DailyContext, DailyNote, DailyPlan, ExerciseLog, Feedback, Habit, HabitLog,
  HabitStatus, MealPlanItem, MealSlot, MenstrualEvent, OvulationTest, PantryItem, Prefs, Recipe, Reminder,
  SavedArticle, ShoppingList, ShoppingListItem, Supplement, SupplementLog, SymptomEntry, WorkDay, YogaSessionRec,
} from '../data/types';
import { BASE_HABITS, CYCLE_SETTINGS_ID, DEFAULT_CYCLE, PREFS_ID, PRESCRIBED, SEED_TS, defaultReminders } from '../data/seed';
import { FAVORITES, NEW_RECIPES } from '../data/recipes';
import { addDays, dayKey, type DayKey } from '../lib/date';
import { nowIso, uid } from '../lib/id';
import { habitLogId, yogaId } from '../lib/plan';
import { supplementReminderPlan } from '../lib/reminders';
import { supplementLogId } from '../lib/schedule';
import { genKey } from '../lib/shopping';
import { app } from './app';
import { getPrefs } from './hooks';

const S = () => app.store;

// ——— Настройки ———
export function savePrefs(partial: Partial<Prefs>) {
  const cur = getPrefs();
  const next = { ...cur, ...partial, modules: { ...cur.modules, ...(partial.modules ?? {}) }, mealTimes: { ...cur.mealTimes, ...(partial.mealTimes ?? {}) } };
  S().put<Prefs>('user_preferences', PREFS_ID, next);
  return next;
}

export function setModule(key: keyof Prefs['modules'], on: boolean) {
  savePrefs({ modules: { ...getPrefs().modules, [key]: on } });
  if (key === 'honey') {
    const h = S().get<Habit>('habits', 'h-honey');
    if (h) S().put<Habit>('habits', 'h-honey', { ...h, status: on ? 'active' : 'paused' });
  }
}

/** Завершение онбординга: создаём встроенные записи с «ранней» датой, чтобы правки с других устройств побеждали. */
export function finishOnboarding(p: Partial<Prefs>, opts: { addSupplements: boolean; habitIdeas: Habit[]; cycle?: Partial<CycleSettings>; lastPeriod?: DayKey }) {
  const store = S();
  for (const { id, habit } of BASE_HABITS) if (!store.rec('habits', id)) store.put('habits', id, habit, { updatedAt: SEED_TS });
  for (const { id, recipe } of [...FAVORITES, ...NEW_RECIPES]) if (!store.rec('recipes', id)) store.put('recipes', id, recipe, { updatedAt: SEED_TS });
  if (opts.addSupplements) for (const { id, s } of PRESCRIBED) if (!store.rec('supplements', id)) store.put('supplements', id, s, { updatedAt: SEED_TS });
  const today = dayKey();
  opts.habitIdeas.forEach((h, i) => store.put<Habit>('habits', `h-${h.seed ?? uid()}`, { ...h, startedAt: today, order: 10 + i }));
  if (opts.cycle) store.put<CycleSettings>('menstrual_cycles', CYCLE_SETTINGS_ID, { ...DEFAULT_CYCLE, ...opts.cycle });
  if (opts.lastPeriod) addPeriod(opts.lastPeriod);
  const prefs = savePrefs({ ...p, onboarded: true, onboardedAt: nowIso(), startDate: p.startDate ?? today });
  for (const { id, r } of defaultReminders(prefs)) if (!store.rec('reminders', id)) store.put('reminders', id, r, { updatedAt: SEED_TS });
  syncSupplementReminders();
}

// ——— День ———
export function getDay(date: DayKey): DailyPlan {
  return S().get<DailyPlan>('daily_plans', `day:${date}`) ?? { date, water: 0, produce: [], hidden: [], skipped: [], done: {} };
}
function putDay(d: DailyPlan) { S().put<DailyPlan>('daily_plans', `day:${d.date}`, d); }

export function setItemDone(date: DayKey, key: string, v: 'full' | 'min' | null) {
  const d = getDay(date);
  const done = { ...d.done };
  if (v) done[key] = v; else delete done[key];
  putDay({ ...d, done, skipped: d.skipped.filter((k) => k !== key) });
}
export function skipItem(date: DayKey, key: string, skip = true) {
  const d = getDay(date);
  const done = { ...d.done }; delete done[key];
  putDay({ ...d, done, skipped: skip ? [...new Set([...d.skipped, key])] : d.skipped.filter((k) => k !== key) });
}
export function hideItem(date: DayKey, key: string, hide = true) {
  const d = getDay(date);
  putDay({ ...d, hidden: hide ? [...new Set([...d.hidden, key])] : d.hidden.filter((k) => k !== key) });
}
export function unhideAll(date: DayKey) { const d = getDay(date); putDay({ ...d, hidden: [] }); }
export function setWater(date: DayKey, n: number) { const d = getDay(date); putDay({ ...d, water: Math.max(0, n) }); }
export function addProduce(date: DayKey, name: string, kind: 'fruit' | 'veg') {
  const d = getDay(date);
  putDay({ ...d, produce: [...d.produce, { name, kind, at: nowIso() }] });
}
export function removeProduce(date: DayKey, index: number) {
  const d = getDay(date);
  putDay({ ...d, produce: d.produce.filter((_, i) => i !== index) });
}

export function getContext(date: DayKey): DailyContext {
  return S().get<DailyContext>('daily_context', `ctx:${date}`) ?? { date, contexts: [], dismissedAuto: [], wakeShiftMin: 0, muteReminders: false };
}
export function saveContext(date: DayKey, partial: Partial<DailyContext>) {
  S().put<DailyContext>('daily_context', `ctx:${date}`, { ...getContext(date), ...partial, date });
}
export function toggleContext(date: DayKey, k: ContextKind, auto: ContextKind[]) {
  const c = getContext(date);
  const active = new Set(c.contexts);
  const dismissed = new Set(c.dismissedAuto);
  const isOn = active.has(k) || (auto.includes(k) && !dismissed.has(k));
  if (isOn) { active.delete(k); if (auto.includes(k)) dismissed.add(k); }
  else { active.add(k); dismissed.delete(k); }
  if (k === 'normal') { active.clear(); for (const a of auto) dismissed.add(a); }
  const patch: Partial<DailyContext> = { contexts: [...active].filter((x) => x !== 'normal'), dismissedAuto: [...dismissed] };
  if ((k === 'lateWake' || k === 'badSleep') && !isOn && !c.wakeShiftMin) patch.wakeShiftMin = 120;
  if (k === 'travel' && isOn) patch.muteReminders = false;
  saveContext(date, patch);
}

// ——— Привычки ———
export function setHabitStatus(habitId: string, date: DayKey, status: HabitStatus | null, movedTo?: DayKey) {
  const id = habitLogId(habitId, date);
  if (!status) { S().remove('habit_logs', id); return; }
  S().put<HabitLog>('habit_logs', id, { habitId, date, status, movedTo, at: nowIso() });
}
export function saveHabit(id: string | null, h: Habit): string {
  const hid = id ?? `h-${uid()}`;
  S().put<Habit>('habits', hid, h);
  return hid;
}
export function deleteHabit(id: string) { S().remove('habits', id); }

// ——— Назначения ———
export function setSupplementStatus(supId: string, date: DayKey, time: string, status: 'taken' | 'skipped' | null) {
  const id = supplementLogId(supId, date, time);
  if (!status) { S().remove('supplement_logs', id); return; }
  S().put<SupplementLog>('supplement_logs', id, { supplementId: supId, date, time: time || 'any', status, at: nowIso() });
}
export function saveSupplement(id: string | null, s: Supplement): string {
  const sid = id ?? `sup-${uid()}`;
  S().put<Supplement>('supplements', sid, s);
  syncSupplementReminders();
  return sid;
}
export function deleteSupplement(id: string) { S().remove('supplements', id); syncSupplementReminders(); }
export function syncSupplementReminders() {
  const sups = S().all<Supplement>('supplements');
  const rems = S().all<Reminder>('reminders');
  const plan = supplementReminderPlan(sups, rems);
  for (const [id, r] of plan.upsert) S().put<Reminder>('reminders', id, r);
  for (const id of plan.remove) S().remove('reminders', id);
}

// ——— Цикл ———
export function addPeriod(start: DayKey, end?: DayKey): string {
  const id = `period:${start}`;
  S().put<MenstrualEvent>('menstrual_events', id, { type: 'period', start, end });
  return id;
}
export function updatePeriod(id: string, start: DayKey, end?: DayKey) {
  const newId = `period:${start}`;
  if (newId !== id) S().remove('menstrual_events', id);
  S().put<MenstrualEvent>('menstrual_events', newId, { type: 'period', start, end });
}
export function deleteEvent(id: string) { S().remove('menstrual_events', id); }
export function addPregnancyTest(date: DayKey, result: 'positive' | 'negative' | 'unclear') {
  S().put<MenstrualEvent>('menstrual_events', `ptest:${date}:${uid().slice(0, 6)}`, { type: 'pregnancy_test', date, result });
}
export function saveCycleSettings(partial: Partial<CycleSettings>) {
  const cur = S().get<CycleSettings>('menstrual_cycles', CYCLE_SETTINGS_ID) ?? DEFAULT_CYCLE;
  S().put<CycleSettings>('menstrual_cycles', CYCLE_SETTINGS_ID, { ...DEFAULT_CYCLE, ...cur, ...partial });
}
export function emptySymptoms(date: DayKey): SymptomEntry { return { date, pelvicPain: 0, backPain: 0, energy: 0, wellbeing: 0, pms: false, other: [], note: '' }; }
export function saveSymptoms(date: DayKey, partial: Partial<SymptomEntry>) {
  const cur = S().get<SymptomEntry>('symptoms', `sym:${date}`) ?? emptySymptoms(date);
  S().put<SymptomEntry>('symptoms', `sym:${date}`, { ...cur, ...partial, date });
}
export function saveOvulationTest(id: string | null, t: OvulationTest) { S().put<OvulationTest>('ovulation_tests', id ?? `ot-${uid()}`, t); }
export function deleteOvulationTest(id: string) { S().remove('ovulation_tests', id); }

// ——— Движение ———
export function moveYoga(from: DayKey, to: DayKey, sessionId: string) {
  S().put<YogaSessionRec>('yoga_sessions', yogaId(from), { date: from, sessionId, status: 'moved', movedTo: to });
  S().put<YogaSessionRec>('yoga_sessions', yogaId(to), { date: to, sessionId, status: 'planned', movedFrom: from });
}
export function setYoga(date: DayKey, status: YogaSessionRec['status'] | null, sessionId: string, minutes?: number) {
  const id = yogaId(date);
  const prev = S().get<YogaSessionRec>('yoga_sessions', id);
  if (!status) {
    if (prev?.movedFrom) S().put<YogaSessionRec>('yoga_sessions', id, { ...prev, status: 'planned', minutes: undefined });
    else S().remove('yoga_sessions', id);
    return;
  }
  S().put<YogaSessionRec>('yoga_sessions', id, { ...(prev ?? {}), date, sessionId, status, minutes });
}
export function planExtraYoga(date: DayKey, sessionId: string) {
  S().put<YogaSessionRec>('yoga_sessions', yogaId(date), { date, sessionId, status: 'planned' });
}
export function logExercise(date: DayKey, routineId: string, minutes: number, partial = false) {
  S().put<ExerciseLog>('exercise_logs', `ex-${uid()}`, { date, routineId, minutes, at: nowIso(), partial });
}
export function saveActivity(id: string | null, a: ActivityLog) { S().put<ActivityLog>('activity_logs', id ?? `act-${uid()}`, a); }
export function deleteActivity(id: string) { S().remove('activity_logs', id); }
export function setWorkDay(date: DayKey, w: Omit<WorkDay, 'date'> | null) {
  const id = `work:${date}`;
  if (!w) { S().remove('work_calendar', id); return; }
  S().put<WorkDay>('work_calendar', id, { ...w, date });
}

// ——— Рецепты и меню ———
export function saveRecipe(id: string | null, r: Recipe): string { const rid = id ?? `r-${uid()}`; S().put<Recipe>('recipes', rid, r); return rid; }
export function deleteRecipe(id: string) { S().remove('recipes', id); }
export function setMeal(id: string | null, item: MealPlanItem): string {
  const mid = id ?? `meal-${item.date}-${item.slot}-${uid().slice(0, 8)}`;
  S().put<MealPlanItem>('meal_plan_items', mid, item);
  return mid;
}
export function deleteMeal(id: string) { S().remove('meal_plan_items', id); }
export function copyMenu(fromStart: DayKey, toStart: DayKey, days: number) {
  const items = S().all<MealPlanItem>('meal_plan_items');
  let n = 0;
  for (const { data } of items) {
    if (data.date < fromStart || data.date > addDays(fromStart, days - 1)) continue;
    const offset = (Date.parse(data.date) - Date.parse(fromStart)) / 86400000;
    setMeal(null, { ...data, date: addDays(toStart, Math.round(offset)), eaten: undefined, rating: undefined, leftovers: undefined });
    n++;
  }
  return n;
}
export function moveMeal(id: string, date: DayKey, slot: MealSlot) {
  const cur = S().get<MealPlanItem>('meal_plan_items', id);
  if (cur) S().put<MealPlanItem>('meal_plan_items', id, { ...cur, date, slot });
}

// ——— Покупки ———
export function ensureList(from: DayKey, to: DayKey): string {
  const id = `list:${from}:${to}`;
  if (!S().get('shopping_lists', id)) S().put<ShoppingList>('shopping_lists', id, { title: `Покупки ${from} — ${to}`, from, to });
  return id;
}
export function toggleGenLine(listId: string, name: string, checked: boolean, amount: number) {
  const key = genKey(listId, name);
  const id = `sli:${key}`;
  const cur = S().get<ShoppingListItem>('shopping_list_items', id);
  S().put<ShoppingListItem>('shopping_list_items', id, { ...(cur ?? { listId, key, source: 'gen' }), listId, key, source: 'gen', checked, checkedAmount: checked ? amount : undefined, removed: false });
}
export function removeGenLine(listId: string, name: string, removed = true) {
  const key = genKey(listId, name);
  const id = `sli:${key}`;
  const cur = S().get<ShoppingListItem>('shopping_list_items', id);
  S().put<ShoppingListItem>('shopping_list_items', id, { ...(cur ?? { listId, key, source: 'gen', checked: false }), listId, key, source: 'gen', checked: cur?.checked ?? false, removed });
}
export function addManualItem(listId: string, name: string, amount?: number, unit?: string) {
  const id = `sli:m:${uid()}`;
  S().put<ShoppingListItem>('shopping_list_items', id, { listId, key: id, source: 'manual', name, amount, unit, checked: false });
}
export function toggleManual(id: string, checked: boolean) {
  const cur = S().get<ShoppingListItem>('shopping_list_items', id);
  if (cur) S().put<ShoppingListItem>('shopping_list_items', id, { ...cur, checked });
}
export function deleteManual(id: string) { S().remove('shopping_list_items', id); }
export function savePantry(id: string | null, p: PantryItem) { S().put<PantryItem>('pantry_items', id ?? `pan-${uid()}`, p); }
export function deletePantry(id: string) { S().remove('pantry_items', id); }

// ——— Напоминания ———
export function saveReminder(id: string | null, r: Reminder) { S().put<Reminder>('reminders', id ?? `rem-${uid()}`, r); }
export function deleteReminder(id: string) { S().remove('reminders', id); }
export function snoozeReminder(id: string, minutes = 15) {
  const r = S().get<Reminder>('reminders', id);
  if (r) S().put<Reminder>('reminders', id, { ...r, snoozedUntil: new Date(Date.now() + minutes * 60000).toISOString() });
}

// ——— Прочее ———
export function saveNote(date: DayKey, text: string) {
  const id = `note:${date}`;
  if (!text.trim()) { S().remove('daily_notes', id); return; }
  S().put<DailyNote>('daily_notes', id, { date, text });
}
export function setArticleState(articleId: string, partial: Partial<SavedArticle>) {
  const id = `art:${articleId}`;
  const cur = S().get<SavedArticle>('saved_articles', id) ?? { articleId, saved: false, hidden: false };
  S().put<SavedArticle>('saved_articles', id, { ...cur, ...partial });
}
export function hideRecommendation(key: string) {
  S().put<Feedback>('user_feedback', `hide:${key}`, { kind: 'hide-reco', key, date: dayKey() });
}
export function unhideRecommendation(key: string) { S().remove('user_feedback', `hide:${key}`); }
export function isRecoHidden(key: string) { return !!S().get('user_feedback', `hide:${key}`); }
export function addFeedback(text: string) { S().put<Feedback>('user_feedback', `fb-${uid()}`, { kind: 'note', key: 'note', text, date: dayKey() }); }
