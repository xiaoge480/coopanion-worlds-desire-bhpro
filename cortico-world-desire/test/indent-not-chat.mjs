/**
 * 顶格才算聊天（第六次翻车的回归）
 *   node test/indent-not-chat.mjs
 */
const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.isChatPayload);
const W = Object.values(mod).find((v) => typeof v === 'function' && v.happenedAt);
const Hap = (...a) => W.happenedAt(...a);

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 缩进一格都不行（我就是栽在这一格空格上）');

const indented = [
  '  [私聊 20:41] Partner: 灌满了，我腿都软了',
  ' [私聊 20:41] Partner: 灌满了',
  '\t[私聊 20:41] Partner: 灌满了',
  '✅ [私聊 20:41] Partner: 灌满了',
  '· [私聊 20:41] Partner: 灌满了',
  '  - [私聊 20:41] Partner: 灌满了',
];
for (const t of indented) (!Cls.isChatPayload(t) ? ok : bad)('不收 ' + JSON.stringify(t.slice(0, 22)), t);

console.log('\n[2] 顶格才收');

const solid = [
  '#1462331433 [私聊 12:29] Partner(1000000000): 嗯，角色♡',
  '#-1569091493 [私聊 00:35] Partner(1000000000): （最后两下…',
  '[私聊 20:41] Partner: 灌满了',
  '[draft staged → 私聊 Partner]',
];
for (const t of solid) (Cls.isChatPayload(t) ? ok : bad)('收 ' + t.slice(0, 32), t);

console.log('\n[3] 发生时刻也只看顶格那行');

const nowIso = '2026-11-22T07:31:00.000Z';
const quoted = '解释一下：\n  [私聊 20:41] Partner: 灌满了\n就这样';
Hap(quoted, 'chat:' + nowIso, nowIso) === nowIso
  ? ok('引用的时刻不采纳（退回扫描时刻）')
  : bad('被中间行带跑了', Hap(quoted, 'chat:' + nowIso, nowIso));

const real = '#1462331433 [私聊 12:29] Partner: 嗯';
Hap(real, 'chat:2026-11-22T07:31:00Z', nowIso) !== nowIso
  ? ok(`顶格真聊天采纳了它的时刻（${Hap(real, 'chat:2026-11-22T07:31:00Z', nowIso)}）`)
  : bad('没推出来', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
