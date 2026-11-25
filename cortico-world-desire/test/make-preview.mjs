/**
 * 生成一个极简预览页：一份 SVG、去掉滤镜和动画，只验证几何对不对。
 * 上一版四份 SVG + 一堆 filter 把页面拖到截图都超时。
 *   node test/make-preview.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/webui.js', 'utf-8');

const svgM = src.match(/const CORE_SVG = `([\s\S]*?)`;/);
if (!svgM) {
  console.error('抠不出 SVG');
  process.exit(1);
}
let svg = svgM[1];

// 去掉所有 filter="url(...)" —— 高斯模糊是截图卡死的元凶，这次只看形状
svg = svg.replace(/\s*filter="url\(#[^)]*\)"/g, '');

const helpers = src.match(/const OUTLINE_X = \[\[[\s\S]*?\]\];/)[0]
  + '\n'
  + src.match(/function outlineWidth\(y\) \{[\s\S]*?\n\}/)[0]
  + '\n'
  + src.match(/function liquidPath\(level, bottom = 232\) \{[\s\S]*?\n\}/)[0]
  + '\n'
  + src.match(/function surfacePath\(level\) \{[\s\S]*?\n\}/)[0];

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:#0a0812;font:12px sans-serif;color:#ccc;padding:10px}
.row{display:flex;gap:10px}
.stage{width:260px;height:320px;border:1px solid #1e1833;border-radius:10px;overflow:hidden;background:#0a0812}
.lbl{color:#8a80a8;margin-top:4px;text-align:center}
</style></head><body>
<div class="row">
  <div><div class="stage" id="a">${svg}</div><div class="lbl">留存 26 · 复刻</div></div>
  <div><div class="stage" id="b">${svg}</div><div class="lbl">留存 26 · 纯色高亮</div></div>
</div>
<script>
${helpers}
const paint = (id, retention, highlight) => {
  const host = document.getElementById(id);
  const q = (s) => host.querySelector(s);
  const BOTTOM = 232, TOP = 96;
  const r = retention / 100;
  const level = BOTTOM - (BOTTOM - TOP) * r;
  const liq = q('#d-liquid');
  const surf = q('#d-surface');
  liq.setAttribute('d', liquidPath(level, BOTTOM));
  liq.setAttribute('opacity', '1');
  if (highlight) liq.setAttribute('fill', '#ff5ea8');   // 纯色，排除渐变的问题
  surf.setAttribute('d', surfacePath(level));
  surf.setAttribute('opacity', '1');
  console.log(id, 'level', Math.round(level), 'd长度', liq.getAttribute('d').length);
};
paint('a', 26, false);
paint('b', 26, true);
</script>
</body></html>`;

writeFileSync('C:/Users/User/.dsh/cortico-world-desire/test/preview.html', html, 'utf-8');
console.log('生成极简预览页（两份、无滤镜）');
