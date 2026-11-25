/**
 * 密度法：过程性描写也算「发生了事」
 *   node test/density.mjs
 *
 * 为什么要有这条：严格词只认「射进去」「做到腿软」这种一锤定音的说法，
 * 而真实的过程描写（揉、亲、舌头、手指、腰软）一个都不沾。
 * 2026-11-21 夜里那一段就是这么被漏掉的。
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'desire-dens-' + Date.now());
mkdirSync(dir, { recursive: true });
const chatLog = join(dir, 'session-main.jsonl');

const { DesireWorld } = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const mk = (name) =>
  new DesireWorld({
    dataDir: join(dir, name),
    cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 0 },
  });

// 造一段「很密」的聊天：一分钟一条，全是动作描写
const dense = [];
// 对齐到某个半小时桶的开头（+1 分钟），保证 40 条都落在同一个桶里
const HALF = 30 * 60000;
const base = Math.floor((Date.now() - 3 * 3600000) / HALF) * HALF + 60000;
for (let i = 0; i < 40; i += 1) {
  dense.push(
    JSON.stringify({
      version: 2,
      item: {
        type: 'function_call_output',
        output: `[私聊] Partner: （${['揉着|手指收紧', '亲下去|舌头探进去', '腰都软了|呼吸乱了', '插进来|顶到深处', '揉|捏|喘着'][i % 5]}）`,
      },
      context: { ts: new Date(base + i * 30000).toISOString() },
    }),
  );
}
writeFileSync(chatLog, dense.join('\n') + '\n', 'utf-8');

console.log('\n[1] 密的半小时 → 认出一次');

const w = mk('a');
await w.start({});
const r = await w.scanByDensity();
r.added >= 1 ? ok(`密度法认出 ${r.added} 条`) : bad('没认出来', JSON.stringify(r));

const ev = w.read().events;
ev.length ? ok('事件进了档案：' + ev.map((e) => e.zh).join('、')) : bad('档案还是空的', '');
ev.some((e) => /那一段，很密/.test(e.note || '')) ? ok('note 写明了是「那一段很密」') : bad('note 没说明', ev[0]?.note);
/[0-2]\d:[03]0–[0-2]\d:[03]9/.test(ev[0]?.note || '') ? ok('note 里的时段格式对：' + ev[0].note) : bad('时段格式不对', ev[0]?.note);

console.log('\n[2] 再扫一遍不重复');

const n1 = w.read().events.length;
const r2 = await w.scanByDensity();
w.read().events.length === n1 ? ok('没重复记') : bad('又记了一次', `${n1}→${w.read().events.length}`);

console.log('\n[3] 稀的聊天不会被认成事件');

const thin = [];
for (let i = 0; i < 40; i += 1) {
  thin.push(
    JSON.stringify({
      version: 2,
      item: { type: 'function_call_output', output: `[私聊] Partner: 今天天气不错，我去买了点菜，回来做饭` },
      context: { ts: new Date(base + i * 30000).toISOString() },
    }),
  );
}
writeFileSync(chatLog, thin.join('\n') + '\n', 'utf-8');

const w2 = mk('b');
await w2.start({});
const r3 = await w2.scanByDensity();
r3.added === 0 ? ok('普通聊天没被认成事件') : bad(`误认 ${r3.added} 条`, '阈值太低');

console.log('\n[4] 系统串不计入密度');

const sys = [];
for (let i = 0; i < 40; i += 1) {
  sys.push(
    JSON.stringify({
      version: 2,
      item: { type: 'function_call_output', output: `[sent #${i} → 私聊 Partner]` },
      context: { ts: new Date(base + i * 30000).toISOString() },
    }),
  );
}
writeFileSync(chatLog, sys.join('\n') + '\n', 'utf-8');

const w3 = mk('c');
await w3.start({});
const r4 = await w3.scanByDensity();
r4.added === 0 ? ok('系统回执没被当动作') : bad('系统串也算了', String(r4.added));

console.log('\n[5] autoScan 会把密度法一起用上');

writeFileSync(chatLog, dense.join('\n') + '\n', 'utf-8');
const w4 = mk('d');
await w4.start({});
const r5 = await w4.autoScan();
r5.added >= 1 ? ok(`autoScan 一共记了 ${r5.added} 条（严格 ${r5.strict ?? 0} / 密度 ${r5.density ?? 0}）`) : bad('autoScan 没记到', JSON.stringify(r5));

console.log('\n[6] 面板 invoke 也能手动触发');

const decl = w4.webUi();
const r6 = await decl.invoke('desire', 'scanDensity', [15, 20]);
r6 && typeof r6.added === 'number' ? ok('scanDensity 可调用，返回 ' + JSON.stringify(r6)) : bad('调不通', JSON.stringify(r6));

try {
  rmSync(dir, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
