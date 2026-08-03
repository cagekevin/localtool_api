# scripts/archived —— 已归档脚本

本目录存放**非核心流水线**的一次性 / 临时 / 逆向辅助脚本。
核心流水线（持续复用、CI 质量门相关）仍保留在 `scripts/` 根目录，包括：

- `beautify.cjs` / `beautify-dist.cjs`：样本反编译美化（一键复现）
- `smoke_test.cjs` / `_smoke_checks.cjs` / `_check_align.cjs`：质量门与改名对齐校验
- `_syntax_check.ps1`：启动脚本语法检查
- `contract_scan.cjs`：跨端字符串契约漂移检测
- `gen_bundle_map.cjs`：AI 检索入口地图
- `add_chunk_headers.cjs`：chunk 角色注释头
- `rollback/`：改名失败回退快照与恢复

> 注：`ai-optimize.cjs`（AI 可读性视图生成器）属于逆向可读性增强链路，已归档到
> `rename-pipeline/`，不在此列。

> 注意：归档脚本内部相对路径（`__dirname/../..`）与相互 `require` 均已按本目录结构调整，
> 如需运行请保持当前子目录结构不变。

## 子目录

### `one-off/` —— 一次性 / 通用临时工具
- `_copy_public.cjs`：一次性资源复制 + manifest 净化（仅搭建 A22 工程用，标注"一次性"）
- `advanced_format.js` / `format.js`：通用 webcrack + prettier 反混淆格式化（读 `input.js`，与本项目解耦）
- `split_js.py`：通用大文件拆分工具（与本项目无关）

### `reverse-helpers/` —— 逆向辅助（产物文档生成）
- `analyze_regions.cjs`：主程序 chunk 分区域分析（产物 `regions.json` / `panels.json`，与脚本同目录）
- `gen_map.cjs`：由 `regions.json`/`panels.json`（同目录）重建 `MODULE_MAP.md`；
  区域标签 `region_labels.json` 取自 `../rename-pipeline/region_labels.json`

### `rename-pipeline/` —— 1.4.0 语义重命名 + 可读性增强链路（当前空跑占位）
> 任务书红线：根目录三本字典建自 1.3.5，禁用于 1.4.0。本链路当前 `name_rules` 返回空规则，
> 全部退化为安全 no-op，仅为将来基于 1.4.0 重新推导规则后启用。

- `name_rules.cjs`：生成「压缩名 -> 语义名」规则（默认空）
- `scope_rename_plugin.cjs`：babel 作用域精确重命名插件
- `apply_rename_to_bundle.cjs`：把规则应用到 `src/bundle`（写回构建源）
- `apply_stringify_to_bundle.cjs`：无插值反引号模板 -> 字符串字面量
- `rename.cjs`：生成 `readable/` 只读副本（被 `_smoke_checks.cjs` 自动调用）
- `symbols.cjs`：提取 `src/bundle` 顶层符号到 `readable/symbols.json`
- `ai-optimize.cjs`：AI 可读性视图生成器，输出 `src/bundle-ai/` 只读结构化视图（幂等）
- `jsx_restore_plugin.cjs`：JSX 运行时调用还原插件（仅只读副本临时用）
- 数据文件：`region_labels.json`（供 `gen_map.cjs` 使用；`contracts.json` / `contract_snapshot.json` 属契约扫描基线，留在 `scripts/` 根目录）

---

## 规范：一次性脚本归哪里

**以后任何一次性 / 临时 / 探索性脚本，必须新建独立文件夹放进 `scripts/archived/` 下，禁止直接丢进 `scripts/` 根目录。**

- 根目录只放**核心流水线**脚本（持续复用、被 CI / npm scripts 引用的）。
- 新的一次性脚本：在 `scripts/archived/` 下按用途建一个子文件夹（如 `archived/临时导出/`、`archived/实验-xxx/`），把脚本及其依赖数据一起放进去。
- 不要为了"图省事"把临时脚本平铺在根目录——那会污染脚本目录、淹没核心流水线、让后人分不清哪些还能跑。
- 若某个归档脚本后来证明要长期复用，再把它和依赖一起移回 `scripts/` 根目录，并在 `scripts/README.md` 登记。
