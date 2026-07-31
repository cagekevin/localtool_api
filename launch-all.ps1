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
#   网关    apimart-gateway\apimart_9004.log / .err.log
#   本地    localTool\localtool_18080.log / .err.log
# =====================================================================
$ErrorActionPreference = "Continue"
$ScriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { $PWD.Path }
Set-Location -Path $ScriptDir

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

    # 有 requirements.txt 则使用独立 venv；否则直接用系统 python（同 run_local.bat）
    $useVenv = $false
    $venvPython = Join-Path $dir "venv\Scripts\python.exe"
    $reqFile = Join-Path $dir "requirements.txt"
    if (Test-Path $reqFile) {
        if (-not (Test-Path (Join-Path $dir "venv\Scripts\pip.exe"))) {
            Write-Log "  🐍 正在创建 Python 虚拟环境..." "Info"
            & python -m venv (Join-Path $dir "venv") 2>&1 | Out-Null
        }
        & $venvPython -m pip install -r $reqFile 2>&1 | Out-Null
        $useVenv = $true
    }
    
    # 优先使用 pythonw.exe (无控制台版本的 python)，如果没有则用普通 python 配合隐藏窗口
    $pythonwExe = if ($useVenv) { Join-Path $dir "venv\Scripts\pythonw.exe" } else { "pythonw" }
    $pythonExe = if (Get-Command $pythonwExe -ErrorAction SilentlyContinue) { $pythonwExe } else { if ($useVenv) { $venvPython } else { "python" } }

    # 后台完全静默启动（使用 -WindowStyle Hidden 彻底隐藏黑框）
    Start-Process -FilePath $pythonExe -ArgumentList "-m uvicorn main:app --host 127.0.0.1 --port $($Config.Gateway.Port)" `
        -RedirectStandardOutput (Join-Path $dir "apimart_9004.log") `
        -RedirectStandardError (Join-Path $dir "apimart_9004.err.log") `
        -WindowStyle Hidden -WorkingDirectory $dir

    Start-Sleep -Seconds 3
    Write-Log "  ✅ AI 网关已启动 (日志: apimart-gateway\apimart_9004.log)" "Success"
    return $true
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
        # 后台完全静默启动（使用 -WindowStyle Hidden 彻底隐藏 Node 的 CMD 弹窗）
        Start-Process -FilePath "node" -ArgumentList (Join-Path $dir "dist\index.js") `
            -RedirectStandardOutput (Join-Path $dir "localtool_18080.log") `
            -RedirectStandardError (Join-Path $dir "localtool_18080.err.log") `
            -WindowStyle Hidden -WorkingDirectory $dir
        Start-Sleep -Seconds 2
        Write-Log "  ✅ LocalTool 已启动 (日志: localTool\localtool_18080.log)" "Success"
        return $true
    }
}

# 3. 守护模式：同时启动并自动重启
function Start-Watchdog {
    Write-Log "`n📡 正在启动服务群..." "Info"
    $null = Start-Gateway
    $null = Start-LocalTool
    Start-Sleep -Seconds 1
    Open-Canvas

    Write-Log "`n🛡️ 进入守护模式 (5秒轮询，掉线自动重启)... [按 Ctrl+C 退出控制台则关闭所有]" "Info"
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
            exit 0 
        }
        default { Write-Log "❌ 无效选择，请重试" "Error"; Start-Sleep -Seconds 1 }
    }

    Write-Host "`n按回车键返回菜单..." -ForegroundColor DarkGray
    $null = Read-Host
}