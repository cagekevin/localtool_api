'use strict';
// 地图生成器：自动扫描 src/bundle/ 生成 BUNDLE_MAP.md（AI 检索入口）。
// 解决两层问题：① 文件名混淆看不懂（AI 靠特征反查落点）；② 改一处漏一处（反向索引 + 高危文件标记）。
// 用法：node scripts/gen_bundle_map.cjs   （或 npm run map）
// 不读 docs/逆向专用_ai 禁止读/，不依赖任何运行时包。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const BUNDLE = path.join(ROOT, 'src/bundle');
const OUT = path.join(BUNDLE, 'BUNDLE_MAP.md');

const REACT_HOOKS = ['useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer', 'useLayoutEffect', 'useNavigate', 'useLocation', 'useParams', 'useSelector', 'useDispatch', 'useStore'];

function walk(dir, exts) {
  const out = [];
  const go = (d) => {
    let ents;
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = (d + '/' + e.name).replace(/\\/g, '/');
      if (e.isDirectory()) go(p);
      else if (exts.some((x) => e.name.endsWith(x))) out.push(p);
    }
  };
  go(dir);
  return out;
}

function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function countLines(p) { return read(p).split('\n').length; }

// 顶层 chunk（*.js 直接位于 src/bundle/）
const topChunks = fs.readdirSync(BUNDLE)
  .filter((f) => f.endsWith('.js') && fs.statSync(path.join(BUNDLE, f)).isFile())
  .map((f) => ({ name: f, lines: countLines(path.join(BUNDLE, f)) }))
  .sort((a, b) => b.lines - a.lines);

// _components 目录
const compDirs = fs.readdirSync(BUNDLE)
  .filter((f) => f.endsWith('_components') && fs.statSync(path.join(BUNDLE, f)).isDirectory());

// 所有组件文件（+ 顶层 chunk 作为 dir='' 的特殊项纳入特征/反向索引）
const allCompFiles = [];
for (const d of compDirs) {
  for (const f of walk(path.join(BUNDLE, d), ['.jsx', '.js'])) {
    allCompFiles.push({ abs: f, rel: f.replace(BUNDLE + '/', ''), dir: d, lines: countLines(f), content: read(f) });
  }
}
// 顶层 chunk（不在 _components 内，但承载关键契约如 endpointConfig 的 18080/active_api_endpoint）
for (const tc of topChunks) {
  const abs = path.join(BUNDLE, tc.name);
  allCompFiles.push({ abs, rel: tc.name, dir: '', lines: tc.lines, content: read(abs) });
}

// 抽取单文件特征
function extractFeatures(file) {
  const c = file.content;
  const feats = { apis: new Set(), kvKeys: new Set(), hooks: new Set(), exports: new Set(), components: new Set() };
  // API 路径
  const apiRe = /\/api\/[a-zA-Z0-9_/-]+|\/v1\/[a-zA-Z0-9_/-]+|\/public\/[a-zA-Z0-9_/-]+|\/files\/[a-zA-Z0-9_/-]*/g;
  let m;
  while ((m = apiRe.exec(c))) feats.apis.add(m[0]);
  // KV 键（带引号的长串）
  const kvRe = /[`'"]([a-zA-Z][a-zA-Z0-9_-]{4,})[`'"](?=\s*[,)])/g;
  while ((m = kvRe.exec(c))) {
    const k = m[1];
    if (/^(canvas-state-v1|active_api_endpoint|transitResources|api_configs|localToolBaseUrl|accessKey|secretKey)$/.test(k)) feats.kvKeys.add(k);
  }
  // React hooks
  for (const h of REACT_HOOKS) {
    if (new RegExp('\\b' + h + '\\s*[\\(<]').test(c)) feats.hooks.add(h);
  }
  // 导出组件名 export function Xxx / export const Xxx = / export default function Xxx
  const expRe = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  while ((m = expRe.exec(c))) feats.exports.add(m[1]);
  const defRe = /export\s+default\s+function\s+([A-Za-z0-9_]+)/g;
  while ((m = defRe.exec(c))) feats.components.add(m[1]);
  return feats;
}

for (const f of allCompFiles) f.feats = extractFeatures(f);

// 反向索引：契约字符串 -> 文件
const REVERSE_KEYS = ['/api/proxy', '18080', '9004', '/public/platform', 'transitResources', 'active_api_endpoint', 'canvas-state-v1', 'proxyMode', 'local-tool', 'x-proxy-url'];
const reverseIndex = {};
for (const k of REVERSE_KEYS) {
  const files = [];
  for (const f of allCompFiles) {
    const n = f.content.split(k).length - 1;
    if (n > 0) files.push({ rel: f.rel, n });
  }
  reverseIndex[k] = files.sort((a, b) => b.n - a.n);
}

// 依赖图：统计每个文件被多少其他文件 import
const importCount = {};
const importRe = /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
for (const f of allCompFiles) {
  let m;
  const seen = new Set();
  while ((m = importRe.exec(f.content))) {
    const spec = m[1];
    if (!spec.startsWith('.')) continue; // 只统计相对引用（同 bundle 内）
    const resolved = path.resolve(path.dirname(f.abs), spec).replace(/\\/g, '/');
    let rel = resolved.replace(BUNDLE + '/', '');
    if (!rel.endsWith('.js') && !rel.endsWith('.jsx')) rel += '.jsx';
    if (seen.has(rel)) continue;
    seen.add(rel);
    importCount[rel] = (importCount[rel] || 0) + 1;
  }
}
// 也统计顶层 chunk 作为 facade 指向的组件文件
for (const tc of topChunks) {
  const c = read(path.join(BUNDLE, tc.name));
  const re = /from\s+['"]\.\/([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(c))) {
    const rel = m[1].replace(/^\.\//, '');
    importCount[rel] = (importCount[rel] || 0) + 1;
  }
}

// ---- 生成 Markdown ----
const L = [];
L.push('# BUNDLE_MAP.md · src/bundle 逆向源码地图');
L.push('');
L.push('> 自动生成（scripts/gen_bundle_map.cjs）。AI 改 `src/bundle/` 前先读本图，按特征反查落点，避免"找不到/改漏"。');
L.push('> 文件名是混淆名（如 `H_.jsx` 12668 行），**不要凭文件名判断职责**，看「特征」列。');
L.push('> 配套：CONTRACTS.md（契约分布）+ scripts/contract_scan.cjs（漏改检测）。');
L.push('');
L.push('## 一、顶层 chunk 总表（14 个，均为 facade 或运行时垫片）');
L.push('');
L.push('| chunk | 行数 | 类型 | 说明 |');
L.push('|---|---|---|---|');
for (const tc of topChunks) {
  let type = 'facade', note = '';
  if (/vendor|runtime|shim|jsx_runtime|browser-external/.test(tc.name)) { type = '运行时'; note = '勿改（React 单实例/外链垫片）'; }
  else if (tc.name === 'endpointConfig-Bt85xi8d.js') { type = '逻辑'; note = '接入点/端口/18080 配置（契约 critical）'; }
  else if (tc.name === 'main-CYvt_zul.js') { type = '入口'; note = '应用入口'; }
  else if (tc.name === 'share-CyPsaet6.js') { type = '入口'; note = '分享页入口'; }
  else if (tc.name === 'mediabunny-mp3-encoder-CZeRAvEV.js') { type = '库'; note = 'MP3 编码器'; }
  else if (tc.name.startsWith('src-')) { type = 'facade'; note = '映射至同名 _components'; }
  else { note = '映射至同名 _components'; }
  L.push(`| \`${tc.name}\` | ${tc.lines} | ${type} | ${note} |`);
}
L.push('');
L.push('## 二、_components 目录规模');
L.push('');
L.push('| 目录 | 文件数 | 角色 |');
L.push('|---|---|---|');
const compRole = {
  'App-BX6o9fW5_components': '主应用（画布编辑器核心 UI/状态）',
  'httpClient-BknZwXjG_components': 'HTTP 客户端层（代理/请求/资源/转场，最大 141 文件）',
  'src-_qSScO88_components': '运行时模块',
  'src-kC58-PF2_components': '入口胶水',
};
for (const d of compDirs) {
  const n = allCompFiles.filter((f) => f.dir === d).length;
  L.push(`| \`${d}/\` | ${n} | ${compRole[d] || '—'} |`);
}
L.push('');
L.push('## 三、大文件索引（>500 行，按特征反查）');
L.push('');
L.push('> 这些文件 AI 最可能要进。特征列从代码自动抽取：用到哪些 API 路径、KV 键、React hooks、导出组件。');
L.push('');
L.push('| 文件 | 行数 | API 路径 | KV 键 | Hooks | 导出组件 |');
L.push('|---|---|---|---|---|---|');
const big = allCompFiles.filter((f) => f.lines > 500).sort((a, b) => b.lines - a.lines);
for (const f of big) {
  const ft = f.feats;
  L.push(`| \`${f.rel}\` | ${f.lines} | ${([...ft.apis].slice(0, 5).join(' ') || '—')} | ${([...ft.kvKeys].join(' ') || '—')} | ${([...ft.hooks].slice(0, 4).join(' ') || '—')} | ${([...ft.components, ...ft.exports].slice(0, 4).join(' ') || '—')} |`);
}
L.push('');
L.push('## 四、反向索引（契约字符串 → 在哪改）');
L.push('');
L.push('> 改某个契约前，先看右边列确认要动几个文件。完整分布见 CONTRACTS.md。');
L.push('');
L.push('| 契约字符串 | 命中文件数 | 文件（按命中次数降序） |');
L.push('|---|---|---|');
for (const k of REVERSE_KEYS) {
  const fs2 = reverseIndex[k];
  if (!fs2.length) { L.push(`| \`${k}\` | 0 | — |`); continue; }
  const detail = fs2.slice(0, 12).map((x) => `${x.rel}(${x.n})`).join(' · ');
  L.push(`| \`${k}\` | ${fs2.length} | ${detail} |`);
}
L.push('');
L.push('## 五、高危文件（被大量 import，改它影响面最大）');
L.push('');
L.push('> 这些文件是「改一处漏一处」重灾区。改前务必全文 grep 确认所有引用方，改后跑 `npm run contracts` + `npm run build`。');
L.push('');
L.push('| 文件 | 被引用次数 |');
L.push('|---|---|');
const topDeps = Object.entries(importCount).filter(([k]) => k.includes('_components')).sort((a, b) => b[1] - a[1]).slice(0, 15);
for (const [f, n] of topDeps) L.push(`| \`${f}\` | ${n} |`);
L.push('');
L.push('## 六、同名影子文件警示（重要）');
L.push('');
L.push('- `public/assets/*.js` 是 1.4.0 时期遗留的**死副本**（12 个 JS 已于 2026-08-02 删除），被 build 产物覆盖不生效。grep 该路径若再现，是缓存/未清理产物，勿改。');
L.push('- `public/assets/*.css`（src-DoQUrSOl.css / httpClient-DFxwm5B3.css / vendor-Qkhkn02K.css）是**活文件**，Vite 不产出，由 post-build-fixups 补引用，保留勿删。');
L.push('- `dist/` 是构建产物，运行时只读它；改前端一律改 `src/bundle/` 后 `npm run build` 回灌（见 CLAUDE.md §四.2/§四.5）。');
L.push('');
L.push('## 七、重建命令');
L.push('');
L.push('```bash');
L.push('npm run map        # 重建本图');
L.push('npm run contracts  # 校验契约全端同步（漏改检测）');
L.push('npm run contracts -- --resnap  # 混淆重排后重建基线');
L.push('```');
L.push('');

fs.writeFileSync(OUT, L.join('\n'));
console.log('✓ 地图已生成 → src/bundle/BUNDLE_MAP.md');
console.log(`  顶层 chunk: ${topChunks.length}, _components 目录: ${compDirs.length}, 组件文件: ${allCompFiles.length}, 大文件(>500行): ${big.length}, 高危文件标记: ${topDeps.length}`);
