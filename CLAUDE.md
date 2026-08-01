# CLAUDE.md · 一毛AI画布多端合一（自研后端替代版）架构师工作手册

> **最后更新**：2026-08-01

## 一、 项目全局定位 (TL;DR)

* **项目本质**：使用自研的 `localTool` 和 `apimart-gateway` 替换官方原版的三个闭源可执行引擎（Win端、Mac Arm版、Mac Intel版），实现多端合一。

* **当前进度**：
  * **已完成**：`localTool` 已承担前端托管、请求代理、本地存储及生图异步转同步，并自研实现了替代官方 1mao 的平台接口。`apimart-gateway` 已承担 Lovart 中继、聊天同步、图视异步、webhook 及自动确认。
  * **进行中**：网关原生双模（同步/异步）改造、落盘转存（不丢图）增强。

---

## 二、 核心架构与组件职责

系统严格遵循分层铁律，请求的唯一入口为 `localTool`，网关作为纯粹的中转站。任何接口/报错/模型的归属，必须先分清是 **localTool / 网关 / 官方 1mao / kkidc** 哪一类，禁止含糊说"后端返回"。

### 0. 三道关系与信息链路（总图）

```
浏览器/画布 (dist/)
   │  唯一出口 proxyMode=local-tool，所有请求打到 localTool
   ▼
localTool :18080  ── 自研，整体对接 apimart-gateway
   ├─ /api/proxy ──────► apimart-gateway :9004 ──► Lovart (lgw.lovart.ai，需 VPN)
   │      （x-proxy-url 常态 = http://127.0.0.1:9004/...）
   ├─ /api/proxy 透传 ─► kkidc (外部视频上游，原样透传)
   └─ /public/platform/* ─► 本地静态兜底（自研替换官方 1mao，不连任何远端）
   ▼
官方 1mao（闭源，非自研）
   └─ 仅当 localTool 未启动时，前端 fallback 裸直连；常态不参与链路
```

**关系要点**：
- localTool ↔ apimart-gateway：经 `/api/proxy` 服务端转发，`x-proxy-url` 常态指向 `:9004`，再到 Lovart。
- localTool ↔ 官方 1mao：官方 1mao 的平台接口由 localTool **自研替换**，常态不连；仅 fallback 裸连官方。
- apimart-gateway ↔ 官方 1mao：**无直接关系**，网关只认 Lovart。
- kkidc：localTool 透传的外部上游，非前端直连、也非网关直连。

### 1. 核心层：localTool (一毛画布专属适配层)

* **技术栈与端口**：Node/TS，固定端口 `127.0.0.1:18080`。
* **定位**：一切"让画布好用"的适配都在此层完成，整体对接 **apimart-gateway（→Lovart）**。

* **七类职责**：
  1. **前端托管**：托管 `dist/` 静态产物并自动打开浏览器。
  2. **代理转发**：画布所有请求（`proxyMode=local-tool`）的唯一入口 `/api/proxy`，负责协议翻译（剥 `{code,data}` 信封、SSE 过滤、异步转同步、超时），转发给网关或透传给 kkidc。
  3. **本地存储**：KV、任务、资源、文件 `/files/` 落盘（SQLite）。
  4. **接口替换**：自研实现平台接口（`/public/platform/builtin`、`/public/platform/models`、`/plugin/manifest.json`、`/api/workflow-apps/*`、`/api/sync/default` 兜底），**替代官方 1mao 的对应能力**（官方为闭源外部服务，非自研），返回本地静态兜底，不连官方服务，也不实时连 Lovart。
  5. **管理接口**：`/api/admin/*`（统计/清理/导入导出）。
  6. **上传/资产**：`/api/assets/upload`、`/api/upload/app-asset`。
  7. **网关自检引导**：读 apimart-gateway `.env` 校验 AK/SK、提示 VPN。

> 注：② 的转发目标是 apimart-gateway；④ 是用来替换官方 1mao 的，两者边界清晰。

### 2. 中继层：apimart-gateway (通用第三方 AI API 中继)

* **技术栈与端口**：Python/FastAPI，固定端口 `127.0.0.1:9004`。
* **定位**：纯粹中转站，只对接 Lovart，做三件事：
  1. 接收外部 OpenAI 风格请求（`/v1/images`、`/v1/videos`、`/v1/chat`）。
  2. 最小规范化（尺寸解析、数量约束、**模型别名映射**→Lovart 工具名）。
  3. 转发 Lovart 并回传结果。

* **绝对解耦**：只认"图片/视频/聊天"三种能力；✗ 不关心前端逻辑（节点/特惠/混淆字段），✗ 不侵入 Lovart 内部（项目/工具名/生成策略由 `lovart_client.py` 负责）。鲁棒性（项目失效重建、`done` 防抖、高成本自动确认）属对上游不稳定性的兜底，不改变中转定位。

### 3. 前端与外部依赖层

* **画布前端 (`dist/`)**：混淆构建产物，默认黑盒只读，仅在授权后按规程修改。
* **官方 1mao**：闭源外部服务（**非自研**），处理账号权益（含 grok/GK 等模型及报错），体外于自研引擎；仅在 localTool 未启动时作为 fallback 裸连。其平台接口正由 localTool 自研替换（见 §2.1 ④）。
* **kkidc**：视频生成外部上游，请求由 localTool 原样透传，非前端直连。

---

## 三、 关键技术机制

### 1. 同步与异步双模机制 (网关层)

* **异步（默认）**：提交后返回 `task_id`，调用方通过轮询或 webhook 接收结果（webhook 幂等去重）。
* **同步（规划）**：请求带 `wait:true`，内部复用轮询直至终态直接返回，自带超时（504），**必须保持异步为默认**。
* **独立聊天**：聊天 (`chat_completions`) 走内部 `run_and_get` 轮询，**绝对不经过**图片同步的 `_do_submit`。

### 2. 本地落盘与文件管理机制

* **唯一入口**：localTool 的 `/files/` 是唯一文件入口，Python 网关不直接落盘。
* **不丢图增强**：localTool 拿到 CDN url 后调 `saveRemoteUrl`（基于 `sha1(url)` 幂等）转存本地。
* **降级策略**：下载失败仍返回 CDN 链接 + WARN，**绝不抛 500 阻断生图**。

---

## 四、 开发红线与规范

### 1. 绝对禁区 🚫

* **端口与入口**：禁止改 `18080`/`9004` 端口；禁止改 `proxyMode=local-tool` 唯一入口。
* **VPN 前置**：连 Lovart (`lgw.lovart.ai:443`) **必须开 VPN**，否则网关静默 502，非代码问题。
* **溯源铁律**：讨论报错/模型归属必须标清来源（localTool / 网关 / 官方 1mao / kkidc），禁止"后端返回"式含糊。

### 2. `dist/` 前端修改规程

* **默认只读**：适配逻辑优先放 localTool 侧；仅当无法在后端解决且**用户明确授权**后才可改。
* **操作要求**：改前备份；每次重新 grep 定位（混淆符号随时变）；仅最小化改动，**严禁重排/格式化/整文件重写**。
* **记录与提交**：必须记录修改说明，git 单独 commit 注明"授权手改 dist：<原因>"。
* **风险**：自动升级清零改动；混淆变量不稳定；服务端校验仍在，前端改动可能无效。

### 3. 卡帕西编码准则 (Karpathy Rules)

* **奥卡姆剃刀**：如无必要，勿增实体（依赖/文件/端点）。多解释并存取假设最少的一条。
* **精准修改**：只碰必须碰的，清理孤儿代码，每行修改可追溯明确目的。
* **目标驱动**：任务转可验证目标，拆解执行。

---

## 五、 运维排障速查 (Quick Reference)

### 1. 启动方式

* **一键启动 (推荐)**：先开 VPN。
  * Windows: `powershell -ExecutionPolicy Bypass -File .\launch-all.ps1 2`
  * Mac: `./launch-all.command`
* **独立调试**：
  * localTool: `cd localTool && npm run build && node dist/index.js`
  * 网关: `cd apimart-gateway && python -m uvicorn main:app --host 127.0.0.1 --port 9004`

### 2. 常见问题速查

* **网关 502**：先查 VPN 是否连通 `lgw.lovart.ai:443`。
* **字段对不上**：画布硬编码读 `t.data[0].url`，需在 localTool 侧剥 `{code,data}` 信封对齐。
* **接口契约**：查 `01-接口兼容性审计.md.bak.md` + 分析 `dist/` 调用。
* **反混淆排障**：`script/` 下 `format转移.js`(Prettier) / `advanced_format.js`(webcrack) 离线分析，**产物严禁回写主分支**。
