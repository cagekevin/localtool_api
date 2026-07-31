'use strict';
// Tier 2 质量网：可复用冒烟检查（被 smoke_test.cjs 硬断言 + _check_align.cjs 信息日志共用）。
// 全部为静态、零依赖检查，可在 CI 直接跑；不依赖无头浏览器
// （MV3 扩展加载需特殊处理，静态检查已覆盖主要崩溃面：悬空 import / 缺失 asset / manifest 非法 / 副本漂移）。
const fs = require('fs');
const path = require('path');

function exists(p) { return fs.existsSync(p); }
function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

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
    for (const r of localRefs) {
      if (!exists(path.join(dist, r))) { pass = false; details.push('[FAIL] ' + rel + ' 引用缺失: ' + r); }
    }
    details.push('[OK] ' + rel + ' 校验 ' + localRefs.length + ' 个本地引用');
  }
  return { name: 'dist HTML 资源引用', pass, details };
}

// 4) src/bundle chunk 间 import 图完整性（catch 删除/误改名导致 import 悬空）
function checkImportGraph(ROOT) {
  const bundle = path.join(ROOT, 'src/bundle').replace(/\\/g, '/');
  if (!exists(bundle)) return { name: 'chunk import 图完整性', pass: false, details: ['src/bundle 缺失'] };
  const files = fs.readdirSync(bundle).filter((f) => f.endsWith('.js'));
  const have = new Set(files);
  const details = [];
  let pass = true;
  // 覆盖三种写法：import"./X" / import("./X") / from"./X"
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
  if (!exists(readable)) return { name: 'readable 副本保真', pass: false, details: ['readable/ 不存在，先跑 npm run readable'] };
  const files = fs.readdirSync(bundle).filter((f) => f.endsWith('.js'));
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

module.exports = {
  checkDistExists,
  checkManifest,
  checkDistAssets,
  checkImportGraph,
  checkReadableParity,
};
