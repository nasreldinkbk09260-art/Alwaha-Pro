#!/usr/bin/env bash
set -euo pipefail

: "${PGHOST:=127.0.0.1}"
: "${PGPORT:=5432}"
: "${PGUSER:=postgres}"
: "${PGPASSWORD:=postgres}"
: "${PGDATABASE:=alwaha_test}"
export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql -v ON_ERROR_STOP=1 -c 'SELECT version();'
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/ci-bootstrap.sql"

for migration in \
  20261101022015_marketplace_conversation_messaging.sql \
  20261101022031_marketplace_conversation_policy_owner_fix.sql \
  20261101210000_marketplace_transaction_archive_and_call_auth.sql \
  20261102010000_legacy_client_privileges_hardening.sql \
  20261102150000_products_seller_email_privacy.sql \
  20261013235236_multiplayer_game_rooms_v283.sql \
  20261014195018_game_room_join_game_validation.sql \
  20261014195108_game_room_join_rpc_compatibility.sql \
  20261108100000_server_authoritative_game_actions.sql; do
  echo "APPLY TEST MIGRATION: $migration"
  psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/$migration"
done

# The hosted Postgres fixture lacks the Supabase pg_cron extension. Its cron schema
# is a tiny test double, so remove only CREATE EXTENSION while executing the same
# retention triggers/functions/job-registration block. Real extension install is
# still present and statically checked in the release migration.
python3 - "$ROOT/supabase/migrations/20261102100000_marketplace_retention_policy_and_cleanup.sql" "$RUNNER_TEMP/retention-with-cron-test-double.sql" <<'PY'
from pathlib import Path
import sys
source=Path(sys.argv[1]).read_text()
line='CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;'
if source.count(line)!=1:
    raise SystemExit('Expected one pg_cron extension line in retention migration.')
Path(sys.argv[2]).write_text(source.replace(line,'-- pg_cron extension line omitted in CI fixture; cron API is mocked.'),encoding='utf-8')
PY
psql -v ON_ERROR_STOP=1 -f "$RUNNER_TEMP/retention-with-cron-test-double.sql"
echo 'APPLY TEST MIGRATION: 20261108110000_marketplace_retention_two_party_consent.sql'
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/20261108110000_marketplace_retention_two_party_consent.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261102010000_legacy_client_privileges_hardening.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261102100000_marketplace_retention_policy_and_cleanup.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261102100000_marketplace_retention_behavior.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261102150000_products_seller_email_privacy.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261102160000_marketplace_snapshot_column_privileges.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261102170000_marketplace_nonfriend_conversation.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261108100000_game_actions_security.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261108110000_marketplace_retention_two_party_consent.sql"

# Restore the separately maintained admin audit-log schema in the CI fixture.
psql -v ON_ERROR_STOP=1 -f "$ROOT/admin-app/supabase/migrations/20261102130000_admin_action_logs_source_recovery.sql"
psql -v ON_ERROR_STOP=1 -f "$ROOT/supabase/tests/20261102130000_admin_action_logs_source_recovery.sql"
echo 'SUPABASE_SQL_REGRESSION=PASS (PostgreSQL fixture; pg_cron API mocked, not a Supabase project test)'
