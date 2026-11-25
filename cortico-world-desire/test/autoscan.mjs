/**
 * 自动扫聊天：不用任何人点，聊天里发生了就自己记进去。
 *   node test/autoscan.mjs
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'desire-auto-' + Date.now());
mkdirSync(dir, { recursive: true });
const chatLog = join(dir, 'session-main.jsonl');

const { DesireWorld } = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const line = (text, role = 'user', minsAgo = 0) =>
  JSON.stringify({
    version: 2,
    item: { type: 'message', role, content: [{ type: 'input_text', text }] },
    context: { ts: new Date(Date.now() - minsAgo * 60000).toISOString() },
  });

const mk = (name) =>
  new DesireWorld({
    dataDir: join(dir, name),
    cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 10 },
  });

console.log('\n[1] 聊天里有事，自动扫能认出来');

writeFileSync(chatLog, [line('今天想你了', 'user', 30), line('后来灌满了，腿都软了', 'user', 20)].join('\n') + '\n', 'utf-8');

const w = mk('a');
await w.start({});
const r1 = await w.autoScan();
r1.added >= 1 ? ok(`第一次扫到 ${r1.added} 条`) : bad('一条都没认出来', JSON.stringify(r1));

const st1 = w.read();
st1.events.some((e) => e.kind === 'fill') ? ok('认出了「灌满」') : bad('没认出灌满', '');
st1.lastScanAt ? ok('记下了扫到哪儿（lastScanAt）') : bad('没记 lastScanAt', '下次会重复扫');

console.log('\n[2] 再扫一遍不会重复记');

const before = w.read().events.length;
const r2 = await w.autoScan();
const after = w.read().events.length;
r2.added === 0 ? ok('第二次扫到 0 条新事') : bad(`又记了 ${r2.added} 条`, '说明去重没生效');
after === before ? ok(`事件数没变（${before}）`) : bad('事件数变了', `${before}→${after}`);

console.log('\n[3] 来了新的一句，下次就扫得到');

// 追加一条新的（时间在 lastScanAt 之后）
writeFileSync(
  chatLog,
  readFileSync(chatLog, 'utf-8') + line('刚刚又灌满了', 'user', 0) + '\n',
  'utf-8',
);
const r3 = await w.autoScan();
r3.added >= 1 ? ok(`扫到 ${r3.added} 条新的`) : bad('新的一句没扫到', JSON.stringify(r3));

console.log('\n[4] 句子长得像但不是那回事的，不要乱认');

writeFileSync(chatLog, [line('今天一次搬了三次家', 'user', 0), line('机主亲口说的', 'user', 0)].join('\n') + '\n', 'utf-8');
const w2 = mk('b');
await w2.start({});
const r4 = await w2.autoScan();
r4.added === 0 ? ok('普通句子没被认成事件') : bad(`误认了 ${r4.added} 条`, '严格词不够严');

console.log('\n[5] 没有聊天文件也不炸');

const w3 = new DesireWorld({
  dataDir: join(dir, 'c'),
  cfg: { workspace: join(dir, 'notes'), chatLog: join(dir, 'nope.jsonl'), autoScanMinutes: 10 },
});
await w3.start({});
const r5 = await w3.autoScan();
r5.added === 0 ? ok('读不到就当 0 条，没抛错') : bad('不该有', JSON.stringify(r5));

console.log('\n[6] 定时器起了，stop 会收掉');

const before6 = w._scanTimer ? 'has' : 'none';
before6 === 'has' ? ok('start 之后定时器在跑') : bad('没起定时器', '不会自己扫');
await w.stop();
w._scanTimer === undefined ? ok('stop 之后定时器收掉了') : bad('定时器还在', '会拖着进程');

console.log('\n[7] 关掉自动扫就不起定时器');

const w4 = new DesireWorld({
  dataDir: join(dir, 'd'),
  cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 0 },
});
await w4.start({});
w4._scanTimer === undefined ? ok('autoScanMinutes=0 时不扫') : bad('还是起了', '');
await w4.stop();

try {
  rmSync(dir, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
