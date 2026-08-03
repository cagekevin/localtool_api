# scripts/ —— 核心脚本目录

本目录只放**核心流水线**脚本：持续复用、被 `package.json` 的 npm scripts 或 CI 质量门引用。
**一次性 / 临时 / 探索性脚本禁止放这里**，请统一放进 `archived/`（见下方规范）。

## 根目录脚本清单

| 脚本 | 用途 |
| --- | --- |
| `beautify.cjs` | 反编译美化：把 1.4.0 样本 `dist/assets` 压缩 chunk 重排版为可读源码，输出到 `src/bundle/` 与 `public/`。用法：`SAMPLE=<样本路径> node scripts/beautify.cjs` |
| `beautify-dist.cjs` | 一键美化 `dist/`（压缩单行 → 可读版写回 `dist/`），4 步全自动流水线。用法：`node scripts/beautify-dist.cjs` |
| `launch-beautify-dist.ps1` | `beautify-dist.cjs` 的 Windows PowerShell 启动器（双击/命令行触发，含 dist-orig/ 备份提示）。用法：`powershell -ExecutionPolicy Bypass -File .\scripts\launch-beautify-dist.ps1`。⚠️ 脚本位于 `scripts/` 内，`$ScriptDir` 即本目录，`$nodeScript` 指向同目录 `beautify-dist.cjs`，并已 `Set-Location` 回仓库根 |
| `smoke_test.cjs` | Tier 2 冒烟测试（硬断言），任一项 FAIL 即退出码 1，作为 CI 质量门。用法：`node scripts/smoke_test.cjs`（npm: `test:smoke`） |
| `_smoke_checks.cjs` | 可复用静态冒烟检查（被 `smoke_test.cjs` 与 `_check_align.cjs` 共用），零依赖，CI 直跑 |
| `_check_align.cjs` | 改名对齐校验安全网：扫描改名后源码关键行为标记位置，确认改名没误伤 |
| `_syntax_check.ps1` | 启动脚本 `launch-all.ps1` 语法检查 |
| `contract_scan.cjs` | 跨端字符串契约全量分布 + 漂移检测。用法：`node scripts/contract_scan.cjs [--resnap\|--md]`（npm: `contracts`） |
| `gen_bundle_map.cjs` | 扫描 `src/bundle/` 生成 `BUNDLE_MAP.md`，作为 AI 检索入口。用法：`node scripts/gen_bundle_map.cjs`（npm: `map`） |
| `add_chunk_headers.cjs` | 给 `src/bundle` 每个 chunk 顶部插入「角色注释」头（幂等，可重跑） |
| `rollback/` | 改名失败回退：快照（`snapshot.cjs`）+ 恢复（`restore.cjs`），安全网 |

> 注：`ai-optimize.cjs`（AI 可读性视图生成器）属于逆向可读性增强链路，已归档到
> `archived/rename-pipeline/`，不在此核心清单内。

## 数据文件（根目录，核心流水线输入）

- `contracts.json` / `contract_snapshot.json`：`contract_scan.cjs` 的契约字典与基线快照
- `contract_snapshot.json`：契约扫描基线，漂移比对依据

> 其它数据文件（如 `regions.json` / `panels.json` / `region_labels.json`）已随逆向辅助脚本归入 `archived/`。

## 规范：一次性脚本归哪里

**以后任何一次性 / 临时 / 探索性脚本，必须新建独立文件夹放进 `scripts/archived/` 下，禁止直接丢进本目录。**

- 本目录只保留**核心流水线**脚本（持续复用、被 CI / npm scripts 引用）。
- 新的一次性脚本：在 `scripts/archived/` 下按用途建子文件夹（如 `archived/临时导出/`、`archived/实验-xxx/`），脚本及其依赖数据一起放进去。
- 不要为图省事把临时脚本平铺在本目录——会污染脚本目录、淹没核心流水线、让后人分不清哪些还能跑。
- 若一个归档脚本后来证明要长期复用，再把它和依赖一起移回本目录，并在此表登记。

详见 [`archived/README.md`](./archived/README.md)。
