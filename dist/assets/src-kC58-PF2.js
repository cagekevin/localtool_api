/**
 * [auto chunk header]
 * 角色：Vite modulepreload polyfill（纯副作用，无导出）
 * 主要导出：无导出（仅注入 modulepreload 助手）
 * 对接模块：被各 chunk 作为副作用 import
 * 改动注意：运行时代码，勿改。
 */
(function () {
  let e = document.createElement("link").relList;
  if (e && e.supports && e.supports("modulepreload")) {
    return;
  }
  for (let e2 of document.querySelectorAll("link[rel=\"modulepreload\"]")) {
    n(e2);
  }
  new MutationObserver(e2 => {
    for (let t2 of e2) {
      if (t2.type === "childList") {
        for (let e3 of t2.addedNodes) {
          e3.tagName === "LINK" && e3.rel === "modulepreload" && n(e3);
        }
      }
    }
  }).observe(document, {
    childList: true,
    subtree: true
  });
  function t(e2) {
    let t2 = {};
    return e2.integrity && (t2.integrity = e2.integrity), e2.referrerPolicy && (t2.referrerPolicy = e2.referrerPolicy), e2.crossOrigin === "use-credentials" ? t2.credentials = "include" : e2.crossOrigin === "anonymous" ? t2.credentials = "omit" : t2.credentials = "same-origin", t2;
  }
  function n(e2) {
    if (e2.ep) {
      return;
    }
    e2.ep = true;
    let n2 = t(e2);
    fetch(e2.href, n2);
  }
})();