#!/usr/bin/env bash
# Manages the local services (background processes with pids and logs in .sandbox/).
# Usage: sandbox/scripts/dev.sh up|down|status|logs <service>
# Services: api (local server in place of AppSync, Cognito and S3), web (Vite dev server of the editor),
# mcp (local stand-in for the AgentCore Gateway of Lumi, in front of the Studio MCP tools) and lumi (the agent,
# which needs Bedrock access: AWS credentials or BEDROCK_API_KEY). Lumi starts last, so the editor works without it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

STATE_DIR=".sandbox"
SERVICES=(api web mcp lumi)

# Command that runs each service in the foreground.
service_command() {
  case "$1" in
    api) echo "npx tsx watch sandbox/src/main.ts" ;;
    web) echo "npm run dev -w @lumia/web" ;;
    mcp) echo "npx tsx watch sandbox/src/mcp-gateway/main.ts" ;;
    # Defaults for an .env created before Lumi existed; values in .env win.
    lumi) echo "env LUMI_MCP_URL=${LUMI_MCP_URL:-http://localhost:${LUMIA_MCP_PORT:-4100}/mcp} LUMI_SESSION_DIR=${LUMI_SESSION_DIR:-.sandbox/lumi/sessions} LUMI_MEMORY_DIR=${LUMI_MEMORY_DIR:-.sandbox/lumi/memory} npm run dev -w @lumia/agent" ;;
    *) return 1 ;;
  esac
}

# Health URL used to wait for each service; empty when the service has none.
service_health() {
  case "$1" in
    api) echo "http://localhost:${LUMIA_API_PORT:-4000}/health" ;;
    web) echo "http://localhost:${LUMIA_WEB_PORT:-5173}/" ;;
    mcp) echo "http://localhost:${LUMIA_MCP_PORT:-4100}/health" ;;
    lumi) echo "http://localhost:${LUMI_PORT:-8080}/ping" ;;
    *) echo "" ;;
  esac
}

pid_file() { echo "$STATE_DIR/$1.pid"; }
log_file() { echo "$STATE_DIR/$1.log"; }

is_running() {
  local file pid
  file="$(pid_file "$1")"
  [ -f "$file" ] || return 1
  pid="$(cat "$file")"
  kill -0 "$pid" 2>/dev/null
}

load_env() {
  if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
  fi
}

require_service() {
  local name
  for name in "${SERVICES[@]}"; do
    [ "$name" = "$1" ] && return 0
  done
  echo "Unknown service \"$1\". Available: ${SERVICES[*]}" >&2
  exit 2
}

# Writes the runtime config of the web app. The dev server proxies the API and Lumi, so the URLs are relative.
write_web_config() {
  cat >apps/web/public/config.json <<JSON
{
  "apiUrl": "/graphql",
  "authMode": "dev",
  "lumiUrl": "/lumi/invocations"
}
JSON
}

start_service() {
  local name="$1" command health i
  if is_running "$name"; then
    echo "$name already running (pid $(cat "$(pid_file "$name")"))"
    return 0
  fi
  command="$(service_command "$name")"
  mkdir -p "$STATE_DIR"
  if [ "$name" = "web" ]; then write_web_config; fi
  # setsid gives the service its own process group so that `down` stops tsx and its children.
  # On macOS, setsid is not available; fall back to running without it.
  if command -v setsid >/dev/null 2>&1; then
    setsid bash -c "exec $command" >>"$(log_file "$name")" 2>&1 &
  else
    bash -c "exec $command" >>"$(log_file "$name")" 2>&1 &
  fi
  echo $! >"$(pid_file "$name")"
  health="$(service_health "$name")"
  if [ -n "$health" ]; then
    for i in $(seq 1 60); do
      if curl -fsS "$health" >/dev/null 2>&1; then
        echo "$name up (pid $(cat "$(pid_file "$name")"), log: $(log_file "$name"))"
        return 0
      fi
      if ! is_running "$name"; then
        echo "$name exited during startup; see $(log_file "$name")" >&2
        rm -f "$(pid_file "$name")"
        exit 1
      fi
      sleep 1
    done
    echo "$name did not answer $health within 60 s; see $(log_file "$name")" >&2
    exit 1
  fi
  echo "$name started (pid $(cat "$(pid_file "$name")"))"
}

stop_service() {
  local name="$1" pid i
  if ! is_running "$name"; then
    rm -f "$(pid_file "$name")"
    echo "$name not running"
    return 0
  fi
  pid="$(cat "$(pid_file "$name")")"
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  for i in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -KILL -- "-$pid" 2>/dev/null || true
  fi
  rm -f "$(pid_file "$name")"
  echo "$name stopped"
}

case "${1:-}" in
  up)
    load_env
    for service in "${SERVICES[@]}"; do start_service "$service"; done
    ;;
  down)
    for service in "${SERVICES[@]}"; do stop_service "$service"; done
    ;;
  status)
    for service in "${SERVICES[@]}"; do
      if is_running "$service"; then
        echo "$service running (pid $(cat "$(pid_file "$service")"))"
      else
        echo "$service stopped"
      fi
    done
    ;;
  logs)
    [ -n "${2:-}" ] || { echo "Usage: $0 logs <service>" >&2; exit 2; }
    require_service "$2"
    [ -f "$(log_file "$2")" ] || { echo "No log yet for $2" >&2; exit 1; }
    tail -n 100 -f "$(log_file "$2")"
    ;;
  *)
    echo "Usage: $0 up|down|status|logs <service>" >&2
    exit 2
    ;;
esac
