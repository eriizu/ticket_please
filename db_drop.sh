#!/usr/bin/env bash
# db_drop.sh
# Non-interactive script to drop a PostgreSQL database or wipe its public schema.
# Usage (examples):
#   sudo ./drop_pg_db_args.sh --db mydb --action full-drop --confirm mydb
#   sudo ./drop_pg_db_args.sh --db mydb --action wipe-db --force
#
# Arguments:
#   --db DBNAME          (required) the target database
#   --action ACTION      (optional) full-drop | wipe-db  (default: full-drop)
#   --confirm DBNAME     (optional) must equal DBNAME to proceed (safety)
#   --force              (optional) skip confirm check (use with care)
#   --help               show help
#
# Notes:
# - Must be run as root (script uses sudo -u postgres to run psql).
# - full-drop: terminates connections and runs DROP DATABASE.
# - wipe-db: terminates connections and drops/recreates public schema (keeps DB).
# - This script is intended for local, trusted use. Operations are destructive.

PSQL="sudo -u postgres psql"

set -euo pipefail

print_usage() {
  cat <<EOF
Usage:
  sudo $0 --db DBNAME [--action full-drop|wipe-db] [--confirm DBNAME | --force]

Options:
  --db DBNAME       (required) database to operate on
  --action ACTION   action to perform: 'full-drop' or 'wipe-db' (default: full-drop)
  --confirm DBNAME  safety: must equal DBNAME to proceed
  --force           skip confirm check (dangerous)
  --help            show this help
EOF
}

# Defaults
ACTION="full-drop"
DBNAME=""
CONFIRM=""
FORCE=0

# Parse args (simple loop)
while [ $# -gt 0 ]; do
  case "$1" in
    --db)
      shift
      DBNAME=${1:-}
      ;;
    --action)
      shift
      ACTION=${1:-}
      ;;
    --confirm)
      shift
      CONFIRM=${1:-}
      ;;
    --force)
      FORCE=1
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      print_usage
      exit 2
      ;;
  esac
  shift
done

# Basic validation
if [ -z "$DBNAME" ]; then
  echo "Error: --db DBNAME is required."
  print_usage
  exit 2
fi

if [ "$ACTION" != "full-drop" ] && [ "$ACTION" != "wipe-db" ]; then
  echo "Error: --action must be 'full-drop' or 'wipe-db'."
  exit 2
fi

if [ "$FORCE" -ne 1 ]; then
  if [ -z "$CONFIRM" ]; then
    echo "Error: destructive action requires either --confirm DBNAME or --force."
    print_usage
    exit 2
  fi
  if [ "$CONFIRM" != "$DBNAME" ]; then
    echo "Error: --confirm value does not match --db. Aborting."
    exit 2
  fi
fi

# Ensure psql exists
if ! command -v $PSQL >/dev/null 2>&1; then
  echo "psql not found. Install postgresql package: sudo pacman -S postgresql"
  exit 1
fi

# Helper functions
terminate_connections() {
  echo "Terminating other connections to database '${DBNAME}'..."
  $PSQL -v ON_ERROR_STOP=1 -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity \
     WHERE datname = '${DBNAME}' AND pid <> pg_backend_pid();" >/dev/null
}

db_exists() {
  $PSQL -tAc "SELECT 1 FROM pg_database WHERE datname='${DBNAME}'" | grep -q 1
}

# Main
if ! db_exists; then
  echo "Database '${DBNAME}' does not exist. Nothing to do."
  exit 0
fi

terminate_connections

if [ "$ACTION" = "full-drop" ]; then
  echo "Dropping database '${DBNAME}'..."
  $PSQL -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS \"${DBNAME}\";"
  echo "Database '${DBNAME}' dropped."
  exit 0
else
  # wipe-db
  echo "Dropping and recreating public schema in database '${DBNAME}'..."
  $PSQL -v ON_ERROR_STOP=1 -d "${DBNAME}" -c \
    "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; \
     GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"
  echo "Public schema wiped and recreated in '${DBNAME}'."
  exit 0
fi
