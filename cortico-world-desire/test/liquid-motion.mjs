import { readFileSync } from 'node:fs';

const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/webui.js', 'utf-8');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 液体块不再整体平移');

!src.includes('d-liquid-sway') ? ok('没有 sway 组了') : bad('还在', '又会让液体脱离内壁');
!/@keyframes dSway/.test(src) ? ok('dSway 动画删了') : bad('还留着', '');
/translateX/.test(src) ? bad('还有 translateX', '液体或水面会被横着推走') : ok('没有 translateX');

console.log('\n[2] 动的是水面，不是水块');

/@keyframes dSurfaceFloat/.test(src) ? ok('水面有自己的波动动画') : bad('没有', '');
/#d-surface \{ animation: dSurfaceFloat/.test(src) ? ok('挂在水面线上') : bad('没挂上', '');
/0%/ .test(src) && /50%/.test(src) && /100%/.test(src) ? ok('0 / 50 / 100 三个关键帧，一个完整来回') : bad('关键帧不够', '');
/@keyframes dLiquidBreath/.test(src) ? ok('液体自己也只呼吸明暗') : bad('液体没有呼吸', '');
! /@keyframes dLiquidBreath[\s\S]{0,200}translate/.test(src) ? ok('液体的呼吸里没有位移') : bad('液体还在动位置', '');

console.log('\n[3] 定位和动画分两层（不然一个会盖掉另一个）');

/<\/?g id="d-surface-pos">/.test(src) ? ok('有外层 d-surface-pos') : bad('没有外层', '');
!/surfacePos\.setAttribute\('transform'/.test(src) ? ok('外层不再定位（路径自带高度，避免移两次）') : bad('外层还在定位', '会多移一次');
/surface\.setAttribute\('d'/.test(src) ? ok('内层只画形状') : bad('内层还在用于定位', '');
! /surface\.setAttribute\('transform'/.test(src) ? ok('内层不碰 transform（留给 CSS）') : bad('内层也写了 transform', '会跟动画打架');

console.log('\n[4] 液体形状还是贴着轮廓算的');

/liquidPath\(level, BOTTOM\)/.test(src) ? ok('液体仍按轮廓宽度生成') : bad('不是', '');
/math.pow\(r, 0\.7\)/i.test(src) ? ok('低留存仍做了抬高') : bad('抬高没了', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
