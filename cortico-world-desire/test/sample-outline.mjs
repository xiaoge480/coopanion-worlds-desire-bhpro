/**
 * 采样轮廓：算每一高度上轮廓的左右边界。
 * 这样液体可以用一个自算的多边形画出来，不依赖 clipPath
 * （2026-11-22 怀疑 clipPath 在宿主里没生效，液体整个看不见）。
 *   node test/sample-outline.mjs
 */

// 左半边三段三次贝塞尔（和 CORE_SVG 里那条 path 一致）
const segs = [
  [[130, 58], [96, 58], [74, 86], [74, 122]],
  [[74, 122], [74, 152], [88, 170], [100, 186]],
  [[100, 186], [112, 202], [118, 220], [130, 250]],
];

const bez = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};

// 采样所有点（左半边）
const pts = [];
for (const [p0, p1, p2, p3] of segs) {
  for (let i = 0; i <= 60; i += 1) pts.push(bez(p0, p1, p2, p3, i / 60));
}

// 按 y 分桶，取每桶最小的 x（最左）
const table = [];
for (let y = 96; y <= 232; y += 8) {
  let minX = Infinity;
  for (const p of pts) {
    if (Math.abs(p[1] - y) < 3.5) minX = Math.min(minX, p[0]);
  }
  if (Number.isFinite(minX)) table.push([y, Math.round(minX)]);
}

console.log('y → 左边界 x（中心 130，右边界 = 260 - x）\n');
for (const [y, x] of table) console.log(`  y=${String(y).padStart(3)}  x=${String(x).padStart(3)}  宽=${(130 - x) * 2}`);

console.log('\n嵌进代码的表：');
console.log('const OUTLINE_X = ' + JSON.stringify(table) + ';');
