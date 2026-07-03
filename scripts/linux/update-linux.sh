#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/deploy-common.sh"

preflight

if [[ -d .git ]]; then
  info "Checking for local Git changes before update."
  if [[ -n "$(git status --porcelain)" ]]; then
    fail "The repository has local changes. Commit, move, or review them before updating."
    git status --short
    exit 1
  fi

  current_branch="$(git branch --show-current)"
  if [[ -z "$current_branch" ]]; then
    fail "Repository is in detached HEAD state. Switch to the intended deployment branch before updating."
    exit 1
  fi

  previous_commit="$(git rev-parse --short HEAD)"
  info "Fetching origin/$current_branch ..."
  git fetch origin "$current_branch"
  info "Pulling latest changes with fast-forward only. Current commit: $previous_commit"
  git pull --ff-only origin "$current_branch"
else
  warn "No .git directory found. Skipping Git update and rebuilding the current files."
fi

info "Rebuilding the production app image."
if ! "${COMPOSE_BASE[@]}" build app; then
  fail "App image build failed. Existing containers were not replaced by this script."
  show_recent_logs app
  exit 1
fi

info "Starting updated Compose stack."
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

pass "Update completed."
