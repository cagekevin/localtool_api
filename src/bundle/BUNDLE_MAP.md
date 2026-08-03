# BUNDLE_MAP.md · src/bundle 逆向源码地图

> 自动生成（scripts/gen_bundle_map.cjs）。AI 改 `src/bundle/` 前先读本图，按特征反查落点，避免"找不到/改漏"。
> 文件名是混淆名（如 `H_.jsx` 12668 行），**不要凭文件名判断职责**，看「特征」列。
> 配套：CONTRACTS.md（契约分布）+ scripts/contract_scan.cjs（漏改检测）。

## 一、顶层 chunk 总表（14 个，均为 facade 或运行时垫片）

| chunk | 行数 | 类型 | 说明 |
|---|---|---|---|
| `vendor-Z-adA07W.js` | 4682 | 运行时 | 勿改（React 单实例/外链垫片） |
| `ShareAppPage-C4RerI9i.js` | 623 | facade | 映射至同名 _components |
| `mediabunny-mp3-encoder-CZeRAvEV.js` | 212 | 库 | MP3 编码器 |
| `src-_qSScO88.js` | 151 | facade | 映射至同名 _components |
| `endpointConfig-Bt85xi8d.js` | 123 | 逻辑 | 接入点/端口/18080 配置（契约 critical） |
| `main-CYvt_zul.js` | 97 | 入口 | 应用入口 |
| `httpClient-BknZwXjG.js` | 74 | facade | 映射至同名 _components |
| `_react_shim.js` | 44 | 运行时 | 勿改（React 单实例/外链垫片） |
| `rolldown-runtime-aKtaBQYM.js` | 37 | 运行时 | 勿改（React 单实例/外链垫片） |
| `share-CyPsaet6.js` | 23 | 入口 | 分享页入口 |
| `App-BX6o9fW5.js` | 6 | facade | 映射至同名 _components |
| `_jsx_runtime.js` | 6 | 运行时 | 勿改（React 单实例/外链垫片） |
| `src-kC58-PF2.js` | 5 | facade | 映射至同名 _components |
| `__vite-browser-external-CwrUGkgb.js` | 2 | 运行时 | 勿改（React 单实例/外链垫片） |

## 二、_components 目录规模

| 目录 | 文件数 | 角色 |
|---|---|---|
| `App-BX6o9fW5_components/` | 32 | 主应用（画布编辑器核心 UI/状态） |
| `httpClient-BknZwXjG_components/` | 141 | HTTP 客户端层（代理/请求/资源/转场，最大 141 文件） |
| `src-_qSScO88_components/` | 4 | 运行时模块 |
| `src-kC58-PF2_components/` | 1 | 入口胶水 |

## 三、大文件索引（>500 行，按特征反查）

> 这些文件 AI 最可能要进。特征列从代码自动抽取：用到哪些 API 路径、KV 键、React hooks、导出组件。

| 文件 | 行数 | API 路径 | KV 键 | Hooks | 导出组件 |
|---|---|---|---|---|---|
| `src-_qSScO88_components/shared.js` | 34659 | — | — | — | _cmp_xs e t n 📦聚合导出 |
| `httpClient-BknZwXjG_components/H_.jsx` | 12672 | /v1/chat/completions /v1/draw/completions /v1/images/edits /v1/images/generations /api/assets/upload | proxyMode local-tool transitResources | useState useEffect useRef useMemo | H_ H_ |
| `httpClient-BknZwXjG_components/shared.js` | 11722 | /api/jianying/send /v1/gateway/ai-app /api/tasks /api/tasks/save /api/tasks/batch-save | proxyMode local-tool canvas-state-v1 transitResources api_configs | useState useEffect useRef useCallback | _cmp_Bn _cmp_Er _cmp_Tr _cmp_Vn 📦聚合导出 |
| `vendor-Z-adA07W.js` | 4682 | /api/objects | — | useState useEffect useRef useMemo | $ $n $t A 📦聚合导出 |
| `App-BX6o9fW5_components/Vr.jsx` | 4519 | /v1/gateway/task/ /files/resources/ | local-tool canvas-state-v1 transitResources api_configs | useState useEffect useRef useMemo | Vr Vr |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ /v1/gateway/task/ /api/resources /api/resources/save | — | useState useEffect useRef useCallback | _cmp_Ln _cmp_Lt _cmp_Qt _cmp_Sr 📦聚合导出 |
| `httpClient-BknZwXjG_components/c_.jsx` | 2806 | — | transitResources | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/As.jsx` | 2088 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/bo.jsx` | 1694 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/$s.jsx` | 1648 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/es.jsx` | 1255 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Gc.jsx` | 1234 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Zo.jsx` | 1150 | /files/ | transitResources | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Uo.jsx` | 1076 | — | — | useState useEffect useRef useMemo | Uo Uo |
| `httpClient-BknZwXjG_components/Lo.jsx` | 963 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Rs.jsx` | 905 | — | — | useState useEffect useRef | — |
| `src-_qSScO88_components/xs.jsx` | 875 | — | — | — | — |
| `httpClient-BknZwXjG_components/Yo.jsx` | 828 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Rg.jsx` | 826 | — | — | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/Lh.jsx` | 720 | — | — | useState useEffect useRef useLayoutEffect | Lh Lh |
| `httpClient-BknZwXjG_components/Co.jsx` | 703 | — | transitResources | useState useEffect useRef useMemo | — |
| `httpClient-BknZwXjG_components/_Component129.jsx` | 662 | — | — | useState useEffect useRef | _Component129 _Component129 |
| `httpClient-BknZwXjG_components/Un.jsx` | 658 | /api/files/open /files/ /api/files/open-dir | local-tool transitResources | — | Un Un |
| `httpClient-BknZwXjG_components/ec.jsx` | 635 | — | — | useState useEffect useRef useMemo | — |
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default /api/upload/app-asset | proxyMode transitResources | — | default 📦聚合导出 |
| `httpClient-BknZwXjG_components/Zl.jsx` | 609 | — | — | useState useEffect useRef useMemo | — |
| `App-BX6o9fW5_components/_Component40.jsx` | 559 | — | — | useState useEffect useRef useMemo | _Component40 _Component40 |
| `httpClient-BknZwXjG_components/_Component72.jsx` | 547 | — | — | useState useEffect useRef useMemo | _Component72 _Component72 |
| `App-BX6o9fW5_components/jn.jsx` | 544 | — | — | useState useEffect useRef useMemo | — |
| `App-BX6o9fW5_components/Qn.jsx` | 528 | — | — | useState useEffect useMemo | Qn Qn |

## 四、反向索引（契约字符串 → 在哪改）

> 改某个契约前，先看右边列确认要动几个文件。完整分布见 CONTRACTS.md。

| 契约字符串 | 命中文件数 | 文件（按命中次数降序） |
|---|---|---|
| `/api/proxy` | 1 | httpClient-BknZwXjG_components/shared.js(4) |
| `18080` | 2 | endpointConfig-Bt85xi8d.js(5) · App-BX6o9fW5_components/Tr.jsx(1) |
| `9004` | 0 | ⚠ bundle 内无字面量（前端经变量拼接，见 contracts.json scope=localTool/apimart） |
| `/public/platform` | 1 | httpClient-BknZwXjG_components/shared.js(2) |
| `transitResources` | 9 | App-BX6o9fW5_components/Vr.jsx(7) · httpClient-BknZwXjG_components/H_.jsx(6) · httpClient-BknZwXjG_components/Un.jsx(2) · httpClient-BknZwXjG_components/_Component118.jsx(2) · httpClient-BknZwXjG_components/c_.jsx(2) · ShareAppPage-C4RerI9i.js(2) · httpClient-BknZwXjG_components/Co.jsx(1) · httpClient-BknZwXjG_components/Zo.jsx(1) · httpClient-BknZwXjG_components/shared.js(1) |
| `active_api_endpoint` | 1 | endpointConfig-Bt85xi8d.js(1) |
| `canvas-state-v1` | 2 | App-BX6o9fW5_components/Vr.jsx(2) · httpClient-BknZwXjG_components/shared.js(2) |
| `proxyMode` | 3 | httpClient-BknZwXjG_components/H_.jsx(14) · httpClient-BknZwXjG_components/shared.js(1) · ShareAppPage-C4RerI9i.js(1) |
| `local-tool` | 4 | httpClient-BknZwXjG_components/Un.jsx(4) · App-BX6o9fW5_components/Vr.jsx(3) · httpClient-BknZwXjG_components/H_.jsx(2) · httpClient-BknZwXjG_components/shared.js(2) |
| `x-proxy-url` | 0 | ⚠ bundle 内无字面量（上游头，见 contracts.json scope=localTool） |

## 五、高危文件（被大量 import，改它影响面最大）

> 这些文件是「改一处漏一处」重灾区。改前务必全文 grep 确认所有引用方，改后跑 `npm run contracts` + `npm run build`。

| 文件 | 被引用次数 |
|---|---|
| `httpClient-BknZwXjG_components/shared.js` | 203 |
| `src-_qSScO88_components/shared.js` | 146 |
| `App-BX6o9fW5_components/shared.js` | 31 |
| `httpClient-BknZwXjG_components/_Component8.jsx` | 26 |
| `httpClient-BknZwXjG_components/_Component12.jsx` | 24 |
| `httpClient-BknZwXjG_components/_Component9.jsx` | 16 |
| `httpClient-BknZwXjG_components/Bn.jsx` | 8 |
| `httpClient-BknZwXjG_components/Er.jsx` | 8 |
| `httpClient-BknZwXjG_components/Si.jsx` | 6 |
| `httpClient-BknZwXjG_components/_Component23.jsx` | 6 |
| `httpClient-BknZwXjG_components/Ai.jsx` | 6 |
| `httpClient-BknZwXjG_components/_Component76.jsx` | 6 |
| `httpClient-BknZwXjG_components/_Component21.jsx` | 5 |
| `httpClient-BknZwXjG_components/Oi.jsx` | 5 |
| `httpClient-BknZwXjG_components/Ti.jsx` | 4 |

## 六、同名影子文件警示（重要）

> ⚠ **`src/bundle/` 内部同名影子文件**：以下文件名在多个 `_components` 目录中重复出现，是「改一处漏一处」最高危陷阱。改其中之一前，必须逐个确认所有同名文件是否要同步改，改完跑 `npm run contracts` + `npm run build`。

| 同名文件 | 出现目录数 | 落点（按目录） |
|---|---|---|
| `shared.js` | 4 | App-BX6o9fW5_components · httpClient-BknZwXjG_components · src-_qSScO88_components · src-kC58-PF2_components |
| `Tr.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |
| `_Component19.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |
| `_Component24.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |
| `_Component40.jsx` | 2 | App-BX6o9fW5_components · httpClient-BknZwXjG_components |

- `public/assets/*.js` 是 1.4.0 时期遗留的**死副本**（12 个 JS 已于 2026-08-02 删除），被 build 产物覆盖不生效。grep 该路径若再现，是缓存/未清理产物，勿改。
- `public/assets/*.css`（src-DoQUrSOl.css / httpClient-DFxwm5B3.css / vendor-Qkhkn02K.css）是**活文件**，Vite 不产出，由 post-build-fixups 补引用，保留勿删。
- `dist/` 是构建产物，运行时只读它；改前端一律改 `src/bundle/` 后 `npm run build` 回灌（见 CLAUDE.md §四.2/§四.5）。

## 七、功能域速查（改某功能先看哪）

> 基于文件特征（API 路径 / 契约字符串 / 目录）自动归类，供 AI 定位「我要改 X 功能该进哪个文件」。同一文件可能命中多域。

### 应用入口 / 启动

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `main-CYvt_zul.js` | 97 | — |
| `src-kC58-PF2_components/shared.js` | 48 | — |
| `share-CyPsaet6.js` | 23 | — |
| `App-BX6o9fW5.js` | 6 | — |
| `src-kC58-PF2.js` | 5 | — |

### 接入点 / 端口 / 代理配置

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12672 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11722 | /api/jianying/send /v1/gateway/ai-app |
| `App-BX6o9fW5_components/Vr.jsx` | 4519 | /v1/gateway/task/ /files/resources/ |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |
| `httpClient-BknZwXjG_components/Un.jsx` | 658 | /api/files/open /files/ |
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default |
| `endpointConfig-Bt85xi8d.js` | 123 | /api/kv/get /api/kv/set |
| `main-CYvt_zul.js` | 97 | — |

### HTTP 客户端 / 代理转发层

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12672 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11722 | /api/jianying/send /v1/gateway/ai-app |
| `httpClient-BknZwXjG_components/Un.jsx` | 658 | /api/files/open /files/ |

### 画布编辑器核心 UI / 状态

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `App-BX6o9fW5_components/Vr.jsx` | 4519 | /v1/gateway/task/ /files/resources/ |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |
| `App-BX6o9fW5_components/_Component40.jsx` | 559 | — |
| `App-BX6o9fW5_components/jn.jsx` | 544 | — |
| `App-BX6o9fW5_components/Qn.jsx` | 528 | — |
| `App-BX6o9fW5_components/Ln.jsx` | 410 | — |
| `App-BX6o9fW5_components/_Component11.jsx` | 396 | — |
| `App-BX6o9fW5_components/Qt.jsx` | 314 | — |

### 资源 / 文件上传

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12672 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11722 | /api/jianying/send /v1/gateway/ai-app |
| `vendor-Z-adA07W.js` | 4682 | /api/objects |
| `App-BX6o9fW5_components/Vr.jsx` | 4519 | /v1/gateway/task/ /files/resources/ |
| `httpClient-BknZwXjG_components/c_.jsx` | 2806 | — |
| `httpClient-BknZwXjG_components/As.jsx` | 2088 | — |
| `httpClient-BknZwXjG_components/bo.jsx` | 1694 | — |
| `httpClient-BknZwXjG_components/$s.jsx` | 1648 | — |

### 任务 / 工作流管理

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12672 | /v1/chat/completions /v1/draw/completions |
| `httpClient-BknZwXjG_components/shared.js` | 11722 | /api/jianying/send /v1/gateway/ai-app |
| `App-BX6o9fW5_components/Vr.jsx` | 4519 | /v1/gateway/task/ /files/resources/ |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default |

### 分享页（ShareAppPage）

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `ShareAppPage-C4RerI9i.js` | 623 | /api/workflow-apps/ /api/sync/default |
| `share-CyPsaet6.js` | 23 | — |

### AI 对话 / 绘图接口

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12672 | /v1/chat/completions /v1/draw/completions |

### 视频生成

| 文件 | 行数 | 关键特征 |
|---|---|---|
| `httpClient-BknZwXjG_components/H_.jsx` | 12672 | /v1/chat/completions /v1/draw/completions |
| `App-BX6o9fW5_components/shared.js` | 3088 | /v1/video/generations/ /v1/videos/ |

## 八、重建命令

```bash
npm run map        # 重建本图
npm run contracts  # 校验契约全端同步（漏改检测）
npm run contracts -- --resnap  # 混淆重排后重建基线
```
