#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

verify_only=false
case "${1:-}" in
  "") ;;
  --verify-only) verify_only=true ;;
  *) echo "Usage: bash scripts/backup-before-migrate.sh [--verify-only]" >&2; exit 2 ;;
esac

# Back up and actually restore even an empty database before pending migrations.
# A failed dump or restore stops setup before it can change the database schema.
mkdir -p .local/backups
plan_file="$(mktemp)"
trap 'rm -f "$plan_file"' EXIT
docker compose run --rm --no-deps api python manage.py showmigrations --plan > "$plan_file"
if [[ "$verify_only" == false ]] && ! grep -q '^\[ \]' "$plan_file"; then
  echo "No pending migrations; no database changes required."
  exit 0
fi

stamp="$(date -u +%Y%m%dT%H%M%SZ)_$$"
backup_file=".local/backups/before-migration-${stamp}.dump"
restore_database="supermarket_restore_check_$(date -u +%s)_$$"
docker compose exec -T db sh -c 'export PGPASSWORD="$POSTGRES_PASSWORD"; pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom' > "$backup_file"
docker compose exec -T db sh -eu -c '
  export PGPASSWORD="$POSTGRES_PASSWORD"
  restore_database="$1"
  createdb -U "$POSTGRES_USER" "$restore_database"
  trap '\''dropdb --if-exists -U "$POSTGRES_USER" "$restore_database"'\'' EXIT
  pg_restore --exit-on-error --no-owner -U "$POSTGRES_USER" -d "$restore_database"
' sh "$restore_database" < "$backup_file"
echo "Backup saved and restore verified: $backup_file"
