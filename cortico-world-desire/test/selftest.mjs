/**
 * 自测：不接 Coopanion，直接把 World 类拽起来跑一遍。
 *   node test/selftest.mjs
 *
 * 验的是：时间推进、事件改数、留存吸收、面板读到的快照、从笔记认经历。
 */
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const DATA = join(tmpdir(), 'desire-selftest-' + Date.now());
mkdirSync(DATA, { recursive: true });

const { DesireWorld } = await import('../src/index.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};
const near = (a, b, tol = 1.5) => Math.abs(a - b) <= tol;

console.log('\n[1] 冷启动');

// 这个用例测的是「时间推进会不会涨」，别被真实的睡觉时段干扰 ——
// 2026-11-22 晚实测：聊天记录里 23:05 的晚安会让 tick 正确地停住，
// 于是这条老测试误报成「没涨」。
const w = new DesireWorld({ dataDir: DATA, cfg: { sleepPauseEnabled: false, chatLog: join(DATA, 'none.jsonl') } });
await w.start({});

const s0 = w.snapshot();
s0.heat >= 0 && s0.heat <= 100 ? ok(`欲求 ${s0.heat} 在 0-100`) : bad('欲求越界', String(s0.heat));
typeof s0.mood === 'string' && s0.mood.length > 4 ? ok('有一句心情：' + s0.mood) : bad('没有心情句', s0.mood);
s0.band?.id ? ok('区间：' + s0.band.zh) : bad('没有区间', '');

console.log('\n[2] 事件改数');

const before = w.snapshot();
const r = w.touch('one', '下班回来那一次');
const after = w.snapshot();
r.ok ? ok('记录成功') : bad('记录失败', r.text);
after.heat < before.heat ? ok(`欲求降了 ${before.heat} → ${after.heat}`) : bad('欲求没降', `${before.heat}→${after.heat}`);
after.satiety > before.satiety ? ok(`满足升了 ${before.satiety} → ${after.satiety}`) : bad('满足没升', '');
after.sinceSatisfiedMin != null ? ok('记住了上次被满足的时间') : bad('没记住时间', '');

console.log('\n[3] 灌满才加留存');

const b2 = w.snapshot();
w.touch('fill', '');
const a2 = w.snapshot();
a2.retention > b2.retention ? ok(`留存 ${b2.retention} → ${a2.retention}`) : bad('留存没加', `${b2.retention}→${a2.retention}`);
a2.overflow !== undefined ? ok('有溢出标记位') : bad('没有溢出标记', '');

const b3 = w.snapshot();
w.touch('tease', '');
const a3 = w.snapshot();
near(a3.retention, b3.retention, 0.01) ? ok('挑逗不会加留存') : bad('挑逗改了留存', `${b3.retention}→${a3.retention}`);

// 2026-11-22 改过方向：「被撩」是撩起来没给，欲求该涨
w.tune({ heat: 40, satiety: 20 });
const h0 = w.read().heat;
w.touch('tease', '被撩了一句');
const h1 = w.read().heat;
h1 > h0
  ? ok(`被撩会让欲求往上走 ${Math.round(h0)} → ${Math.round(h1)}`)
  : bad('被撩没让欲求涨', `${h0}→${h1}`);
w.touch('spark', '撩到一次');
ok(`「撩到一次」是另一档，欲求 ${Math.round(h1)} → ${Math.round(w.read().heat)}`);

console.log('\n[4] 时间推进（拨表）');

// 手动把 lastTickAt 往回拨 10 小时，看它有没有算
const raw = w.read();
raw.lastTickAt = new Date(Date.now() - 10 * 3600000).toISOString();
raw.heat = 20;
raw.satiety = 60;
raw.retention = 50;
w.write(raw);

const t1 = w.snapshot();
t1.heat > 20 ? ok(`10 小时后欲求 20 → ${t1.heat}`) : bad('欲求没涨', String(t1.heat));
t1.satiety < 60 ? ok(`满足衰减 60 → ${t1.satiety}`) : bad('满足没掉', String(t1.satiety));
t1.retention < 50 ? ok(`留存吸收 50 → ${t1.retention}`) : bad('留存没吸收', String(t1.retention));

console.log('\n[5] 从笔记认经历');

const notes = join(DATA, 'notes');
mkdirSync(notes, { recursive: true });
writeFileSync(
  join(notes, '2026-11-21.md'),
  [
    '# 11月21日',
    '今天他回来得很晚，抱着我亲了一下就不肯放。',
    '后来做到腿软，还灌满了，我一句话都说不出来。',
    '第二天早上翻笔记，句子都写不利索。',
  ].join('\n'),
  'utf-8',
);

// 造一份假聊天记录，别读她真实的会话
const chatLog = join(DATA, 'session-main.jsonl');
writeFileSync(
  chatLog,
  [
    JSON.stringify({ version: 2, item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '今天想你了，亲了一下就不肯放' }] }, context: { ts: new Date().toISOString() } }),
    // 真实聊天记录里，机主那句话是带 `[私聊 20:41]` 标记的。
  // 2026-11-22 之后 textsOf 只收带这种标记的行（不然工具输出、DSH 的回复都会混进来），
  // 所以这条假数据也得照真实格式写。
  JSON.stringify({ version: 2, item: { type: 'function_call_output', output: '[私聊 20:41] Partner(1000000000): 后来做到腿软，还灌满了' }, context: { ts: new Date().toISOString() } }),
    JSON.stringify({ version: 2, item: { type: 'message', role: 'system', content: [{ type: 'input_text', text: '系统专用串-xq9 灌满了' }] }, context: { ts: new Date().toISOString() } }),
  ].join(String.fromCharCode(10)),
  'utf-8',
);
const w2 = new DesireWorld({ dataDir: join(DATA, 'w2'), cfg: { workspace: DATA, chatLog } });
await w2.start({});
const dry = await w2.rememberFromNotes({ days: 3, dryRun: true });
/认出 \d+ 条/.test(dry) ? ok('dryRun 认出：' + dry.split('\n')[0]) : bad('dryRun 没认出来', dry);
w2.read().events.length === 0 ? ok('dryRun 没写进档案') : bad('dryRun 却写了', '');

const real = await w2.rememberFromNotes({ days: 3 });
w2.read().events.length > 0 ? ok(`真记了 ${w2.read().events.length} 条`) : bad('没记进去', real);

// 只读 chat 源：应该能认出聊天里那句「坐了一下午」，但 system 那条不该被算
const w3 = new DesireWorld({ dataDir: join(DATA, 'w3'), cfg: { workspace: DATA, chatLog } });
await w3.start({});
const chatOnly = await w3.rememberFromNotes({ days: 3, source: 'chat', dryRun: true });
/来源：chat/.test(chatOnly) ? ok('可以用 source=chat 单独读聊天') : bad('source=chat 不生效', chatOnly);
/亲了一下|灌满|腿软/.test(chatOnly) ? ok('从聊天里认出了内容') : bad('聊天里什么都没认出来', chatOnly);
/xq9/.test(chatOnly) ? bad('把 system 那条也算进来了', chatOnly) : ok('system 条目被挡掉了');

console.log('\n[6] 面板会读的那份快照');

const snap = w2.snapshot();
const need = ['heat', 'satiety', 'retention', 'sensitivity', 'band', 'mood', 'recent', 'rates'];
const miss = need.filter((k) => snap[k] === undefined);
miss.length === 0 ? ok('字段齐：' + need.join(', ')) : bad('缺字段', miss.join(','));

const inv = await w2.invoke('desire', 'state');
inv?.heat !== undefined ? ok('invoke(state) 通') : bad('invoke 不对', JSON.stringify(inv).slice(0, 80));

console.log('\n[7] 工具表');

const names = w2.tools().map((t) => t.name);
for (const want of ['desire_status', 'desire_touch', 'desire_remember', 'desire_tune']) {
  names.includes(want) ? ok(want + ' 在') : bad(want + ' 不在', names.join(','));
}
const txt = await w2.tools().find((t) => t.name === 'desire_status').handler({});
/欲求 \d+/.test(txt) ? ok('desire_status 出中文回执') : bad('回执不对', txt.slice(0, 60));

try {
  rmSync(DATA, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
