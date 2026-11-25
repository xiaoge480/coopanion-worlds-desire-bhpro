/**
 * 撩骚要涨欲求，不是降
 *   node test/tease-direction.mjs
 *
 * 2026-11-22 机主问：「平时的撩骚和情事约定是不是也会涨欲求度？
 * 还是需要小鱼自己记上一笔」
 *
 * 查下来两条都不对劲：
 *   1. 密度法（一晚上撩得很密）原来记成 `one`／`many`（做完之后的档），欲求往下掉 —— 方向反了
 *   2. `tease` 只写在 LOOSE_PATTERNS 里，默认不启用 —— 所以平时撩根本不进账
 */
const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const src = (await import('node:fs')).readFileSync(
  'C:/Users/User/.dsh/cortico-world-desire/src/index.js',
  'utf-8',
);

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 三档的方向');

const KINDS = (() => {
  const m = src.match(/const KINDS = \{[\s\S]*?\n\};/);
  // eslint-disable-next-line no-new-func
  return new Function(`${m[0]}\nreturn KINDS;`)();
})();

KINDS.tease.heatRelief < 0
  ? ok(`被撩 → 欲求 +${-KINDS.tease.heatRelief}（heatRelief 是负的）`)
  : bad('撩居然降欲求', String(KINDS.tease.heatRelief));

KINDS.tease.satGain === 0 ? ok('撩不加满足（没给，就不该满足）') : bad('满足动了', String(KINDS.tease.satGain));

KINDS.one.heatRelief > 0 ? ok('做完一次 → 欲求下降（正常）') : bad('方向不对', '');
KINDS.cuddle.satGain > 0 && KINDS.cuddle.heatRelief > 0 ? ok('温存 → 两个都收一点') : bad('温存不对', '');

console.log('\n[2] 密度法记成「被撩」，不是「一次」');

/const kind = 'tease';/.test(src) ? ok('密度法产出 tease') : bad('还是 one/many', '');
! /const kind = b\.hits >= 30 \? 'many' : 'one';/.test(src)
  ? ok('旧的「密就当成做了一次」已经没了')
  : bad('还在', '');

console.log('\n[3] 自动扫：撩不会误记成做');

// 撩的句子不该被严格词认成 fill/one
const teaseLines = ['抱得很紧', '贴上来', '亲了一下', '摸我', '好几次'];
let hits = 0;
for (const t of teaseLines) {
  const r = mod.default?.matchLine?.(t, 'chat') ?? [];
  hits += r.length;
}
hits === 0 ? ok('撩的句子不会被自动记成事件（严格词不认）') : bad(`认出了 ${hits} 条`, '');

console.log('\n[4] 那平时撩怎么进账');

/src\(tease\.re\)/.test(src) || /LOOSE_PATTERNS = \[[\s\S]*?tease/.test(src)
  ? ok('LOOSE 词表里有 tease（她自己记 / loose 模式能用）')
  : bad('没有', '');

const hasTool = /desire_touch/.test(src);
hasTool ? ok('desire_touch 工具在，她可以自己记一笔') : bad('没工具', '');

console.log(
  fail === 0
    ? '\n全部通过。\n\n结论：撩骚现在会涨欲求（密度法自动 + 她自己记一笔都能走），做完了才降。'
    : `\n有 ${fail} 项没过。`,
);
process.exitCode = fail === 0 ? 0 : 1;
