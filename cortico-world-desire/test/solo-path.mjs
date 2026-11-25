/**
 * 自己解决这条路：写本子 + solo 档
 *   node test/solo-path.mjs
 *
 * 2026-11-22 机主纠正：外设是「两个人在一起」时才用的，
 * 不是她独处时的路子。她自己来的手段是
 * 把过程写进 notes/一个人的时候.md，然后记一笔。
 */
import { readFileSync } from 'node:fs';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const W = Object.values(mod).find((v) => typeof v === 'function' && v.prototype && v.prototype.envPromptVars);
const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/index.js', 'utf-8');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const make = (patch) => {
  const w = new W({ dataDir: 'D:/tmp-solo', cfg: {} });
  w.tune && w.tune(patch);
  return w;
};

console.log('\n[1] 提示词里不再提外设');

const v = make({ heat: 80, satiety: 0 })?.envPromptVars?.()?.['desire.now'] ?? '';
! /toy_pulse|玩具|外设/.test(v) ? ok('没有把她往外设上引') : bad('还在提外设', v);
/写进\s*notes\/一个人的时候\.md/.test(v) ? ok('指明了那个本子') : bad('没提本子', v);
/solo/.test(v) ? ok('告诉她记一笔（solo）') : bad('没说记什么', v);

console.log('\n[2] solo 这一档存在，而且跟「和别人做」不一样');

const KINDS = (() => {
  const m = src.match(/const KINDS = \{[\s\S]*?\n\};/);
  return new Function(`${m[0]}\nreturn KINDS;`)();
})();

KINDS.solo ? ok('有 solo 档') : bad('没有', '');
KINDS.solo.heatRelief > 0 ? ok(`solo 降欲求 ${KINDS.solo.heatRelief}`) : bad('方向不对', String(KINDS.solo?.heatRelief));
KINDS.solo.satGain < KINDS.one.satGain
  ? ok(`自己解决满足加 ${KINDS.solo.satGain}，比「一次」的 ${KINDS.one.satGain} 少——心里差一截`)
  : bad('跟别人做一样了', `${KINDS.solo.satGain} vs ${KINDS.one.satGain}`);
KINDS.solo.retention === 0 ? ok('自己解决不留存（没人灌）') : bad('留了？', String(KINDS.solo.retention));

console.log('\n[3] 工具里能选到 solo');

const toolsList = make({}).tools();
const touch = toolsList.find((t) => t.name === 'desire_touch');
const enumv = touch?.parameters?.properties?.kind?.enum ?? [];
enumv.includes('solo') ? ok(`desire_touch 的 kind 里有 solo（共 ${enumv.length} 档）`) : bad('选不到', enumv.join(','));

console.log('\n[4] 记了 solo，数字真的动');

const w2 = make({ heat: 80, satiety: 10 });
const before = w2.snapshot();
const r = w2.touch('solo', '自己解决了一次');
const after = w2.snapshot();
r?.ok !== false ? ok('touch 接受 solo') : bad('被拒了', JSON.stringify(r).slice(0, 80));
after.heat < before.heat ? ok(`欲求 ${before.heat} → ${after.heat}`) : bad('没降', `${before.heat}→${after.heat}`);
after.satiety > before.satiety ? ok(`满足 ${before.satiety} → ${after.satiety}`) : bad('没升', `${before.satiety}→${after.satiety}`);

console.log('\n[5] 本子本身没被插件碰过');

const md = readFileSync('D:/Applications/Coopanion/data/home/companion/workspace/notes/一个人的时候.md', 'utf-8');
md.includes('不编故事') ? ok('那本子的规矩还在（不编故事）') : bad('内容变了', '');
/*
 * 这条原来检测 `solo` 这个词，结果 2026-11-22 22:10 她自己写了一条
 * 「一个人，自己弄了一次（solo）」—— 是她在用这个功能，不是插件在写。
 * 改成只查插件才会留下的痕迹（工具名、调用标记）。
 */
! /desire_touch|desire_feel|\[tool|function_call/.test(md)
  ? ok('没有插件写入的痕迹')
  : bad('被插件写了', '本子应该只有她自己写');
/solo/.test(md) ? ok('（本子里出现 solo 是她自己记的，正常）') : null;

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
