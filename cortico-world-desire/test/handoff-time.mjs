/**
 * 交接笔记里的聊天行也要认对时间
 *   node test/handoff-time.mjs
 *
 * 2026-11-23 下午：早上 08:54 那次灌满被记成 14:25，
 * 而且同一条消息被记了两遍，留存凭空多出 32。
 *
 * 原因两层：
 *   ① 交接笔记里的行，from 是 `handoff:xxx.md`（没有日期），
 *      happenedAt 取不到日期就 fallback 成 nowIso（扫描时刻）；
 *   ② 同一条消息在两个来源里各出现一次（chat: 带日期 / handoff: 不带），
 *      时间错开后 30 分钟去重对不上，两条都进了时间线。
 */
import { readFileSync } from 'node:fs';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const W = mod.DesireWorld;

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const fmt = (iso) => (iso ? new Date(iso).toLocaleString('zh-CN', { hour12: false }) : '(undefined)');

console.log('\n[1] 带日期的 from（聊天记录）');

const a = W.happenedAt(
  '#2141291718 [私聊 08:54] Partner: 角色被机主灌满了',
  'chat:2026-11-23T06:54:51.059+08:00',
);
fmt(a).includes('08:54') ? ok(`→ ${fmt(a)}`) : bad('不对', fmt(a));

console.log('\n[2] 不带日期的 from（交接笔记）→ 用今天，不是扫描时刻');

const b = W.happenedAt(
  '#2141291718 [私聊 08:54] Partner: 角色被机主灌满了',
  'handoff:2026-11-23.md',
);
fmt(b).includes('08:54') ? ok(`→ ${fmt(b)}（时分对了）`) : bad('时分没认出来', fmt(b));

// 关键：不能是「现在」
const nowMin = new Date().toTimeString().slice(0, 5);
Math.abs(Date.now() - Date.parse(b)) > 5 * 60000
  ? ok('没退回扫描时刻（离现在超过 5 分钟）')
  : bad('还是现在', `${fmt(b)} 现在 ${nowMin}`);

console.log('\n[3] 带「[回执]」前缀的行也要认');

const c = W.happenedAt(
  '[回执] #-2076315243 [私聊 08:39] Partner: 机主的东西叫什么呀',
  'handoff:2026-11-23.md',
);
fmt(c).includes('08:39') ? ok(`→ ${fmt(c)}`) : bad('没认出', fmt(c));

console.log('\n[4] 拿不到时分的行，仍然退回扫描时刻');

const d = W.happenedAt('没有时间标记的一句话', 'handoff:x.md');
d === 'handoff:x.md' || d === undefined ? ok('老实退回 fallback') : bad('乱猜', fmt(d));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
