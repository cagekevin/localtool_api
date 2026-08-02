import { defineConfig } from 'vite';
import { resolve } from 'path';
import { transformWithEsbuild } from 'vite';
import fs from 'fs';
import path from 'path';
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
    {
      // 构建后收尾：每次 npm run build 自动执行（此前手动/构建前补丁会被 Vite 重写 index.html 冲掉）。
      // ① 拷贝图标（原始 dist/icon*.png 不在 public 内，Vite 不会自动带进 dist）
      // ② 补回 src-DoQUrSOl.css 的 stylesheet 引用（逆向 JS 用 mapDeps 懒加载 CSS，Vite 静态分析抓不到）
      // ③ 剥离 data:text/javascript 的 modulepreload（Rolldown 内联，违反 MV3 CSP）
      name: 'post-build-fixups',
      apply: 'build',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist');
        const origDist = path.resolve(__dirname, '..', '..', 'dist'); // 逆向专用/dist（原始发行）
        if (!fs.existsSync(distDir)) return;

        // ① 图标
        for (const n of ['icon16.png', 'icon48.png', 'icon128.png']) {
          const from = path.join(origDist, n);
          const to = path.join(distDir, n);
          if (fs.existsSync(from) && !fs.existsSync(to)) fs.copyFileSync(from, to);
        }

        // ②+③ Html 修正
        const targets = [
          { f: path.join(distDir, 'index.html'), base: './assets/' },
          { f: path.join(distDir, 'share', 'index.html'), base: '../assets/' },
        ];
        for (const { f, base } of targets) {
          if (!fs.existsSync(f)) continue;
          let h = fs.readFileSync(f, 'utf8');
          // ② 补回 src-DoQUrSOl.css 引用（若不存在）
          if (!h.includes('src-DoQUrSOl.css')) {
            const link = `<link rel="stylesheet" crossorigin href="${base}src-DoQUrSOl.css">`;
            const idx = h.indexOf('</head>');
            if (idx !== -1) h = h.slice(0, idx) + '    ' + link + '\n    ' + h.slice(idx);
          }
          // ③ 剥离 data: modulepreload
          h = h.replace(/<link[^>]+rel="modulepreload"[^>]+href="data:text\/javascript[^"]*"[^>]*>\s*/g, '');
          fs.writeFileSync(f, h);
        }

        // ④ Bug B 修复（docs/22 §2.6 / §七 次修）：分享页不应再加载主应用入口 main。
        //   成因：main/share 共享 __vitePreload 辅助，Rollup 把它归到 main 并让 share 反向
        //   import main → share 页跑双 createRoot 挂同一 #root。此处从产物层剔除 main 的
        //   注入与 share 对 main 的 import，使分享页只跑一次 createRoot（share 自己的）。
        const shareHtml = path.join(distDir, 'share', 'index.html');
        if (fs.existsSync(shareHtml)) {
          let sh = fs.readFileSync(shareHtml, 'utf8');
          sh = sh.replace(/\s*<script[^>]*src="[^"]*main-CYvt_zul\.js"[^>]*>\s*<\/script>\s*/g, '');
          // 清理删除后残留的紧贴换行（</script><script），保持可读
          sh = sh.replace(/<\/script><script/g, '</script>\n    <script');
          fs.writeFileSync(shareHtml, sh);
        }
        const shareJs = path.join(distDir, 'assets', 'share-CyPsaet6.js');
        if (fs.existsSync(shareJs)) {
          let sj = fs.readFileSync(shareJs, 'utf8');
          // 剥离 share 对 main 的 import（该 import 仅用于空依赖的 __vitePreload 包裹）。
          // 本地别名（minify 后为随机单字母）从 import 行动态提取，避免硬编码失效。
          const impM = sj.match(/^import\{_ as ([A-Za-z_$][\w$]*)\}from"\.\/main-CYvt_zul\.js";/);
          if (impM) {
            const n = impM[1];
            sj = sj.replace(`import{_ as ${n}}from"./main-CYvt_zul.js";`, '');
            // 内层空依赖 __vitePreload 包裹退化为直接调用（[] => 无预载，等值）
            sj = sj.replace(new RegExp(`await ${n}\\(async\\(\\)=>\\{`), 'await(async()=>{');
            sj = sj.replace(/\},\[\],import\.meta\.url\)/, '})()');
            fs.writeFileSync(shareJs, sj);
          } else {
            console.warn('  ⚠️ Bug B: share-CyPsaet6.js 未匹配到 main import，跳过（可能已剥离或结构变化）');
          }
        }

        console.log('  ✅ post-build 收尾：图标 + css 引用 + CSP data: 剥离 + Bug B(share 去 main) 已固化');
      },
    },
  ],
  build: {
    outDir: 'dist', emptyOutDir: true, target: 'esnext', modulePreload: false,
    rollupOptions: {
      input: { index: resolve(__dirname, 'index.html'), share: resolve(__dirname, 'share', 'index.html') },
      output: {
        entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]',
        manualChunks(id) { const m = id.match(/[\\/]src[\\/]bundle[\\/]([^\\/]+\.js)$/); if (m) return m[1].replace(/\.js$/, ''); },
      },
    },
  },
});