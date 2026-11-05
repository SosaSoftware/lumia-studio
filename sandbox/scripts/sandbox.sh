#!/usr/bin/env bash
# Manages the Postgres of the local sandbox (Docker Compose).
# Usage: sandbox/scripts/sandbox.sh up|down|reset|status
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
COMPOSE_FILE="sandbox/docker-compose.yaml"

# Sets NAME=value in .env only when NAME is missing or empty. Never prints values.
set_env_default() {
  local name="$1" value="$2"
  if grep -Eq "^${name}=.+" .env; then
    return 0
  fi
  if grep -Eq "^${name}=" .env; then
    sed "s|^${name}=.*|${name}=${value}|" .env > .env.tmp && mv .env.tmp .env
  else
    echo "${name}=${value}" >> .env
  fi
}

# Creates .env from .env.example on first use and fills every secret with a random value.
ensure_env() {
  if [ ! -f .env ]; then
    [ -f .env.example ] || { echo "Missing .env.example" >&2; exit 1; }
    cp .env.example .env
    echo "Created .env from .env.example"
  fi
  [ -z "$(tail -c1 .env)" ] || echo >> .env
  # Plain assignments so that set -e stops the script if openssl fails, instead of writing empty secrets.
  local db_password app_password jwt_secret storage_secret port
  db_password="$(openssl rand -hex 16)"
  app_password="$(openssl rand -hex 16)"
  jwt_secret="$(openssl rand -hex 32)"
  storage_secret="$(openssl rand -hex 32)"
  set_env_default LUMIA_SANDBOX_DB_PASSWORD "$db_password"
  set_env_default LUMIA_SANDBOX_DB_PORT 5432
  port="$(grep -E '^LUMIA_SANDBOX_DB_PORT=.+' .env | head -n1 | cut -d= -f2-)"
  set_env_default LUMIA_DB_DRIVER pg
  set_env_default LUMIA_DB_NAME lumia_studio
  set_env_default LUMIA_PG_HOST 127.0.0.1
  set_env_default LUMIA_PG_PORT "$port"
  set_env_default LUMIA_DB_STUDIO_APP_PASSWORD "$app_password"
  set_env_default LUMIA_DEV_JWT_SECRET "$jwt_secret"
  set_env_default LUMIA_STORAGE_SIGNING_SECRET "$storage_secret"
  set_env_default LUMIA_API_PORT 4000
  set_env_default LUMIA_API_BASE_URL http://localhost:4000
  set_env_default LUMIA_STORAGE_DRIVER filesystem
  set_env_default LUMIA_STORAGE_ROOT .sandbox/storage
  set_env_default LUMIA_SPEECH_PROVIDER none
  set_env_default AWS_REGION us-east-1
  set_env_default LUMIA_WEB_PORT 5173
}

ensure_docker() {
  command -v docker >/dev/null 2>&1 || { echo "Docker is not installed." >&2; exit 1; }
  if ! docker info >/dev/null 2>&1; then
    echo "Docker daemon is not reachable. Start Docker Desktop or an active Docker daemon and retry." >&2
    exit 1
  fi
}

compose() {
  docker compose --env-file .env -f "$COMPOSE_FILE" "$@"
}

case "${1:-}" in
  up)
    ensure_env
    ensure_docker
    compose up -d --wait
    ;;
  down)
    ensure_env
    ensure_docker
    compose down
    ;;
  reset)
    # Deletes the sandbox database and starts an empty one.
    ensure_env
    ensure_docker
    compose down -v
    compose up -d --wait
    ;;
  status)
    ensure_env
    ensure_docker
    compose ps
    ;;
  *)
    echo "Usage: $0 up|down|reset|status" >&2
    exit 2
    ;;
esac
