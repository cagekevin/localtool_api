#!/usr/bin/env node
/**
 * trace-barrels.cjs — gougou barrel 全链路追溯
 *
 * 逐个 barrel 检查：
 *   1. 每个 export 目标 legacy 文件是否存在
 *   2. barrel 是否被某个 shared.js import（接线）
 *   3. runtime 标记是否用 (window as any)（typecheck 兼容）
 *   4. legacy 文件是否已 @deprecated
 *
 * 用法: node scripts/trace-barrels.cjs [--json]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES_DIR = path.join(ROOT, 'src', 'features');
const LEGACY_DIR = path.join(ROOT, 'src', 'legacy');

// ---- util ----
function globFiles(dir, pattern) {
  const results = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(d, entry.name));
      else if (entry.name === pattern) results.push(path.join(d, entry.name));
    }
  }
  walk(dir);
  return results;
}

function sharedJSFiles() {
  return globFiles(LEGACY_DIR, 'shared.js').filter(f => !f.includes('node_modules'));
}

// ---- main ----
function parseBarrel(barrelPath) {
  const content = fs.readFileSync(barrelPath, 'utf8');
  const exports = [];
  const re = /export\s*\{\s*default\s+as\s+(\S+)\s*\}\s*from\s+['"]([^'"]+)['"]\s*;?/g;
  let m;
  while ((m = re.exec(content))) exports.push({ name: m[1], source: m[2] });
  const asAny = content.includes('(window as any).__gougou_features__') || content.includes('(window as any)[') || content.includes('(window as any).');
  return { exports, asAny };
}

function checkLegacyFile(sourceRel, barrelDir) {
  const resolved = path.resolve(barrelDir, sourceRel);
  return fs.existsSync(resolved);
}

function checkWiring(barrelRelPath, sharedFiles) {
  // barrelRelPath is relative to ROOT: e.g. src/features/model-config/index.ts
  // 在 shared.js 中查找以下模式之一：
  //   import ... from "../../features/<domain>/index.ts"
  //   import ... from "../../features/<domain>/<sub>/index.ts"
  const wiredBy = [];
  // 提取 pattern: 取 barrelRelPath 去掉 src/ 前缀，例如 "features/model-config/index.ts"
  const barrelPattern = barrelRelPath.replace(/^src\//, '');
  for (const sf of sharedFiles) {
    const content = fs.readFileSync(sf, 'utf8');
    if (content.includes(barrelPattern)) {
      wiredBy.push(path.relative(ROOT, sf));
    }
  }
  return wiredBy;
}

function checkDeprecated(barrelExports, barrelDir) {
  let marked = 0, unmarked = [];
  for (const e of barrelExports) {
    const legacyAbs = path.resolve(barrelDir, e.source);
    if (fs.existsSync(legacyAbs)) {
      const c = fs.readFileSync(legacyAbs, 'utf8');
      if (c.includes('@deprecated')) marked++;
      else unmarked.push(path.relative(LEGACY_DIR, legacyAbs));
    } else {
      unmarked.push(e.source);
    }
  }
  return { marked, unmarked };
}

function main() {
  const jsonMode = process.argv.includes('--json');
  const barrelFiles = globFiles(FEATURES_DIR, 'index.ts');
  const sharedFiles = sharedJSFiles();

  const results = [];
  let totalExports = 0, totalWired = 0, totalOrphan = 0;
  let missingTargets = 0, missingAsAny = 0;

  for (const barrelPath of barrelFiles) {
    const barrelRel = path.relative(ROOT, barrelPath);
    const barrelDir = path.dirname(barrelPath);
    const barrel = parseBarrel(barrelPath);
    const wiredBy = checkWiring(barrelRel, sharedFiles);
    const isWired = wiredBy.length > 0;

    let missingFiles = [];
    for (const e of barrel.exports) {
      if (!checkLegacyFile(e.source, barrelDir)) missingFiles.push(e.source);
    }

    const dep = checkDeprecated(barrel.exports, barrelDir);

    totalExports += barrel.exports.length;
    if (isWired) totalWired++; else totalOrphan++;
    if (missingFiles.length > 0) missingTargets += missingFiles.length;
    if (!barrel.asAny) missingAsAny++;

    results.push({
      barrel: path.relative(FEATURES_DIR, barrelRel).replace(/\/index\.ts$/, ''),
      exports: barrel.exports.length,
      wired: isWired,
      wiredBy: wiredBy.map(f => path.basename(path.dirname(f))),
      missingTargets: missingFiles,
      deprecated: { marked: dep.marked, total: barrel.exports.length },
      asAny: barrel.asAny,
    });
  }

  // sort: wired first, then by name
  results.sort((a, b) => {
    if (a.wired !== b.wired) return b.wired - a.wired;
    return a.barrel.localeCompare(b.barrel);
  });

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // ---- human-readable ----
  const domainName = (b) => {
    if (b.startsWith('ui-subcomponents/')) {
      return `ui-subcomponents → ${b.replace('ui-subcomponents/', '')}`;
    }
    return b;
  };

  console.log('════════ barrel 全链路追溯 ════════\n');
  for (const r of results) {
    const icon = r.wired ? '✅' : '⚠️ ORPHAN';
    const depOk = r.deprecated.marked === r.deprecated.total ? '✅' : `⚠️ ${r.deprecated.marked}/${r.deprecated.total}`;
    const asAnyOk = r.asAny ? '✅' : '⚠️ 缺 as any';
    console.log(`${icon} ${domainName(r.barrel)}`);
    console.log(`   ${r.exports} exports | wired: ${r.wiredBy.join(',') || '—'} | @deprecated: ${depOk} | as any: ${asAnyOk}`);
    if (r.missingTargets.length > 0) {
      console.log(`   ❌ ${r.missingTargets.length} 缺失文件: ${r.missingTargets.slice(0, 3).join(', ')}${r.missingTargets.length > 3 ? '...' : ''}`);
    }
  }

  console.log(`\n════════ 摘要 ════════`);
  console.log(`  barrels: ${results.length} | wired: ${totalWired} | orphan: ${totalOrphan}`);
  console.log(`  exports: ${totalExports} | 缺失目标: ${missingTargets} | 缺 as any: ${missingAsAny}\n`);
  if (totalOrphan === 0 && missingTargets === 0 && missingAsAny === 0) {
    console.log('✅ 全链路健康');
  }
}

main();
