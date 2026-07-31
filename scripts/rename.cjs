'use strict';
// 只读副本语义名覆盖（任务书 line 240）：把 name_rules 应用到 `readable/` 副本，**绝不写回构建源 src/bundle**。
// 与 apply_rename_to_bundle.cjs（作用域精确、写回构建源）不同，本脚本是「阅读副本」机制：
// 仅在 readable/ 下生成带语义名的副本，方便人类/AI 只读对照；构建仍以 src/bundle 为准。
// 1.4.0 当前 name_rules 返回空规则 → 副本与源 1:1（等价无改名），安全 no-op。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const BUNDLE = path.join(ROOT, 'src/bundle').replace(/\\/g, '/');
const OUT = path.join(ROOT, 'readable').replace(/\\/g, '/');
const { getRules } = require('./name_rules.cjs');

const rulesMap = getRules(); // {from:to}；1.4.0 默认 {}
const rules = Object.entries(rulesMap).map(([from, to]) => ({ from, to }));
fs.mkdirSync(OUT, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(BUNDLE)) {
  if (!f.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(BUNDLE, f), 'utf8');
  let out = src;
  for (const r of rules) {
    if (!r.from || !r.to) continue;
    out = out.split(r.from).join(r.to); // 仅阅读副本的宽松替换；构建源绝不用此方式
  }
  fs.writeFileSync(path.join(OUT, f), out);
  n++;
}
console.log(`已生成可读副本 ${n} 个到 readable/（规则 ${rules.length} 条；空规则=等价副本，非构建源）`);
