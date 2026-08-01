/**
 * 一毛AI画布 深度逆向还原流水线
 *
 * 输入: step0_raw/  输出: output/project/
 * 用法: node run.cjs
 *
 * 步骤:
 *   ⓪ webcrack → JSX 标签真实还原
 *   ① expand   → 结构展开
 *   ② split    → 组件拆分
 *   ③ facade   → 门面替换
 *   ④ unicode  → 中文还原
 *   ⑤ assemble → Vite 工程
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const UNPACKED = path.resolve(__dirname, '..');
const SCRIPTS = __dirname;
const INPUT = path.join(UNPACKED, 'step0_raw');
const OUTPUT = path.join(UNPACKED, 'output');
const WORK = path.join(OUTPUT, '.work');
const PROJECT = path.join(OUTPUT, 'project');

// 输入源
const SRC = path.join(INPUT, 'chunks');           // 业务混淆 chunks（glob 提取）
const STATIC = path.join(INPUT, 'static');         // public + html + config

// 版本无关：从 step0_raw/chunks/ 自动读取，不再写死白名单。
// DEEP = 走完整 webcrack→展开→拆分 的核心业务文件（由文件名模式判定）
// OTHER = 其余业务 chunk（只拷贝，不拆分）
if (!fs.existsSync(SRC)) { console.error(`❌ 输入缺失: ${SRC}（先跑 extract_input.cjs）`); process.exit(1); }
const ALL_CHUNKS = fs.readdirSync(SRC).filter((f) => f.endsWith('.js'));
// DEEP 模式：App- / httpClient- / src-（核心业务）视为需深度还原
function isDeep(name) { return /^(App|httpClient|src)-/.test(name); }
const DEEP = ALL_CHUNKS.filter(isDeep);
const OTHER = ALL_CHUNKS.filter((f) => !isDeep(f));
console.log(`📦 自动识别 chunks: DEEP(${DEEP.length}) = ${DEEP.join(', ')}`);
console.log(`             OTHER(${OTHER.length}) = ${OTHER.join(', ')}`);

function run(cmd, label) {
  console.log(`\n🔹 ${label}`);
  try { execSync(cmd, { stdio: 'inherit' }); }
  catch (e) { console.error(`❌ ${label} 失败: ${e.message}`); process.exit(1); }
}

function cp(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function cpDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? cpDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ============================================================
console.log('══════════════════════════════════════');
console.log('  一毛AI画布 深度逆向还原流水线');
console.log('══════════════════════════════════════');

// 初始化
console.log('\n📁 初始化...');
fs.rmSync(OUTPUT, { recursive: true, force: true });
fs.mkdirSync(path.join(WORK, 'src', 'bundle'), { recursive: true });
fs.mkdirSync(path.join(PROJECT, 'src', 'bundle'), { recursive: true });
fs.mkdirSync(path.join(PROJECT, 'share'), { recursive: true });

// 拷贝源文件
console.log('\n📦 拷贝源文件...');
for (const f of [...DEEP, ...OTHER]) {
  const s = path.join(SRC, f);
  if (fs.existsSync(s)) { cp(s, path.join(WORK, 'src', 'bundle', f)); console.log(`   ✅ ${f}`); }
  else { console.log(`   ⚠️ 缺失: ${f}`); }
}

// 第 0 步: Webcrack JSX 还原
console.log('\n══════ ⓪ Webcrack JSX 还原 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (fs.existsSync(fp)) {
    const tmp = fp + '.wc_tmp';
    run(`npx webcrack "${fp}" -o "${tmp}"`, `webcrack: ${f}`);
    // 回退链：deobfuscated.js → index.js → 目录下最大的 .js
    let out = path.join(tmp, 'deobfuscated.js');
    if (!fs.existsSync(out)) out = path.join(tmp, 'index.js');
    if (!fs.existsSync(out) && fs.existsSync(tmp)) {
      let max = null;
      for (const e of fs.readdirSync(tmp, { recursive: true, withFileTypes: true })) {
        if (e.isFile() && e.name.endsWith('.js')) {
          const p = path.join(e.parentPath || tmp, e.name);
          if (!max || fs.statSync(p).size > fs.statSync(max).size) max = p;
        }
      }
      out = max || out;
    }
    if (out && fs.existsSync(out)) fs.copyFileSync(out, fp);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 第 1 步: AI 结构展开
console.log('\n══════ ① AI 结构展开 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (fs.existsSync(fp)) {
    run(`node "${path.join(SCRIPTS, '01_expand.cjs')}" "${fp}" "${fp}"`, f);
  }
}

// 第 1.5 步: 伪迹清理（webcrack 把 Object/constructor 替换成 Object.toString() 文本）
console.log('\n══════ ①b 伪迹清理 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (fs.existsSync(fp)) {
    run(`node "${path.join(SCRIPTS, '00_sanitize.cjs')}" "${fp}"`, f);
  }
}

// 第 2 步: 智能组件拆分
console.log('\n══════ ② 智能组件拆分 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (!fs.existsSync(fp)) continue;
  const compDir = path.join(WORK, 'src', 'bundle', f.replace('.js', '_components'));
  run(`node "${path.join(SCRIPTS, '02_split.cjs')}" "${fp}" "${compDir}"`, f);
}

// 第 3 步: 门面替换（原始 JS → Re-export）
console.log('\n══════ ③ 门面替换 ══════');
for (const f of DEEP) {
  const fp = path.join(WORK, 'src', 'bundle', f);
  if (!fs.existsSync(fp)) continue;
  const compDir = path.join(WORK, 'src', 'bundle', f.replace('.js', '_components'));
  if (fs.existsSync(compDir)) {
    run(`node "${path.join(SCRIPTS, '03_facade.cjs')}" "${fp}" "${compDir}"`, f);
  }
}

// 第 4 步: Unicode 中文还原
console.log('\n══════ ④ Unicode 中文还原 ══════');
function walkJs(dir, cb) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.includes('_components'))
        for (const f2 of fs.readdirSync(p).filter(x => /\.(js|jsx)$/.test(x))) cb(path.join(p, f2));
      else walkJs(p, cb);
    } else if (/\.(js|jsx)$/.test(e.name)) cb(p);
  }
}
walkJs(path.join(WORK, 'src', 'bundle'), (fp) => {
  try { execSync(`node "${path.join(SCRIPTS, '04_unicode.cjs')}" "${fp}"`, { stdio: 'inherit' }); }
  catch (e) { console.log(`   ⚠️ 跳过: ${path.basename(fp)}`); }
});

// 第 5 步: 组装工程
console.log('\n══════ ⑤ 组装工程 ══════');

// 修复 _components/ 子目录中对外部 chunk 的相对路径
const allChunkNames = [...DEEP, ...OTHER].map(x => x);
function walkFixImports(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name.includes('_components')) {
      for (const f2 of fs.readdirSync(p)) {
        if (!/\.(js|jsx)$/.test(f2)) continue;
        const fp = path.join(p, f2);
        let code = fs.readFileSync(fp, 'utf8');
        const old = code;
        code = code.replace(/(from\s+)?['"`]\.\/([^'"`]+\.js)['"`]/g, (m, from, f) => {
          if (f.includes('/') || f === 'shared.js') return m;
          if (allChunkNames.includes(f)) return `${from || ''}'../${f}'`;
          return m;
        });
        if (code !== old) fs.writeFileSync(fp, code);
      }
    }
  }
}
walkFixImports(path.join(WORK, 'src', 'bundle'));

cp(path.join(STATIC, 'index.html'), path.join(PROJECT, 'index.html'));
cp(path.join(STATIC, 'share.html'), path.join(PROJECT, 'share', 'index.html'));

// 写入 vite.config.ts
  // 单 React 实例 shim：把 'react' 指向 vendor-Z 内联 React(Rr)，与入口 react-dom(Ir) 同一实例，
  // 杜绝 Invalid hook call / 多实例（AI01~AI11 全员翻车的真凶）。jsx 运行时也指向 vendor Fr。
  const REACT_SHIM_SRC = `import { Rr as __Rr } from './vendor-Z-adA07W.js';
import { i as __e } from './rolldown-runtime-aKtaBQYM.js';
const React = __e(__Rr(), 1);
export default React;
export const useState = React.useState;
export const useEffect = React.useEffect;
export const useMemo = React.useMemo;
export const useCallback = React.useCallback;
export const useRef = React.useRef;
export const useImperativeHandle = React.useImperativeHandle;
export const useContext = React.useContext;
export const useReducer = React.useReducer;
export const useLayoutEffect = React.useLayoutEffect;
export const useDebugValue = React.useDebugValue;
export const useDeferredValue = React.useDeferredValue;
export const useTransition = React.useTransition;
export const useId = React.useId;
export const useSyncExternalStore = React.useSyncExternalStore;
export const useInsertionEffect = React.useInsertionEffect;
export const useOptimistic = React.useOptimistic;
export const useActionState = React.useActionState;
export const useFormStatus = React.useFormStatus;
export const use = React.use;
export const forwardRef = React.forwardRef;
export const memo = React.memo;
export const lazy = React.lazy;
export const Suspense = React.Suspense;
export const StrictMode = React.StrictMode;
export const Fragment = React.Fragment;
export const createElement = React.createElement;
export const createContext = React.createContext;
export const createFactory = React.createFactory;
export const createRef = React.createRef;
export const cloneElement = React.cloneElement;
export const isValidElement = React.isValidElement;
export const Children = React.Children;
export const Component = React.Component;
export const PureComponent = React.PureComponent;
export const Profiler = React.Profiler;
export const startTransition = React.startTransition;
export const flushSync = React.flushSync;
export const unstable_batchedUpdates = React.unstable_batchedUpdates;
export const version = React.version;
`;
  const JSX_RUNTIME_SRC = `import { Fr as __Fr } from './vendor-Z-adA07W.js';
const __rt = __Fr();
export const jsx = __rt.jsx;
export const jsxs = __rt.jsxs;
export const Fragment = __rt.Fragment;
`;
  const viteConfig = `import { defineConfig } from 'vite';
import { resolve } from 'path';
import { transformWithEsbuild } from 'vite';
// 单 React 实例：所有 'react' / 'react/jsx-runtime' 导入统一指向 vendor-Z 内联 React(Rr)，
// 与入口 vendor react-dom(Ir) 同一实例，杜绝 Invalid hook call / 多实例。
const reactShim = resolve(__dirname, 'src', 'bundle', '_react_shim.js');
const jsxRuntimeShim = resolve(__dirname, 'src', 'bundle', '_jsx_runtime.js');
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  base: './',
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react/jsx-runtime': jsxRuntimeShim,
      'react/jsx-dev-runtime': jsxRuntimeShim,
      'react': reactShim,
    },
  },
  plugins: [
    {
      name: 'force-jsx-for-js',
      enforce: 'pre',
      async transform(code, id) {
        if (id.endsWith('.js') && !id.includes('node_modules')) {
          return await transformWithEsbuild(code, id, { loader: 'jsx', jsx: 'automatic' });
        }
        return null;
      },
    },
  ],
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'esnext', modulePreload: false,
    rollupOptions: {
      input: { index: resolve(__dirname, 'index.html'), share: resolve(__dirname, 'share', 'index.html') },
      output: {
        entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]',
        manualChunks(id) { const m = id.match(/[\\\\/]src[\\\\/]bundle[\\\\/]([^\\\\/]+\\.js)$/); if (m) return m[1].replace(/\\.js$/, ''); },
      },
    },
  },
});`;
fs.writeFileSync(path.join(PROJECT, 'vite.config.ts'), viteConfig);
cp(path.join(STATIC, 'tsconfig.json'), path.join(PROJECT, 'tsconfig.json'));
cp(path.join(STATIC, 'tailwind.config.js'), path.join(PROJECT, 'tailwind.config.js'));
cpDir(path.join(STATIC, 'public'), path.join(PROJECT, 'public'));
cpDir(path.join(WORK, 'src'), path.join(PROJECT, 'src'));
// 写入单 React 实例 shim（'react' 经 vite alias 指向这两个文件 -> vendor 单实例）
fs.writeFileSync(path.join(PROJECT, 'src', 'bundle', '_react_shim.js'), REACT_SHIM_SRC, 'utf8');
fs.writeFileSync(path.join(PROJECT, 'src', 'bundle', '_jsx_runtime.js'), JSX_RUNTIME_SRC, 'utf8');
// 终检：对组装后的工程递归清理 webcrack 伪迹（function X(){[native code]}），确保 Vite 能正常解析
console.log('   🧼 终检伪迹清理...');
run(`node "${path.join(SCRIPTS, 'clean_project.cjs')}" "${path.join(PROJECT, 'src', 'bundle')}"`, 'clean');
console.log('   ✅ 配置 / public / 源码');

// CSS 占位文件（消除 Vite 警告）
const cssDir = path.join(PROJECT, 'src', 'bundle', 'assets');
fs.mkdirSync(cssDir, { recursive: true });
['src-BsO0T5Vc.css', 'vendor-Qkhkn02K.css'].forEach(css => {
  const p = path.join(cssDir, css);
  if (!fs.existsSync(p)) fs.writeFileSync(p, '/* 逆向还原自动生成 */');
});

// package.json (含 react 依赖)
fs.writeFileSync(path.join(PROJECT, 'package.json'), JSON.stringify({
  name: 'yimao-ai-canvas', private: true, version: '1.0.0',
  description: '一毛AI画布 深度逆向还原', type: 'module',
  scripts: { dev: 'vite', build: 'vite build' },
  dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
  devDependencies: { '@types/chrome': '^0.0.279', '@types/react': '^19.0.0', '@types/react-dom': '^19.0.0', typescript: '^5.6.3', vite: '^5.4.11' },
}, null, 2));

// 统计 & 清理
const count = fs.readdirSync(path.join(PROJECT, 'src', 'bundle'), { recursive: true }).length;
fs.rmSync(WORK, { recursive: true, force: true }); // 清临时目录

console.log(`\n══════════════════════════════════════`);
console.log(`  ✅ 完成！${count} 个文件`);
console.log(`  工程: ${PROJECT}`);
console.log(`  构建: cd output/project && npm install && npm run build`);
console.log(`══════════════════════════════════════`);
