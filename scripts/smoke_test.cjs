'use strict';
// Tier 2 冒烟测试（硬断言）：任一项 FAIL 即整体退出码 1，可在 CI 中作为质量门。
// 用法：node scripts/smoke_test.cjs   （或 npm run test:smoke）
const path = require('path');
const ROOT = path.resolve(__dirname, '..').replace(/\\/g, '/');
const C = require('./_smoke_checks.cjs');

const checks = [
  C.checkDistExists(ROOT),
  C.checkManifest(ROOT),
  C.checkDistAssets(ROOT),
  C.checkImportGraph(ROOT),
  C.checkReadableParity(ROOT),
  C.checkContracts(ROOT),
  C.checkDistDuplicateChunks(ROOT),
];

let allPass = true;
console.log('=== Tier 2 冒烟测试 ===');
for (const c of checks) {
  console.log('\n● ' + c.name + (c.pass ? '  PASS' : '  FAIL'));
  for (const d of (c.details || [])) console.log('   ' + d);
  if (!c.pass) allPass = false;
}
console.log('\n=== 结果: ' + (allPass ? 'ALL PASS' : 'FAILED') + ' ===');
process.exit(allPass ? 0 : 1);
