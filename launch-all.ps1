# =====================================================================
# 一毛AI画布 — 一键启动器 (launch-all)  [Windows / PowerShell]
# 参考 maomao\启动项目.ps1 改写，适配本项目结构
# ---------------------------------------------------------------------
# 依次拉起：API 网关 (:9004)  +  本地服务 localTool (:18080)  +  打开画布
#
# 运行方式（Windows）：
#   powershell -ExecutionPolicy Bypass -File .\launch-all.ps1
#
# 参数：
#   1   仅前台运行 localTool（方便看终端 [proxy] 日志，Ctrl+C 退出）
#   2   启动 网关 + localTool（后台运行 + 守护自动重启）+ 打开画布
#   （无参数）交互菜单
#
# 日志：
#   网关    apimart-gateway\logs\apimart_9004.log / .err.log
#   本地    localTool\logs\localtool_18080.log / .err.log
#   （所有运行日志统一收进各自模块的 logs\ 目录，已加入 .gitignore）
# =====================================================================
$ErrorActionPreference = "Continue"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
Set-Location -Path $ScriptDir

# =====================================================================
# ── 🔒 守护进程单实例锁（PID 锁文件方案）──
# 用锁文件记录守护进程 PID，确保同一时间只能有 1 个守护进程在运行。
# 修复：原命名 Mutex 方案在普通权限下（无 Global\ 权限退 Local\）跨 PowerShell
# 进程互斥不可靠，实测第二次仍能再开一个守护窗口。
# PID 锁文件优点：逻辑直观、跨进程可靠、无权限问题；进程退出后 PID 消失即可重新启动。
# 锁文件：<仓库根>\logs\watchdog.pid（logs 已在 .gitignore）。
# =====================================================================
$script:WatchdogLockFile = Join-Path $ScriptDir "logs\watchdog.pid"

# 获取锁。若锁文件记录的 PID 对应进程还活着且是 PowerShell 守护进程 → 返回 $false（拒绝）。
# 否则写入当前 PID 持有锁，返回 $true。
# 修复：仅当 PID 对应进程名是 powershell/pwsh 才认为守护进程存活，避免 PID 被系统进程
# 复用（如 dllhost）时误判"已有守护进程"导致闪退。
function Acquire-WatchdogLock {
    $lockDir = Split-Path $script:WatchdogLockFile -Parent
    if (-not (Test-Path $lockDir)) { New-Item -ItemType Directory -Force -Path $lockDir | Out-Null }

    # 读锁文件，判断旧守护进程是否仍存活
    if (Test-Path $script:WatchdogLockFile) {
        $oldPid = $null
        try { $oldPid = [int](Get-Content $script:WatchdogLockFile -Raw).Trim() } catch { $oldPid = $null }
        $alive = $false
        if ($oldPid -and $oldPid -gt 0) {
            $oldProc = Get-Process -Id $oldPid -ErrorAction SilentlyContinue
            if ($oldProc) {
                # 守护进程是 PowerShell 窗口，进程名必须是 powershell / pwsh
                if ($oldProc.ProcessName -match "^(powershell|pwsh)$") {
                    $alive = $true
                } else {
                    Write-Log "  ⚠️ 锁文件 PID=$oldPid 被非守护进程复用 ($($oldProc.ProcessName))，视为锁已失效。" "Warn"
                    try { Remove-Item $script:WatchdogLockFile -Force -ErrorAction SilentlyContinue } catch { }
                }
            }
        }
        if ($alive) {
            Write-Log "❌ 已有守护进程在运行 (PID=$oldPid)，拒绝重复启动。" "Error"
            Write-Log "   如需强制重启，请先退出原守护进程（按 Ctrl+C）。" "Warn"
            return $false
        }
        # 旧 PID 已死（守护进程退出了），允许覆盖
    }

    # 持有锁：写入当前进程 PID
    try { Set-Content -Path $script:WatchdogLockFile -Value "$PID" -Encoding UTF8 } catch {
        Write-Log "  ⚠️ 写入守护锁失败，继续启动：$($_.Exception.Message)" "Warn"
    }
    return $true
}

# 释放锁：仅当锁文件里的 PID 是当前进程时才删除，避免误删新守护进程的锁
function Release-WatchdogLock {
    if (-not (Test-Path $script:WatchdogLockFile)) { return }
    $curPid = $null
    try { $curPid = [int](Get-Content $script:WatchdogLockFile -Raw).Trim() } catch { $curPid = $null }
    if ($curPid -eq $PID) {
        try { Remove-Item $script:WatchdogLockFile -Force -ErrorAction SilentlyContinue } catch { }
    }
}

# 彻底清理守护进程：结束锁文件里记录的守护进程 PID，并删除锁文件
function Stop-Watchdog {
    if (-not (Test-Path $script:WatchdogLockFile)) {
        Write-Log "  ℹ️ 未发现守护进程锁文件，无需清理。" "Dim"
        return
    }
    $watchdogPid = $null
    try { $watchdogPid = [int](Get-Content $script:WatchdogLockFile -Raw).Trim() } catch { $watchdogPid = $null }
    if ($watchdogPid -and $watchdogPid -gt 0 -and $watchdogPid -ne $PID) {
        $alive = $false
        try { $alive = $null -ne (Get-Process -Id $watchdogPid -ErrorAction Stop) } catch { $alive = $false }
        if ($alive) {
            Write-Log "  🛑 正在结束守护进程 (PID=$watchdogPid)..." "Warn"
            Stop-Process -Id $watchdogPid -Force -ErrorAction SilentlyContinue
        }
    }
    try { Remove-Item $script:WatchdogLockFile -Force -ErrorAction SilentlyContinue } catch { }
}

# 脚本退出时（含 Ctrl+C）自动释放锁
$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action {
    try { Release-WatchdogLock } catch { }
}

# ── ⚙️ 全局配置（与本项目端口/目录一致）──
$Config = @{
    Gateway   = @{ Port = 9004;  Dir = "apimart-gateway"; Name = "AI 网关" }
    LocalTool = @{ Port = 18080; Dir = "localTool";       Name = "本地工具" }
}

# =====================================================================
# ── 🛠️ 核心辅助函数 ──
# =====================================================================

function Write-Log {
    param([string]$Message, [string]$Level = "Info")
    $colors = @{ "Info"="Cyan"; "Success"="Green"; "Warn"="Yellow"; "Error"="Red"; "Dim"="DarkGray" }
    Write-Host $Message -ForegroundColor $colors[$Level]
}

# 端口清理工具（释放被占用的端口）
function Clear-Port {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Log "  🧹 端口 $Port 被占用，正在清理旧进程..." "Warn"
        $connections.OwningProcess | Sort-Object -Unique | ForEach-Object {
            Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
}

# 端口状态检测
function Test-PortStatus {
    param([int]$Port, [string]$Name, [switch]$Quiet)
    $isAlive = [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if (-not $Quiet) {
        if ($isAlive) { Write-Log "  ● $Name (端口 $Port): 运行中" "Success" }
        else { Write-Log "  ○ $Name (端口 $Port): 已关闭" "Dim" }
    }
    return $isAlive
}

# 端口就绪等待：轮询直至端口可监听（就绪即返回），或超时返回 $false。
# 替代固定 sleep——进程起得快就秒回，起得慢也能等到，绝不因固定等待误判或卡死。
# 每 300ms 探测一次；默认超时 20s（给足 Node/Python 冷启动裕量）。
function Wait-PortReady {
    param([int]$Port, [int]$TimeoutSec = 20)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortStatus -Port $Port -Quiet) { return $true }
        Start-Sleep -Milliseconds 300
    }
    return $false
}

# Node 项目环境初始化（自动安装依赖与编译）
function Ensure-NodeEnvironment {
    param([string]$Path, [switch]$NeedsBuild)
    Push-Location $Path
    if (-not (Test-Path "node_modules")) {
        Write-Log "  📦 [$Path] 首次运行，正在安装依赖..." "Info"
        npm install 2>&1 | Out-Null
    }
    if ($NeedsBuild -and -not (Test-Path "dist\index.js")) {
        Write-Log "  🛠️ [$Path] 正在编译 TypeScript..." "Info"
        npm run build 2>&1 | Out-Null
    }
    Pop-Location
}

# 打开画布
function Open-Canvas {
    $url = "http://127.0.0.1:$($Config.LocalTool.Port)"
    Write-Log "  🌐 打开画布 $url" "Info"
    Start-Process $url
}

# =====================================================================
# ── 🚀 业务功能模块 ──
# =====================================================================

# 1. 启动 AI 网关 (9004)
function Start-Gateway {
    $dir = Join-Path $ScriptDir $Config.Gateway.Dir
    if (-not (Test-Path $dir)) { Write-Log "❌ 未找到网关目录: $dir" "Error"; return $false }

    Clear-Port -Port $Config.Gateway.Port

    # 优雅解析 .env 文件（含 OPEN_RELAY / LOVART_* 等）
    $envFile = Join-Path $dir ".env"
    if (Test-Path $envFile) {
        Get-Content $envFile -Encoding UTF8 | Where-Object { $_ -match '^([^#=]+)=(.*)$' } | ForEach-Object {
            $key = $Matches[1].Trim()
            $val = $Matches[2].Trim() -replace '^["'']|["'']$', '' # 去除首尾引号
            [Environment]::SetEnvironmentVariable($key, $val)
        }
    }

    # 定位系统 Python 3.12（不用 venv），只负责启动，不检查/安装依赖。
    # 候选来源（按优先级）：PATH 的 python → py -3.12 → 常见安装路径。
    # 每个候选都要验证版本确为 3.12，避免命中 Windows Store 的 python 别名空壳。
    function Test-UsablePython {
        param([string]$Exe)
        if (-not (Test-Path $Exe)) { return $false }
        $out = & $Exe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>$null
        return ($LASTEXITCODE -eq 0 -and $out -and $out.Trim() -eq "3.12")
    }
    $SystemPython = $null
    $pythonCmd = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonCmd -and (Test-UsablePython $pythonCmd.Source)) { $SystemPython = $pythonCmd.Source }
    if (-not $SystemPython) {
        $pyOut = & py -3.12 -c "import sys; print(sys.executable)" 2>$null
        if ($LASTEXITCODE -eq 0 -and $pyOut -and (Test-UsablePython $pyOut.Trim())) { $SystemPython = $pyOut.Trim() }
    }
    if (-not $SystemPython) {
        $cand = "C:\Users\xinye\AppData\Local\Programs\Python\Python312\python.exe"
        if (Test-UsablePython $cand) { $SystemPython = $cand }
    }
    if (-not $SystemPython) {
        Write-Log "  ❌ 未找到可用的系统 Python 3.12，请先安装 Python 3.12" "Error"
        return $false
    }
    Write-Log "  🐍 使用 Python: $SystemPython" "Dim"

    # 优先使用 pythonw.exe (无控制台版本) 配合隐藏窗口
    $pythonExe = if (Test-Path (Join-Path (Split-Path $SystemPython) "pythonw.exe")) {
        Join-Path (Split-Path $SystemPython) "pythonw.exe"
    } else { $SystemPython }

    # 日志统一收纳到模块自己的 logs\ 目录（避免散落在仓库根目录）
    $logDir = Join-Path $dir "logs"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null

    # 后台完全静默启动（使用 -WindowStyle Hidden 彻底隐藏黑框）
    Start-Process -FilePath $pythonExe -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port $($Config.Gateway.Port)" `
        -RedirectStandardOutput (Join-Path $logDir "apimart_9004.log") `
        -RedirectStandardError (Join-Path $logDir "apimart_9004.err.log") `
        -WindowStyle Hidden -WorkingDirectory $dir

    # 就绪等待（替代固定 sleep）：端口可监听即返回；超时则判定启动失败，避免"假成功"
    if (Wait-PortReady -Port $Config.Gateway.Port -TimeoutSec 25) {
        Write-Log "  ✅ AI 网关已启动 (日志: apimart-gateway\logs\apimart_9004.log)" "Success"
        return $true
    }
    Write-Log "  ❌ AI 网关启动超时，请查看 apimart-gateway\logs\apimart_9004.err.log" "Error"
    return $false
}

# 2. 启动 LocalTool (18080)
function Start-LocalTool {
    param([switch]$RunInForeground)

    $dir = Join-Path $ScriptDir $Config.LocalTool.Dir
    if (-not (Test-Path $dir)) { Write-Log "❌ 未找到 localTool 目录: $dir" "Error"; return $false }

    Clear-Port -Port $Config.LocalTool.Port
    Ensure-NodeEnvironment -Path $dir -NeedsBuild

    if ($RunInForeground) {
        Write-Log "`n🚀 前台运行 LocalTool (端口 $($Config.LocalTool.Port))... [按 Ctrl+C 停止]" "Success"
        Set-Location $dir
        node dist/index.js
    } else {
        # 日志统一收纳到模块自己的 logs\ 目录（避免散落在仓库根目录）
        $logDir = Join-Path $dir "logs"
        New-Item -ItemType Directory -Force -Path $logDir | Out-Null

        # 后台完全静默启动（使用 -WindowStyle Hidden 彻底隐藏 Node 的 CMD 弹窗）
        Start-Process -FilePath "node" -ArgumentList (Join-Path $dir "dist\index.js") `
            -RedirectStandardOutput (Join-Path $logDir "localtool_18080.log") `
            -RedirectStandardError (Join-Path $logDir "localtool_18080.err.log") `
            -WindowStyle Hidden -WorkingDirectory $dir
        # 就绪等待（替代固定 sleep）：端口可监听即返回；超时则判定启动失败
        if (Wait-PortReady -Port $Config.LocalTool.Port -TimeoutSec 25) {
            Write-Log "  ✅ LocalTool 已启动 (日志: localTool\logs\localtool_18080.log)" "Success"
            return $true
        }
        Write-Log "  ❌ LocalTool 启动超时，请查看 localTool\logs\localtool_18080.err.log" "Error"
        return $false
    }
}

# 3. 守护模式：同时启动并自动重启
function Start-Watchdog {
    # 单实例保护：获取锁失败（已有存活守护进程）则直接退出
    if (-not (Acquire-WatchdogLock)) { exit 1 }

    Write-Log "`n📡 正在启动服务群..." "Info"
    $null = Start-Gateway
    $null = Start-LocalTool
    Start-Sleep -Seconds 1
    Open-Canvas

    Write-Log "`n🛡️ 进入守护模式 (5秒轮询，掉线自动重启)... [按 Ctrl+C 退出控制台则关闭所有]" "Info"
    Write-Log "   🔒 本守护进程 PID=$PID（全局唯一，重复启动将被拒绝）" "Dim"
    try {
        while ($true) {
            if (-not (Test-PortStatus -Port $Config.Gateway.Port -Name $Config.Gateway.Name -Quiet)) {
                Write-Log "  ⚠️ $(Get-Date -Format 'HH:mm:ss') 网关掉线，正在重启..." "Warn"
                $null = Start-Gateway
            }
            if (-not (Test-PortStatus -Port $Config.LocalTool.Port -Name $Config.LocalTool.Name -Quiet)) {
                Write-Log "  ⚠️ $(Get-Date -Format 'HH:mm:ss') 本地工具掉线，正在重启..." "Warn"
                $null = Start-LocalTool
            }
            Start-Sleep -Seconds 5
        }
    } finally {
        # 退出守护循环时释放锁（Ctrl+C 也会触发）
        Release-WatchdogLock
    }
}

# =====================================================================
# ── 🖥️ 交互与路由 ──
# =====================================================================

function Show-Dashboard {
    Clear-Host
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "   一毛AI画布 — 本地服务控制台" -ForegroundColor White
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Log "`n📊 当前状态：" "Info"
    $null = Test-PortStatus -Port $Config.Gateway.Port -Name $Config.Gateway.Name
    $null = Test-PortStatus -Port $Config.LocalTool.Port -Name $Config.LocalTool.Name

    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "   [1] 启动 LocalTool (前台, 看 [proxy] 日志)"
    Write-Host "   [2] 启动 网关 + LocalTool (后台完全静默 + 守护 + 打开画布)"
    Write-Host "   [q] 退出并清理后台进程" -ForegroundColor DarkGray
    Write-Host "========================================" -ForegroundColor Cyan
}

# 处理命令行参数 (静默执行)
if ($args.Count -gt 0) {
    switch ($args[0]) {
        "1" { Start-LocalTool -RunInForeground; exit 0 }
        "2" { Start-Watchdog; exit 0 }
    }
}

# 交互菜单循环
while ($true) {
    Show-Dashboard
    $CHOICE = Read-Host "`n👉 请选择操作 (1/2/q)"
    switch ($CHOICE) {
        "1" { Start-LocalTool -RunInForeground }
        "2" { Start-Watchdog }
        { $_ -match "^[qQ]$" } { 
            Write-Log "👋 正在清理后台进程并退出..."
            Clear-Port -Port $Config.Gateway.Port
            Clear-Port -Port $Config.LocalTool.Port
            Stop-Watchdog
            exit 0 
        }
        default { Write-Log "❌ 无效选择，请重试" "Error"; Start-Sleep -Seconds 1 }
    }

    Write-Host "`n按回车键返回菜单..." -ForegroundColor DarkGray
    $null = Read-Host
}