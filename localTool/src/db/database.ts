/**
 * 数据库初始化 — sql.js（纯 WASM，跨平台，无需编译）
 * 封装兼容 better-sqlite3 风格的查询接口
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

export function getDataDir(): string {
  const envDir = process.env['MAOMAO_DATA_DIR'];
  if (envDir) return envDir;
  return path.join(os.homedir(), '.maomao-localtool');
}

export function getUploadDir(): string {
  return path.join(getDataDir(), 'uploads');
}

/** 本地文件可访问 base（files 路由前缀）。多处拼 URL 共用，避免硬编码漂移 */
export const LOCAL_FILE_BASE = 'http://127.0.0.1:18080/files/';

let _db: SqlJsDatabase | null = null;

export async function getDb(): Promise<SqlJsDatabase> {
  if (_db) return _db;

  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const uploadDir = getUploadDir();
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'localtool.db');
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    _db = new SQL.Database(fileBuffer);
  } else {
    _db = new SQL.Database();
  }

  initTables(_db);
  return _db;
}

/** 持久化到磁盘 */
export function saveDb(): void {
  if (!_db) return;
  const data = _db.export();
  const buffer = Buffer.from(data);
  const dbPath = path.join(getDataDir(), 'localtool.db');
  fs.writeFileSync(dbPath, buffer);
}

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 安全删除本地文件：只删 18080 本地文件，跳过远程 URL。
 * 删前检查是否有其他 task/resource 仍引用该 URL，有引用则跳过。
 * @returns true = 已删除，false = 跳过或不存在
 */
export function deleteLocalFile(db: any, dbUrl: string): boolean {
  if (!dbUrl.startsWith(LOCAL_FILE_BASE)) return false;

  const relativePath = dbUrl.slice(LOCAL_FILE_BASE.length);
  const diskPath = path.join(getUploadDir(), relativePath);

  if (!fs.existsSync(diskPath)) return false;

  // 检查是否有其他 task 或 resource 仍引用此 URL
  const taskRefs = queryOne(db,
    'SELECT COUNT(*) as cnt FROM tasks WHERE result_url = ? OR thumbnail_url = ?',
    [dbUrl, dbUrl]
  ) as { cnt: number } | undefined;
  const resRefs = queryOne(db,
    'SELECT COUNT(*) as cnt FROM resources WHERE url = ?',
    [dbUrl]
  ) as { cnt: number } | undefined;
  if ((taskRefs?.cnt ?? 0) > 0 || (resRefs?.cnt ?? 0) > 0) return false;

  fs.unlinkSync(diskPath);
  return true;
}

/**
 * 防抖落盘：500ms 内多次调用只落一次。
 * 所有写路由（KV/tasks/resources）写完后调用此函数，
 * 确保非优雅退出时最多丢 500ms 数据。
 */
export function debouncedSaveDb(): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    saveDb();
  }, 500);
}

function initTables(db: any): void {
  db.run(`CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT (unixepoch()))`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (task_id TEXT PRIMARY KEY, node_id TEXT, prompt TEXT, result_url TEXT, thumbnail_url TEXT, error_msg TEXT, custom_output_type TEXT, channel_name TEXT, model_name TEXT, progress INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL DEFAULT 0, not_found_count INTEGER NOT NULL DEFAULT 0, custom_result_data TEXT, custom_raw_response TEXT, request_data TEXT, response_data TEXT, media_meta TEXT, extra_fields TEXT)`);
  db.run(`CREATE TABLE IF NOT EXISTS resources (id TEXT PRIMARY KEY, url TEXT NOT NULL, type TEXT NOT NULL, source TEXT, folder TEXT, name TEXT, page_url TEXT, page_title TEXT, is_favorite INTEGER NOT NULL DEFAULT 0, timestamp INTEGER NOT NULL DEFAULT 0)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_progress ON tasks(progress)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_timestamp ON resources(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_folder ON resources(folder)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_resources_is_favorite ON resources(is_favorite)`);

  // 迁移：旧数据库可能缺列（前端 task 对象带这些字段时会 INSERT 报错）
  try { db.run(`ALTER TABLE tasks ADD COLUMN type TEXT`); } catch { /* 列已存在 */ }
  try { db.run(`ALTER TABLE tasks ADD COLUMN status TEXT`); } catch { /* 列已存在 */ }
  try { db.run(`ALTER TABLE tasks ADD COLUMN error_message TEXT`); } catch { /* 列已存在 */ }
}

export function closeDb(): void {
  if (_db) {
    saveDb();
    _db.close();
    _db = null;
  }
}

// ── 兼容 better-sqlite3 风格的查询接口 ──

/** 执行 SQL，返回结果数组 */
export function queryAll(db: any, sql: string, params: unknown[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params as any[]);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/** 执行 SQL，返回第一行 */
export function queryOne(db: any, sql: string, params: unknown[] = []): any | undefined {
  const rows = queryAll(db, sql, params);
  return rows[0];
}

/** 执行 INSERT/UPDATE/DELETE，返回 { changes } */
export function run(db: any, sql: string, params: unknown[] = []): { changes: number } {
  db.run(sql, params as any[]);
  return { changes: db.getRowsModified() };
}

/** 执行多条 SQL（事务） */
export function execMulti(db: any, statements: string[]): void {
  for (const sql of statements) {
    db.run(sql);
  }
}

/** 开始事务 */
export function beginTx(db: any): void {
  db.run('BEGIN');
}

/** 提交事务 */
export function commitTx(db: any): void {
  db.run('COMMIT');
}

/** 回滚事务 */
export function rollbackTx(db: any): void {
  db.run('ROLLBACK');
}
