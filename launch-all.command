#!/bin/bash
# ============================================================================
# 猫猫AI画布 — 一键启动器 (launch-all)
# 双击启动：依次拉起 API 网关 (:9004) + 本地服务 (:18080) + 打开画布
# ============================================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║     猫猫AI画布 — 一键启动                   ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── 1. 启动 API 网关 (:9004) ──
echo "  [1/3] 启动 API 网关 (apimart-gateway :9004)..."
cd "$SCRIPT_DIR/apimart-gateway"
if [ -f 启动网关.command ]; then
    bash 启动网关.command &
    GW_PID=$!
else
    echo "        ⚠️  未找到 启动网关.command，跳过"
fi
cd "$SCRIPT_DIR"
sleep 2

# ── 2. 启动 localTool (:18080) ──
echo "  [2/3] 启动本地服务 (localTool :18080)..."
cd "$SCRIPT_DIR/localTool"
if [ -f start.sh ]; then
    bash start.sh &
    LOCAL_PID=$!
else
    echo "        ⚠️  未找到 start.sh，跳过"
fi
cd "$SCRIPT_DIR"
sleep 3

# ── 3. 打开画布 ──
echo "  [3/3] 打开画布 http://127.0.0.1:18080 ..."
open "http://127.0.0.1:18080" 2>/dev/null || xdg-open "http://127.0.0.1:18080" 2>/dev/null || true

echo ""
echo "  ═══════════════════════════════════════════"
echo "    启动完成！"
echo "    画布: http://127.0.0.1:18080"
echo "    网关: http://127.0.0.1:9004"
echo ""
echo "    停止服务:"
echo "      localTool: 在 localTool 终端按 Ctrl+C"
echo "      网关:      pkill -f 'uvicorn main:app'"
echo "  ═══════════════════════════════════════════"
echo ""
echo "  按回车键关闭此窗口（服务仍在后台运行）..."
read -r
