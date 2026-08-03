#!/usr/bin/env node
/**
 * audit-barrels.cjs — 自动交叉校验 T02B 报告 与 storageKeys.ts/events.ts
 *
 * 用法:
 *   node scripts/audit-barrels.cjs
 *
 * 输出:
 *   - T02B 有但 barrel 缺的键/事件（漏收）
 *   - barrel 有但 T02B 无的键/事件（多收）
 *   - 两端一致的键/事件
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const T02B_PATH = path.join(ROOT, 'docs', 'agent 批量任务', 'out', 'T02B-inv-scatter.md');
const KEYS_TS = path.join(ROOT, 'src', 'shared', 'storageKeys.ts');
const EVENTS_TS = path.join(ROOT, 'src', 'shared', 'events.ts');

// ── 1. 从 T02B markdown 提取所有存储键字面量 ──
const t02bMd = fs.readFileSync(T02B_PATH, 'utf-8');

// 存储键：从 §1.1 表格提取
const t02bStorage = new Set();
const storeRe = /\| `([^`]+)` \| (?:localStorage|sessionStorage|chrome\.storage)/g;
let sm;
while ((sm = storeRe.exec(t02bMd)) !== null) {
  // 跳过非字面量
  if (sm[1].includes('${')) continue;
  t02bStorage.add(sm[1]);
}

// 事件频道：从 §2.1 表格提取
const t02bEvents = new Set();
const eventRe = /\| `([^`]+)` \| \d+ \| (?:字面量|变量)/g;
let em;
while ((em = eventRe.exec(t02bMd)) !== null) {
  // 跳过 DOM 事件
  if (['change', 'input', 'resize'].includes(em[1])) continue;
  t02bEvents.add(em[1]);
}
// 变量事件名从 §2.3 提取
const varEventRe = /\| `([^`]+)` \| `([^`]+)` \| .+ \|/g;
let ve;
while ((ve = varEventRe.exec(t02bMd)) !== null) {
  t02bEvents.add(ve[2]);
}

// ── 2. 从 storageKeys.ts 提取所有字符串字面量 ──
const keysTs = fs.readFileSync(KEYS_TS, 'utf-8');
const barrelStorage = new Set();
const barrelStoreRe = /'([^']+)' as const/g;
let bs;
while ((bs = barrelStoreRe.exec(keysTs)) !== null) {
  barrelStorage.add(bs[1]);
}

// ── 3. 从 events.ts 提取所有字符串字面量 ──
const eventsTs = fs.readFileSync(EVENTS_TS, 'utf-8');
const barrelEvents = new Set();
const barrelEventRe = /'([^']+)' as const/g;
let be;
while ((be = barrelEventRe.exec(eventsTs)) !== null) {
  barrelEvents.add(be[1]);
}
// 也抓透传的 EVT_* 常量（canvas 三个事件）
const canvasEvents = ['canvas-run-workflow-request', 'canvas-run-workflow-done', 'canvas-reset-workflow-runtime'];
for (const e of canvasEvents) barrelEvents.add(e);

// ── 4. 对比 ──
const storageMiss = [...t02bStorage].filter(k => !barrelStorage.has(k));
const storageExtra = [...barrelStorage].filter(k => !t02bStorage.has(k));
const storageMatch = [...t02bStorage].filter(k => barrelStorage.has(k));

const eventMiss = [...t02bEvents].filter(e => !barrelEvents.has(e));
const eventExtra = [...barrelEvents].filter(e => !t02bEvents.has(e));
const eventMatch = [...t02bEvents].filter(e => barrelEvents.has(e));

// ── 5. 输出 ──
console.log('═'.repeat(50));
console.log('  barrel 交叉审计结果');
console.log('═'.repeat(50));

console.log(`\n📦 存储键: T02B=${t02bStorage.size}  barrel=${barrelStorage.size}`);
console.log(`   ✅ 一致: ${storageMatch.length}`);
if (storageMiss.length > 0) {
  console.log(`   ❌ T02B 有但 barrel 缺 (${storageMiss.length}):`);
  for (const k of storageMiss.sort()) console.log(`      - ${k}`);
}
if (storageExtra.length > 0) {
  console.log(`   ⚠️ barrel 有但 T02B 无 (${storageExtra.length}):`);
  for (const k of storageExtra.sort()) console.log(`      + ${k}`);
}

console.log(`\n📡 事件频道: T02B=${t02bEvents.size}  barrel=${barrelEvents.size}`);
console.log(`   ✅ 一致: ${eventMatch.length}`);
if (eventMiss.length > 0) {
  console.log(`   ❌ T02B 有但 barrel 缺 (${eventMiss.length}):`);
  for (const e of eventMiss.sort()) console.log(`      - ${e}`);
}
if (eventExtra.length > 0) {
  console.log(`   ⚠️ barrel 有但 T02B 无 (${eventExtra.length}):`);
  for (const e of eventExtra.sort()) console.log(`      + ${e}`);
}

// 退出码
const totalIssues = storageMiss.length + eventMiss.length;
if (totalIssues === 0) {
  console.log(`\n✅ 全量对齐，零差异\n`);
} else {
  console.log(`\n❌ ${totalIssues} 个差异需要处理\n`);
}
process.exit(totalIssues > 0 ? 1 : 0);
