# CLAUDE.md · 一毛AI画布多端合一（自研后端替代版）架构师工作手册

> **最后更新**：2026-08-02

## 一、 项目全局定位 (TL;DR)

* **项目本质**：使用自研的 `localTool` 和 `apimart-gateway` 替换官方原版的三个闭源可执行引擎（Win端、Mac Arm版、Mac Intel版），实现多端合一。

* **当前进度**：
  * **已完成**：`localTool` 已承担前端托管、请求代理、本地存储及生图异步转同步，并自研实现了替代官方 1mao 的平台接口。`apimart-gateway` 已承担 Lovart 中继、聊天同步、图视异步、webhook 及自动确认。
  * **进行中**：网关原生双模（同步/异步）改造、落盘转存（不丢图）增强。
  * **新增（2026-08-02）**：仓库已纳入官方混淆 `dist/` 逆向还原出的**可编辑工程源码** `src/bundle/`，支持 `npm run build` 直接回灌 `dist/`（见 §四.5）；配套还原流水线脚本在 `scripts/`（`split_js.py`、`beautify.cjs`、`gen_map.cjs`、`scope_rename_plugin.cjs` 等），质量门 `scripts/smoke_test.cjs`。逆向还原方法论与中间产物集中于 `docs/逆向专用_ai 禁止读/`（标注「AI 禁止读」，AI 助手默认不读取该目录内容）。

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

* **八类职责**：
  1. **前端托管**：托管 `dist/` 静态产物并自动打开浏览器。
  2. **代理转发**：画布所有请求（`proxyMode=local-tool`）的唯一入口 `/api/proxy`，负责协议翻译（剥 `{code,data}` 信封、SSE 过滤、异步转同步、超时），转发给网关或透传给 kkidc。
  3. **本地存储**：KV、任务、资源、文件 `/files/` 落盘（SQLite）。
  4. **接口替换**：自研实现平台接口（`/public/platform/builtin`、`/public/platform/models`、`/plugin/manifest.json`、`/api/workflow-apps/*`、`/api/sync/default` 兜底），**替代官方 1mao 的对应能力**（官方为闭源外部服务，非自研），返回本地静态兜底，不连官方服务，也不实时连 Lovart。
  5. **管理接口**：`/api/admin/*`（统计/清理/导入导出）。
  6. **上传/资产**：`/api/assets/upload`、`/api/upload/app-asset`。
  7. **网关自检引导**：读 apimart-gateway `.env` 校验 AK/SK、提示 VPN。
  8. **官方权益接口转发**（`/api/user/info`、`/api/user/model-entitlements`、`/api/agent/:id/vip-check`）：官方 1mao 闭源，账号/权益/会员判定 100% 在官方远程；本层只做**中转 + 短缓存**（内存 Map，按 token hash 隔离），不取代官方判定、不伪造权限。默认转发目标为官方候选接入点（endpointConfig `s()[0]`，如 `https://www.1mao.cc`）。**注意**：前端权益 base 默认直连官方候选地址（`g()` 只读 sessionStorage 不读 KV），请求当前不经本层；需后续让前端把 base 指向 18080 才真正接管（见 `localTool/src/routes/official.ts` 尾部「后续补前端」）。

> 注：② 的转发目标是 apimart-gateway；④ 是用来替换官方 1mao 的，两者边界清晰。

### 2. 中继层：apimart-gateway (通用第三方 AI API 中继)

* **技术栈与端口**：Python/FastAPI，固定端口 `127.0.0.1:9004`。
* **定位**：纯粹中转站，只对接 Lovart，做三件事：
  1. 接收外部 OpenAI 风格请求（`/v1/images`、`/v1/videos`、`/v1/chat`）。
  2. 最小规范化（尺寸解析、数量约束、**模型别名映射**→Lovart 工具名）。
  3. 转发 Lovart 并回传结果。

* **绝对解耦**：只认"图片/视频/聊天"三种能力；✗ 不关心前端逻辑（节点/特惠/混淆字段），✗ 不侵入 Lovart 内部（项目/工具名/生成策略由 `lovart_client.py` 负责）。鲁棒性（项目失效重建、`done` 防抖、高成本自动确认）属对上游不稳定性的兜底，不改变中转定位。

### 3. 前端与外部依赖层

* **画布前端 (`dist/`)**：Vite 构建产物，由 `src/bundle/` 编译生成（见 §四.5）。**运行只读 `dist/`**；改前端须改 `src/bundle/` 再 `npm run build` 回灌。
* **逆向还原源码 (`src/bundle/`)**：官方 `dist/` 经拆包/还原后的**可编辑工程源码**（约 200 文件，174 `.jsx` + 18 `.js` + 4 `.css` + 4 `.json`）。每个顶层 chunk `.js` 仅做门面 re-export，真实逻辑拆到 `*_components/` 子目录；`component_map.json` 记录「原始混淆名 → 文件名」映射，是还原引用的真相表。含 `_react_shim.js` / `_jsx_runtime.js` 解决 React 单实例问题（⚠️ 不可删除/改写，否则 `Invalid hook call`）。**改完跑 `npm run build` 即回灌 `dist/`**（见 §四.5 改造规范）。
* **官方 1mao**：闭源外部服务（**非自研**），处理账号权益（含 grok/GK 等模型及报错），体外于自研引擎；仅在 localTool 未启动时作为 fallback 裸连。其平台接口正由 localTool 自研替换（见 §2.1 ④）。
* **kkidc**：视频生成外部上游，请求由 localTool 原样透传，非前端直连。

---

## 二点五、 提交前验证流程（不跑不许提交）

**每次改 `localTool/` 或 `apimart-gateway/` 代码，按序跑；提交时人工确认已通过。**

```
1. cd localTool && npm run build        ← tsc 类型+编译（localTool 无 vite，build=tsc）
2. cd apimart-gateway && python -c "import main"  ← 网关语法/导入自检
3. 若动了 src/bundle：node scripts/smoke_test.cjs（质量门）→ npm run build（回灌 dist/）
4. 启动双服务（先开 VPN）→ 浏览器打开画布真机走查关键链路
```

> 注：当前无 husky/pre-commit 强制钩子，验证靠自觉；`dist/` 手改按 §四.2 单独 commit 并注明授权。

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
* **出站代理（2026-08-02）**：localTool 是独立 Node 进程，原生 `fetch` **不继承浏览器/系统代理**。若外部 CDN（如 Lovart `a.lovart.ai`）在本机需经代理才能访问，`saveRemoteUrl` 直连会超时 → 表现 `POST /api/files/upload 400`。统一封装 `localTool/src/utils/netProxy.ts` 的 `fetchWithProxy`：**直连优先 → 失败读代理环境变量（`HTTPS_PROXY`>`HTTP_PROXY`>`ALL_PROXY`，大小写兼容）→ 无则探测本机常见代理端口（`7897/7890/1087/1080/8888/8118`）→ 用 `node:https`+`tls.connect` CONNECT 隧道经代理重试**。本地目标（`127.0.0.1`/`localhost`/内网）永不走代理。适用点：`files.ts` 的 `saveRemoteUrl`（下载 CDN 图）与 `handleReadProxy`（`x-proxy-url` 外部代理读）；`/api/proxy`→`:9004`、`official.ts`/`passthrough.ts`→官方（直连可达）**不涉及**。

---

## 四、 开发红线与规范

### 1. 绝对禁区 🚫

* **端口与入口**：禁止改 `18080`/`9004` 端口；禁止改 `proxyMode=local-tool` 唯一入口。
* **VPN 前置**：连 Lovart (`lgw.lovart.ai:443`) **必须开 VPN**，否则网关静默 502，非代码问题。
* **溯源铁律**：讨论报错/模型归属必须标清来源（localTool / 网关 / 官方 1mao / kkidc），禁止"后端返回"式含糊。

### 2. `dist/` 前端修改规程

* **禁止直接手改 `dist/`**：`dist/` 是 `src/bundle/` 的构建产物，**前端改动一律改 `src/bundle/` 后 `npm run build` 回灌**（见 §四.5）。任何情况下都不得直接编辑 `dist/` 混淆产物。
* **定位：官方包 + 我们的最小改动**。`src/bundle/` 是「官方发行 dist 经还原流水线的基线」叠加「我们的最小改动」。我们的目标是对官方包做**最小**改动，而非另起炉灶。
* **每次改动必须记录**：任何对 `src/bundle/` 的修改都要在 `docs/` 下（或改动文件顶部注释）登记——改了哪个 chunk、哪一行、原始混淆符号、改动目的、影响的运行时行为。这是官方更新时「重打补丁」的唯一依据（见 §四.5 ⑧）。
* **官方更新 = 重打补丁**：官方发新版时，重新拉官方 dist → 跑还原流水线生成新基线 → 依据变更记录把我们的每处最小改动**逐一重新打上**（混淆符号可能已重排，需重新对照，禁止直接套用旧映射）。

### 4. 逆向源码与还原脚本红线 🚫

* **运行与源码关系**：运行时只认 `dist/`；`src/bundle/` 是可编辑源码，`npm run build` 编译回灌 `dist/`（见 §四.5）。
* **还原脚本边界**：还原/拆包/重命名脚本在 `scripts/`（如 `split_js.py`、`beautify.cjs`、`gen_map.cjs`、`scope_rename_plugin.cjs`、`jsx_restore_plugin.cjs`）；离线分析中间产物集中在 `docs/逆向专用_ai 禁止读/`。
* **AI 禁止读目录**：`docs/逆向专用_ai 禁止读/` 明确标注「AI 禁止读」，AI 助手默认不读取该目录，仅在需要时引用其存在，不展开其内容。
* **混淆符号随官方版本变动**：官方每次发新版，还原出的变量名/组件名可能整体重排。我们的最小改动钉在特定混淆符号/行号上，**官方更新重打补丁时必须重新对照现版本，禁止直接套用旧映射**（见 §四.2 定位与 §四.5 ⑧）。

### 5. `src/bundle/` 可编辑化改造规范（适配 gougou 铁律）

`src/bundle/` 已支持 `npm run build` 直接回灌 `dist/`（Vite + `post-build-fixups` 自动补图标/CSS 引用/CSP）。改造遵循以下铁律（借鉴 gougou 反编译还原工程化经验）：

1. **被高频依赖的共享函数不可从 chunk 抽取**（打乱 vendor 初始化 → `Rr is not a function` / `Bd is not a function`）。新增逻辑优先走 `*_components/` 内新建文件，或复用现有 barrel，不直引大 chunk。
2. **禁止新文件 `import` 顶层 chunk 大文件**（循环依赖 → TDZ）。跨 chunk 引用走 `component_map.json` 指定的目标文件。
3. **整块迁移几千行必翻车**（store+helper 不可分割）；拆改只做最小差异（diff ≤ 30 行，见 §3.1）。
4. **React 单实例不可破**：`_react_shim.js` / `_jsx_runtime.js` 经 `vite.config.ts` 的 `resolve.alias` + `dedupe` 绑定到 vendor 工厂，✗ 不可删除/改写/新增独立 react 实例。
5. **字符串契约零损伤**（见 §3.2/§3.3）：画布硬编码读 `t.data[0].url`、`{code,data}` 信封、`proxyMode=local-tool` 等契约值，改任何引用必须全量 grep 同步。**辅助工具**：改前查 `CONTRACTS.md` 确认落点，改后跑 `npm run contracts` 校验全端同步（漂移即 FAIL）。
6. **混淆留痕 + 变更登记**：每处反直觉改动立即注释语义 + 原名（如 `// ol = tasks 数组, shared.js L247`，不设 deadline）；同时按 §四.2 的「变更记录」要求在 `docs/` 登记该改动，作为官方更新重打的依据。
7. **改前建基线 / 改后比对**：改前跑 `node scripts/smoke_test.cjs` 记录基线；改后必须重跑，确保 `checkImportGraph`（chunk 引用不悬空）+ `checkReadableParity`（运行时标记不漂移）全 PASS，再 `npm run build`。
8. **官方更新重打流程**：官方发新版 → ① 拉新 dist，跑还原流水线生成新 `src/bundle/` 基线；② 取出 §四.2 登记的我们的最小改动清单；③ 逐条对照**新版本**的混淆符号/行号重新打上（禁止直接 `git apply` 旧 diff，符号已变）；④ 重跑 `smoke_test.cjs` + `npm run build` + 真机走查。

9. **降低复杂度优先**：凡是能减少代码复杂度、又不引入 bug 的改动都要做——包括但不限于把混淆短名（`_st`/`R`/`Dl` 等本地可改的）改为语义长名、抽公共逻辑、删冗余分支。被 `component_map.json`/运行时契约钉死、改动会破坏引用的除外。**改完必须 `npm run build` 验证回灌 `dist/` 成功。**

> 验证链路：`src/bundle/` 改完 → `node scripts/smoke_test.cjs`（质量门）→ `npm run build`（回灌 `dist/`）→ 浏览器真机走查（见 §二点五）。

### 3. 卡帕西编码准则 (Karpathy Rules)

* **奥卡姆剃刀**：如无必要，勿增实体（依赖/文件/端点）。多解释并存取假设最少的一条。
* **精准修改**：只碰必须碰的，清理孤儿代码，每行修改可追溯明确目的。
* **目标驱动**：任务转可验证目标，拆解执行。

### 3.1 最小差异提交

* 每次 commit 的 diff 尽量 ≤ 30 行；多步改动拆成单文件独立 commit，便于 `git reset --hard HEAD~1` 回退。
* 每写一处反直觉/绕开混淆的代码，立即注释原因（如 `// 绕开 dist 硬编码读 t.data[0].url`）。

### 3.2 字符串契约零损伤

以下前后端契约值一字不差，改任何引用必须全量 grep 同步，禁止局部替换漏网：
- `proxyMode=local-tool`、`127.0.0.1:18080`、`127.0.0.1:9004`、`/api/proxy`、`x-proxy-url`
- 画布硬编码字段：`t.data[0].url`、`{code,data}` 信封结构、SSE 事件格式
- 模型别名映射（网关 `lovart_client.py` 内的工具名 ↔ Lovart 工具名）

### 3.3 契约字典与地图工具（AI 防漏改辅助）

`src/bundle/` 为混淆还原代码，AI 改动极易「改一处漏一处」。配套工具（零运行时依赖，随代码重跑）：

- **`scripts/contracts.json`**：字符串契约字典，声明每条「改一处必须全端同步」的契约（端口/路径/KV 键/信封）。新增跨端字符串须同步登记。
- **`scripts/contract_scan.cjs`**：漂移检测（质量门）。`npm run contracts` 比对 `scripts/contract_snapshot.json` 基线，任一 high/critical 契约命中数变化即 FAIL，并打印哪个文件多了/少了。混淆重排后数量正常变化用 `npm run contracts -- --resnap` 重建基线。
- **`CONTRACTS.md`**：自动生成的契约分布表（哪条契约命中在哪些文件），AI 改契约前先查，确认要动几个端。由 `npm run contracts -- --md` 重建。
- **`src/bundle/BUNDLE_MAP.md`**：自动生成的逆向源码地图（chunk 表 / 大文件特征索引 / 反向索引 / 高危文件标记 / 同名影子文件警示）。AI 改 `src/bundle/` 前**必读**，按特征反查落点，不凭混淆文件名判断职责。由 `npm run map` 重建。
- **`scripts/smoke_test.cjs`** 已接入 `checkContracts`（契约漂移）与 `checkDistDuplicateChunks`（React 双实例/Vite 重复 chunk），提交前验证链路见 §二点五。

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
* **反混淆排障**：`scripts/` 下 `advanced_format.js`(webcrack) / `beautify.cjs`(Prettier) 离线分析，`src/bundle/` 为还原产物，**严禁回写主分支作为运行产物**；还原中间产物见 `docs/逆向专用_ai 禁止读/`（AI 禁止读）。

---

## 六、 文档导航与场景速查

### 1. 文档导航（信任度）

| 文档 | 用途 | 信任度 |
|---|---|---|
| `docs/01-接口兼容性审计.md.bak.md` | 前后端契约海关审计 | 🟢 高 |
| `docs/02-断点三域梳理.md` ~ `docs/21-*.md` | 断点/方案/进度系列（21 篇） | 🟡 中（部分已落地，部分规划） |
| `daily/2026-08-01.md` / `daily/2026-07-31.md` | 执行日志 | 🟢 高 |
| `docs/逆向专用_ai 禁止读/` | 还原方法论与中间产物 | 🚫 AI 禁止读 |
| `src/bundle/*_components/component_map.json` | 混淆名→文件名映射（真相表） | 🟡 字典级 |
| `src/bundle/BUNDLE_MAP.md` | 逆向源码地图（AI 改前必读，按特征反查落点） | 🟢 自动生成 |
| `CONTRACTS.md` | 跨端字符串契约分布表（改契约前查阅） | 🟢 自动生成 |
| `scripts/contracts.json` + `scripts/contract_scan.cjs` | 契约字典 + 漏改漂移检测（质量门） | 🟢 权威 |
| `scripts/gen_bundle_map.cjs` | 地图生成器（`npm run map`） | 🟢 工具 |

> 读 `docs/` 任意方案前先确认其状态是「已完成」还是「规划中」，避免把规划当现状。

### 2. 场景速查表

| 场景 | 做法 |
|---|---|
| 要加平台接口（替代官方 1mao） | 改 `localTool/src/routes/`（builtin/models/manifest/sync），返回本地静态兜底 |
| 要改代理/转发逻辑 | `localTool/src/routes/system.ts`（`/api/proxy` 剥信封/SSE/异步转同步） |
| 要接新模型/视频能力 | 改 `apimart-gateway/lovart_client.py` 别名映射与规范化 |
| 要查官方权益转发 | `localTool/src/routes/official.ts`（中转+短缓存，不伪造权限） |
| 要改画布前端 | 改 `src/bundle/` → `node scripts/smoke_test.cjs` → `npm run build` 回灌 dist（见 §四.5）；严禁直接手改 dist |
| 要看画布可读源码 | `src/bundle/`（可编辑工程源码，改完 build 回灌） |
| VPN/502 排障 | 先 `ping lgw.lovart.ai:443` 确认 VPN |
| 提交前验证 | 见 §二点五 流程 |
