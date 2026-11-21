#!/usr/bin/env bash
# Applies AuditForge migrations to the DB already initialized by Supabase (which provides the
# roles, the auth schema and auth.uid()). Idempotent: records applied files in _af_migrations,
# so re-running `docker compose up` does not re-apply them. Then it enables the worker role.
set -euo pipefail

PSQL=(psql -v ON_ERROR_STOP=1 -q)

echo "[migrate] waiting for the database…"
for i in $(seq 1 60); do
  if "${PSQL[@]}" -c "select 1" >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "[migrate] migration ledger…"
"${PSQL[@]}" -c "create table if not exists public._af_migrations (name text primary key, applied_at timestamptz not null default now());"

for f in $(ls /migrations/*.sql | sort); do
  name=$(basename "$f")
  if "${PSQL[@]}" -tAc "select 1 from public._af_migrations where name = '$name'" | grep -q 1; then
    echo "[migrate] already applied: $name"
    continue
  fi
  echo "[migrate] applying: $name"
  "${PSQL[@]}" -f "$f"
  "${PSQL[@]}" -c "insert into public._af_migrations (name) values ('$name')"
done

echo "[migrate] enabling the worker role…"
"${PSQL[@]}" -c "alter role auditforge_worker login password '${WORKER_DB_PASSWORD}';"
"${PSQL[@]}" -c "grant connect on database ${PGDATABASE} to auditforge_worker;"

# PostgREST cached the schema at startup (before these migrations): ask it to reload.
echo "[migrate] reloading PostgREST schema…"
"${PSQL[@]}" -c "notify pgrst, 'reload schema';" || true

echo "[migrate] done."
