#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

require_docker
require_project_files

info "Stopping Compose stack without deleting volumes."
"${COMPOSE_BASE[@]}" down
pass "Stack stopped. Volumes were not removed."
