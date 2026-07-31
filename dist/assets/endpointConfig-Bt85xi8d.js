/**
 * [auto chunk header]
 * 角色：接入点配置（host 重写 / Chrome 扩展检测 / 端口 18080 / 默认端点）
 * 主要导出：export { i as a, t as c, v as i, _ as n, n as o, g as r, r as s, c as t }
 * 对接模块：被 main / App / httpClient 引用；含存储键 active_api_endpoint
 * 改动注意：改后端端点地址的唯一安全入口（只改 host/端口这类可切换项）。API 路径与存储键字符串契约不可动。
 */
var e = "18080";
function t() {
  try {
    return typeof chrome < "u" && !!chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}
function n() {
  return t() ? `http://127.0.0.1:${e}` : `http://${window.location.hostname || "127.0.0.1"}:${e}`;
}
function r() {
  return e;
}
function i(e2) {
  if (!e2 || typeof e2 != "string" || t()) {
    return e2;
  }
  let n2 = window.location.hostname;
  return n2 && n2 !== "127.0.0.1" && n2 !== "localhost" ? e2.replace(/127\.0\.0\.1/g, n2) : e2;
}
var a = "active_api_endpoint";
function o(e2) {
  return (e2 || "").replace(/[`\s]/g, "").trim().replace(/\/$/, "");
}
function s() {
  let e2 = [{
    label: "默认接入点",
    url: o("http://154.219.102.152:3012")
  }];
  try {
    let t2 = JSON.parse("[{\"label\":\"主接入点\",\"url\":\"https://www.1mao.cc\"},{\"label\":\"备用接入点1\",\"url\":\"https://1mao.16iai.com\"},{\"label\":\"备用接入点2\",\"url\":\"http://154.219.102.152:3012\"}]");
    if (!Array.isArray(t2)) {
      return e2;
    }
    let n2 = t2.map(e3 => ({
      label: String(e3?.label || e3?.url || "").trim(),
      url: o(String(e3?.url || ""))
    })).filter(e3 => !!e3.url);
    return n2.length > 0 ? n2 : e2;
  } catch (t2) {
    return console.warn("[endpointConfig] 解析 VITE_API_ENDPOINTS 失败，使用默认接入点:", t2), e2;
  }
}
var c = s();
function l() {
  return c[0]?.url || o("http://154.219.102.152:3012");
}
function u() {
  try {
    let e2 = sessionStorage.getItem(a);
    return e2 ? o(e2) : null;
  } catch {
    return null;
  }
}
function d(e2) {
  try {
    sessionStorage.setItem(a, o(e2));
  } catch {}
}
function f() {
  try {
    sessionStorage.removeItem(a);
  } catch {}
}
function p(e2) {
  if (e2 == null || e2 === "") {
    return null;
  }
  if (typeof e2 == "string") {
    let t2 = e2.trim();
    if (!t2) {
      return null;
    }
    if (t2.startsWith("\"") || t2.startsWith("{")) {
      try {
        return p(JSON.parse(t2));
      } catch {
        return o(t2);
      }
    }
    return o(t2);
  }
  if (typeof e2 == "object") {
    let t2 = e2;
    if (typeof t2.url == "string") {
      return o(t2.url);
    }
    if (typeof t2.value == "string") {
      return p(t2.value);
    }
  }
  return null;
}
async function m() {
  try {
    let e2 = await fetch(`${n()}/api/kv/get?key=${a}`);
    return e2.ok ? p(await e2.json()) : null;
  } catch {
    return null;
  }
}
async function h(e2) {
  try {
    return (await fetch(`${n()}/api/kv/set`, {
      method: "POST",
      headers: {
        'Content-Type': "application/json"
      },
      body: JSON.stringify({
        key: a,
        value: o(e2)
      })
    })).ok;
  } catch {
    return false;
  }
}
function g() {
  return u() || l();
}
async function _() {
  let e2 = u();
  if (e2) {
    return e2;
  }
  let t2 = await m();
  return t2 ? (d(t2), t2) : l();
}
async function v(e2) {
  let t2 = o(e2);
  if (!t2) {
    return false;
  }
  let n2 = await h(t2);
  return n2 && f(), n2;
}
export { i as a, t as c, v as i, _ as n, n as o, g as r, r as s, c as t };