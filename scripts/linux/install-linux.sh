#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

preflight

info "Building the production app image."
if ! "${COMPOSE_BASE[@]}" build app; then
  fail "App image build failed."
  show_recent_logs app
  exit 1
fi

pass "Install build completed. Start the stack with: scripts/linux/start-linux.sh"
show_status
