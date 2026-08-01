# 一毛 AI 画布 · 逆向还原方法包（最小版）

> 把一个 **webcrack 反混淆产物**重建成 **「React 19 单实例 + 文件拆分 + 真机零应用级报错」** 的可运行扩展工程。
> 本目录是已验证成功的精简版，删除了所有调试日志、历史 fixers、冗余 chunk，只保留能跑通主线的文件。

---

## 0. 四步主线（先跑通，再回头看细节）

> **起点只有一个官方编译好的扩展 `dist`**（如 `C:\Users\xinye\Downloads\11\dist`），
> 没有任何其它输入。`step0_raw/` 是从这个 `dist` 里**提取**出来的，不是凭空存在的。

```
第0步 提取输入   node extract_input.cjs <最初的dist路径>
                → glob 自适应从 dist/assets/ 提取「业务 chunk」到 step0_raw/chunks/（剔除 vendor/rolldown-runtime 等第三方）
                → 从 dist/ 根提取 index.html、从 dist/share/ 提取 share.html
                → 从 dist/public/ 提取 manifest.json / background.js / 图标 / mediapipe / models / assets/*.css 等到 step0_raw/static/public/
① 生成工程     node pipeline/run.cjs
                → 自动识别 chunks（DEEP=核心业务走 webcrack→拆分；OTHER=其余只拷贝），产出 output/project
①b 先构建验证   cd output/project && npm install && npm run build
                → 【关卡】能构建通过，才说明拆包产物基本可用，方可进入后处理
                → 此时报错通常是静态解析错误（如门面 re-export 路径错），先修再继续
①c 可读化(可选) node pipeline/05_rename.cjs output/project/src/bundle
                → 作用域安全语义改名；改前建议先 snapshot output/project/src 以便回退
①d 构建冒烟门   node verifiers/verify_build.cjs
                → 秒级静态断言（manifest 合法 / 入口 HTML 引用 / 无悬空 chunk 引用），不通过则回修
② 后处理根治   node pipeline/fix_esm.cjs output/project
                → 修 ESM 五类错误（A~E）
③ 再构建       cd output/project && npm run build
                → 后处理后应干净通过（若有 ReferenceError 回 §4 按 map 补修）
④ 真机验收     cd verifiers/AI01_ext && node verify_ext.cjs
                → 看 report.json 的 errorCount（=2 且全是噪声即达成）
```

> 若 ②③ 后还冒 `ReferenceError: X is not defined`，回到 §4 按 component_map.json 定位补修，再重跑 ③④。

---

## 1. 目录结构与文件职责（本最小版）

```
minimal/
├─ extract_input.cjs        ← 第0步：从最初 dist 提取 step0_raw/（chunks + static，glob 自适应）
├─ pipeline/                ← 生成 + 后处理脚本（run.cjs 调用链完整）
│  ├─ run.cjs               ← 总入口：自动识别 chunks → webcrack → 00~04 → 组装 + shim + vite.config + css占位 + 终检
│  ├─ 00_sanitize.cjs       ← ①b 伪迹清理（Object/constructor 文本还原）
│  ├─ 01_expand.cjs         ← ①  AI 结构展开
│  ├─ 02_split.cjs          ← ②  智能组件拆分（生成 *_components/）
│  ├─ 03_facade.cjs         ← ③  门面替换（原 JS → re-export）
│  ├─ 04_unicode.cjs        ← ④  Unicode 中文还原
│  ├─ 05_rename.cjs         ← ①c 可读化层（可选）：作用域安全语义改名，glob 自适应所有 bundle js
│  ├─ clean_project.cjs     ← 终检：递归清理 webcrack [native code] 伪迹
│  ├─ fix_esm.cjs           ← 后处理① 五类 ESM 修复（A~E）
│  └─ fix_cmp_imported.cjs  ← 后处理② 剥离 _cmp_ 前缀（干净态常可跳过）
├─ step0_raw/               ← 第0步从 dist 提取的原始素材（run.cjs 只读这里）
│  ├─ chunks/               ← 业务混淆 chunk（glob 自适应提取，见 §2）
│  └─ static/               ← 入口 html / tsconfig / tailwind / public 资源
│     ├─ index.html  share.html  tsconfig.json  tailwind.config.js
│     └─ public/            ← manifest.json / 图标 / mediapipe / models / assets/*.css 占位
├─ verifiers/
│  ├─ AI01_ext/verify_ext.cjs   ← 真机验收（Playwright 加载 dist 为 MV3 扩展，生成 report.json）
│  └─ verify_build.cjs          ← ①d 构建后静态冒烟门（秒级，exit-code 质量门）
├─ docs/
│  └─ 成功复盘SOP.md         ← 完整 SOP 细节（shim 模板、五类修复源码、三个真实 bug 案例）
└─ README.md                ← 本文件（总表）
```

### 1.1 文件清单对照表

| 文件 | 类型 | 是否必需 | 说明 |
|------|------|----------|------|
| `extract_input.cjs` | 脚本 | ✅ 必需 | 第0步：从最初 dist 提取 step0_raw/（chunks+static） |
| `pipeline/run.cjs` | 脚本 | ✅ 必需 | 生成流水线总入口 |
| `pipeline/00_sanitize.cjs` | 脚本 | ✅ 必需 | run.cjs 第116行调用 |
| `pipeline/01_expand.cjs` | 脚本 | ✅ 必需 | run.cjs 第107行调用 |
| `pipeline/02_split.cjs` | 脚本 | ✅ 必需 | run.cjs 第126行调用 |
| `pipeline/03_facade.cjs` | 脚本 | ✅ 必需 | run.cjs 第136行调用 |
| `pipeline/04_unicode.cjs` | 脚本 | ✅ 必需 | run.cjs 第154行调用 |
| `pipeline/clean_project.cjs` | 脚本 | ✅ 必需 | run.cjs 第292行终检调用 |
| `pipeline/fix_esm.cjs` | 脚本 | ✅ 必需 | 后处理①（SOP §5） |
| `pipeline/fix_cmp_imported.cjs` | 脚本 | ✅ 必需 | 后处理②（SOP 剥离前缀） |
| `pipeline/05_rename.cjs` | 脚本 | ◯ 可选 | ①c 可读化层（语义改名，移植自 AI08） |
| `step0_raw/chunks/*.js` | 数据 | ✅ 必需 | 业务 chunk（glob 自适应提取，非写死 12 个） |
| `step0_raw/static/*` | 数据 | ✅ 必需 | 入口/配置/public 资源 |
| `verifiers/AI01_ext/verify_ext.cjs` | 脚本 | ✅ 必需 | 真机验收 |
| `verifiers/verify_build.cjs` | 脚本 | ✅ 必需 | ①d 构建后静态冒烟门 |
| `docs/成功复盘SOP.md` | 文档 | ✅ 必需 | 完整细节与避坑 |
| `*.log` / `debug.cjs` / `analyze_shared.cjs` / `reconstruct_shared.cjs` / `05_split_shared.cjs` / `build_project.cjs` / `check_project.cjs` / `verify_state.cjs` | 历史 | ❌ 已删 | 不在 run.cjs 调用链，调试残留 |
| `step0_raw/chunks/` 多余 9 个旧版 chunk | 数据 | ❌ 已删 | run.cjs 不处理（App-D5SRQxl_.js 等） |
| `fixers/` `diagnostics/` `probes/` `logs/` `output/` | 历史 | ❌ 已删 | AI02~AI10 归档与旧产物 |

---

## 2. 输入数据约定（step0_raw 从哪来）

**我们最初只有一个官方编译好的扩展 `dist`**（如 `C:\Users\xinye\Downloads\11\dist`），没有任何其它输入。
`step0_raw/` 是**第 0 步 `extract_input.cjs` 从这个 dist 提取出来的**，不是凭空准备的：

- `step0_raw/chunks/` ← 从 `dist/assets/` **glob 自适应提取「业务 chunk」**（剔除 `vendor-*` / `rolldown-runtime-*` / `__vite-browser-external-*`，其余一律收齐），**不再写死白名单**，换源/换版本无需改代码
- `step0_raw/static/` ← 从 `dist/` 根提 `index.html`、从 `dist/share/` 提 `share.html`、从 `dist/public/` 提 `manifest.json`/`background.js`/图标/`mediapipe`/`models`/`assets/*.css` 等到 `static/public/`

提取命令：
```powershell
node extract_input.cjs C:\Users\xinye\Downloads\11\dist
```

提取的业务 chunk 由脚本自动识别（DEEP=核心业务走完整 webcrack→拆分，OTHER=其余只拷贝）：
- **DEEP 模式**：文件名匹配 `^(App|httpClient|src)-`（`App-*` `httpClient-*` `src-*` 等核心业务文件）
- **OTHER**：其余业务 chunk（`__vite-browser-external-*` / `endpointConfig-*` / `main-*` / `mediabunny-*` / `share-*` / `ShareAppPage-*` / `vendor-*` 等）

> 文件名不再写死：提取用 glob 过滤、生成用正则判定 DEEP。换源只要重新 `node extract_input.cjs` 即可。

---

## 3. 四个关键决策点（为什么这么做）

### 3.1 React 单实例 shim（杜绝多实例 / Invalid hook call）
拆出的代码 `import React from 'react'`，但运行时只能有一份 React（vendor 里的 `Rr`）。`run.cjs` 自动生成：
- `src/bundle/_react_shim.js`：把 `react` 指向 vendor `Rr` 工厂（经 rolldown interop 包装）
- `src/bundle/_jsx_runtime.js`：把 `react/jsx-runtime` 指向 vendor `Fr` 工厂
- `vite.config.ts`：`alias` + `dedupe:['react','react-dom']` + `force-jsx-for-js` 插件

> 细节与模板见 `docs/成功复盘SOP.md` §2。

### 3.2 后处理五类修复（fix_esm.cjs）
构建前必须先跑，一次性根治逆向产物的 ESM 错误：

| 类别 | 现象 | 处理 |
|------|------|------|
| A 导出同步 | `X is not exported` | shared.js 顶层声明同步进 export |
| B import 赋值改写 | `X is an import` | 共享名抽成 `import * as _shared` |
| C 伪迹清理 | `function X(){[native code]}` | 正则删 webcrack 伪迹 |
| D constructor 还原 | `Object(...){super}` | babel 还原成 constructor |
| E 悬空引用补全 | 引用了未 import 的共享符号 | 补 `import {X} from './shared.js'` |
| E2 抽出组件改写 | `X is not defined`（抽到独立文件） | 读 component_map.json，改写 `_cmp_<FILE>` |

> **`component_map.json` 是真相表**：原始组件名 ≠ 文件名（如 `I_`→`I__1`），任何按文件名猜映射的逻辑都会漏接。

### 3.3 CSS 预加载噪声（已知、可不修）
`run.cjs` 写入 `src/bundle/assets/src-BsO0T5Vc.css` / `vendor-Qkhkn02K.css` 占位文件消除 Vite 警告。真机加载时 `main-*.js` 预加载的 css 若不存在，报 `Unable to preload CSS` —— 这是**原扩展自身运行时行为**，属验收噪声，不计入拆分问题。

### 3.4 真机验收判分（verify_ext.cjs）
读 `report.json`，**只修**真机调用栈里的 `ReferenceError`/`TypeError`/`NotFoundError:removeChild`。以下一律**不修**（噪声）：
- `sw.createCDPSession is not a function` —— Playwright 1.62 的 SW API 兼容问题，非应用错误
- `Failed to load resource: 404` ×1 —— 资源缺失噪声

**达成标准**：`errorCount` 可以不是 0，但只要剩下的全是上述噪声，即视为「真机零应用级报错」。

---

## 4. 排错闭环（三个真实 bug 范式）

每修一类 → 重跑 `fix_esm.cjs` → `npm run build` → `verify_ext.cjs` → 看 `report.json`，直到 `ReferenceError` 全消。

| 案例 | 报错 | 根因 | 修复点 |
|------|------|------|--------|
| Qn is not defined | App `mr.jsx` `<Qn/>` | Qn 抽到 Qn.jsx，父文件仍写原名 | E2 改写 `_cmp_Qn` |
| I_ is not defined | httpClient `R_.jsx` `<I_ />` | 原始名 `I_`≠文件 `I__1`，按文件名猜漏接 | E2 用 component_map 映射 |
| _r is not defined | httpClient `_Component133.jsx` `<_r.Provider>` | `_r` 是 JSX 成员表达式对象，早期只收标签名漏了 | E 补 `import {_r} from './shared.js'` |

---

## 5. 避坑清单（给下一位）

1. **生成流水线较重（5~8 分钟），优先用后处理兜底**：产物已完整时，直接 `fix_esm.cjs`（十几秒一次）比重跑更划算。注意：PowerShell 下跑 `run.cjs` 时，webcrack/clean 的 stderr 会被当成 `RemoteException` 误报"挂死/中断"——这**不是脚本 bug**，用 `cmd /d /c` 包裹（见第6条）即可完整跑完，无需担心。
2. **文件名保持原样**：`run.cjs` 内部按 `00_sanitize.cjs` 等原名互相调用，改名会破坏调用链（已踩过坑）。
3. **component_map.json 是真相表**：原始名 ≠ 文件名，按文件名猜必漏。
4. **PowerShell 缓冲区污染**：用 `search_content`/直读文件，避免 `Select-String` 混历史输出。
5. **Playwright 跨版本**：验收装包务必 `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`；`sw.createCDPSession` 报错是脚本兼容，非应用 bug。
6. **cmd 包裹跑 node**：PowerShell 会把 webcrack 的 stderr 当 `RemoteException` 中断 node，用 `cmd /d /c "node ... > log 2>&1"` 包裹可完整跑完。

---

## 6. 一键复现（PowerShell）

```powershell
# 第0步 提取输入（从最初的 dist → step0_raw/）
cd minimal
node extract_input.cjs C:\Users\xinye\Downloads\11\dist

# ① 生成工程（用 cmd 包裹，避免 PowerShell 把 webcrack 的 stderr 当错误中断）
cmd /d /c "node pipeline/run.cjs > run_gen.log 2>&1"
# 跑完看 run_gen.log 末尾确认 ✅ 完成 / 产物文件数

# ①b 先构建验证（关卡：能构建才算拆包可用）
cd output/project
npm install
npm run build
# 若报错（静态解析/门面路径错）→ 先修，通过后再继续

# ①c 可读化（可选）：作用域安全语义改名，让交付物源码/产物命名可读
#     改前建议先 snapshot output/project/src 以便回退
cd ../..
node pipeline/05_rename.cjs output/project/src/bundle

# ①d 构建后静态冒烟门（秒级，不通过则回修，exit 1 阻断）
node verifiers/verify_build.cjs output/project
# 通过才继续

# ② 后处理根治
node pipeline/fix_esm.cjs output/project

# ③ 再构建（后处理后应干净通过）
cd output/project
npm run build

# ④ 真机验收（Playwright 装在 verifiers 目录，非工程根）
cd ../verifiers/AI01_ext
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm install playwright@1.62.0
$env:EXT_PATH = (Resolve-Path ../output/project/dist)
node verify_ext.cjs
# 看 report.json：errorCount=2 且全是噪声即达成
```

---

## 7. 产物形态（达成后）

- `output/project/dist/` —— 可加载运行的扩展产物
- `output/project/src/bundle/` —— 已后处理干净的源码（约 170 jsx + 17 js，含 `*_components/component_map.json`，以实际生成为准）
- `pipeline/fix_esm.cjs` —— 可复用后处理脚本
- `verifiers/AI01_ext/verify_ext.cjs` + `report.json` —— 验收 harness 与报告
