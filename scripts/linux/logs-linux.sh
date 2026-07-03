#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

TAIL_LINES="${TAIL_LINES:-200}"
FOLLOW="${FOLLOW:-false}"
SERVICE="${1:-}"

require_docker
require_project_files
cd_app

args=(logs --tail "$TAIL_LINES")
if [[ "$FOLLOW" == "true" ]]; then
  args+=(--follow)
fi
if [[ -n "$SERVICE" ]]; then
  args+=("$SERVICE")
fi

info "Showing Compose logs. Use TAIL_LINES=300 or FOLLOW=true to adjust output."
"${COMPOSE_BASE[@]}" "${args[@]}"
