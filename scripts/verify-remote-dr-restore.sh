#!/usr/bin/env bash
set -euo pipefail

: "${DR_DATABASE_URL:?DR_DATABASE_URL is required}"

latest_repo_migration="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort | tail -n 1 | sed 's/_.*//')"
migration_count="$(find supabase/migrations -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"
sql_suite_count="$(find tests/sql -maxdepth 1 -type f -name '*.sql' | wc -l | tr -d ' ')"

latest_remote_migration="$(psql "$DR_DATABASE_URL" -Atqc "select version from supabase_migrations.schema_migrations order by version desc limit 1")"
remote_migration_count="$(psql "$DR_DATABASE_URL" -Atqc "select count(*) from supabase_migrations.schema_migrations")"

if [[ "$latest_remote_migration" != "$latest_repo_migration" ]]; then
  echo "DR migration mismatch: repo=$latest_repo_migration restored=$latest_remote_migration" >&2
  exit 1
fi

if [[ "$remote_migration_count" -lt "$migration_count" ]]; then
  echo "DR migration history incomplete: repo=$migration_count restored=$remote_migration_count" >&2
  exit 1
fi

for file in tests/sql/*.sql; do
  echo "==> $file"
  psql "$DR_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$file"
done

cat <<EOF
DR restore verification PASS
Source commit: ${SOURCE_COMMIT:-unknown}
Latest migration: $latest_remote_migration
Recorded migrations: $remote_migration_count
Repository migrations: $migration_count
SQL suites passed: $sql_suite_count
Verified at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
