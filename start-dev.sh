#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/web-server"
FRONTEND_DIR="$PROJECT_ROOT/client/client/app"
BACKEND_PORT="5001"
FRONTEND_PORT="3002"
REDIS_CONTAINER_NAME="clarity-coach-redis"

log() {
    printf '%s\n' "$*"
}

fail() {
    printf 'Error: %s\n' "$*" >&2
    exit 1
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

http_is_ready() {
    curl --silent --fail "$1" >/dev/null 2>&1
}

docker_is_ready() {
    docker info >/dev/null 2>&1
}

worktree_is_clean() {
    [[ -z "$(git status --porcelain)" ]]
}

ensure_repo_root() {
    cd "$PROJECT_ROOT"
    git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Run this from inside the Career Compass repo."
}

sync_main_branch() {
    local current_branch
    current_branch="$(git branch --show-current)"

    if [[ -z "$current_branch" ]]; then
        fail "Could not determine the current git branch."
    fi

    if [[ "$current_branch" != "main" ]]; then
        log "Switching to main so the app always starts from the latest shared branch..."
        worktree_is_clean || fail "Please stash or commit local changes before switching branches."
        git checkout main
    fi

    log "Refreshing main from origin..."
    git fetch origin main
    git pull --ff-only origin main
}

install_dependencies() {
    local dir="$1"
    local label="$2"

    log "Installing ${label} dependencies..."
    if [[ -f "$dir/package-lock.json" ]]; then
        (cd "$dir" && npm ci --no-audit --no-fund)
    else
        (cd "$dir" && npm install --no-audit --no-fund)
    fi
}

redis_is_available() {
    if command -v redis-cli >/dev/null 2>&1; then
        redis-cli -p 6379 ping >/dev/null 2>&1
    else
        return 1
    fi
}

ensure_docker_running() {
    require_command docker

    if docker_is_ready; then
        log "Docker is already running."
        return 0
    fi

    log "Opening Docker Desktop..."
    open -a Docker >/dev/null 2>&1 || open -a "Docker Desktop" >/dev/null 2>&1 || true

    local attempts=0
    local max_attempts=60

    log "Waiting for Docker to be ready..."
    until docker_is_ready; do
        attempts=$((attempts + 1))
        if [[ "$attempts" -ge "$max_attempts" ]]; then
            fail "Docker Desktop did not become ready. Open Docker Desktop and try again."
        fi
        sleep 2
    done

    log "Docker is ready."
}

ensure_redis() {
    if redis_is_available; then
        log "Redis is already available on port 6379."
        return 0
    fi

    ensure_docker_running

    if docker ps -a --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER_NAME"; then
        log "Starting existing Redis container..."
        docker start "$REDIS_CONTAINER_NAME" >/dev/null
    else
        log "Creating Redis container..."
        docker run -d --name "$REDIS_CONTAINER_NAME" -p 6379:6379 redis:7-alpine >/dev/null
    fi

    log "Redis container started."
}

start_background_process() {
    local dir="$1"
    local log_file="$2"
    local pid_var_name="$3"
    shift 3

    (cd "$dir" && "$@") >"$log_file" 2>&1 &
    local pid="$!"
    printf -v "$pid_var_name" '%s' "$pid"
}

wait_for_http() {
    local url="$1"
    local label="$2"
    local attempts=0
    local max_attempts=60

    log "Waiting for ${label}..."
    until http_is_ready "$url"; do
        attempts=$((attempts + 1))
        if [[ "$attempts" -ge "$max_attempts" ]]; then
            fail "${label} did not become ready at ${url}. Check $FRONTEND_LOG for details."
        fi
        sleep 2
    done
}

cleanup() {
    local exit_code=$?

    if [[ -n "${BACKEND_PID:-}" ]]; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi

    if [[ -n "${FRONTEND_PID:-}" ]]; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi

    wait 2>/dev/null || true

    exit "$exit_code"
}

ensure_repo_root

log "Starting Career Compass..."
require_command git
require_command npm

sync_main_branch
ensure_redis
install_dependencies "$BACKEND_DIR" "backend"
install_dependencies "$FRONTEND_DIR" "frontend"

BACKEND_LOG="$PROJECT_ROOT/.dev-backend.log"
FRONTEND_LOG="$PROJECT_ROOT/.dev-frontend.log"

trap cleanup EXIT INT TERM

log "Starting backend on http://127.0.0.1:${BACKEND_PORT}..."
start_background_process "$BACKEND_DIR" "$BACKEND_LOG" BACKEND_PID npm run dev

log "Starting frontend on http://127.0.0.1:${FRONTEND_PORT}..."
start_background_process "$FRONTEND_DIR" "$FRONTEND_LOG" FRONTEND_PID env VITE_API_URL="http://127.0.0.1:${BACKEND_PORT}" npm run dev

wait_for_http "http://127.0.0.1:${FRONTEND_PORT}" "frontend"

log "Opening the frontend in your browser..."
open "http://127.0.0.1:${FRONTEND_PORT}" >/dev/null 2>&1 || true

log ""
log "Career Compass is starting up."
log "Frontend: http://127.0.0.1:${FRONTEND_PORT}"
log "Backend:  http://127.0.0.1:${BACKEND_PORT}"
log "Logs:     $BACKEND_LOG"
log "          $FRONTEND_LOG"
log ""
log "Press Ctrl+C to stop both services."

wait "$BACKEND_PID" "$FRONTEND_PID"