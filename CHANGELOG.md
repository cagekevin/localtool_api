# 更新日志

## 2026-07-31
- **网关双模**：`apimart-gateway/main.py` 原生支持同步(`wait`)+异步(`task_id`)双模。
- **localTool 直传**：`src/routes/system.ts` 去除 `handleAsyncPoll` 轮询，注入 `wait` 直连网关。
- **日志降噪**：`SILENT_LOG_PATHS` 过滤 `/api/kv/get` 等高频轮询端点，只留 `[proxy]` 有用日志。
- **清理缓存可用**：上传接口返回绝对 URL（`http://127.0.0.1:18080/files/...`），前端 `清理缓存` 判定通过。
- **辅助脚本入册**：`script/format.js` + `script/advanced_format.js` 写入 `CLAUDE.md` §10（代码反混淆工具）。
