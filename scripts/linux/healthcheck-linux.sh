#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

require_docker
require_project_files
validate_compose
show_status

if ! check_local_health; then
  show_recent_logs app
  exit 1
fi

pass "Health check completed."
