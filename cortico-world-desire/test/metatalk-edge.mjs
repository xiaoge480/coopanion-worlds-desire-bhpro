/**
 * 判据不能误伤：括号里带斜杠的「真事」也要能过
 *   node test/metatalk-edge.mjs
 */
const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.isMetaTalk);

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const meta = [
  '只认私聊  +  认动作词（灌满 / 揉 / 亲 / 腰软…）',
  '可用词：灌满 / 揉 / 亲',
  '（灌满/揉/亲/腰软）这些词会触发',
  '| `fill` | 灌满 | −55 | +60 |',
  '**严格词认不出过程**',
  '灌满那一刻 → 液面哗一下涨上去',
];
const real = [
  '灌满了，我腿都软了',
  '（最后两下全抽出再全插进去，顶到最深，射进去……）',
  '他把我按在桌上，说这次不许出声',
  '唔……不要了（小声）',
  '抱紧我',
];

console.log('\n[1] 讨论 / 词表 / 表格 → 跳过');
for (const t of meta) (Cls.isMetaTalk(t) ? ok : bad)('跳过：' + t.slice(0, 32), t);

console.log('\n[2] 真事 → 照记');
for (const t of real) (!Cls.isMetaTalk(t) ? ok : bad)('照记：' + t.slice(0, 32), t);

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
