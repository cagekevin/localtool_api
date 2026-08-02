'use strict';
// 契约扫描器：跨端字符串契约全量分布 + 漂移（漏改/多改）检测。
// 用法：
//   node scripts/contract_scan.cjs            # 校验模式：与基线快照比对，漂移即 FAIL
//   node scripts/contract_scan.cjs --resnap   # 重建基线快照（混淆重排后数量正常变化时用）
//   node scripts/contract_scan.cjs --md       # 额外输出 CONTRACTS.md 分布表（AI 改前查阅）
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const DICT = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/contracts.json'), 'utf8'));
const SNAP_PATH = path.join(ROOT, 'scripts/contract_snapshot.json');
const CONTRACTS_MD = path.join(ROOT, 'CONTRACTS.md');

// 始终排除的目录/文件
const EXCLUDE = ['node_modules', 'dist', 'docs/逆向专用_ai 禁止读'];
function inExclude(p) {
  return EXCLUDE.some((e) => p.split('/').includes(e) || p.includes('/' + e + '/'));
}

// 在某 scope 内递归搜文件；scope 可为目录或单个文件
function listFiles(scope) {
  const dir = path.join(ROOT, scope);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  let stat;
  try { stat = fs.statSync(dir); } catch { return []; }
  if (stat.isFile()) {
    if (/\.(js|jsx|ts|tsx|json|css|html)$/.test(scope)) out.push(dir.replace(/\\/g, '/'));
    return out;
  }
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = (d + '/' + e.name).replace(/\\/g, '/');
      if (inExclude(p)) continue;
      if (e.isDirectory()) walk(p);
      else if (/\.(js|jsx|ts|tsx|json|css|html)$/.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// 统计一条契约在某 scope 内的命中（返回 {file: 次数}）
function scanContractInScope(contract, scope) {
  const files = listFiles(scope);
  const hit = {};
  for (const f of files) {
    let content;
    try { content = fs.readFileSync(f, 'utf8'); } catch { continue; }
    let count = 0;
    for (const pat of contract.patterns) {
      if (pat.type === 'fixed') {
        let i = content.indexOf(pat.value);
        while (i !== -1) { count++; i = content.indexOf(pat.value, i + pat.value.length); }
      } else {
        const re = new RegExp(pat.value, 'g');
        const m = content.match(re);
        if (m) count += m.length;
      }
    }
    if (count > 0) hit[f.replace(ROOT + '/', '')] = count;
  }
  return hit;
}

// 跑全部契约，得到当前分布快照
function buildSnapshot() {
  const snap = {};
  for (const [id, c] of Object.entries(DICT.contracts)) {
    snap[id] = { desc: c.desc, severity: c.severity, scopes: c.scopes, hits: {}, total: 0 };
    for (const scope of c.scopes) {
      const h = scanContractInScope(c, scope);
      for (const [f, n] of Object.entries(h)) {
        snap[id].hits[f] = (snap[id].hits[f] || 0) + n;
      }
    }
    snap[id].total = Object.values(snap[id].hits).reduce((a, b) => a + b, 0);
  }
  return snap;
}

function loadSnapshot() {
  if (!fs.existsSync(SNAP_PATH)) return null;
  return JSON.parse(fs.readFileSync(SNAP_PATH, 'utf8'));
}

// ---- 模式分发 ----
const argv = process.argv.slice(2);
const resnap = argv.includes('--resnap');
const emitMd = argv.includes('--md') || resnap;

const cur = buildSnapshot();

if (resnap) {
  fs.writeFileSync(SNAP_PATH, JSON.stringify(cur, null, 2));
  console.log('✓ 基线快照已重建 → scripts/contract_snapshot.json');
  if (!emitMd) process.exit(0);
}

// 输出 CONTRACTS.md 分布表（AI 改契约前查阅）
if (emitMd) {
  const lines = ['# CONTRACTS.md · 跨端字符串契约分布表', '',
    '> 自动生成（scripts/contract_scan.cjs --md）。改任一契约前先查此表，确认要动几个文件、哪个端；改完跑 `npm run contracts` 校验全端同步。',
    '> 当前快照基线时间见 scripts/contract_snapshot.json。', ''];
  lines.push('| 契约 | 严重度 | 总命中 | 文件分布（文件:次数） |');
  lines.push('|---|---|---|---|');
  for (const [id, s] of Object.entries(cur)) {
    const dist = Object.entries(s.hits).map(([f, n]) => `${f}(${n})`).join(' · ') || '—';
    lines.push(`| \`${id}\` | ${s.severity} | ${s.total} | ${dist} |`);
  }
  lines.push('');
  lines.push('## 各契约 scope 与含义');
  lines.push('');
  for (const [id, c] of Object.entries(DICT.contracts)) {
    lines.push(`- **${id}**：${c.desc}`);
    lines.push(`  - scope: ${c.scopes.join(', ')}`);
    lines.push(`  - 模式: ${c.patterns.map((p) => (p.type === 'fixed' ? `"${p.value}"` : `/${p.value}/`)).join(' | ')}`);
  }
  fs.writeFileSync(CONTRACTS_MD, lines.join('\n'));
  console.log('✓ 分布表已生成 → CONTRACTS.md');
}

if (resnap) process.exit(0);

// ---- 校验模式：与基线比对 ----
const base = loadSnapshot();
if (!base) {
  console.log('⚠ 无基线快照，先跑 `npm run contracts -- --resnap` 建基线。');
  process.exit(0);
}

let fail = false;
const sevRank = { critical: 3, high: 2, medium: 1, low: 0 };
console.log('=== 契约漂移检测（与基线 snapshot 比对）===');
for (const [id, s] of Object.entries(cur)) {
  const b = base[id];
  if (!b) { console.log(`\n● ${id}  [新增契约, 基线无]`); continue; }
  const curTotal = s.total, baseTotal = b.total;
  const curFiles = s.hits, baseFiles = b.hits;
  const allFiles = new Set([...Object.keys(curFiles), ...Object.keys(baseFiles)]);
  const drift = [];
  for (const f of allFiles) {
    const c = curFiles[f] || 0, bf = baseFiles[f] || 0;
    if (c !== bf) drift.push(`${f}: 基线${bf} → 当前${c}`);
  }
  const changed = curTotal !== baseTotal || drift.length > 0;
  const mark = !changed ? 'PASS' : (sevRank[s.severity] >= 2 ? 'FAIL' : 'WARN');
  if (mark !== 'PASS') fail = fail || mark === 'FAIL';
  console.log(`\n● ${id}  [${s.severity}]  ${mark}`);
  console.log(`   命中: ${baseTotal} → ${curTotal}`);
  for (const d of drift) console.log('   漂移: ' + d);
  if (!changed) console.log('   无漂移 ✓');
}
console.log('\n=== 结果: ' + (fail ? 'DRIFT FAIL' : 'STABLE') + ' ===');
process.exit(fail ? 1 : 0);
