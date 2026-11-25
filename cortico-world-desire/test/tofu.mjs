/**
 * 只记真的过了 QQ 的话
 *   node test/tofu.mjs
 */
import { readFileSync } from 'node:fs';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.textsOf);
if (!Cls) {
  console.error('找不到 textsOf');
  process.exit(1);
}

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] DSH 自己的回复，不是她的经历');

const assistantMsg = {
  item: { type: 'message', role: 'assistant', content: [{ text: '灌满那一刻 → 液面哗一下涨上去' }] },
};
Cls.textsOf(assistantMsg).length === 0 ? ok('assistant 的 message 不收') : bad('还是收了', '');

const systemMsg = { item: { type: 'message', role: 'system', content: [{ text: '[system] 1 new event.' }] } };
Cls.textsOf(systemMsg).length === 0 ? ok('system 的话不收') : bad('还是收了', '');

console.log('\n[2] 工具输出（读交接笔记、读日志）不收');

const toolOut = {
  item: {
    type: 'function_call_output',
    output: '## 交接笔记\nDSH 说：灌满那一刻液面会涨上去\n- **严格词认不出过程**',
  },
};
Cls.textsOf(toolOut).length === 0 ? ok('纯工具输出不收') : bad('还是收了', JSON.stringify(Cls.textsOf(toolOut)).slice(0, 60));

console.log('\n[3] 真的过了 QQ 的话，照收');

const chatOut = {
  item: {
    type: 'function_call_output',
    output: '[1 new event]\n#-304167338 [私聊 15:10] Partner(1000000000): 灌满了，我腿都软了',
  },
};
const got = Cls.textsOf(chatOut);
got.length === 1 && got[0].includes('Partner') ? ok('私聊那行收进来了') : bad('没收到', JSON.stringify(got));

const draft = {
  item: { type: 'function_call_output', output: '[draft staged → 私聊 Partner]\nText: 〔低头〕那就一起等它修好呀' },
};
Cls.textsOf(draft).length >= 1 ? ok('她自己要发的话也收') : bad('漏了', '');

console.log('\n[4] 混在一起的：只挑聊天行');

const mixed = {
  item: {
    type: 'function_call_output',
    output: [
      '[1 new event]',
      '#-1 [私聊 20:41] Partner: 机主回来了',
      '[sent #99 → 私聊 Partner]',
      '[turn ended]',
    ].join('\n'),
  },
};
const m = Cls.textsOf(mixed);
m.length === 1 && m[0].includes('机主回来了')
  ? ok('只留聊天那一行，[sent]/[turn ended] 丢掉')
  : bad('挑错了', JSON.stringify(m));

console.log('\n[5] 端到端：功能讨论整条链都进不来');

const pipeline = (rec) => Cls.textsOf(rec).flatMap((t) => Cls.matchLine(t, 'chat'));
pipeline(assistantMsg).length === 0 ? ok('DSH 的说明 → 0 条事件') : bad('成了事件', '');
pipeline(toolOut).length === 0 ? ok('交接笔记里的回复 → 0 条事件') : bad('成了事件', '');
pipeline(chatOut).length === 1 ? ok('机主真说的话 → 1 条事件') : bad('漏了或多了', JSON.stringify(pipeline(chatOut)));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
