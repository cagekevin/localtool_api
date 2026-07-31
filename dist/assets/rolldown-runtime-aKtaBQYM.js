/**
 * [auto chunk header]
 * 角色：rolldown 运行时节（内部运行时符号）
 * 主要导出：导出运行时内部符号（e/t/n/r/i/a/o/s 等）
 * 对接模块：被全部 chunk 引用
 * 改动注意：禁止改动；运行时代码。
 */
var e = Object.create;
var t = Object.defineProperty;
var n = Object.getOwnPropertyDescriptor;
var r = Object.getOwnPropertyNames;
var i = Object.getPrototypeOf;
var a = Object.prototype.hasOwnProperty;
var o = (e2, t2) => () => (
  t2 ||
    (e2(
      (t2 = {
        exports: {}
      }).exports,
      t2
    ),
    (e2 = null)),
  t2.exports
);
var s = (e2, n2) => {
  let r2 = {};
  for (var i2 in e2) {
    t(r2, i2, {
      get: e2[i2],
      enumerable: true
    });
  }
  return (
    n2 ||
      t(r2, Symbol.toStringTag, {
        value: `Module`
      }),
    r2
  );
};
var c = (e2, i2, o2, s2) => {
  if ((i2 && typeof i2 == `object`) || typeof i2 == `function`) {
    for (var c2 = r(i2), l2 = 0, u2 = c2.length, d; l2 < u2; l2++) {
      d = c2[l2];
      !a.call(e2, d) &&
        d !== o2 &&
        t(e2, d, {
          get: ((e3) => i2[e3]).bind(null, d),
          enumerable: !(s2 = n(i2, d)) || s2.enumerable
        });
    }
  }
  return e2;
};
var l = (n2, r2, a2) => (
  (a2 = n2 == null ? {} : e(i(n2))),
  c(
    r2 || !n2 || !n2.__esModule
      ? t(a2, `default`, {
          value: n2,
          enumerable: true
        })
      : a2,
    n2
  )
);
var u = ((e2) =>
  typeof require < `u`
    ? require
    : typeof Proxy < `u`
      ? new Proxy(e2, {
          get: (e3, t2) => (typeof require < `u` ? require : e3)[t2]
        })
      : e2)(function (e2) {
  if (typeof require < `u`) {
    return require.apply(this, arguments);
  }
  throw Error(
    'Calling `require` for "' +
      e2 +
      '" in an environment that doesn\'t expose the `require` function. See https://rolldown.rs/in-depth/bundling-cjs#require-external-modules for more details.'
  );
});
export { l as i, s as n, u as r, o as t };
