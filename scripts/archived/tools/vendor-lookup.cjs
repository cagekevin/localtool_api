#!/usr/bin/env node
/**
 * vendor-lookup.cjs — 输入混淆名 → 输出可读原名 + 所在 chunk / 文件
 *
 * 用法:
 *   node scripts/vendor-lookup.cjs jr          # 查一个混淆名
 *   node scripts/vendor-lookup.cjs Y           # 也可以通过别名反查
 *   node scripts/vendor-lookup.cjs Nt          # 查一个只在 component-mapping.json 中的名字
 *   node scripts/vendor-lookup.cjs --list      # 列出所有收录标识符的分布统计
 *
 * 数据来源（两级查表）:
 *   ① docs/dual-naming-mapping.md          — httpClient facade 67 对双重命名（混淆名 ↔ 别名 ↔ barrel 语义名）
 *   ② docs/component-mapping.json          — 166 个混淆标识符 → legacy chunk 路径映射
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DUAL_NAME_MD = path.resolve(ROOT, 'docs', 'dual-naming-mapping.md');
const COMP_MAP_JSON = path.resolve(ROOT, 'docs', 'component-mapping.json');

// ── 1. 加载 component-mapping.json ──
if (!fs.existsSync(COMP_MAP_JSON)) {
  console.error('❌ component-mapping.json 不存在，请先运行 npm run mapping');
  process.exit(1);
}
const compMap = JSON.parse(fs.readFileSync(COMP_MAP_JSON, 'utf-8'));

// ── 2. 解析 dual-naming-mapping.md ──
const dualMap = new Map(); // key: 原生混淆名, value: { alias, semantic, crossChunk, shareApp, app }
const aliasToRaw = new Map(); // key: 字母别名, value: 原生混淆名
if (fs.existsSync(DUAL_NAME_MD)) {
  const md = fs.readFileSync(DUAL_NAME_MD, 'utf-8');
  // 表格行格式: | N | `原生名`[(文件名)] | `别名` | 语义名 | ✅/❌ | ... | App名 |
  // 部分行在原生名后有文件名注释，如: `default`(L_.jsx)
  // capture: 1=#, 2=`内文本`, 3=(内文件名 or ''), 4=别名, 5=语义名, 6=跨chunk, 7=ShareAppPage, 8=App
  const rowRe = /^\| (\d+) \| `([^`]+)`(?:\(([^)]*)\))? \| `([^`]+)` \| ([^|]*?) \| ([^|]*?) \| ([^|]*?) \| ([^|]*?) \|$/gm;
  let m;
  while ((m = rowRe.exec(md)) !== null) {
    const raw = m[2] + (m[3] ? `(${m[3]})` : '');
    const alias = m[4];
    const semantic = m[5].trim() === '—' ? '' : m[5].trim();
    const crossChunk = m[6].includes('✅');
    const shareApp = m[7].trim() === '—' ? '' : m[7].trim();
    const app = m[8].trim() === '—' ? '' : m[8].trim();
    dualMap.set(raw, { alias, semantic, crossChunk, shareApp, app });
    aliasToRaw.set(alias, raw);
  }
}

// ── 3. 辅助函数 ──

/** 把 src/bundle/ 路径转为 src/legacy/（改名后的真实路径） */
function bundleToLegacy(p) {
  return p.replace(/src\/bundle\//g, 'src/legacy/');
}

/** 从 component-mapping.json 中提取 chunk 简称（去重） */
function chunkNames(paths) {
  return [...new Set(paths.map(p => {
    const dir = p.replace(/src\/bundle\/([^/]+).*/, '$1');
    return dir.replace(/_components$/, '');
  }))];
}

// ── 4. --list 模式 ──
if (process.argv.includes('--list')) {
  const byChunk = new Map();
  for (const [name, paths] of Object.entries(compMap)) {
    for (const p of paths) {
      const short = chunkNames([p])[0];
      if (!byChunk.has(short)) byChunk.set(short, new Set());
      byChunk.get(short).add(name);
    }
  }
  console.log(`\n📋 ${Object.keys(compMap).length} 个混淆标识符 + ${dualMap.size} 个 httpClient 双名对\n`);
  console.log('按 chunk 分布:\n');
  for (const [chunk, names] of [...byChunk.entries()].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${chunk.padEnd(35)}  ${String(names.size).padStart(3)} 个标识符`);
  }
  console.log(`\n  httpClient 双名映射                    ${dualMap.size} 对 (dual-naming-mapping.md)`);
  console.log(`  其中已 barrel 收敛                     ${[...dualMap.values()].filter(v => v.semantic).length} 个`);
  console.log('');
  process.exit(0);
}

// ── 5. 查询模式 ──
const query = process.argv[2];
if (!query) {
  console.error('用法: node scripts/vendor-lookup.cjs <混淆名|别名>');
  console.error('      node scripts/vendor-lookup.cjs --list');
  process.exit(1);
}

// 先查 dual-naming 表（httpClient facade）
let dualEntry = null;
let dualSource = '';
if (dualMap.has(query)) {
  dualEntry = dualMap.get(query);
  dualSource = '原生混淆名';
} else if (aliasToRaw.has(query)) {
  dualSource = '别名 → 原生名';
  const raw = aliasToRaw.get(query);
  dualEntry = dualMap.get(raw);
} else if (query === 'default') {
  // 查询 'default' 时列出所有 default 变体
  const defaults = [...dualMap.entries()].filter(([k]) => k.startsWith('default('));
  if (defaults.length > 0) {
    console.log(`\n🔍 查询: "default" — 以下 4 个 default 导出:\n`);
    for (const [raw, entry] of defaults) {
      console.log(`  ${raw.padEnd(22)}  别名: ${entry.alias.padEnd(4)}  语义名: ${entry.semantic || '—'}`);
    }
    console.log('');
    process.exit(0);
  }
}

// 再查 component-mapping.json
const compEntry = compMap[query] || null;

// 如果两边都查不到，做模糊搜索
if (!dualEntry && !compEntry) {
  const allKeys = [...new Set([
    ...Object.keys(compMap),
    ...[...dualMap.keys()],
    ...[...aliasToRaw.keys()],
  ])];
  const close = allKeys.filter(k => k.includes(query) || k.toLowerCase().includes(query.toLowerCase()));
  console.log(`\n❌ 未找到 "${query}"。`);
  if (close.length > 0) {
    console.log(`   相似标识符: ${close.slice(0, 10).join(', ')}${close.length > 10 ? ' ...' : ''}`);
  }
  console.log('   可用 --list 查看全部收录标识符\n');
  process.exit(1);
}

// ── 6. 输出结果 ──
const foundVia = compEntry ? 'component-mapping.json' : '';
console.log(`\n🔍 查询: "${query}"`);

if (dualEntry) {
  console.log(`\n┌─ httpClient 双重命名映射 ─────────────────`);
  console.log(`│ 来源:    ${dualSource}`);
  console.log(`│ 别名:    ${dualEntry.alias}`);
  if (dualEntry.semantic) {
    console.log(`│ 语义名:  ${dualEntry.semantic}  (barrel 已收敛)`);
  }
  console.log(`│ 跨 chunk: ${dualEntry.crossChunk ? '✅ 是（被 ShareAppPage 和 App 共用）' : '❌ 否（仅 App 内部）'}`);
  if (dualEntry.shareApp) console.log(`│ ShareAppPage: ${dualEntry.shareApp}`);
  if (dualEntry.app) console.log(`│ App:     ${dualEntry.app}`);
  console.log(`└───────────────────────────────────────────`);
}

if (compEntry) {
  const chunks = chunkNames(compEntry);
  console.log(`\n┌─ 所在 chunk ──────────────────────────────`);
  for (const c of chunks) {
    console.log(`│ ${bundleToLegacy(c)}`);
  }
  console.log(`│ 路径数:  ${compEntry.length} (${compEntry.map(bundleToLegacy).join(', ')})`);
  console.log(`└───────────────────────────────────────────`);
} else if (dualEntry) {
  // dual-naming 里的名字不在 component-mapping 中，说明是 httpClient facade 门面导出
  console.log(`\n┌─ 所在 chunk ──────────────────────────────`);
  console.log(`│ (httpClient facade 门面导出，源码在 httpClient-Bqba_SHR.js)`);
  console.log(`│ legacy 路径: src/legacy/httpClient-Bqba_SHR.js`);
  console.log(`└───────────────────────────────────────────`);
}

if (!dualEntry && compEntry) {
  // 只在 component-mapping 中，不在 dual-naming 中
  console.log(`\n  📝 该标识符未收录在 dual-naming-mapping.md 中`);
  const chunks = chunkNames(compEntry);
  if (chunks.some(c => c.startsWith('httpClient'))) {
    console.log(`     (httpClient facade 内部子模块，非对外导出，按审计决策不做 barrel 收敛)`);
  }
}

console.log('');
