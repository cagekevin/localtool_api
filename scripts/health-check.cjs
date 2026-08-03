#!/usr/bin/env node
/**
 * health-check.cjs — 工程健康度全量检查
 * 覆盖：脚本/产物存在性 / npm scripts / 构建 / TDZ / dist 基线 / chunk 完整性
 *
 * 用法: node scripts/health-check.cjs
 *
 * 注意：本文件清单已更新到 src/bundle/ 现状（项目已从旧 src/legacy 迁移到 src/bundle/）。
 * 不再检查已删除的旧结构（T01A-T12B 报告、旧 src/shared、semantic-map 等）。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
let errors = 0, warns = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`);
  } else {
    console.log(`  ❌ ${label}  ${detail}`);
    errors++;
  }
}

function warn(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`);
  } else {
    console.log(`  ⚠️ ${label}  ${detail}`);
    warns++;
  }
}

console.log('═'.repeat(50));
console.log('  工程健康度全量检查');
console.log('═'.repeat(50));

// ── 1. 文件存在性（src/bundle/ 现状 + 核心脚本 + 数据/契约文件）──
console.log('\n📁 文件存在性');
const files = [
  // src/bundle 顶层 chunk（facade + 运行时垫片）
  ['src/bundle/App-BX6o9fW5.js', 'bundle App chunk'],
  ['src/bundle/httpClient-BknZwXjG.js', 'bundle httpClient chunk'],
  ['src/bundle/endpointConfig-Bt85xi8d.js', 'bundle endpointConfig'],
  ['src/bundle/main-CYvt_zul.js', 'bundle 入口 main'],
  ['src/bundle/vendor-Z-adA07W.js', 'bundle vendor 工厂'],
  ['src/bundle/share-CyPsaet6.js', 'bundle 分享页入口'],
  ['src/bundle/_react_shim.js', 'React 单实例 shim'],
  ['src/bundle/_jsx_runtime.js', 'jsx runtime'],
  ['src/bundle/BUNDLE_MAP.md', 'AI 检索地图'],
  // _components 目录及真相表
  ['src/bundle/App-BX6o9fW5_components/component_map.json', 'App component_map'],
  ['src/bundle/httpClient-BknZwXjG_components/component_map.json', 'httpClient component_map'],
  ['src/bundle/src-_qSScO88_components/component_map.json', 'src-_qSScO88 component_map'],
  ['src/bundle/src-kC58-PF2_components/component_map.json', 'src-kC58-PF2 component_map'],
  // 核心流水线脚本
  ['scripts/smoke_test.cjs', 'smoke_test'],
  ['scripts/_smoke_checks.cjs', '_smoke_checks'],
  ['scripts/_check_align.cjs', '_check_align'],
  ['scripts/contract_scan.cjs', 'contract_scan'],
  ['scripts/gen_bundle_map.cjs', 'gen_bundle_map'],
  ['scripts/check-build.cjs', 'check-build'],
  ['scripts/safety-net.cjs', 'safety-net'],
  ['scripts/health-check.cjs', 'health-check'],
  ['scripts/verify-ext.cjs', 'verify-ext'],
  ['scripts/verify-chunks.cjs', 'verify-chunks'],
  ['scripts/verify-common.cjs', 'verify-common'],
  ['scripts/rollback/snapshot.cjs', 'rollback/snapshot'],
  // 契约 / 数据文件
  ['scripts/contracts.json', '契约字典'],
  ['scripts/contract_snapshot.json', '契约基线'],
  ['scripts/dist-snapshot.json', 'dist 基线'],
  // 后端双服务
  ['localTool/dist/index.js', 'localTool 产物'],
];
for (const [f, name] of files) {
  check(name, fs.existsSync(path.join(ROOT, f)), `缺: ${f}`);
}

// ── 2. npm scripts（只断言真实存在的）──
console.log('\n🔧 npm scripts');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
['build', 'map', 'contracts', 'test:smoke', 'dev'].forEach(s => {
  check(s, !!pkg.scripts[s], `package.json 缺 scripts.${s}`);
});

// ── 3. 构建 ──
console.log('\n🏗️ 构建');
try {
  execSync('npm run build', { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
  check('npm run build', true);
} catch (e) {
  check('npm run build', false, e.message.slice(0, 80));
}

// ── 4. 地图生成（src/bundle 检索入口，验证可复现）──
console.log('\n🗺️ 地图生成');
try {
  execSync('node scripts/gen_bundle_map.cjs', { cwd: ROOT, stdio: 'pipe', timeout: 20000 });
  check('gen_bundle_map (npm run map)', true);
} catch (e) {
  check('gen_bundle_map', false, e.message.slice(0, 80));
}

// ── 5. 冒烟质量门 ──
console.log('\n🧪 冒烟质量门');
try {
  execSync('node scripts/smoke_test.cjs', { cwd: ROOT, stdio: 'pipe', timeout: 30000 });
  check('smoke_test (npm test:smoke)', true);
} catch (e) {
  check('smoke_test', false, (e.stdout || e.message || '').slice(0, 120));
}

// ── 6. TDZ / chunk 完整性 ──
console.log('\n🛡️ TDZ / chunk 扫描');
try {
  execSync('node scripts/check-build.cjs', { cwd: ROOT, stdio: 'pipe', timeout: 15000 });
  check('check-build', true);
} catch (e) {
  check('check-build', false, e.message.slice(0, 80));
}

// ── 7. dist 基线 ──
console.log('\n📊 dist 基线');
try {
  const out = execSync('node scripts/safety-net.cjs', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' });
  const ok = out.includes('0 变化');
  check('safety-net', ok, out.split('\n').filter(l => l.includes('变化')).join(' | ') || out.split('\n').slice(-2).join(' | '));
} catch (e) {
  check('safety-net', false, (e.stdout || e.message || '').slice(0, 80));
}

// ── 8. 已废弃脚本检查 ──
console.log('\n🗑️ 已废弃脚本');
warn('status.cjs → archive', !fs.existsSync(path.join(ROOT, 'scripts', 'status.cjs')), '仍在根 scripts/');
warn('build-mapping.cjs → archive', !fs.existsSync(path.join(ROOT, 'scripts', 'build-mapping.cjs')), '仍在根 scripts/');

// ── 汇总 ──
console.log(`\n${'═'.repeat(50)}`);
console.log(`  ${errors > 0 ? '❌' : '✅'} 错误: ${errors}  警告: ${warns}`);
console.log(`${'═'.repeat(50)}\n`);
process.exit(errors > 0 ? 1 : 0);
