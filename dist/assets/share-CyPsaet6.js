/**
 * [auto chunk header]
 * 角色：分享页入口（独立页面，非 side_panel）
 * 主要导出：动态 import ShareAppPage 主程序
 * 对接模块：设置 window.__CANVAS_RUNTIME__={disableLocalTool:true}；引用 ShareAppPage
 * 改动注意：分享/预览链接页面。改前确认这是独立入口，不影响侧边栏。
 */
const __vite__mapDeps = (i2, m = __vite__mapDeps, d = m.f || (m.f = ['./ShareAppPage-C4RerI9i.js', './rolldown-runtime-aKtaBQYM.js', './vendor-Z-adA07W.js', './vendor-Qkhkn02K.css', './httpClient-BknZwXjG.js', './endpointConfig-Bt85xi8d.js', './httpClient-DFxwm5B3.css'])) => i2.map(i3 => d[i3]);
import { i as e } from './rolldown-runtime-aKtaBQYM.js';
import './src-kC58-PF2.js';
import { Fr as t, Ir as n, Pr as r } from './vendor-Z-adA07W.js';
var i = e(n(), 1);
var a = t();
window.__CANVAS_RUNTIME__ = {
  disableLocalTool: true
};
async function o() {
  let {
    default: e2
  } = await r(async () => {
    let {
      default: e3
    } = await import('./ShareAppPage-C4RerI9i.js');
    return {
      default: e3
    };
  }, __vite__mapDeps([0, 1, 2, 3, 4, 5, 6]), import.meta.url);
  (0, i.createRoot)(document.getElementById("root")).render((0, a.jsx)(e2, {}));
}
o();