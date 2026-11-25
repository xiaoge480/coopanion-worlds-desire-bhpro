/**
 * 区间图例高亮：框的必须是当前那一档
 *   node test/legend-highlight.mjs
 *
 * 2026-11-22 机主截图：欲求 81 落在「难受」，面板却框着「平静」。
 * 原因：图例从留存卡片搬到欲求卡片时，只改了位置，判断依据还是 s.retention。
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

console.log('\n[1] 高亮依据必须是欲求，不是留存');

const m = src.match(/for \(const \{ row, band \} of legendRows\) \{[\s\S]*?\n      \}/);
m ? ok('找到高亮那段') : bad('找不到', '');

const usesHeat = /s\.heat >= band\.from && s\.heat < band\.to/.test(m ? m[0] : '');
const usesRet = /s\.retention >= band\.from/.test(m ? m[0] : '');
usesHeat ? ok('用的是 s.heat') : bad('没用 heat', m ? m[0].slice(0, 80) : '');
usesRet ? bad('还在用 retention', '') : ok('不再用 s.retention');

console.log('\n[2] 图例挂在欲求卡片上，而不是留存');

const heatAppend = src.match(/heatCard\.append\(([^)]*)\)/g) || [];
heatAppend.some((a) => a.includes('legend'))
  ? ok('heatCard 里挂了 legend')
  : bad('没挂', heatAppend.join(' | '));
const retAppend = src.match(/retCard\.append\(([^)]*)\)/g) || [];
retAppend.some((a) => /append\(legend\)/.test(a))
  ? bad('retCard 还挂着 legend', '')
  : ok('retCard 不再挂 legend');

console.log('\n[3] 分档边界对得上（用 BANDS 实算）');

const bandsSrc = src.match(/const BANDS = \[[\s\S]*?\n\];/);
// BANDS 里引用了颜色表 C，求值时给它一个假的就够（这里只关心 from/to/zh）
const fakeC = { cyan: '', violet: '', pink: '' };
const BANDS = new Function('C', `${bandsSrc[0]}\nreturn BANDS;`)(fakeC);
const which = (h) => BANDS.find((b) => h >= b.from && h < b.to)?.zh ?? null;

const cases = [
  [10, '平静'],
  [50, '想要'],
  [81, '难受'],
  [95, '临界'],
];
for (const [h, want] of cases) {
  const got = which(h);
  got === want ? ok(`欲求 ${h} → ${got}`) : bad(`欲求 ${h} 应该 ${want}，实算 ${got}`, '');
}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
