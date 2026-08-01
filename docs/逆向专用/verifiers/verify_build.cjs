/**
 * verify_build.cjs — 构建后静态质量门（Tier2 冒烟，对齐第一步 smoke_test）
 *
 * 在 output/project 跑完 `npm run build` 后调用，断言交付物基本健全，
 * 不依赖浏览器/Playwright，秒级返回 exit-code：
 *   0 = 通过（dist 关键文件齐全 + manifest 合法 + 无悬空 chunk 引用）
 *   1 = 不通过（打印具体缺失项）
 *
 * 用法:
 *   node verifiers/verify_build.cjs [output/project]
 */
const fs = require('fs');
const path = require('path');

const PROJECT = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(__dirname, '..', 'output', 'project');
const DIST = path.join(PROJECT, 'dist');

const problems = [];
function expect(cond, msg) { if (!cond) { problems.push(msg); console.log('❌ ' + msg); } else console.log('✅ ' + msg); }

console.log('════════ 构建静态质量门 ════════');
if (!fs.existsSync(PROJECT)) { console.error('工程不存在:', PROJECT); process.exit(2); }

// 1) dist 存在
expect(fs.existsSync(DIST), 'dist/ 已生成');

// 2) manifest.json 合法且为 MV3
const manifestPath = path.join(DIST, 'manifest.json');
let manifest = null;
if (fs.existsSync(manifestPath)) {
  try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); expect(true, 'manifest.json 可解析'); }
  catch (e) { expect(false, 'manifest.json 解析失败: ' + e.message); }
  if (manifest) {
    expect(manifest.manifest_version === 3, 'manifest_version === 3');
    expect(!!manifest.action || !!manifest.background, '含 action 或 background 入口');
  }
} else expect(false, 'dist/manifest.json 缺失');

// 3) 入口 HTML 存在且引用了脚本
for (const html of ['index.html', path.join('share', 'index.html')]) {
  const p = path.join(DIST, html);
  expect(fs.existsSync(p), `dist/${html} 存在`);
  if (fs.existsSync(p)) {
    const t = fs.readFileSync(p, 'utf8');
    expect(/<script[^>]+src=/.test(t), `dist/${html} 含 <script src>`);
  }
}

// 4) assets 下 JS 文件存在（构建产物非空）
const assetsDir = path.join(DIST, 'assets');
let jsCount = 0;
if (fs.existsSync(assetsDir)) {
  jsCount = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js')).length;
}
expect(jsCount > 0, `dist/assets/ 含 ${jsCount} 个 JS 产物`);

// 5) 无悬空 chunk 引用：HTML 引用的脚本名都应在 assets 里存在
if (fs.existsSync(assetsDir)) {
  const assetFiles = new Set(fs.readdirSync(assetsDir));
  for (const html of ['index.html', path.join('share', 'index.html')]) {
    const p = path.join(DIST, html);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8');
    const re = /src=["']([^"']+\.js)["']/g;
    let m;
    while ((m = re.exec(t))) {
      const ref = m[1].replace(/^\.?\//, '');
      const base = ref.split('/').pop();
      // 仅校验落在 assets 下的
      if (ref.includes('assets/') && !assetFiles.has(base)) problems.push(`HTML 引用悬空: ${ref}`);
    }
  }
}
if (problems.length) console.log('❌ 发现悬空引用相关项见上');

console.log('\n════════ 结果 ════════');
if (problems.length) { console.log(`不通过（${problems.length} 项）`); process.exit(1); }
console.log('通过 ✅ 可进入真机验收。');
process.exit(0);
