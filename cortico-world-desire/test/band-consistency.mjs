/**
 * 分档一致性：面板标什么档，那句状态就得是同一档
 *   node test/band-consistency.mjs
 *
 * 2026-11-22 机主说「难受从 55 开始是不是太低，70 行吗」，
 * 顺手发现原来 band() 的「想要」上限是 55、describe() 的是 65 ——
 * 欲求 60 时面板标「难受」，那句状态写「想要了」，自相矛盾。
 */
import { readFileSync } from 'node:fs';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const W = Object.values(mod).find((v) => typeof v === 'function' && v.prototype && v.prototype.envPromptVars);
const w = new W({ dataDir: 'D:/tmp-band', cfg: {} });

const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/webui.js', 'utf-8');
const bandsSrc = src.match(/const BANDS = \[[\s\S]*?\n\];/);
const BANDS = new Function('C', `${bandsSrc[0]}\nreturn BANDS;`)({ cyan: '', violet: '', pink: '' });

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 新的四个档');

const want = [
  [0, 45, '平静'],
  [45, 70, '想要'],
  [70, 85, '难受'],
  [85, 101, '临界'],
];
want.forEach(([from, to, zh], i) => {
  const b = BANDS[i];
  b.from === from && b.to === to && b.zh === zh
    ? ok(`${zh}  ${from}–${Math.min(100, to)}%`)
    : bad(`${zh} 分档不对`, JSON.stringify(b));
});

console.log('\n[2] 面板和正文说得一致（逐格扫）');

let mismatch = [];
for (let h = 0; h <= 100; h += 5) {
  w.tune({ heat: h, satiety: 0 });
  const s = w.snapshot();
  const bandZh = s.band?.zh;
  const mood = s.mood || '';
  // 正文那句该跟面板同档
  let expectBand = null;
  if (mood.includes('平静')) expectBand = '平静';
  else if (mood.includes('有点想') || mood.includes('想要了') || mood.includes('余韵')) expectBand = '想要';
  else if (mood.includes('很难受')) expectBand = '难受';
  else if (mood.includes('临界')) expectBand = '临界';
  else if (mood.includes('软的')) expectBand = '满足';
  if (expectBand && expectBand !== '满足' && expectBand !== bandZh) {
    mismatch.push(`欲求 ${h}：面板「${bandZh}」，正文「${mood.slice(0, 12)}…」`);
  }
}
mismatch.length === 0 ? ok('0–100 全扫过，没有一处打架') : bad(`${mismatch.length} 处不一致`, mismatch.slice(0, 3).join(' / '));

console.log('\n[3] 难受档确实从 70 起');

w.tune({ heat: 65, satiety: 0 });
const at65 = w.snapshot();
at65.band?.zh === '想要' ? ok(`欲求 65 → ${at65.band.zh}（不再是难受）`) : bad('65 还算难受', String(at65.band?.zh));
w.tune({ heat: 72, satiety: 0 });
const at72 = w.snapshot();
at72.band?.zh === '难受' ? ok(`欲求 72 → ${at72.band.zh}`) : bad('72 没进难受', String(at72.band?.zh));

console.log('\n[4] 环境提示里「给动作」的门槛也跟着到 70');

w.tune({ heat: 65, satiety: 0 });
const at65v = w.envPromptVars()['desire.now'];
! /往他那边靠/.test(at65v) ? ok('65 时不催她往人身上靠') : bad('65 就催了', '');
w.tune({ heat: 72, satiety: 0 });
const at72v = w.envPromptVars()['desire.now'];
/往他那边靠/.test(at72v) ? ok('72 时给了动作') : bad('72 没给', at72v);

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
