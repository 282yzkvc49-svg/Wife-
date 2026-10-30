-- Проверки схемы «Бережно»: RLS, синхронизация (push/pull), конфликты, удаление.
\set ON_ERROR_STOP 1
\set A '11111111-1111-4111-8111-111111111111'
\set B '22222222-2222-4222-8222-222222222222'

insert into auth.users values (:'A', 'a@example.com'), (:'B', 'b@example.com');

-- ——— Пользователь A ———
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);

select public.push_changes('[
  {"t":"habits","id":"h-water","data":{"title":"Тёплая вода"},"created_at":"2026-10-30T08:00:00.000Z","updated_at":"2026-10-30T08:00:00.000Z","deleted_at":null,"device_id":"iphone"},
  {"t":"supplements","id":"s1","data":{"name":"Фолиевая кислота","dose":""},"created_at":"2026-10-30T08:00:00.000Z","updated_at":"2026-10-30T08:00:00.000Z","deleted_at":null,"device_id":"iphone"}
]'::jsonb) is not null as pushed \gset

do $$
declare n int;
begin
  select jsonb_array_length(public.pull_changes(null, 1000)) into n;
  assert n = 2, format('A видит 2 свои записи, а видит %s', n);
  raise notice 'ok: A видит свои записи (%)', n;
end $$;

-- Устаревшая версия (более раннее updated_at) не перезаписывает новую
do $$
declare res jsonb;
begin
  res := public.push_changes('[{"t":"habits","id":"h-water","data":{"title":"СТАРОЕ"},"created_at":"2026-10-30T08:00:00Z","updated_at":"2026-10-30T07:00:00.000Z","deleted_at":null,"device_id":"mac"}]');
  assert res->0->'data'->>'title' = 'Тёплая вода', 'старая версия не должна побеждать';
  assert (res->0->>'updated_at')::timestamptz = '2026-10-30T08:00:00Z'::timestamptz, 'возвращается версия сервера';
  raise notice 'ok: устаревшая правка отклонена, сервер вернул актуальную версию';
end $$;

-- Новая версия принимается, ревизия растёт
do $$
declare res jsonb; r int;
begin
  res := public.push_changes('[{"t":"habits","id":"h-water","data":{"title":"Тёплая вода утром"},"created_at":"2026-10-30T08:00:00Z","updated_at":"2026-10-30T09:00:00.000Z","deleted_at":null,"device_id":"mac"}]');
  assert res->0->'data'->>'title' = 'Тёплая вода утром', 'новая версия принята';
  select rev into r from public.habits where id = 'h-water';
  assert r = 2, format('ревизия 2, а не %s', r);
  raise notice 'ok: новая правка принята, rev=%', r;
end $$;

-- Повторная отправка той же версии ничего не меняет (идемпотентность)
do $$
declare r int;
begin
  perform public.push_changes('[{"t":"habits","id":"h-water","data":{"title":"Тёплая вода утром"},"created_at":"2026-10-30T08:00:00Z","updated_at":"2026-10-30T09:00:00.000Z","deleted_at":null,"device_id":"mac"}]');
  select rev into r from public.habits where id = 'h-water';
  assert r = 2, 'повтор не создаёт новую ревизию';
  raise notice 'ok: повторная отправка идемпотентна';
end $$;

-- Мягкое удаление доходит через pull
do $$
declare res jsonb;
begin
  perform public.push_changes('[{"t":"supplements","id":"s1","data":{"name":"Фолиевая кислота"},"created_at":"2026-10-30T08:00:00Z","updated_at":"2026-10-30T10:00:00.000Z","deleted_at":"2026-10-30T10:00:00.000Z","device_id":"mac"}]');
  select e into res from jsonb_array_elements(public.pull_changes(null, 100)) e where e->>'id' = 's1';
  assert res->>'deleted_at' is not null, 'удаление видно другим устройствам';
  raise notice 'ok: удаление передаётся как надгробие';
end $$;

-- Курсор: pull после метки времени возвращает только новые записи
do $$
declare cur timestamptz; n int;
begin
  select max(server_updated_at) into cur from public.habits;
  select jsonb_array_length(public.pull_changes(cur, 100)) into n;
  assert n = 1, format('после курсора только s1 (изменена позже), а не %s', n);
  raise notice 'ok: выборка по курсору';
end $$;

-- Неизвестная таблица отклоняется
do $$
begin
  begin
    perform public.push_changes('[{"t":"pg_authid","id":"x","data":{},"updated_at":"2026-10-30T10:00:00Z"}]');
    raise exception 'ПРОВАЛ: неизвестная таблица принята';
  exception when others then
    if sqlerrm like 'ПРОВАЛ%' then raise; end if;
    raise notice 'ok: неизвестная таблица отклонена (%)', sqlerrm;
  end;
end $$;

-- ——— Пользователь B: изоляция ———
select set_config('request.jwt.claim.sub', :'B', false);

do $$
declare n int;
begin
  select jsonb_array_length(public.pull_changes(null, 1000)) into n;
  assert n = 0, format('B не видит чужие записи, а видит %s', n);
  select count(*) into n from public.habits;
  assert n = 0, 'прямой select тоже ограничен RLS';
  select count(*) into n from public.record_history;
  assert n = 0, 'история чужих записей не видна';
  raise notice 'ok: B не видит данные A';
end $$;

do $$
begin
  begin
    insert into public.habits (user_id, id, data) values ('11111111-1111-4111-8111-111111111111', 'evil', '{}');
    raise exception 'ПРОВАЛ: вставка от чужого имени прошла';
  exception when insufficient_privilege then
    raise notice 'ok: нельзя записать строку от имени другого пользователя';
  end;
end $$;

do $$
declare n int;
begin
  update public.habits set data = '{"title":"взлом"}' where id = 'h-water';
  get diagnostics n = row_count;
  assert n = 0, 'чужая строка не обновляется';
  delete from public.habits where id = 'h-water';
  get diagnostics n = row_count;
  assert n = 0, 'чужая строка не удаляется';
  raise notice 'ok: B не может менять и удалять строки A';
end $$;

-- Тот же id у B — это отдельная запись B, данные A не затронуты
select public.push_changes('[{"t":"habits","id":"h-water","data":{"title":"Вода B"},"created_at":"2026-10-30T08:00:00Z","updated_at":"2026-10-31T09:00:00.000Z","deleted_at":null,"device_id":"pc"}]') is not null as ok \gset
reset role;
do $$
declare a text; b text;
begin
  select data->>'title' into a from public.habits where id = 'h-water' and user_id = '11111111-1111-4111-8111-111111111111';
  select data->>'title' into b from public.habits where id = 'h-water' and user_id = '22222222-2222-4222-8222-222222222222';
  assert a = 'Тёплая вода утром' and b = 'Вода B', format('A=%s, B=%s', a, b);
  raise notice 'ok: одинаковые id у разных пользователей не пересекаются';
end $$;

-- История хранит прежние версии
do $$
declare n int;
begin
  select count(*) into n from public.record_history where user_id = '11111111-1111-4111-8111-111111111111' and record_id = 'h-water';
  assert n = 1, format('ожидалась 1 запись истории, есть %s', n);
  raise notice 'ok: история изменений пишется';
end $$;

-- ——— anon не имеет доступа ———
set role anon;
do $$
begin
  begin
    perform public.pull_changes(null, 10);
    raise exception 'ПРОВАЛ: anon вызвал pull_changes';
  exception when insufficient_privilege then
    raise notice 'ok: анонимный доступ к функциям закрыт';
  end;
  begin
    perform 1 from public.habits limit 1;
    raise exception 'ПРОВАЛ: anon читает таблицу';
  exception when insufficient_privilege then
    raise notice 'ok: анонимный доступ к таблицам закрыт';
  end;
end $$;
reset role;

-- ——— Удаление данных B (аккаунт остаётся) ———
set role authenticated;
select set_config('request.jwt.claim.sub', :'B', false);
select public.delete_my_data() is not null as wiped \gset
do $$
declare n int; marker jsonb;
begin
  select count(*) into n from public.habits;
  assert n = 0, 'данные B удалены';
  select data into marker from public.user_preferences where id = '__wiped__';
  assert marker ? 'wipedAt', 'метка очистки для других устройств';
  raise notice 'ok: delete_my_data удаляет данные и оставляет метку';
end $$;
reset role;

-- ——— Удаление аккаунта A ———
set role authenticated;
select set_config('request.jwt.claim.sub', :'A', false);
select public.delete_my_account();
reset role;
do $$
declare n int;
begin
  select count(*) into n from auth.users where id = '11111111-1111-4111-8111-111111111111';
  assert n = 0, 'пользователь A удалён';
  select count(*) into n from public.habits where user_id = '11111111-1111-4111-8111-111111111111';
  assert n = 0, 'записи A удалены каскадно';
  select count(*) into n from public.record_history where user_id = '11111111-1111-4111-8111-111111111111';
  assert n = 0, 'история A удалена каскадно';
  select count(*) into n from auth.users where id = '22222222-2222-4222-8222-222222222222';
  assert n = 1, 'пользователь B не затронут';
  raise notice 'ok: удаление аккаунта удаляет все связанные данные';
end $$;

\echo 'SQL-проверки пройдены'
