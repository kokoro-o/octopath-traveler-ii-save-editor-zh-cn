#!/bin/zsh
set -eu
cd "${0:A:h}"
label='local.game-tools-collection.octopath-ii'
if job="$(launchctl list "$label" 2>/dev/null)"; then
  if [[ "$job" == *"$PWD/启动八方旅人2中文版.command"* ]]; then
    launchctl remove "$label"
  fi
fi
if [[ -f .local/server.pid ]]; then
  pid="$(cat .local/server.pid)"
  # Only stop this project's server, even if a stale PID was reused.
  if [[ "$(ps -p "$pid" -o command= 2>/dev/null)" == *node*build/index.js* ]] && \
     [[ "$(/usr/sbin/lsof -a -p "$pid" -d cwd -Fn 2>/dev/null)" == *$'\n'"n$PWD" ]]; then
    kill "$pid"
  fi
  rm -f .local/server.pid
fi
for attempt in {1..20}; do
  if ! /usr/sbin/lsof -nP -iTCP:18782 -sTCP:LISTEN >/dev/null 2>&1; then break; fi
  sleep 0.1
done
print '本地中文版服务已停止。'
