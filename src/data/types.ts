import type { DayKey } from '../lib/date';

/** Все синхронизируемые таблицы. Названия совпадают с таблицами в Supabase. */
export const TABLES = [
  'user_preferences', 'habits', 'habit_logs', 'daily_plans', 'daily_context',
  'supplements', 'supplement_logs', 'recipes', 'meal_plans', 'meal_plan_items',
  'shopping_lists', 'shopping_list_items', 'pantry_items', 'menstrual_cycles', 'menstrual_events',
  'symptoms', 'ovulation_tests', 'yoga_sessions', 'exercise_library', 'exercise_logs',
  'activity_logs', 'work_calendar', 'reminders', 'saved_articles', 'user_feedback', 'daily_notes', 'store_products',
] as const;
export type TableName = typeof TABLES[number];

/** Запись в локальном хранилище (конверт) */
export interface StoredRecord<T = any> {
  t: TableName;
  id: string;
  data: T;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** 1 — изменение ещё не отправлено в облако */
  dirty: 0 | 1;
  server_updated_at?: string | null;
}

// ——— Настройки ———
export type Goal = 'preparing' | 'pregnant' | 'maintain';
export interface Modules {
  cycle: boolean;
  ovulationTests: boolean;
  supplements: boolean;
  yoga: boolean;
  warmups: boolean;
  nutrition: boolean;
  snacks: boolean;
  library: boolean;
  honey: boolean;
  water: boolean;
  produce: boolean;
  newHabitHints: boolean;
}
export interface Prefs {
  name: string;
  goal: Goal;
  startDate: DayKey;
  onboarded: boolean;
  onboardedAt?: string;
  modules: Modules;
  /** дни недели для йоги, 1=Пн…7=Вс */
  yogaDays: number[];
  yogaTime: string;
  workStart: string;
  workEnd: string;
  /** время пятиминутных перерывов в рабочие дни */
  warmupTimes: string[];
  mealTimes: { breakfast: string; lunch: string; dinner: string; snack: string };
  menuHorizon: 7 | 14;
  waterGoal: number | null;
  timeZone: string;
  testsTotal: number;
  /** после первого месяца — продолжать только календарный прогноз */
  testsAfterFirstMonth: 'calendar' | 'tests';
  calendarHideMedNames: boolean;
  yearPlanChecks: Record<string, boolean>;
  hiddenCalendarCategories: string[];
  defaultContexts: ContextKind[];
  /** продукты, которые исключаются из подбора (не любит) */
  excludedFoods: string[];
  /** продукты, которые лучше ограничить (например, лимон из-за изжоги) */
  limitFoods: string[];
}

// ——— Привычки ———
export type HabitSchedule = { kind: 'daily' } | { kind: 'weekdays'; days: number[] } | { kind: 'workdays' } | { kind: 'offdays' };
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'any';
export interface Habit {
  title: string;
  fullVersion: string;
  minVersion: string;
  icon: string;
  schedule: HabitSchedule;
  timeOfDay: TimeOfDay;
  time?: string;
  /** важная привычка остаётся в плане даже в режиме «мало сил» */
  core: boolean;
  status: 'active' | 'paused';
  optional?: boolean;
  /** связанная привычка («после тёплой воды»), не обязательная последовательность */
  anchor?: string;
  note?: string;
  order: number;
  startedAt: DayKey;
  /** ключ встроенной привычки или идеи */
  seed?: string;
}
export type HabitStatus = 'full' | 'min' | 'skipped' | 'moved';
export interface HabitLog { habitId: string; date: DayKey; status: HabitStatus; movedTo?: DayKey; at: string }

// ——— День ———
export type ContextKind = 'normal' | 'busy' | 'travel' | 'lowEnergy' | 'lateWake' | 'badSleep' | 'pms' | 'period1' | 'period2' | 'rest';
export interface DailyContext {
  date: DayKey;
  contexts: ContextKind[];
  /** автоматически предложенные контексты, которые пользователь снял */
  dismissedAuto: ContextKind[];
  wakeShiftMin: number;
  muteReminders: boolean;
  /** «Всё равно сделаю»: разрешение на тренировку в разъездах/при низкой энергии */
  allowWorkout?: boolean;
}
export interface ProduceEntry { name: string; kind: 'fruit' | 'veg'; at: string }
export interface DailyPlan {
  date: DayKey;
  water: number;
  produce: ProduceEntry[];
  /** пункты плана, скрытые на сегодня */
  hidden: string[];
  /** пункты плана, пропущенные сегодня (без долга) */
  skipped: string[];
  /** пункты, выполненные: ключ → full|min */
  done: Record<string, 'full' | 'min'>;
}

// ——— Назначения ———
export interface Supplement {
  name: string;
  dose: string;
  unit: string;
  times: string[];
  frequency: 'daily' | 'weekdays' | 'custom';
  days?: number[];
  startDate?: DayKey;
  endDate?: DayKey;
  comment: string;
  source: string;
  /** состав (компоненты) — для предупреждения о дублировании */
  components: string[];
  active: boolean;
  order: number;
}
export interface SupplementLog { supplementId: string; date: DayKey; time: string; status: 'taken' | 'skipped'; at: string }

// ——— Рецепты и меню ———
export type RecipeKind = 'favorite' | 'new';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export interface Ingredient {
  name: string;
  /** только для новых рецептов (тип B) или если пользователь указал */
  amount?: number;
  unit?: 'г' | 'мл' | 'шт' | 'ст. л.' | 'ч. л.' | 'зубч.' | 'пучок' | string;
  /** «по вкусу», «немного», «на глаз» */
  note?: string;
  category?: ShopCategory;
  optional?: boolean;
}
export interface Recipe {
  kind: RecipeKind;
  title: string;
  slots: MealSlot[];
  ingredients: Ingredient[];
  steps: string[];
  equipment: string[];
  servings?: number;
  prepMin?: number;
  cookMin?: number;
  pairings?: string;
  comment?: string;
  rating?: number;
  tags: FoodTag[];
  substitutions?: string;
  pinned?: boolean;
  archived?: boolean;
  seed?: string;
}
export type FoodTag = 'veg' | 'fruit' | 'legumes' | 'wholegrain' | 'grain' | 'fish' | 'seafood' | 'poultry' | 'redmeat' | 'eggs' | 'dairy' | 'nuts' | 'healthyfat' | 'sweet';
export interface MealPlan { title: string; start: DayKey; days: 7 | 14; note?: string }
export interface MealPlanItem {
  date: DayKey;
  slot: MealSlot;
  recipeId?: string;
  text?: string;
  servings: number;
  eaten?: boolean;
  leftovers?: boolean;
  rating?: number;
  note?: string;
  planId?: string;
}

// ——— Покупки ———
export type ShopCategory = 'veg' | 'meat' | 'dairy' | 'grocery' | 'bread' | 'sauces' | 'frozen' | 'other';
export interface ShoppingList { title: string; from: DayKey; to: DayKey }
export interface ShoppingListItem {
  listId: string;
  /** ключ позиции, вычисленной из меню (gen) или ручная позиция (manual) */
  key: string;
  source: 'gen' | 'manual';
  name?: string;
  amount?: number;
  unit?: string;
  category?: ShopCategory;
  checked: boolean;
  checkedAmount?: number;
  removed?: boolean;
}
export interface PantryItem { name: string; amount?: number; unit?: string; enough: boolean; category?: ShopCategory }

// ——— Цикл ———
export interface CycleSettings {
  avgCycle: number;
  avgPeriod: number;
  regularity: 'regular' | 'irregular' | 'unknown';
  useHistory: boolean;
}
export type MenstrualEvent =
  | { type: 'period'; start: DayKey; end?: DayKey; note?: string }
  | { type: 'pregnancy_test'; date: DayKey; result: 'positive' | 'negative' | 'unclear'; note?: string };
export interface SymptomEntry {
  date: DayKey;
  pelvicPain: 0 | 1 | 2 | 3;
  backPain: 0 | 1 | 2 | 3;
  energy: 0 | 1 | 2 | 3 | 4 | 5;
  wellbeing: 0 | 1 | 2 | 3 | 4 | 5;
  pms: boolean;
  other: string[];
  note: string;
}
export interface OvulationTest {
  date: DayKey;
  time: string;
  maker: string;
  result: 'negative' | 'positive' | 'unclear';
  photo?: string;
  note?: string;
}

// ——— Движение ———
export interface YogaSessionRec {
  date: DayKey;
  sessionId: string;
  status: 'planned' | 'done' | 'min' | 'skipped' | 'moved';
  movedTo?: DayKey;
  movedFrom?: DayKey;
  minutes?: number;
}
export interface CustomExercise { title: string; kind: 'yoga' | 'warmup' | 'video'; url?: string; minutes?: number; free?: boolean; note?: string; favorite?: boolean }
export interface ExerciseLog { date: DayKey; routineId: string; minutes: number; at: string; partial?: boolean }
export interface ActivityLog { date: DayKey; type: 'steps' | 'walk' | 'workout' | 'other'; steps?: number; minutes?: number; note?: string; source: 'manual' }
export interface WorkDay { date: DayKey; status: 'office' | 'remote' | 'trip' | 'off'; start?: string; end?: string; note?: string }

// ——— Напоминания ———
export type ReminderKind = 'water' | 'supplement' | 'produce' | 'meal' | 'yoga' | 'warmup' | 'menu' | 'shopping' | 'tests' | 'custom';
export interface Reminder {
  kind: ReminderKind;
  title: string;
  time: string;
  /** daily | workdays | yogaDays | список дней недели */
  repeat: { kind: 'daily' } | { kind: 'workdays' } | { kind: 'yogaDays' } | { kind: 'weekdays'; days: number[] };
  enabled: boolean;
  refId?: string;
  snoozedUntil?: string;
}

export interface StoreProduct {
  name: string;
  store: 'vkusvill' | 'azbuka' | 'other';
  storeName?: string;
  category: 'fruit' | 'yogurt' | 'nuts' | 'bread' | 'cheese' | 'sandwich' | 'ready' | 'other';
  composition?: string;
  pack?: string;
  price?: number;
  url?: string;
  available?: 'yes' | 'no' | 'unknown';
  checkedAt?: DayKey;
  type: Array<'light' | 'hearty' | 'sweet' | 'salty'>;
  minutes: 2 | 5 | 15;
  needsFridge: boolean;
  needsHeat: boolean;
  note?: string;
  favorite?: boolean;
}

export interface SavedArticle { articleId: string; saved: boolean; hidden: boolean }
export interface Feedback { kind: 'hide-reco' | 'note'; key: string; text?: string; date: DayKey }
export interface DailyNote { date: DayKey; text: string }
