#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_BASE=(docker compose --env-file .env.production --profile tunnel)
LOCAL_URL="${LOCAL_URL:-http://127.0.0.1:3000}"

info() {
  printf '[INFO] %s\n' "$*"
}

pass() {
  printf '[PASS] %s\n' "$*"
}

warn() {
  printf '[WARN] %s\n' "$*" >&2
}

fail() {
  printf '[FAIL] %s\n' "$*" >&2
}

cd_app() {
  cd "$APP_DIR"
}

require_command() {
  local command_name="$1"
  local install_hint="$2"

  if ! command -v "$command_name" >/dev/null 2>&1; then
    fail "$command_name is not installed or is not available in PATH."
    fail "$install_hint"
    exit 1
  fi
  pass "$command_name is available."
}

require_docker() {
  require_command docker "Install Docker Engine and the Docker Compose plugin, then run this script again."

  if ! docker info >/dev/null 2>&1; then
    fail "Docker is installed but the Docker engine is not running or this user cannot access it."
    fail "Start Docker and confirm this user can run: docker info"
    exit 1
  fi
  pass "Docker engine is running."

  if ! docker compose version >/dev/null 2>&1; then
    fail "Docker Compose v2 is unavailable."
    fail "Install the Docker Compose plugin and confirm: docker compose version"
    exit 1
  fi
  pass "Docker Compose is available."
}

require_project_files() {
  cd_app

  if [[ ! -f compose.yaml ]]; then
    fail "compose.yaml was not found in $APP_DIR."
    exit 1
  fi

  if [[ ! -f Dockerfile ]]; then
    fail "Dockerfile was not found in $APP_DIR."
    exit 1
  fi

  if [[ ! -f .env.production ]]; then
    fail ".env.production was not found in $APP_DIR."
    fail "Create it from .env.example and add the production values. This script will not create or overwrite it."
    exit 1
  fi

  pass "Required project files are present."
}

validate_compose() {
  info "Validating Compose config without printing interpolated environment values."
  "${COMPOSE_BASE[@]}" config --quiet
  pass "Compose config is valid."
}

show_status() {
  info "Compose status:"
  "${COMPOSE_BASE[@]}" ps
}

show_recent_logs() {
  local service="${1:-}"

  warn "Recent Compose logs follow. Secret values are not requested, but avoid sharing logs publicly without review."
  if [[ -n "$service" ]]; then
    "${COMPOSE_BASE[@]}" logs --tail 120 "$service" || true
  else
    "${COMPOSE_BASE[@]}" logs --tail 120 || true
  fi
}

check_local_health() {
  require_command curl "Install curl or use another HTTP client to check $LOCAL_URL."

  info "Checking local app health at $LOCAL_URL ..."
  local status_code
  status_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "$LOCAL_URL" || true)"

  if [[ "$status_code" =~ ^[234][0-9][0-9]$ ]]; then
    pass "Local health check passed with HTTP $status_code."
    return 0
  fi

  fail "Local health check failed with HTTP status ${status_code:-000}."
  return 1
}

preflight() {
  require_docker
  require_project_files
  validate_compose
}
