/**
 * 我在回复里「引用」聊天片段，不能被当成真聊天
 *   node test/quote-not-chat.mjs
 */
const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.isChatPayload);

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 整行就是一条记录 → 收');

const real = [
  '#-151691255 [私聊 15:28] Partner(1000000000): 嗯',
  '[私聊 20:41] Partner: 灌满了，我腿都软了',
  '[群「奥迷交流群」 20:39] 某人: 把角色名的网线拔了',
  '[draft staged → 私聊 Partner]',
];
for (const t of real) (Cls.isChatPayload(t) ? ok : bad)('收：' + t.slice(0, 34), t);

console.log('\n[2] 引用 / 列表 / 表格里的 → 不收');

const quoted = [
  '· [灌满] [私聊 00:35] Partner(1000000000): （最后两下全抽出…',
  '| `灌满了，我腿都软了` | 照记 ✓ |',
  '- [私聊 20:41] Partner: 灌满了',
  '12:28 fill 只认私聊 + 认动作词',
  '> [私聊 20:41] 引用一下',
];
for (const t of quoted) (!Cls.isChatPayload(t) ? ok : bad)('不收：' + t.slice(0, 34), t);

console.log('\n[3] DSH 的轮结束通知整段丢掉');

const dsh = '[1 new event]\n[DSH] 第 168 轮结束（completed）。 回复：**又被清了**\n15:07 fill 只认私聊（灌满 / 揉）';
const got = Cls.textsOf({ item: { type: 'function_call_output', output: dsh } });
got.length === 0 ? ok('textsOf 一条都不收') : bad('漏进来 ' + got.length + ' 条', JSON.stringify(got).slice(0, 80));

console.log('\n[4] 真聊天混在通知里：只挑出来那几行');

const mixed = {
  item: {
    type: 'function_call_output',
    output: [
      '[1 new event]',
      '#-151691255 [私聊 15:28] Partner(1000000000): 嗯',
      '[sent #-1886338562 → 私聊 Partner]',
      '[turn ended]',
    ].join('\n'),
  },
};
const m = Cls.textsOf(mixed);
m.length === 1 && m[0].includes('嗯') ? ok('只留聊天那一行') : bad('挑错', JSON.stringify(m));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
