#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

preflight

info "Starting Compose stack."
if ! "${COMPOSE_BASE[@]}" up -d; then
  fail "Compose startup failed."
  show_status || true
  show_recent_logs
  exit 1
fi

show_status
if ! check_local_health; then
  show_recent_logs app
  exit 1
fi

pass "Stack is running."
