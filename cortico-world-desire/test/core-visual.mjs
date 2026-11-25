/**
 * 核心图：四档各有各的样子，不是一张静态图
 *   node test/core-visual.mjs
 */
import { readFileSync } from 'node:fs';

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/webui.js', 'utf-8');

console.log('\n[1] 动画定义在');

for (const k of ['dPulse', 'dSpin', 'dFlash']) {
  src.includes(`@keyframes ${k}`) ? ok(`有 ${k} 动画`) : bad(`缺 ${k}`, '');
}
src.includes("const styleEl = el('style')") ? ok('CSS 会注入到面板里') : bad('CSS 没注入', '动画不会跑');

console.log('\n[2] 四档各有参数');

const look = src.match(/const look = \{[\s\S]*?\}\[s\.band\?\.id\]/);
if (!look) {
  bad('找不到档位表', '');
} else {
  const block = look[0];
  for (const band of ['calm', 'want', 'hard', 'edge']) {
    block.includes(`${band}: {`) ? ok(`${band} 有自己的配色和节奏`) : bad(`缺 ${band}`, '');
  }
  // 四档的呼吸周期应该不一样（越想要越急）
  const durs = [...block.matchAll(/dur:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  durs.length === 4 ? ok('呼吸周期：' + durs.join('s / ') + 's') : bad('周期数量不对', String(durs.length));
  const desc = durs.every((v, i) => i === 0 || v < durs[i - 1]);
  desc ? ok('越想要呼吸越急（递减）') : bad('周期不是递减', durs.join(','));
}

console.log('\n[3] 有几样东西会真的动');

src.includes("core.style.animation = `dPulse") ? ok('核心按档位呼吸') : bad('核心不会呼吸', '');
src.includes("rings.style.animation = s.toy?.running ? 'dSpin 14s linear infinite'") 
  ? ok('设备开着时两侧的环会转') : bad('环不会转', '');
src.includes("s.band?.id === 'edge' ? 'dFlash 1.1s ease-in-out infinite'") 
  ? ok('临界才闪红圈') : bad('没有临界闪光', '');
src.includes('<circle id="d-flash"') ? ok('SVG 里真有那个闪光圈') : bad('SVG 没有 flash 节点', '');

console.log('\n[4] 核心颜色跟着档位变，不是固定青色');

src.includes("core.setAttribute('fill', look.core)") ? ok('核心改成档位色') : bad('颜色没跟着变', '');
src.includes('drop-shadow(0 0 ') ? ok('发光强度也随档位变') : bad('发光没变', '');

console.log('\n[5] 平静的时候不能还在闪');

src.includes("flash.style.opacity = s.band?.id === 'edge' ? '0.35' : '0'") 
  ? ok('非临界时闪光圈 opacity 是 0') : bad('不会熄灭', '');

console.log('\n[6] 核心缩放的原点只能有一套');

// 2026-11-22 踩：inline 写 transformOrigin: '130px 146px'（SVG 用户坐标），
// CSS 那边又是 transform-box: fill-box，两套原点打架，核放大时往左上飘，像眼睛。
const inlineScale = /core\.style\.transform\s*=/.test(src);
const inlineOrigin = /core\.style\.transformOrigin\s*=/.test(src);
!inlineScale ? ok('没有 inline scale（不会和动画抢 transform）') : bad('还在 inline scale', '动画和它打架');
!inlineOrigin ? ok('没有 inline transformOrigin') : bad('还在写 inline 原点', '两套原点会打架');
(src.match(/transform-box:\s*fill-box/g) || []).length >= 3
  ? ok('三个会动的节点都声明了 transform-box: fill-box')
  : bad('transform-box 不够', '原点会按 SVG 坐标系算，会偏');
/src\.includes/.test('') === false && src.includes('#d-core { transform-box: fill-box; transform-origin: center; }')
  ? ok('核心明确用 center 做原点')
  : bad('核心原点没写死', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
