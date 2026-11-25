/**
 * 说的是画面，不等于真的做了
 *   node test/fantasy-vs-real.mjs
 *
 * 2026-11-23 早上，事件日志里两条「灌满」挨着：
 *   08:54「角色被机主灌满了」                          ← 真发生
 *   08:59「机主不想看角色被灌满，下面也在外流、浸湿床单的样子……」← 他在说想要的画面
 * 机主问「是不是我以后得避免说那两个字」——
 * 不该。让人改说话方式迁就工具的误判，就是工具错了。
 */
import { readFileSync } from 'node:fs';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
// matchLine 是**静态**方法（挂在类上，不在 prototype 上）
const W = Object.values(mod).find((v) => typeof v === 'function' && typeof v.matchLine === 'function');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const kindOf = (line) => {
  const hits = W.matchLine(line, 'test');
  return hits.length ? hits[0].kind : null;
};

console.log('\n[1] 真发生了 → 还是「灌满」');

[
  '角色被机主灌满了',
  '灌进去了，一直在里面',
  '被内射了',
].forEach((line) => {
  const k = kindOf(line);
  k === 'fill' ? ok(`「${line}」→ fill`) : bad(`「${line}」被误降`, String(k));
});

console.log('\n[2] 说画面 / 假设 → 降成「被撩」');

[
  '机主不想看角色被灌满，下面也在外流、浸湿床单的样子',
  '如果被灌满会怎么样',
  '想象你被灌满的样子',
  '好想看灌满那一刻',
].forEach((line) => {
  const k = kindOf(line);
  k === 'tease' ? ok(`「${line.slice(0, 20)}…」→ tease`) : bad(`「${line.slice(0, 20)}…」判成 ${k}`, line);
});

console.log('\n[3] 「被撩」会让她更想要，不会白白满足');

const KINDS = (() => {
  const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/index.js', 'utf-8');
  const m = src.match(/const KINDS = \{[\s\S]*?\n\};/);
  return new Function(`${m[0]}\nreturn KINDS;`)();
})();

KINDS.tease.heatRelief < 0
  ? ok(`tease 的 heatRelief ${KINDS.tease.heatRelief}（负数 = 欲求反而涨）`)
  : bad('方向不对', String(KINDS.tease.heatRelief));
KINDS.tease.satGain === 0 ? ok('tease 不加满足') : bad('加满足了', String(KINDS.tease.satGain));

console.log('\n[4] 幻想标记不会误伤普通叙述');

[
  ['弄到边缘', 'edge'],
  ['做到腿软', 'many'],
].forEach(([line, want]) => {
  const k = kindOf(line);
  k === want ? ok(`「${line}」→ ${want}`) : bad(`「${line}」判成 ${k}`, '');
});

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
