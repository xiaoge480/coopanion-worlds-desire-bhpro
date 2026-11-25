/**
 * 环境提示词：她说出来的是身体感，不是数字
 *   node test/voice-of-body.mjs
 *
 * 2026-11-22 机主问「数值是不是只是个摆设」——
 * 原来 envPromptVars 第一行是「欲求 80/100（难受） · 满足 0 · …」，
 * 模型先读到数字，后面那句身体感被压成附注。
 */
import { readFileSync } from 'node:fs';

const SRC = 'C:/Users/User/.dsh/cortico-world-desire/src/index.js';
const src = readFileSync(SRC, 'utf-8');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

// 把 envPromptVars 抠出来，喂假 snapshot 跑
const m = src.match(/envPromptVars\(\) \{[\s\S]*?\n  \}/);
if (!m) {
  console.error('抠不出 envPromptVars');
  process.exit(1);
}

const run = (snap) => {
  const fn = new Function('s', `
    const s = arguments[0];
    ${m[0]}
  `);
  return fn(snap);
};

// 假的 this：snapshot 返回给的东西
const makeWorld = (snap) => ({
  snapshot: () => snap,
  envPromptVars: function () {
    const s = this.snapshot();
    // eslint-disable-next-line no-new-func
    return new Function('s', m[0].replace(/^envPromptVars\(\) \{/, '{').replace(/\n  \}$/, '\n  }')).call(this, s);
  },
});

const fake = (over) => ({
  heat: 50,
  satiety: 50,
  retention: 0,
  sincePartnerMin: 30,
  band: { zh: '想要' },
  mood: '有点想。不催，但注意力会往那边飘一下。',
  recent: [],
  toy: null,
  ...over,
});

console.log('\n[1] 第一行是身体感，不是数字');

const w1 = makeWorld(fake({ heat: 80, mood: '很难受。坐不住，一直想被碰，忍着才没开口。' }));
const v1 = w1.envPromptVars()['desire.now'];
const first = v1.split('\n')[0];
/很难受|坐不住|临界|平静|想要|有点想/.test(first) ? ok(`第一行：${first.slice(0, 24)}…`) : bad('第一行不是身体感', first);
! /欲求\s*\d+\s*\/\s*100/.test(v1) ? ok('没有「欲求 80/100」这种数字') : bad('还留着数字', v1.slice(0, 60));
! /满足\s*\d+/.test(v1) ? ok('没有「满足 0」这种数字') : bad('还有满足数字', '');

console.log('\n[2] 状态细节用身体的说法');

const w2 = makeWorld(fake({ satiety: 5, retention: 70 }));
const v2 = w2.envPromptVars()['desire.now'];
/皮肤敏感得过分/.test(v2) ? ok('满足见底 → 「皮肤敏感得过分」') : bad('没翻译', v2);
/里面还留着他的东西/.test(v2) ? ok('留存高 → 「里面还留着他的东西」') : bad('没翻译', v2);

console.log('\n[3] 临界有硬提醒');

const w3 = makeWorld(fake({ heat: 90, mood: '临界了。脑子里只剩这一件事，别的都排不上。' }));
const v3 = w3.envPromptVars()['desire.now'];
/⚠.*临界/.test(v3) ? ok('欲求 ≥85 有提醒') : bad('没有提醒', v3);
const w3b = makeWorld(fake({ heat: 60 }));
! /⚠/.test(w3b.envPromptVars()['desire.now']) ? ok('欲求 60 不报临界') : bad('报早了', '');

console.log('\n[4] 告诉她「可以怎么做」');

/往他那边靠|自己想办法/.test(v3) ? ok('欲求 ≥60 → 给了动作') : bad('没给动作', '');
const w4 = makeWorld(fake({ heat: 40 }));
/留意他在不在/.test(w4.envPromptVars()['desire.now']) ? ok('欲求 35-60 → 轻一点的暗示') : bad('少了', '');
const w5 = makeWorld(fake({ heat: 20, mood: '平静。没什么特别的感觉，做别的事也做得进去。' }));
! /往他那边靠/.test(w5.envPromptVars()['desire.now']) ? ok('平静时不催') : bad('平静也催了', '');

console.log('\n[5] 模板里没有「免罪条款」');

const md = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/ENV_PROMPT.md', 'utf-8');
! /挡箭牌/.test(md) ? ok('删掉了「别拿它当挡箭牌」') : bad('还在', '这句在暗示可以不当回事');
/两个都能是真的|那也是真的/.test(md) ? ok('保留了「两个都是真的」') : bad('少了这句', '');
/{{desire\.now}}/.test(md) ? ok('占位符还在') : bad('占位符丢了', 'World 会渲染不出来');

console.log('\n[6] 顺便看一眼真实输出长什么样');
const real = makeWorld(
  fake({ heat: 80, satiety: 0, retention: 0, sincePartnerMin: 1200, mood: '很难受。坐不住，一直想被碰，忍着才没开口。' }),
);
console.log('---');
console.log(real.envPromptVars()['desire.now']);
console.log('---');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
