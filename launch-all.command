#!/bin/zsh
# =====================================================================
# 一毛AI画布 — 一键启动器 (launch-all)  [macOS / zsh]
# 依次拉起：API 网关 (:9004)  +  本地服务 localTool (:18080)  +  打开画布
#
# 运行方式（macOS）：
#   ./launch-all.command
#   ./launch-all.command 1    仅前台运行 localTool（看 [proxy] 日志，Ctrl+C 退出）
#   ./launch-all.command 2    后台启动 网关+localTool + 守护自动重启 + 打开画布
# =====================================================================

set -e

ScriptDir="$(cd "$(dirname "$0")" && pwd)"
cd "$ScriptDir"

GW_PORT=9004
LT_PORT=18080
GW_DIR="apimart-gateway"
LT_DIR="localTool"

# ── 日志 ──
log()   { echo "\033[36m$1\033[0m"; }   # cyan
ok()    { echo "\033[32m$1\033[0m"; }   # green
warn()  { echo "\033[33m$1\033[0m"; }   # yellow
err()   { echo "\033[31m$1\033[0m"; }   # red
dim()   { echo "\033[90m$1\033[0m"; }   # dim

# ── 端口清理（macOS: lsof + kill） ──
clear_port() {
  local port=$1
  local pid
  pid=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pid" ]; then
    warn "  🧹 端口 $port 被占用 (PID $pid)，正在清理旧进程..."
    kill "$pid" 2>/dev/null || true
    sleep 1
    # 强杀兜底
    pid=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    [ -n "$pid" ] && kill -9 "$pid" 2>/dev/null || true
    sleep 1
  fi
}

# ── 端口状态检测 ──
test_port() {
  local port=$1 name=$2 quiet=$3
  local alive
  alive=$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$quiet" ]; then
    if [ -n "$alive" ]; then ok "  ● $name (端口 $port): 运行中"; else dim "  ○ $name (端口 $port): 已关闭"; fi
  fi
  [ -n "$alive" ]
}

# ── Node 环境初始化 ──
ensure_node_env() {
  local path=$1 needsbuild=$2
  pushd "$path" >/dev/null
  if [ ! -d node_modules ]; then
    log "  📦 [$path] 首次运行，正在安装依赖..."
    npm install >/dev/null 2>&1
  fi
  if [ "$needsbuild" = "1" ] && [ ! -f dist/index.js ]; then
    log "  🛠️ [$path] 正在编译 TypeScript..."
    npm run build >/dev/null 2>&1
  fi
  popd >/dev/null
}

# ── 打开画布（去重：端口已活则不再重复 open，避免多次运行堆积标签页）──
open_canvas() {
  local url="http://127.0.0.1:$LT_PORT"
  if test_port "$LT_PORT" "" quiet; then
    log "  🌐 画布已在运行，跳过重复打开: $url"
    return 0
  fi
  log "  🌐 打开画布 $url"
  open "$url"
}

# ── VPN 前置检测（连 Lovart 必须开 VPN，见 CLAUDE.md §五.1）──
# 探测 lgw.lovart.ai:443 连通性。不通时显示红字警告，但不阻塞启动。
# 设计：检测失败【不硬中断、不暂停】（系统级代理也可能让 localTool 出网），仅醒目提醒。
check_vpn() {
  local host="lgw.lovart.ai" port=443 timeout=5
  if nc -zv -w "$timeout" "$host" "$port" >/dev/null 2>&1; then
    ok "  ✅ VPN 检测通过：$host:$port 可达"
    return 0
  fi
  err "  ⚠️  警告：VPN 未连通（$host:$port 不可达）！"
  err "     生图/生视/聊天依赖 Lovart，必须开启 VPN/代理才能访问。"
  err "     不开 VPN 会导致网关静默 502、图片上传连接失败。请先开启 VPN 再使用。"
  return 1
}

# ── 1. 启动网关 (9004) ──
start_gateway() {
  local dir="$ScriptDir/$GW_DIR"
  [ ! -d "$dir" ] && { err "❌ 未找到网关目录: $dir"; return 1; }

  clear_port "$GW_PORT"

  # 加载 .env（OPEN_RELAY / LOVART_* 等）
  local envfile="$dir/.env"
  if [ -f "$envfile" ]; then
    while IFS= read -r line; do
      # 跳过注释与空行
      [ -z "$line" ] && continue
      case "$line" in \#*) continue ;; esac
      # 仅处理含等号的行
      case "$line" in *=*) ;; *) continue ;; esac
      local key="${line%%=*}"
      local val="${line#*=}"
      key="$(echo "$key" | xargs)"
      val="$(echo "$val" | sed -E 's/^["'"'"']|["'"'"']$//g' | xargs)"
      [ -n "$key" ] && export "$key=$val"
    done < "$envfile"
  fi

  local logf="$dir/apimart_9004.log"
  local errf="$dir/apimart_9004.err.log"

  pushd "$dir" >/dev/null
  nohup python3 -m uvicorn main:app --host 127.0.0.1 --port "$GW_PORT" \
    >"$logf" 2>"$errf" &
  popd >/dev/null

  sleep 3
  if test_port "$GW_PORT" "" quiet; then
    ok "  ✅ AI 网关已启动 (日志: $GW_DIR/apimart_9004.log)"
    return 0
  else
    err "  ❌ AI 网关启动失败，请查看 $GW_DIR/apimart_9004.err.log"
    return 1
  fi
}

# ── 2. 启动 LocalTool (18080) ──
start_localtool() {
  local foreground=$1
  local dir="$ScriptDir/$LT_DIR"
  [ ! -d "$dir" ] && { err "❌ 未找到 localTool 目录: $dir"; return 1; }

  clear_port "$LT_PORT"
  ensure_node_env "$dir" 1

  if [ "$foreground" = "1" ]; then
    ok "🚀 前台运行 LocalTool (端口 $LT_PORT)... [按 Ctrl+C 停止]"
    cd "$dir" && node dist/index.js
  else
    local logf="$dir/localtool_18080.log"
    local errf="$dir/localtool_18080.err.log"
    nohup node "$dir/dist/index.js" >"$logf" 2>"$errf" &
    sleep 2
    if test_port "$LT_PORT" "" quiet; then
      ok "  ✅ LocalTool 已启动 (日志: $LT_DIR/localtool_18080.log)"
      return 0
    else
      err "  ❌ LocalTool 启动失败，请查看 $LT_DIR/localtool_18080.err.log"
      return 1
    fi
  fi
}

# ── 3. 守护模式 ──
start_watchdog() {
  log "📡 正在启动服务群..."
  check_vpn || true   # 只检测一次，不阻断；未开 VPN 会醒目提示
  start_gateway || true
  start_localtool "" || true
  sleep 1
  open_canvas

  log "🛡️ 进入守护模式 (5秒轮询，掉线自动重启)... [Ctrl+C 退出]"
  while true; do
    if ! test_port "$GW_PORT" "" quiet; then
      warn "  ⚠️ $(date +%H:%M:%S) 网关掉线，正在重启..."
      start_gateway || true
    fi
    if ! test_port "$LT_PORT" "" quiet; then
      warn "  ⚠️ $(date +%H:%M:%S) 本地工具掉线，正在重启..."
      start_localtool "" || true
    fi
    sleep 5
  done
}

# ── 交互菜单 ──
show_dashboard() {
  clear
  echo "\033[36m========================================\033[0m"
  echo "\033[37m   一毛AI画布 — 本地服务控制台\033[0m"
  echo "\033[36m========================================\033[0m"
  log "📊 当前状态："
  test_port "$GW_PORT" "AI 网关"
  test_port "$LT_PORT" "本地工具"
  echo "\033[36m========================================\033[0m"
  echo "   [1] 启动 LocalTool (前台, 看 [proxy] 日志)"
  echo "   [2] 启动 网关 + LocalTool (后台静默 + 守护 + 打开画布)"
  echo "\033[90m   [q] 退出并清理后台进程\033[0m"
  echo "\033[36m========================================\033[0m"
}

cleanup() {
  log "👋 正在清理后台进程..."
  clear_port "$GW_PORT"
  clear_port "$LT_PORT"
  exit 0
}
trap cleanup INT TERM

# ── 清理已有的同名守护进程（避免多次双击越开越多、互相抢端口自动重启）──
cleanup_stale_daemons() {
  # 列出除自己之外的 launch-all.command 守护进程并杀掉
  local self=$$
  local pids
  pids=$(pgrep -f "launch-all.command" 2>/dev/null | grep -v "^$self$" || true)
  if [ -n "$pids" ]; then
    warn "  🧹 发现旧的启动器守护进程，正在清理..."
    echo "$pids" | xargs -r kill 2>/dev/null || true
    sleep 1
  fi
}

# ── 路由 ──
# 无参双击：直接进守护模式（一键拉起网关+localTool+打开画布），避免交互菜单在
# .command 双击场景下拿不到输入而直接 exit（docs 复测发现：双击只打印状态就退出）。
#   1 → 前台仅跑 localTool（看 [proxy]/[official] 日志，Ctrl+C 退出）
#   2 / 无参 → 后台守护模式（掉线自动重启 + 打开画布）
case "${1:-}" in
  1) start_localtool "1" ;;
  "")
    cleanup_stale_daemons
    log "🚀 无参启动：进入守护模式（网关 + 本地工具 + 画布）..."
    start_watchdog
    ;;
  *) cleanup_stale_daemons; start_watchdog ;;   # 2 或其他参数一律守护模式
esac
