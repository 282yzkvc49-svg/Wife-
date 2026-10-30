#!/usr/bin/env bash
# Проверка SQL-миграции и RLS на локальном PostgreSQL 16.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
WORK="${PGWORK:-$(mktemp -d)}"
mkdir -p "$WORK"
chmod 777 "$WORK"
PORT="${PGPORT_TEST:-54329}"
AS="runuser -u postgres --"
[ "$(id -u)" = "0" ] || AS=""
$AS "$PGBIN/initdb" -D "$WORK/data" -U postgres -A trust >/dev/null
$AS "$PGBIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null
trap '$AS "$PGBIN/pg_ctl" -D "$WORK/data" -m fast stop >/dev/null 2>&1 || true' EXIT
PSQL="psql -h $WORK -p $PORT -U postgres -v ON_ERROR_STOP=1 -q -X"
$PSQL -d postgres -c "create database berezhno_test" >/dev/null
$PSQL -d berezhno_test -f "$HERE/auth_stub.sql"
$PSQL -d berezhno_test -f "$ROOT/supabase/migrations/001_init.sql"
echo "миграция применена (1-й раз)"
$PSQL -d berezhno_test -f "$ROOT/supabase/migrations/001_init.sql"
echo "миграция применена повторно — идемпотентна"
$PSQL -d berezhno_test -f "$HERE/test_rls.sql"
