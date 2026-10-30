-- ============================================================================
-- «Бережно» — схема облачной базы Supabase (PostgreSQL)
-- Выполнить один раз: Supabase → SQL Editor → New query → вставить весь файл → Run.
-- Скрипт можно запускать повторно: он ничего не удаляет из ваших данных.
-- ============================================================================
--
-- Каждая таблица хранит записи одного пользователя в «конверте»:
--   user_id            — владелец (auth.users), доступ только своему владельцу (RLS)
--   id                 — идентификатор записи (первичный ключ вместе с user_id)
--   data               — содержимое записи (jsonb)
--   created_at         — создание
--   updated_at         — время изменения на устройстве (для разрешения конфликтов)
--   deleted_at         — мягкое удаление, чтобы удаление дошло до всех устройств
--   server_updated_at  — время записи на сервере (курсор синхронизации)
--   rev                — номер ревизии
--   device_id          — устройство, которое последним изменило запись
--
-- Таблицы (сущности ТЗ):
--   user_preferences, habits, habit_logs, daily_plans, daily_context,
--   supplements, supplement_logs, recipes (ингредиенты — внутри рецепта),
--   meal_plans, meal_plan_items, shopping_lists, shopping_list_items, pantry_items,
--   menstrual_cycles, menstrual_events, symptoms, ovulation_tests,
--   yoga_sessions, exercise_library, exercise_logs, activity_logs, work_calendar,
--   reminders, saved_articles, user_feedback, daily_notes,
--   store_products (свой каталог перекусов из магазинов)
--   + record_history — история изменений важных записей
-- ============================================================================

-- Служебная функция: список таблиц приложения (используется в RPC-функциях)
create or replace function public.berezhno_tables()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'user_preferences','habits','habit_logs','daily_plans','daily_context',
    'supplements','supplement_logs','recipes','meal_plans','meal_plan_items',
    'shopping_lists','shopping_list_items','pantry_items','menstrual_cycles','menstrual_events',
    'symptoms','ovulation_tests','yoga_sessions','exercise_library','exercise_logs',
    'activity_logs','work_calendar','reminders','saved_articles','user_feedback','daily_notes','store_products'
  ]::text[];
$$;

-- История изменений важных сущностей (назначения, рецепты, цикл, тесты, привычки, настройки)
create table if not exists public.record_history (
  history_id   bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  table_name   text not null,
  record_id    text not null,
  data         jsonb not null,
  updated_at   timestamptz,
  deleted_at   timestamptz,
  archived_at  timestamptz not null default now()
);
create index if not exists record_history_user_idx on public.record_history (user_id, table_name, record_id, archived_at desc);
alter table public.record_history enable row level security;
drop policy if exists "history: read own" on public.record_history;
create policy "history: read own" on public.record_history for select to authenticated using (user_id = (select auth.uid()));
revoke all on table public.record_history from anon, public;
grant select on table public.record_history to authenticated;

-- Триггер: серверное время изменения, номер ревизии, неизменность владельца
create or replace function public.berezhno_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.server_updated_at := clock_timestamp();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.created_at := old.created_at;
    new.rev := old.rev + 1;
  end if;
  return new;
end;
$$;

-- Триггер: сохранение прежней версии в историю (только если содержимое изменилось)
create or replace function public.berezhno_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- при удалении всех данных или аккаунта история не пишется
  if coalesce(current_setting('berezhno.skip_history', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' or old.data is distinct from new.data or old.deleted_at is distinct from new.deleted_at then
    insert into public.record_history (user_id, table_name, record_id, data, updated_at, deleted_at)
    values (old.user_id, tg_table_name, old.id, old.data, old.updated_at, old.deleted_at);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.berezhno_history() from public, anon, authenticated;

-- Создание таблиц, индексов, политик RLS и триггеров
do $$
declare
  t text;
  day_tables text[] := array['habit_logs','daily_plans','daily_context','supplement_logs','meal_plan_items',
                             'symptoms','ovulation_tests','yoga_sessions','exercise_logs','activity_logs',
                             'work_calendar','daily_notes'];
  history_tables text[] := array['user_preferences','habits','supplements','recipes','menstrual_cycles',
                                 'menstrual_events','ovulation_tests','reminders'];
begin
  foreach t in array public.berezhno_tables() loop
    execute format($f$
      create table if not exists public.%1$I (
        user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
        id                text not null check (char_length(id) between 1 and 200),
        data              jsonb not null default '{}'::jsonb check (octet_length(data::text) < 2000000),
        created_at        timestamptz not null default now(),
        updated_at        timestamptz not null default now(),
        deleted_at        timestamptz,
        server_updated_at timestamptz not null default clock_timestamp(),
        rev               integer not null default 1,
        device_id         text,
        primary key (user_id, id)
      )$f$, t);

    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format('drop policy if exists "own rows: select" on public.%I', t);
    execute format('drop policy if exists "own rows: insert" on public.%I', t);
    execute format('drop policy if exists "own rows: update" on public.%I', t);
    execute format('drop policy if exists "own rows: delete" on public.%I', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using (user_id = (select auth.uid()))', t);

    execute format('revoke all on table public.%I from anon, public', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format('create index if not exists %I on public.%I (user_id, server_updated_at)', t || '_sync_idx', t);
    if t = any(day_tables) then
      execute format('create index if not exists %I on public.%I (user_id, (data->>''date''))', t || '_date_idx', t);
    end if;

    execute format('drop trigger if exists berezhno_touch on public.%I', t);
    execute format('create trigger berezhno_touch before insert or update on public.%I for each row execute function public.berezhno_touch()', t);

    if t = any(history_tables) then
      execute format('drop trigger if exists berezhno_history on public.%I', t);
      execute format('create trigger berezhno_history after update or delete on public.%I for each row execute function public.berezhno_history()', t);
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- push_changes(rows) — принять пакет изменений с устройства.
-- Запись обновляется, только если пришедшая версия новее сохранённой (updated_at).
-- Возвращает итоговое состояние каждой записи: устройство видит, чья версия победила.
-- Работает с правами пользователя (security invoker) — действует RLS.
-- ----------------------------------------------------------------------------
create or replace function public.push_changes(rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r jsonb;
  t text;
  uid uuid := auth.uid();
  result jsonb := '[]'::jsonb;
  saved jsonb;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if jsonb_typeof(rows) <> 'array' then raise exception 'rows must be an array'; end if;
  if jsonb_array_length(rows) > 500 then raise exception 'too many rows in one batch (max 500)'; end if;

  for r in select * from jsonb_array_elements(rows) loop
    t := r->>'t';
    if t is null or not (t = any(public.berezhno_tables())) then
      raise exception 'unknown table: %', t;
    end if;

    execute format($f$
      insert into public.%1$I as x (user_id, id, data, created_at, updated_at, deleted_at, device_id)
      values ($1, $2, coalesce($3, '{}'::jsonb), coalesce($4, now()), coalesce($5, now()), $6, $7)
      on conflict (user_id, id) do update
        set data = excluded.data,
            updated_at = excluded.updated_at,
            deleted_at = excluded.deleted_at,
            device_id = excluded.device_id
        where x.updated_at < excluded.updated_at
    $f$, t)
    using uid, r->>'id', r->'data', (r->>'created_at')::timestamptz, (r->>'updated_at')::timestamptz,
          (r->>'deleted_at')::timestamptz, r->>'device_id';

    execute format($f$
      select jsonb_build_object('t', %1$L, 'id', id, 'data', data, 'created_at', created_at,
                                'updated_at', updated_at, 'deleted_at', deleted_at, 'server_updated_at', server_updated_at)
      from public.%1$I where user_id = $1 and id = $2
    $f$, t)
    into saved using uid, r->>'id';

    if saved is not null then result := result || jsonb_build_array(saved); end if;
  end loop;
  return result;
end;
$$;

-- ----------------------------------------------------------------------------
-- pull_changes(since, max_rows) — изменения всех таблиц после курсора, по возрастанию времени.
-- ----------------------------------------------------------------------------
create or replace function public.pull_changes(since timestamptz default null, max_rows integer default 1000)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  t text;
  uid uuid := auth.uid();
  lim integer := least(greatest(coalesce(max_rows, 1000), 1), 5000);
  part jsonb;
  acc jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  foreach t in array public.berezhno_tables() loop
    execute format($f$
      select coalesce(jsonb_agg(jsonb_build_object('t', %1$L, 'id', id, 'data', data, 'created_at', created_at,
                     'updated_at', updated_at, 'deleted_at', deleted_at, 'server_updated_at', server_updated_at)
                     order by server_updated_at), '[]'::jsonb)
      from (select * from public.%1$I
            where user_id = $1 and ($2::timestamptz is null or server_updated_at > $2)
            order by server_updated_at limit $3) s
    $f$, t)
    into part using uid, since, lim;
    acc := acc || part;
  end loop;

  return coalesce((
    select jsonb_agg(e order by (e->>'server_updated_at')::timestamptz)
    from (select e from jsonb_array_elements(acc) e
          order by (e->>'server_updated_at')::timestamptz limit lim) s
  ), '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- delete_my_data() — удалить все данные пользователя (аккаунт остаётся).
-- Оставляет метку, по которой другие устройства тоже очистят свои данные.
-- ----------------------------------------------------------------------------
create or replace function public.delete_my_data()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  t text;
  uid uuid := auth.uid();
  stamp timestamptz := clock_timestamp();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  perform set_config('berezhno.skip_history', 'on', true);
  foreach t in array public.berezhno_tables() loop
    execute format('delete from public.%I where user_id = $1', t) using uid;
  end loop;
  perform public.berezhno_clear_history();
  insert into public.user_preferences (user_id, id, data, updated_at)
  values (uid, '__wiped__', jsonb_build_object('wipedAt', stamp), stamp);
  return jsonb_build_object('wipedAt', stamp);
end;
$$;

create or replace function public.berezhno_clear_history()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.record_history where user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- delete_my_account() — удалить аккаунт и все связанные данные (каскадно).
-- ----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  perform set_config('berezhno.skip_history', 'on', true);
  delete from public.record_history where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.push_changes(jsonb) from public, anon;
revoke all on function public.pull_changes(timestamptz, integer) from public, anon;
revoke all on function public.delete_my_data() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.berezhno_clear_history() from public, anon;
grant execute on function public.push_changes(jsonb) to authenticated;
grant execute on function public.pull_changes(timestamptz, integer) to authenticated;
grant execute on function public.delete_my_data() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.berezhno_clear_history() to authenticated;

-- Обновить кеш схемы PostgREST, чтобы функции стали доступны сразу
notify pgrst, 'reload schema';
