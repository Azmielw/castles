#!/usr/bin/env bash
# Runs all migrations + acceptance tests against a throwaway local PostgreSQL database.
# Usage: PGHOST=... PGUSER=... ./supabase/tests/run_tests.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${TEST_DB:-erp_test}"
PSQL="psql -X -q -v ON_ERROR_STOP=1"
$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d "$DB" -f "$DIR/tests/00_supabase_shim.sql"
for f in "$DIR"/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  $PSQL -d "$DB" -f "$f"
done
for t in "$DIR"/tests/[1-9]*.sql; do
  echo "→ test $(basename "$t")"
  $PSQL -d "$DB" -f "$t"
done
echo "✅ all database tests passed"
