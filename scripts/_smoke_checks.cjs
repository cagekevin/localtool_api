'use strict';
// Tier 2 质量网：可复用冒烟检查（被 smoke_test.cjs 硬断言 + _check_align.cjs 信息日志共用）。
// 全部为静态、零依赖检查，可在 CI 直接跑；不依赖无头浏览器
// （MV3 扩展加载需特殊处理，静态检查已覆盖主要崩溃面：悬空 import / 缺失 asset / manifest 非法 / 副本漂移）。
const fs = require('fs');
const path = require('path');

function exists(p) { return fs.existsSync(p); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

// 递归收集 dir 下所有 .js 文件，返回相对 dir 的正斜杠路径数组（含子目录）
function listJsRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d, base) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      const rel = base ? base + '/' + entry.name : entry.name;
      if (entry.isDirectory()) walk(full, rel);
      else if (entry.isFile() && entry.name.endsWith('.js')) out.push(rel);
    }
  };
  walk(dir, '');
  return out;
}

// 规范化 './'/'../' 相对路径，避免 path.join 对子目录引用的基准错位
function normalizeRel(base, rel) {
  const joined = path.posix.normalize(base + '/' + rel);
  return joined.replace(/^\.\//, '');
}

// 1) dist 基本存在 + 关键入口文件
function checkDistExists(ROOT) {
  const dist = path.join(ROOT, 'dist').replace(/\\/g, '/');
  const need = ['manifest.json', 'index.html', 'background.js'];
  const missing = need.filter((f) => !exists(path.join(dist, f)));
  return {
    name: 'dist 入口存在',
    pass: missing.length === 0,
    details: missing.length ? ['缺失: ' + missing.join(', ')] : ['manifest / index / background 均在'],
  };
}

// 2) manifest 合法（MV3 必需字段 + 引用文件存在）
function checkManifest(ROOT) {
  const dist = path.join(ROOT, 'dist').replace(/\\/g, '/');
  const mPath = path.join(dist, 'manifest.json');
  if (!exists(mPath)) return { name: 'manifest 合法(MV3)', pass: false, details: ['manifest.json 缺失'] };
  let m;
  try { m = readJson(mPath); } catch (e) { return { name: 'manifest 合法(MV3)', pass: false, details: ['JSON 解析失败: ' + e.message] }; }
  const checks = [
    ['manifest_version===3', m.manifest_version === 3],
    ['含 name', !!m.name],
    ['含 version', !!m.version],
    ['background.service_worker 存在', !!(m.background && m.background.service_worker && exists(path.join(dist, m.background.service_worker)))],
    ['side_panel.default_path 存在', !!(m.side_panel && m.side_panel.default_path && exists(path.join(dist, m.side_panel.default_path)))],
    ['icons(16/48/128)存在', !!(m.icons && ['16', '48', '128'].every((k) => m.icons[k] && exists(path.join(dist, m.icons[k]))) )],
    ['content_security_policy.extension_pages 存在', !!(m.content_security_policy && m.content_security_policy.extension_pages)],
  ];
  const pass = checks.every(([, v]) => v);
  return { name: 'manifest 合法(MV3)', pass, details: checks.map(([k, v]) => (v ? '[OK] ' : '[FAIL] ') + k) };
}

// 3) dist HTML 引用的本地资源全部存在（catch 引用了不存在的 chunk/css）
function checkDistAssets(ROOT) {
  const dist = path.join(ROOT, 'dist').replace(/\\/g, '/');
  const htmlCandidates = ['index.html', 'share/index.html'];
  const details = [];
  let pass = true;
  for (const rel of htmlCandidates) {
    const hp = path.join(dist, rel);
    if (!exists(hp)) { details.push('(跳过 ' + rel + ' 不存在)'); continue; }
    const html = fs.readFileSync(hp, 'utf8');
    const refs = [];
    const re = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
    let mm;
    while ((mm = re.exec(html))) {
      const u = mm[1];
      if (u.startsWith('/')) refs.push(u.slice(1));
      else if (!u.startsWith('http') && !u.startsWith('data:') && !u.startsWith('#')) refs.push(u);
    }
    const localRefs = [...new Set(refs)].filter((r) => r && !r.startsWith('http'));
    // 子目录 HTML（如 share/index.html）的引用是相对该 HTML 所在目录（dist/share/），
    // 而非 dist/ 根；此处按 HTML 所在目录解析，避免 `../assets/x.js` 基准错位误判缺失。
    const htmlDir = path.posix.dirname(rel); // '' | 'share'（相对 dist 的正斜杠路径）
    for (const r of localRefs) {
      const target = normalizeRel(htmlDir, r);
      if (!exists(path.join(dist, target))) { pass = false; details.push('[FAIL] ' + rel + ' 引用缺失: ' + target + ' (来自 ' + r + ')'); }
    }
    details.push('[OK] ' + rel + ' 校验 ' + localRefs.length + ' 个本地引用');
  }
  return { name: 'dist HTML 资源引用', pass, details };
}

// 4) src/bundle chunk 间 import 图完整性（catch 删除/误改名导致 import 悬空）
function checkImportGraph(ROOT) {
  const bundle = path.join(ROOT, 'src/bundle').replace(/\\/g, '/');
  if (!exists(bundle)) return { name: 'chunk import 图完整性', pass: false, details: ['src/bundle 缺失'] };
  // 递归收集顶层 + 所有 *_components/ 子目录的 .js，key 为相对 bundle 根的路径
  const files = listJsRecursive(bundle);
  const have = new Set(files);
  const details = [];
  let pass = true;
  // 覆盖三种写法：import"./X" / import("./X") / from"./X"；X 可含子目录
  const IMPORT_RE = /(?:(?:import\s*\(?\s*["'])|(?:from\s*["']))\.\/([^"']+\.js)["']/g;
  for (const f of files) {
    const s = fs.readFileSync(path.join(bundle, f), 'utf8');
    const refs = new Set();
    let mm;
    while ((mm = IMPORT_RE.exec(s))) refs.add(mm[1]);
    for (const ref of refs) {
      if (!have.has(ref)) { pass = false; details.push('[FAIL] ' + f + ' -> ' + ref + ' (缺失)'); }
    }
    if (refs.size) details.push('[OK] ' + f + ' 引用 ' + refs.size + ' 个 chunk');
  }
  if (!details.length) details.push('(无 import 引用，跳过)');
  return { name: 'chunk import 图完整性', pass, details };
}

// 5) readable 副本保真（确保 rename.cjs 产物与源 1:1 行数、且未误伤运行时字符串）
function checkReadableParity(ROOT) {
  const bundle = path.join(ROOT, 'src/bundle').replace(/\\/g, '/');
  const readable = path.join(ROOT, 'readable').replace(/\\/g, '/');
  // readable/ 是 rename.cjs 生成的阅读副本（与 src/bundle 顶层 .js 1:1）。不存在时先调用 rename.cjs
  // 生成，而非直接 FAIL——避免「提示的 npm run readable 命令不存在」导致质量门永远卡死。
  if (!exists(readable)) {
    try {
      require('./archived/rename-pipeline/rename.cjs');
    } catch (e) {
      return { name: 'readable 副本保真', pass: false, details: ['readable/ 不存在且自动生成失败: ' + e.message + '（可手动 node scripts/rename.cjs）'] };
    }
  }
  if (!exists(readable)) return { name: 'readable 副本保真', pass: false, details: ['readable/ 仍未生成，请手动 node scripts/rename.cjs'] };
  const files = listJsRecursive(bundle);
  const MARKERS = ['/api/status', '18080', 'canvas-state-v1', '127.0.0.1', 'localTool', 'cookie'];
  const details = [];
  let pass = true;
  for (const f of files) {
    const out = path.join(readable, f);
    if (!exists(out)) { pass = false; details.push('[FAIL] readable/' + f + ' 缺失'); continue; }
    const a = fs.readFileSync(path.join(bundle, f), 'utf8');
    const b = fs.readFileSync(out, 'utf8');
    const la = a.split('\n').length, lb = b.split('\n').length;
    if (la !== lb) { pass = false; details.push('[FAIL] ' + f + ' 行数不一致 ' + la + ' vs ' + lb); }
    for (const mk of MARKERS) {
      if (a.includes(mk) !== b.includes(mk)) { pass = false; details.push('[FAIL] ' + f + ' 运行时标记漂移: ' + mk); }
    }
  }
  details.push('[OK] 比对 ' + files.length + ' 个 chunk（行数 + 运行时标记）');
  return { name: 'readable 副本保真', pass, details };
}

// 6) 契约漂移检测（catch 「改一处漏一处」：跨端字符串契约命中数基线漂移）
//    依赖 scripts/contract_scan.cjs（零依赖）与基线 scripts/contract_snapshot.json。
//    无基线时仅信息性 WARN，不阻断；有基线且 high/critical 契约漂移则 FAIL。
function checkContracts(ROOT) {
  const scan = path.join(ROOT, 'scripts/contract_scan.cjs').replace(/\\/g, '/');
  const snap = path.join(ROOT, 'scripts/contract_snapshot.json').replace(/\\/g, '/');
  if (!exists(scan)) return { name: '契约漂移检测', pass: true, details: ['(跳过: contract_scan.cjs 缺失)'] };
  if (!exists(snap)) return { name: '契约漂移检测', pass: true, details: ['(跳过: 无基线，先跑 npm run contracts -- --resnap)'] };
  const { execSync } = require('child_process');
  let out;
  try {
    out = execSync('node "' + scan + '"', { cwd: ROOT, encoding: 'utf8' });
  } catch (e) {
    // contract_scan 漂移 FAIL 时退出码 1，但 stdout 含明细；exit 1 本身即失败信号
    out = (e.stdout || '') + (e.stderr || '');
    return { name: '契约漂移检测', pass: false, details: out.split('\n').filter((l) => l.trim()).map((l) => l.replace(/^●\s*/, '[FAIL] ')) };
  }
  const details = out.split('\n').filter((l) => /PASS|WARN|FAIL|无漂移|漂移:/.test(l)).map((l) => l.trim()).filter(Boolean);
  // 若输出里出现了 WARN/FAIL 行（非 PASS/无漂移），视为不阻断但提示
  const hasFail = details.some((l) => l.includes('FAIL') && !l.includes('PASS'));
  return { name: '契约漂移检测', pass: !hasFail, details: details.length ? details : ['[OK] 全部契约 STABLE'] };
}

// 7) dist 重复 chunk 检测（catch React 双实例：vendor-*2.js / 同名 chunk 被 Vite 自动加后缀）
//    见 CLAUDE.md §四.5 铁律 #4「React 单实例不可破」。
function checkDistDuplicateChunks(ROOT) {
  const dist = path.join(ROOT, 'dist').replace(/\\/g, '/');
  const assets = path.join(dist, 'assets').replace(/\\/g, '/');
  if (!exists(assets)) return { name: 'dist 重复 chunk', pass: true, details: ['(跳过: dist/assets 缺失)'] };
  const files = fs.readdirSync(assets).filter((f) => f.endsWith('.js'));
  const base = (f) => f.replace(/\.js$/, '').replace(/2$/, ''); // 去掉可能的尾随 2
  const seen = {};
  const dups = [];
  for (const f of files) {
    const b = base(f);
    if (seen[b]) dups.push(seen[b] + ' + ' + f);
    else seen[b] = f;
  }
  const pass = dups.length === 0;
  const details = pass ? ['[OK] 无重复 chunk（React 单实例安全）'] : dups.map((d) => '[FAIL] 疑似重复 chunk: ' + d);
  return { name: 'dist 重复 chunk', pass, details };
}

module.exports = {
  checkDistExists,
  checkManifest,
  checkDistAssets,
  checkImportGraph,
  checkReadableParity,
  checkContracts,
  checkDistDuplicateChunks,
};
