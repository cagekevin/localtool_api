#!/usr/bin/env node
/**
 * hooks-lookup.cjs — 查一个 legacy 文件的 hooks 执行顺序 + 重写红线
 *
 * 用法:
 *   node scripts/hooks-lookup.cjs mr.jsx         # 查 App 根组件
 *   node scripts/hooks-lookup.cjs bo.jsx         # 查多窗口配置
 *   node scripts/hooks-lookup.cjs --list          # 列出所有已收录文件
 *
 * 数据来源: scripts/hooks-contract.md（采信版本 T12B，115 文件逐行 hooks/async 顺序）
 */
const fs = require('fs');
const path = require('path');

const T12B = path.resolve(__dirname, 'hooks-contract.md');
if (!fs.existsSync(T12B)) { console.error('❌ T12B 数据不存在'); process.exit(1); }

const text = fs.readFileSync(T12B, 'utf-8');
const sections = text.split('\n### ').slice(1);

// 解析所有文件
const files = new Map();
for (const sec of sections) {
  const lines = sec.split('\n');
  const header = lines[0];
  const m = header.match(/^(\S+\.jsx)\s*〔(.)〕/);
  if (!m) continue;
  const name = m[1];
  const type = { C: 'Component(hooks)', M: 'Mixed(hooks+async)', A: 'Async(无hooks)' }[m[2]] || '?';
  const hooks = lines.find(l => l.includes('hooks 顺序'))?.replace(/^.*：/, '') || '';
  const async_ = lines.find(l => l.includes('async 时序'))?.replace(/^.*：/, '') || '-';
  const redline = lines.find(l => l.includes('重写红线'))?.replace(/^.*：/, '') || '';
  files.set(name, { type, hooks, async: async_, redline });
}

// --list 模式
if (process.argv.includes('--list')) {
  console.log(`\n📋 ${files.size} 个文件已收录:\n`);
  for (const [name, info] of [...files].sort()) {
    console.log(`  ${name.padEnd(25)}  ${info.type}`);
  }
  process.exit(0);
}

// 查询模式
const query = process.argv[2];
if (!query) { console.error('用法: node scripts/hooks-lookup.cjs <文件名>'); process.exit(1); }

const entry = files.get(query);
if (!entry) {
  const close = [...files.keys()].filter(k => k.includes(query));
  if (close.length > 0) {
    console.log(`\n❌ 未找到 "${query}"。相似文件: ${close.join(', ')}`);
  } else {
    console.log(`\n❌ 未找到 "${query}"。可用 --list 查看已收录文件`);
  }
  process.exit(1);
}

console.log(`\n📄 ${query}  [${entry.type}]`);
console.log(`\n  ── hooks 执行顺序 ──`);
console.log(`  ${entry.hooks}`);
if (entry.async !== '-') {
  console.log(`\n  ── async/await 时序 ──`);
  console.log(`  ${entry.async}`);
}
console.log(`\n  ── 重写红线 ──`);
console.log(`  ${entry.redline}\n`);
