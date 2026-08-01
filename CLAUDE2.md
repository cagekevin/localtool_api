# CLAUDE.md · 一毛AI画布多端合一（自研后端替代版）架构师工作手册

> 最后更新：2026-07-31

## -0. TL;DR（AI 进场速查）

- **项目本质**：用自研 `localTool`(Node/TS, :18080) + `apimart-gateway`(Python/FastAPI, :9004) **替换原版三个闭源可执行引擎**（`一毛本地引擎Win端.exe` / `一毛AI画布引擎Mac端Arm版` / `一毛AI画布引擎Mac端Intel版`）。
- **分层铁律**：`localTool` = **一毛画布专属适配层**（为一毛画布而生，改它适配画布）；`apimart-gateway` = **通用第三方 AI API 中继**（不是为一毛画布写的，要通用、支持同步+异步双模）。
- **唯一入口**：所有画布请求 → `localTool :18080 /api/proxy` → 网关 `:9004` → Lovart。`dist/` 前端也由 localTool 托管。
- **端口红线**：`18080`(localTool) / `9004`(网关) 不可改；`dist/` 是混淆黑盒，**默认只读，经用户授权可改**（走 §7.1 规程）。
- **启动**：`launch-all.ps1`(Win) / `launch-all.command`(Mac)；手动见 §3。
- **致命前置**：**连 Lovart 必须开 VPN**（连 `lgw.lovart.ai:443`），否则网关 502。
- **聊天独立**：`chat_completions` 走内部 `run_and_get`，**不碰** `_do_submit`；改图片同步逻辑不会弄坏聊天。
- **关键文档**：`08-后端API同步异步改造方案.md`（双模设计）、`02-断点三域梳理.md`（proxyMode 定调）、`01-接口兼容性审计.md.bak.md`（审计基线）。

---

## 0. 项目全局定位

- **目标**：用 `localTool` + `apimart-gateway` 替换三个闭源画布引擎，实现多端合一（Win/Mac Arm/Mac Intel 一套自研后端）。
- **审计方式**：全面读取自研后端源码（`localTool/src`、`apimart-gateway/main.py`）与契约文档，同时分析 `dist/` 前端实际调用的全部接口，逐一比对。
- **审计日期**：2026-07-30。
- **当前状态**：
  - ✅ `localTool` 已承担：前端托管、本地 KV/文件/任务/资源存储、画布请求代理（`/api/proxy`）、生图异步转同步（P0-4 `handleAsyncPoll`）。
  - ✅ `apimart-gateway` 已承担：Lovart 中继、chat 同步（`run_and_get`）、image/video 异步（`_do_submit` + `GET /v1/tasks/{id}` 轮询）、webhook 触发、`pending_confirmation` 自动确认。
  - 🔜 进行中：`apimart-gateway` 原生**双模**（同步 `wait` + 异步 `task_id`）改造方案见 `08-后端API同步异步改造方案.md`；落盘转存（不丢图）作为 localTool 适配增强待落地。

---

## 1. 运行时全貌

| 进程 | 载体 | 端口 | 职责 |
|---|---|---|---|
| 画布前端 | `dist/`（混淆构建产物，localTool 托管） | 经 18080 | 画布 UI、节点编辑、生图/生视/聊天交互 |
| localTool | `localTool/dist/index.js`（Node/TS） | 127.0.0.1:18080 | 前端托管 + 文件(`/files/`) + KV/任务 + **画布专属适配**（同步化、字段对齐、落盘） |
| apimart-gateway | `apimart-gateway/main.py`（Python/FastAPI） | 127.0.0.1:9004 | 通用 Lovart 中继：同步/异步双模、webhook、确认 |
| Lovart 后端 | 第三方 `lgw.lovart.ai` | 443 | 真实生图/生视/聊天执行（**需 VPN**） |

### 1.1 localTool 七类职责（速查）
1. **前端托管**：静态 `dist/` + 自动开浏览器。
2. **画布请求代理**（`/api/proxy`）：透明转发 + 协议翻译（剥信封/SSE 过滤/异步转同步/超时），转发目标为 **apimart-gateway（→Lovart）**，kkidc 经此透传。
3. **本地存储**：KV / 任务 / 资源 / 文件落盘 `/files/`（SQLite）。
4. **平台接口（自研替换官方 1mao）**：`/public/platform/builtin`、`/public/platform/models`、`/plugin/manifest.json`、`/api/workflow-apps/*`、`/api/sync/default` 兜底 —— 均为本地静态兜底，不连官方 1mao。
5. **管理接口**：`/api/admin/*`（统计/清理/导入导出）。
6. **上传/资产**：`/api/assets/upload`、`/api/upload/app-asset`。
7. **网关自检引导**：读 apimart-gateway `.env` 校验 AK/SK、提示 VPN。

> ② 的转发目标是 apimart-gateway（→Lovart）；④ 是用来**替换官方 1mao** 的，两者边界清晰。

### 1.2 apimart-gateway 职责（速查，详见 main.py 顶部）
纯【中转站】，只对接 Lovart，做三件事：
1. 接收外部请求（OpenAI 风格：`/v1/images`、`/v1/videos`、`/v1/chat`）。
2. 最小规范化（尺寸解析、数量约束、模型别名映射→Lovart 工具名）。
3. 转发 Lovart 并回传结果。

不关心两件事：✗ 前端（何种节点/特惠/混淆字段，网关只认「图片/视频/聊天」三种能力）；✗ Lovart 内部（项目管理/工具名/生成策略由 `lovart_client.py` 负责，本文件只调用不侵入）。鲁棒性（项目失效重建、`done` 防抖、高成本自动确认）属对上游不稳定性兜底，不改变中转定位。

---

## 2. 目录职责（当前实际状态）

| 目录/文件 | 职责 |
|---|---|
| `dist/` | 画布前端构建产物（混淆）。**默认黑盒只读**，适配逻辑优先放 `localTool` 侧；**经用户授权可改**，见 §7.1。 |
| `localTool/` | ★ 一毛画布专属适配层（Node/TS）。`src/index.ts` 入口，`src/routes/`(system/files/resources)，`src/db/`(SQLite)，`src/utils/fileStore.ts`(落盘)。 |
| `apimart-gateway/` | ★ 通用 AI API 中继（Python）。`main.py` 主程序，`lovart_client.py` Lovart 客户端，`.env` 凭据（AK/SK/`LOVART_BASE_URL`/`OPEN_RELAY`）。 |
| `launch-all.ps1` / `launch-all.command` | 一键启动器（Win / Mac），拉起网关+localTool+打开画布，含守护自动重启。 |
| `01-接口兼容性审计.md.bak.md` | 审计基线（2026-07-30）：前端接口 vs 自研后端比对。 |
| `02-断点三域梳理.md` | proxyMode 定调：`local-tool` 唯一入口。 |
| `03-断点总表-说明补全.md` | 断点全量清单与说明。 |
| `04-调试基建与探针说明.md` | 调试探针/日志位置。 |
| `05-断点修复方案.md` | 各断点修复方案。 |
| `06-断点修复实施计划书.md` | 实施排期。 |
| `07-使用说明.txt` | 使用说明。 |
| `08-后端API同步异步改造方案.md` | **网关双模 + localTool 适配**设计（本手册 §4/§5 依据）。 |
| `daily/` | 执行日志（按日期）。 |

---

## 3. 启动方式

### 一键启动（推荐）
```powershell
# Windows
powershell -ExecutionPolicy Bypass -File .\launch-all.ps1        # 交互菜单
powershell -ExecutionPolicy Bypass -File .\launch-all.ps1 2      # 网关+localTool 后台+守护+打开画布
# Mac
./launch-all.command
```
> 启动前**确认已开 VPN**（否则网关连不上 Lovart → 502）。

### 手动启动
```bash
# 1) 网关（Python，需先装依赖）
cd apimart-gateway
python -m venv venv && venv\Scripts\pip install -r requirements.txt   # Windows 用纯 uvicorn，勿装 uvloop
python -m uvicorn main:app --host 127.0.0.1 --port 9004

# 2) localTool（Node/TS，需先编译）
cd localTool
npm install
npm run build          # = tsc，产出 dist/index.js
node dist/index.js     # 前台运行，看 [proxy] 日志；Ctrl+C 退出

# 3) 打开画布
# 浏览器访问 http://127.0.0.1:18080
```
> 依赖：网关 `fastapi / uvicorn / httpx / python-multipart`；localTool `sql.js`（运行时）+ `typescript / @types/node`（dev）。

---

## 4. 架构分层与铁律

1. **`localTool` 为一毛画布而生**：所有"让画布好用"的事落在这一层——异步转同步、字段对齐（剥 `{code,data}` 信封、对齐 `t.data[0].url`）、落盘不丢图。
2. **`apimart-gateway` 通用中继**：保持协议翻译 + Lovart 中继的纯粹性；原生支持同步(`wait`)+异步(`task_id`)双模，服务一毛画布也服务未来任意调用方。**不为"多画布"在网关里写画布特例**。
3. **请求通道（非绝对）**：画布默认 `proxyMode=local-tool`，生成/轮询/对话等请求经 `localTool :18080 /api/proxy` → 网关 `:9004`；官方接入点（1mao.cc/kkidc）为可配置默认值，仅在 localTool 未启动或 fallback 时由前端裸直连。详见 §4.1。网关不绑死某个画布。
4. **VPN 前置**：网关对外只连 `lgw.lovart.ai:443`，**必须开 VPN**。Win 未开 VPN 会静默 502（`All connection attempts failed`），非代码问题。
5. **`dist/` 黑盒（默认只读）**：前端混淆构建产物，**默认只分析不修改**，适配优先在 localTool 侧做。**经用户明确授权后允许修改**，见 §7.1「`dist/` 修改规程」。

---

## 4.1 来源区分铁律（最高优先级）

分析/调试/写文档时，凡涉及接口、报错、模型、配置来源，**必须先标清属于下面哪一类**，禁止混为一谈。

**① localTool（`127.0.0.1:18080`，自研，前端主对接）**
- 画布默认 `proxyMode=local-tool` 下，浏览器直连 localTool（同源）。画布静态托管、`/api/*` 本地服务、以及生成/轮询/对话经 `/api/proxy` 服务端转发。
- 负责协议翻译（把上游响应映射为画布期望形状）。见 docs/01 〇节。
- `/public/platform/builtin` 与 `/public/platform/models`：**自研替换官方 1mao 平台接口的预备实现**。前端在 `httpClient` 内 `fetch` 该路径，baseURL 经 `VITE_API_BASE_URL` 替换为 `127.0.0.1:PORT`，即**打到 localTool**。这两个路由由我们自行实现，返回本地静态常量 `BUILTIN_MODELS`，目的是在自托管模式下**替代官方 1mao 的对应能力**，不连官方 1mao，也不实时连 Lovart/apimart-gateway。代码实证：`localTool/src/index.ts:267-270` 注册 `handleBuiltin`/`handleModels`，`routes/platform.ts` 实现（标注「自研替换官方 1mao 平台接口」）。**（docs/17 §5.4 曾称 localTool 无此路由，系 grep 误判，以代码为准。）****

**② apimart-gateway（`127.0.0.1:9004`，自研，不直连前端）**
- **前端从不直连网关**，只由 localTool `/api/proxy` 服务端转发调用，做 Lovart 中继。模型仅 `gpt-image-2*`、`nano-banana*`、`seedance*`、`kling*`，**不含 grok/GK/芭蕉/IMG2**。
- 特惠视频节点的 `discountVideoApiUrl`/`discountVideoApiKey` 是画布配置字段，其值经 localTool 通道下发、请求也经前端 baseURL（=localTool）发出，**不绕过 localTool 直打网关**（docs/16 §6 实证：特惠节点仅"链路解耦、地址写死"，非前端直连网关）。
- 连不上 Lovart 表现为 502（VPN 未开）或 Lovart 业务错误，**不会返回"分组 low"文案**。

**③ 官方 1mao（`1mao.cc`/`1mao.16iai.com`/`154.219.102.152:3012` 等接入点，闭源，非自研）**
- 账号/权益/会员服务。`/user/model-entitlements`、`分组 low`/`distributor`/`model_not_found`/`new_api_error` 等官方口径报错来自此链。grok、GK、芭蕉、IMG2、seedance_官版等"权益不够"模型在此链。
- **不是自研**：官方 1mao 是闭源外部服务，我们只在自托管模式下用 localTool + apimart-gateway 替换其引擎能力；其账号/权益/会员/平台接口本身体外。
- 默认经 localTool 中继；仅当 localTool 未启动或作为硬编码 fallback 时，前端才裸 `fetch` 直连（见 docs/01 七·B1–B5）。平台接口（`sync/default`、`workflow-apps`、`upload/app-asset`、`vip-check`、`agent/{id}/chat`）当前无人接管（docs/01 第六节）——**其中 `/public/platform/*` 已由 localTool 自研实现预备替换，见 ①**。

**④ kkidc（`ai.kkidc.com` / `ai-api.kkidc.com`，外部付费，闭源）**
- 视频生成（Seedance）上游。sd2Video 等节点在 `proxyMode=local-tool` 下**经 localTool `/api/proxy` 原样透传 kkidc**（docs/12 §4.1 源码实证：浏览器→localTool 中继→kkidc，非前端直连）。
- 它是 localTool 透传的**外部上游**，不是前端对接源；kkidc 不可达则相关视频节点挂。

`Proxy error:` 前缀是**前端 `httpClient` 自己拼的**，错误体归属仍须按 ①–④ 判定，不能因前缀误判为本地。

**红线**：讨论接口/报错/模型/配置归属，必须先标「localTool / 网关 / 官方 1mao / kkidc」之一，禁止含糊说"后端返回""平台限制"。

> 与 §4 第3条的关系：docs/01 实证画布默认一切请求经 localTool（同源），官方接入点/kkidc 仅为可配置默认值或 fallback；故"经 localTool 通道"是默认常态，但前端在 localTool 未启动时会直连官方 fallback（docs/01 B1/B7），kkidc 始终经 localTool 透传。第3条"一律走"是理想态，现实含 fallback 与透传上游。
> **代码核实结论（覆盖文档冲突）**：A) `/public/platform/*` 路由**确由 localTool 提供**（`index.ts:267-270` + `routes/platform.ts:71-78`），docs/17 §5.4 的"无此路由"为 grep 误判；B) 网关**前端从不直连**，特惠节点的 `discountVideoApiUrl` 是经 localTool 下发的 upstream 目标，请求统一经 `Bl`→`localTool/api/proxy` 转发（`httpClient-BknZwXjG.js` 的 `function Bl` 实证），docs/17 §2.1"直打网关"为字面误读。

---

## 5. 同步/异步双模设计（apimart-gateway）

> 详见 `08-后端API同步异步改造方案.md`。

- **异步（默认）**：`_do_submit` 提交返回 `{status:"submitted", task_id}`，调用方 `GET /v1/tasks/{task_id}` 轮询；或带 `webhook` 字段让网关主动回调（`_fire_webhook`，**`webhook_sent` 幂等去重**）。
- **同步（规划中）**：请求带 `wait:true` → `_do_submit` 内部循环复用 `_check_and_fire_task` 直到终态，直接返回结果。复用现有轮询器（含 `done→abort` 二次确认、pending_confirmation 自动确认、abort 终态处理）。
- **聊天独立**：`chat_completions` → 内部 `run_and_get`（main.py:477），直接 `client.get_status/get_result` 轮询，**不经过** `_do_submit`/`_check_and_fire_task`。改图片同步**不影响聊天**。
- **格式对齐**：网关 completed 输出 `result:{images:[{url:[...]}]}`（main.py:857/867）；localTool P0-4 当前输出 `{code:200, data:[{url, status}]}`（system.ts:364）。localTool 消费同步结果时需"剥信封"对齐画布 `t.data[0].url`。
- **风险边界**：加 `wait` 开关必须保持**异步为默认**；不改 `chat_completions`/`run_and_get`；同步分支自带 deadline 超时返 504，不挂死事件循环。

---

## 6. 落盘与文件（`/files/` 唯一入口）

- **唯一文件入口**：localTool 托管 `/files/*`（静态服务 + `saveRemoteUrl` 落盘）。网关是 Python，**不能直接调** `saveRemoteUrl`，落盘增强必须放在 localTool 侧。
- **`saveRemoteUrl` 幂等**（files.ts:95）：`sha1(url)` 命名 + `existsSync` 跳过下载 → 同一远程地址永远映射同一文件，调两次不下两份原图。
- **当前状态**：生图/生视路径**未接**落盘（只 `/api/files/upload` 用）。结果 = Lovart CDN 外链，`TASK_RESULT_TTL` 默认 24h 过期 → 过期即 404 裂图。
- **不丢图增强（localTool 侧，与同步改造解耦）**：localTool 拿到最终 CDN url 后调 `saveRemoteUrl` 转存、返回本地 `/files/` url；**同步/异步都适用**。
- **务必"尽力而为"**：CDN 已过期/网络故障 → `saveRemoteUrl` 抛错。**下载失败仍返回 CDN url + WARN，绝不能让整体请求 500**（避免"为落盘反而不能生图"）。
- **时机**：同步分支拿到 url 立即转存最稳（别等前端来取时 CDN 已过期）。

---

## 7. 开发红线与注意事项

| 红线 | 说明 |
|---|---|
| ⚠️ 手改 `dist/` | 混淆黑盒，**默认不改**，适配逻辑优先放 localTool 侧。**经用户明确授权后可改**，须遵守下方「`dist/` 修改规程」。 |
| ❌ 动 `chat_completions` / `run_and_get` | 聊天独立路径，改图片同步不碰它。 |
| ❌ 改 `18080`/`9004` 端口 | 写死在前端与启动脚本。 |
| ❌ 改 `proxyMode=local-tool` 唯一入口 | 见 `02-断点三域梳理.md`。 |
| ⚠️ 改 `_do_submit` 加 `wait` | 必须保持异步为默认、不破坏 webhook 幂等。 |
| ⚠️ 落盘增强 | 仅在 localTool 侧、尽力而为不阻断生图。 |
| ⚠️ 连 Lovart | 启动/调试前**确认 VPN 已开**，否则 502。 |

**改码前检查清单**
```
1. 读本文档 + 对应 01-08 文档，确认影响范围（不瞎猜）
2. 改 localTool 后：npm run build（tsc）→ node dist/index.js 验证
3. 改网关后：确认异步默认、chat 不受影响、webhook 幂等
4. 改 dist/ 前：已拿到用户明确授权 + 走完 §7.1 规程
5. 启动前确认 VPN 已开
```

---

### 7.1 `dist/` 修改规程（授权后适用）

> **默认态：只读。** 只有在用户明确说"可以改 dist / 授权修改前端"之后才启用本规程。

**三问自检（任一为"是"就别改 dist）**
```
1. 这个需求能在 localTool 侧解决吗？        → 能 → 改 localTool
2. 是接口字段/格式对不上吗？                 → 是 → localTool 剥信封对齐
3. 是代理、落盘、同步化的问题吗？             → 是 → localTool 侧做
```

**操作规程**

| 步骤 | 要求 |
|---|---|
| 1. 授权 | 用户明确授权，且**说明清楚改哪个文件、哪个函数、达成什么效果** |
| 2. 备份 | 改前 `cp dist/assets/xxx.js dist/assets/xxx.js.bak`，或确保 git 工作区干净可回退 |
| 3. 定位 | **每次重新 grep 定位**——混淆符号（`Bs`/`Vi`/`ua` 等）**换一次构建就全变**，绝不能凭记忆用旧符号名 |
| 4. 最小改动 | 只改必要的那一个函数体，**不重排、不格式化、不整文件重写**（会破坏 sourcemap 与体积） |
| 5. 记录 | 在 `docs/` 或 `daily/` 记录：文件、符号、原始片段、修改后片段、目的 |
| 6. 验证 | 重启 localTool → 浏览器**硬刷新（禁用缓存）** → 验证目标功能 + 回归主流程（生图/生视/聊天） |
| 7. 单独提交 | `dist/` 改动**单独 commit**，commit message 注明「授权手改 dist：<原因>」，便于整体回退 |

**已知风险（必须同步告知用户）**

| 风险 | 说明 |
|---|---|
| 🔴 自动升级清零 | 存在 `/extension/update`，「确认升级后由本地引擎自动替换当前 dist」→ **一次升级改动全丢**。改后应避免点「确认升级」，或升级后重新施加改动 |
| 🔴 符号漂移 | 混淆变量名不稳定，**新版 dist 的定位串必然失效**，不可复用旧 patch |
| 🟡 无源码追溯 | 改的是构建产物，无法从源码复现；必须靠 §7.1 step 5 的记录 |
| 🟡 连带影响 | 混淆后函数常被多处复用，改一个函数可能影响预期外的调用方，务必回归主流程 |
| 🟡 服务端校验 | 涉及鉴权/计费的前端改动，服务端仍会二次判定（402/403），前端改动可能无实际效果 |

**红线内的红线（授权也不能做）**
```
❌ 整文件 prettier/webcrack 重写后回写 dist（只能用于离线分析，产物不得回写）
❌ 改端口 18080 / 9004 的硬编码
❌ 改 proxyMode=local-tool 唯一入口
❌ 删除或绕过错误处理，导致失败被静默吞掉
```

---

## 8. 文档导航

| 文档 | 用途 | 信任度 |
|---|---|---|
| `01-接口兼容性审计.md.bak.md` | 审计基线（2026-07-30）：前端接口 vs 自研后端 | 🟢 高 |
| `02-断点三域梳理.md` | proxyMode 定调、三域边界 | 🟢 高 |
| `03-断点总表-说明补全.md` | 断点全量清单 | 🟢 高 |
| `04-调试基建与探针说明.md` | 调试探针/日志位置 | 🟢 高 |
| `05-断点修复方案.md` | 各断点修复方案 | 🟢 高 |
| `06-断点修复实施计划书.md` | 实施排期 | 🟢 高 |
| `07-使用说明.txt` | 使用说明 | 🟢 高 |
| `08-后端API同步异步改造方案.md` | 网关双模 + localTool 适配设计 | 🟢 高 |
| `daily/` | 执行日志（按日期） | 🟢 高 |

---

## 9. 快速参考卡片

| 场景 | 做法 |
|---|---|
| 启动全部 | `.\launch-all.ps1 2`(Win) / `./launch-all.command`(Mac)，先开 VPN |
| 只跑 localTool 看日志 | `.\launch-all.ps1 1`（前台）或 `cd localTool && npm run build && node dist/index.js` |
| 改 localTool | 改 `localTool/src/**` → `npm run build`（tsc）→ `node dist/index.js` |
| 改网关 | 改 `apimart-gateway/main.py` → 重启 uvicorn；保持异步默认、chat 不动 |
| 网关 502 | 先查 VPN 是否开启（连 `lgw.lovart.ai:443`） |
| 想加同步模式 | 在 `_do_submit` 加 `wait` 开关复用 `_check_and_fire_task`，勿碰 chat |
| 想不丢图 | 在 localTool 拿到 CDN url 后调 `saveRemoteUrl`，尽力而为 |
| 字段对不上 | 画布硬编码读 `t.data[0].url`，localTool 侧剥 `{code,data}` 信封对齐 |
| 查接口契约 | `01-接口兼容性审计.md.bak.md` + 分析 `dist/` 调用 |
| 回退改动 | `-ol --hard HEAD~1`（每步单文件独立 commit） |

---

---

## 10. 辅助脚本（代码反混淆）

`script/` 下两个 Node 辅助脚本（纯前端分析，不动主后端）：

| 脚本 | 作用 | 依赖 | 产物 |
|---|---|---|---|
| `script/format转移.js` | Prettier 格式化压平 `input.js` → 可读 `output.js` | `npm i prettier` | `output.js` |
| `script/advanced_format.js` | webcrack AST 反混淆 + Prettier，清超长 SVG/Base64 噪点 | `npm i webcrack prettier` | `output_advanced.js` |

用法：`cd script && node format.js` / `node advanced_format.js`

---

## 11. 卡帕西编码准则 (Karpathy Rules)

### 8.1 编码前思考
不假设，不隐藏困惑。说明假设，多解释并存时全盘呈现，有更优解要提出，不清楚就停下询问。

### 8.2 奥卡姆剃刀 · 简洁优先
**如无必要，勿增实体。** 任何新增的依赖/文件/端点/开关，先问"删掉它有影响吗"——答不上来就是多余；多解释并存时取假设最少的那条。

### 8.3 精准修改
只碰必须碰的，匹配现有风格。拆解时清理提取后遗留的孤儿代码（App.js 中已被替代的函数/变量）。每行修改必须能追溯到明确目的。

### 8.4 目标驱动执行
定义成功标准，将任务转为可验证目标（如写测试验证）。多步骤任务先给出简短计划（`步骤 → 验证：检查项`）。

> **生效标志**：diff 中不必要的改动更少、因过度复杂导致的重写更少、澄清问题在实现前而非犯错后提出。
