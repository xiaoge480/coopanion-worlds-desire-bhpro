/**
 * 液面：形状按轮廓算、白线和填充同源
 *   node test/liquid-path.mjs
 */
import { readFileSync } from 'node:fs';

const SRC = 'C:/Users/User/.dsh/cortico-world-desire/src/webui.js';
const src = readFileSync(SRC, 'utf-8');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const grab = (re) => {
  const m = src.match(re);
  if (!m) throw new Error('抠不出：' + re);
  return m[0];
};

const tableM = grab(/const OUTLINE_X = \[\[[\s\S]*?\]\];/);
const wM = grab(/function outlineWidth\(y\) \{[\s\S]*?\n\}/);
const wtM = grab(/function waveTop\(level\) \{[\s\S]*?\n\}/);
const spM = grab(/function surfacePath\(level\) \{[\s\S]*?\n\}/);
const lpM = grab(/function liquidPath\(level, bottom = 224\) \{[\s\S]*?\n\}/);

const { outlineWidth, liquidPath, surfacePath, waveTop } = new Function(
  `${tableM}\n${wM}\n${wtM}\n${spM}\n${lpM}\nreturn { outlineWidth, liquidPath, surfacePath, waveTop };`,
)();

const BOTTOM = 224;
const TOP = 96;
const levelOf = (r) => BOTTOM - (BOTTOM - TOP) * Math.pow(r, 0.7);

const surfacePosWrites = () => /surfacePos\.setAttribute\('transform'/.test(src);

console.log('\n[1] 轮廓宽度');

const w = (y) => Math.round(outlineWidth(y));
w(120) > w(180) ? ok(`上宽下窄（y=120 → ${w(120)}，y=180 → ${w(180)}）`) : bad('宽度反了', '');
w(224) < 25 ? ok(`底部收成尖（y=224 → ${w(224)}）`) : bad('底部没收', String(w(224)));
w(96) > 100 ? ok(`顶部最宽（y=96 → ${w(96)}）`) : bad('顶部不对', String(w(96)));

console.log('\n[2] 白线和填充顶边同源');

const level = levelOf(0.26);
const wave = waveTop(level);
const surface = surfacePath(level);
const liquid = liquidPath(level);
surface === wave.d ? ok('水面线就是 waveTop') : bad('不是同一段', '');
liquid.startsWith(wave.d) ? ok('填充以同一段波浪开头') : bad('填充顶边不一样', '峰下面会露空');

console.log('\n[3] 起伏不再夸张');

wave.dy <= 5.5 ? ok(`起伏 ${wave.dy.toFixed(1)}px（原来 8px 太夸张）`) : bad('还是太大', String(wave.dy));
wave.dy >= 1.4 ? ok('窄处也留了一点起伏') : bad('太平了', String(wave.dy));

console.log('\n[4] 填充是闭合路径、点都在轮廓里');

liquid.startsWith('M') && liquid.trim().endsWith('Z') ? ok('闭合，能填充') : bad('没闭合', '');
// q/t 后面是**相对偏移**，不是绝对坐标，只能挑 L 命令后面的点来查
const afterL = liquid.slice(liquid.indexOf(' L '));
const coords = (afterL.match(/-?\d+\.\d+/g) || []).map(Number);
const xs = coords.filter((_, i) => i % 2 === 0);
const out = xs.filter((x) => x < 60 || x > 200);
out.length === 0
  ? ok(`${xs.length} 个绝对坐标全在轮廓范围内（${Math.min(...xs).toFixed(0)}~${Math.max(...xs).toFixed(0)}）`)
  : bad('有出界的点', out.slice(0, 3).join(','));

console.log('\n[5] 留存越高液面越高');

const y100 = Number(liquidPath(levelOf(1)).match(/^M -?[\d.]+ (-?[\d.]+)/)[1]);
const y50 = Number(liquidPath(levelOf(0.5)).match(/^M -?[\d.]+ (-?[\d.]+)/)[1]);
const y10 = Number(liquidPath(levelOf(0.1)).match(/^M -?[\d.]+ (-?[\d.]+)/)[1]);
y100 < y50 && y50 < y10
  ? ok(`100% y=${y100.toFixed(0)} < 50% y=${y50.toFixed(0)} < 10% y=${y10.toFixed(0)}`)
  : bad('关系不对', '');

console.log('\n[6] 白线和液面同高（不能位移两次）');

!surfacePosWrites() ? ok('外层不再写 transform（路径自带高度）') : bad('外层还在位移', '会多移一次');
const sy = Number(surface.match(/^M -?[\d.]+ (-?[\d.]+)/)[1]);
Math.abs(sy - level) < 0.5 ? ok(`水面线 y=${sy.toFixed(1)} = 液面 y=${level.toFixed(1)}`) : bad('错位', `${sy} vs ${level}`);

console.log('\n[7] 不再依赖 clipPath');

!/clip-path="url\(#d-clip\)"/.test(src) ? ok('没有 clip-path 引用') : bad('还在', '');
!/<clipPath id="d-clip"/.test(src) ? ok('clipPath 定义也删了') : bad('还留着', '');
/path id="d-inner"/.test(src) ? ok('内壁是一条 fill 路径') : bad('没有内壁', '液体没对比度');
/path id="d-liquid"/.test(src) ? ok('液体是 path') : bad('不是', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
