/**
 * [auto chunk header]
 * 角色：侧边栏入口（side_panel bootstrap）
 * 主要导出：export { j as _ }（preload 助手）
 * 对接模块：引用 endpointConfig（接入点引导）、App（动态 import 主程序）
 * 改动注意：勿改 ES module 加载顺序；引导/RootErrorBoundary 在此。改端点只走 endpointConfig。
 */
const __vite__mapDeps = (i2, m = __vite__mapDeps, d2 = m.f || (m.f = ['./App-BX6o9fW5.js', './rolldown-runtime-aKtaBQYM.js', './src-kC58-PF2.js', './src-DoQUrSOl.css', './vendor-Z-adA07W.js', './vendor-Qkhkn02K.css', './httpClient-BknZwXjG.js', './endpointConfig-Bt85xi8d.js', './httpClient-DFxwm5B3.css'])) => i2.map(i3 => d2[i3]);
import { i as e } from './rolldown-runtime-aKtaBQYM.js';
import './src-kC58-PF2.js';
import { Fr as t, Ir as n, Pr as r, Rr as i } from './vendor-Z-adA07W.js';
import { n as a } from './endpointConfig-Bt85xi8d.js';
var o = e(i(), 1);
var s = e(n(), 1);
var c = t();
var l = class extends o.Component {
  constructor(e2) {
    super(e2);
    this.state = {
      hasError: false,
      error: null
    };
  }
  static getDerivedStateFromError(e2) {
    return {
      hasError: true,
      error: e2
    };
  }
  componentDidCatch(e2, t2) {
    console.error("[RootErrorBoundary] 捕获到未处理异常:", e2, t2);
  }
  render() {
    return this.state.hasError ? (0, c.jsxs)("div", {
      style: {
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        background: "#0d0c0c",
        color: "#e5e5e5",
        padding: 24,
        textAlign: "center"
      },
      children: [(0, c.jsx)("div", {
        style: {
          fontSize: 16,
          fontWeight: 600
        },
        children: "页面加载遇到问题"
      }), (0, c.jsx)("div", {
        style: {
          fontSize: 13,
          color: "#9ca3af",
          maxWidth: 420,
          lineHeight: 1.6
        },
        children: "可能是网络或代理导致部分数据加载失败。你可以重试，若仍异常请尝试关闭代理后再打开。"
      }), (0, c.jsx)("button", {
        onClick: () => window.location.reload(),
        style: {
          padding: "8px 20px",
          borderRadius: 8,
          border: "1px solid #333",
          background: "#2a2a2a",
          color: "#fff",
          cursor: "pointer",
          fontSize: 13
        },
        children: "重新加载"
      })]
    }) : this.props.children;
  }
};
var u = console.error;
console.error = (...e2) => {
  typeof e2[0] == "string" && e2[0].includes("ResizeObserver loop") || u.call(console, ...e2);
};
window.addEventListener("error", e2 => {
  (e2.message.includes("ResizeObserver loop limit exceeded") || e2.message.includes("ResizeObserver loop completed with undelivered notifications")) && (e2.stopImmediatePropagation(), e2.preventDefault());
});
async function d() {
  try {
    await a();
  } catch (e3) {
    console.warn("[main] 接入点引导失败，使用默认接入点:", e3);
  }
  let {
    default: e2
  } = await r(async () => {
    let {
      default: e3
    } = await import('./App-BX6o9fW5.js');
    return {
      default: e3
    };
  }, __vite__mapDeps([0, 1, 2, 3, 4, 5, 6, 7, 8]), import.meta.url);
  (0, s.createRoot)(document.getElementById("root")).render((0, c.jsx)(o.StrictMode, {
    children: (0, c.jsx)(l, {
      children: (0, c.jsx)(e2, {})
    })
  }));
}
d();