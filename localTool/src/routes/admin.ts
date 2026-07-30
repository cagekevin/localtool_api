/**
 * 管理 API — stats / cleanup / export / import
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, getUploadDir, saveDb, queryAll, queryOne, run, LOCAL_FILE_BASE } from '../db/database.js';
import { json, parseJsonBody, sendError } from '../utils/helpers.js';

// ── GET /api/admin/stats ──
export async function handleAdminStats(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();

  // KV
  const kvRow = queryOne(db, 'SELECT COUNT(*) as cnt, SUM(LENGTH(key) + LENGTH(value)) as est FROM kv') as { cnt: number; est: number | null } | undefined;
  const kv = { count: kvRow?.cnt ?? 0, estimatedBytes: kvRow?.est ?? 0 };

  // tasks
  const taskTotal = queryOne(db, 'SELECT COUNT(*) as cnt FROM tasks') as { cnt: number } | undefined;
  const taskStatuses = queryAll(db, 'SELECT status, COUNT(*) as cnt FROM tasks WHERE status IS NOT NULL GROUP BY status') as Array<{ status: string; cnt: number }>;
  const byStatus: Record<string, number> = {};
  for (const s of taskStatuses) byStatus[s.status] = s.cnt;
  const tasks = { total: taskTotal?.cnt ?? 0, byStatus };

  // resources
  const resTotal = queryOne(db, 'SELECT COUNT(*) as cnt FROM resources') as { cnt: number } | undefined;
  const resTypes = queryAll(db, 'SELECT type, COUNT(*) as cnt FROM resources GROUP BY type') as Array<{ type: string; cnt: number }>;
  const byType: Record<string, number> = {};
  for (const t of resTypes) byType[t.type] = t.cnt;
  const resources = { total: resTotal?.cnt ?? 0, byType };

  // disk
  const uploadDir = getUploadDir();
  let diskBytes = 0;
  try { diskBytes = dirSize(uploadDir); } catch { /* ignore */ }

  return json(res, { kv, tasks, resources, disk: { uploadDirBytes: diskBytes } });
}

// ── POST /api/admin/cleanup ──
export async function handleAdminCleanup(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();
  const uploadDir = getUploadDir();

  // 收集所有被引用的 URL（从 resources 和 tasks 两个表）
  const refUrls = new Set<string>();
  const resUrls = queryAll(db, 'SELECT url FROM resources') as Array<{ url: string }>;
  for (const r of resUrls) refUrls.add(r.url);
  const taskUrls = queryAll(db, 'SELECT result_url, thumbnail_url FROM tasks') as Array<{ result_url?: string; thumbnail_url?: string }>;
  for (const t of taskUrls) {
    if (t.result_url) refUrls.add(t.result_url);
    if (t.thumbnail_url) refUrls.add(t.thumbnail_url);
  }

  const LOCAL_BASE = LOCAL_FILE_BASE;
  let scanned = 0;
  let deleted = 0;

  try {
    const entries = fs.readdirSync(uploadDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subDir = path.join(uploadDir, entry.name);
      const files = walkFiles(subDir);
      for (const filePath of files) {
        scanned++;
        const relative = path.relative(uploadDir, filePath).replace(/\\/g, '/');
        const url = `${LOCAL_BASE}${relative}`;
        if (!refUrls.has(url)) {
          try { fs.unlinkSync(filePath); deleted++; } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  return json(res, { scanned, deleted });
}

// ── GET /api/admin/export ──
export async function handleAdminExport(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = await getDb();

  const kvRows = queryAll(db, 'SELECT key, value, updated_at FROM kv');
  const taskRows = queryAll(db, 'SELECT * FROM tasks');
  const resRows = queryAll(db, 'SELECT * FROM resources');

  return json(res, {
    kv: kvRows,
    tasks: taskRows,
    resources: resRows,
    exportedAt: Date.now(),
    version: '2.0.0',
  });
}

// ── POST /api/admin/import ──
export async function handleAdminImport(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = (await parseJsonBody(req)) as { data?: Record<string, unknown>; confirm?: boolean } | null;
  if (!body || !body.data) return sendError(res, 'Missing data field', 400);
  if (!body.confirm) return sendError(res, 'Set confirm: true to proceed', 400);

  const src = body.data as {
    kv?: Array<{ key: string; value: string; updated_at?: number }>;
    tasks?: Array<Record<string, unknown>>;
    resources?: Array<Record<string, unknown>>;
  };
  if (!src.kv || !src.tasks || !src.resources) return sendError(res, 'data must contain kv, tasks, resources arrays', 400);

  saveDb(); // 先落当前数据
  const db = await getDb();

  // KV
  run(db, 'DELETE FROM kv');
  for (const row of src.kv) {
    run(db, 'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)',
      [row.key, row.value, row.updated_at ?? Math.floor(Date.now() / 1000)]);
  }

  // tasks
  run(db, 'DELETE FROM tasks');
  for (const row of src.tasks) {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try { run(db, `INSERT INTO tasks (${keys.join(', ')}) VALUES (${placeholders})`, vals); } catch { /* skip invalid row */ }
  }

  // resources
  run(db, 'DELETE FROM resources');
  for (const row of src.resources) {
    const keys = Object.keys(row);
    const vals = Object.values(row);
    const placeholders = keys.map(() => '?').join(', ');
    try { run(db, `INSERT INTO resources (${keys.join(', ')}) VALUES (${placeholders})`, vals); } catch { /* skip invalid row */ }
  }

  saveDb();
  return json(res, {
    ok: true,
    counts: { kv: src.kv.length, tasks: src.tasks.length, resources: src.resources.length },
  });
}

// ── helpers ──
function dirSize(dir: string): number {
  let total = 0;
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        total += dirSize(p);
      } else if (entry.isFile()) {
        total += fs.statSync(p).size;
      }
    }
  } catch { /* ignore */ }
  return total;
}

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        files.push(...walkFiles(p));
      } else if (entry.isFile()) {
        files.push(p);
      }
    }
  } catch { /* ignore */ }
  return files;
}
