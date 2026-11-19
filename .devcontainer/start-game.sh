#!/usr/bin/env bash
set -euo pipefail

health_url="http://127.0.0.1:${PORT:-5173}/api/health"
log_file="${TMPDIR:-/tmp}/reef-relay-codespaces.log"

if curl --silent --fail --max-time 2 "$health_url" >/dev/null; then
  exit 0
fi

nohup npm run dev </dev/null >"$log_file" 2>&1 &
launch_pid=$!

for ((attempt = 0; attempt < 25; attempt++)); do
  if curl --silent --fail --max-time 2 "$health_url" >/dev/null; then
    exit 0
  fi
  kill -0 "$launch_pid" 2>/dev/null || break
  sleep 1
done

tail -n 30 "$log_file" >&2
exit 1
