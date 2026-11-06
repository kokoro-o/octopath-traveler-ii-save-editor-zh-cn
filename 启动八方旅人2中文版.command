#!/bin/zsh
set -eu
cd "${0:A:h}"
mkdir -p .local/logs

url='http://127.0.0.1:18783/octopath-traveler-ii/save-editor'
label='local.octopath-traveler-ii-save-editor-zh-cn'
node_bin="$(command -v node || true)"
if [[ -z "$node_bin" ]]; then
  candidates=( "$HOME"/.nvm/versions/node/*/bin/node(N) /opt/homebrew/bin/node(N) )
  if (( ${#candidates} )); then node_bin="${candidates[-1]}"; fi
fi
if [[ -z "$node_bin" ]]; then
  print '未找到 Node.js。请先安装 Node.js 24，再重新双击启动。'
  exit 1
fi
export PATH="${node_bin:h}:$PATH"

if [[ ! -d node_modules ]]; then npm ci --no-audit --no-fund; fi
if [[ ! -f build/index.html || -s .local/last-build-base ]]; then BASE_PATH='' npm run build; fi

if [[ "${1:-}" == '--serve' ]]; then
  exec "$node_bin" node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 18783 --strictPort
fi

if curl --max-time 2 -fsS "$url" -o /dev/null 2>/dev/null; then
  print "中文版已在运行：$url"
  if [[ "${1:-}" != '--no-open' ]]; then open -a Safari "$url"; fi
  exit 0
fi

if /usr/sbin/lsof -nP -iTCP:18783 -sTCP:LISTEN >/dev/null 2>&1; then
  print '端口 18783 已被其他程序使用。请关闭占用程序后重试。'
  exit 1
fi

if job="$(launchctl list "$label" 2>/dev/null)"; then
  if [[ "$job" != *"$PWD/启动八方旅人2中文版.command"* ]]; then
    print '同名后台服务来自其他位置，未对其进行操作。'
    exit 1
  fi
  launchctl remove "$label"
fi
launchctl submit -l "$label" -o "$PWD/.local/logs/server.log" -e "$PWD/.local/logs/server.log" \
  -- /bin/zsh "$PWD/启动八方旅人2中文版.command" --serve

for attempt in {1..30}; do
  if curl --max-time 2 -fsS "$url" -o /dev/null 2>/dev/null; then
    print "中文版已启动：$url"
    print '在网页中选择存档；保存副本会下载带 .edited 后缀的新文件。'
    print '此窗口可以关闭。停止服务请双击“停止八方旅人2中文版.command”。'
    if [[ "${1:-}" != '--no-open' ]]; then open -a Safari "$url"; fi
    exit 0
  fi
  sleep 1
done
print '启动失败，请查看 .local/logs/server.log。'
exit 1
