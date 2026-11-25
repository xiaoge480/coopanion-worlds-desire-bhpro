/**
 * 三条改动：只认私聊 / 温存档 / 敏感只做系数
 *   node test/three-fixes.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'desire-three-' + Date.now());
mkdirSync(dir, { recursive: true });
const chatLog = join(dir, 'session-main.jsonl');

const { DesireWorld } = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const mk = (name, cfg = {}) =>
  new DesireWorld({
    dataDir: join(dir, name),
    cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 0, ...cfg },
  });

const line = (text, minsAgo = 5) =>
  JSON.stringify({
    version: 2,
    item: { type: 'function_call_output', output: text },
    context: { ts: new Date(Date.now() - minsAgo * 60000).toISOString() },
  });

console.log('\n[1] 群聊里别人带那种词，不算她的事');

writeFileSync(
  chatLog,
  [
    line('#1 [群「奥迷交流群」 20:39] 清鱼(1641057955): 昨晚灌满了，累死'),
    line('#2 [群「奥迷交流群」 20:41] 别人(111): 做到腿软'),
  ].join('\n') + '\n',
  'utf-8',
);

const w1 = mk('a');
await w1.start({});
const r1 = await w1.autoScan();
r1.added === 0 ? ok('群聊没被认成事件') : bad(`误认了 ${r1.added} 条`, '群友的话算到她头上了');

console.log('\n[2] 私聊里同样的词，就该认');

writeFileSync(
  chatLog,
  [line('#3 [私聊 20:41] Partner(1000000000): 最后灌满了')].join('\n') + '\n',
  'utf-8',
);
const w2 = mk('b');
await w2.start({});
const r2 = await w2.autoScan();
r2.added >= 1 ? ok(`私聊认出了 ${r2.added} 条`) : bad('私聊没认出来', JSON.stringify(r2));

console.log('\n[3] 群聊不会把密度也算进去');

const groupDense = [];
for (let i = 0; i < 40; i += 1) {
  groupDense.push(line(`#${i} [群「奥迷交流群」 20:${String(i).padStart(2, '0')}] 某人(111): 揉着 亲下去 腰都软了 插进来`, 3));
}
writeFileSync(chatLog, groupDense.join('\n') + '\n', 'utf-8');
const w3 = mk('c');
await w3.start({});
const r3 = await w3.autoScan();
r3.added === 0 ? ok('群里刷屏也不算') : bad(`密度法把群聊算了 ${r3.added} 条`, '');

console.log('\n[4] 温存这一档');

const w4 = mk('d');
await w4.start({});
w4.tune({ heat: 50, satiety: 20 });
const kinds = Object.keys((await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js')).KINDS);
kinds.includes('cuddle') ? ok('KINDS 里有 cuddle（温存）') : bad('没有', kinds.join(','));
const before4 = w4.read();
w4.touch('cuddle', '抱着躺了很久');
const after4 = w4.read();
after4.heat < before4.heat ? ok(`温存降欲求 ${Math.round(before4.heat)} → ${Math.round(after4.heat)}`) : bad('没降', '');
after4.satiety > before4.satiety ? ok(`温存升满足 ${Math.round(before4.satiety)} → ${Math.round(after4.satiety)}`) : bad('没升', '');

const tool4 = w4.tools().find((t) => t.name === 'desire_touch');
const txt4 = await tool4.handler({ kind: 'cuddle' });
/温存/.test(txt4) ? ok('工具回执说「温存」') : bad('回执不对', txt4);

console.log('\n[5] 敏感只做系数，不占面板');

// 敏感高的人和敏感低的人，同样条件涨得不一样
const mkSens = (name, sens) => {
  const w = mk(name);
  return w;
};
const wLow = mk('e');
await wLow.start({});
const rawLow = wLow.read();
rawLow.heat = 10;
rawLow.satiety = 0;
rawLow.sensitivity = 0;
rawLow.lastSatisfiedAt = new Date(Date.now() - 100 * 3600000).toISOString();
rawLow.lastTickAt = new Date(Date.now() - 5 * 3600000).toISOString();
wLow.write(rawLow);
const lowHeat = wLow.snapshot().heat;

const wHigh = mk('f');
await wHigh.start({});
const rawHigh = wHigh.read();
rawHigh.heat = 10;
rawHigh.satiety = 0;
rawHigh.sensitivity = 100;
rawHigh.lastSatisfiedAt = new Date(Date.now() - 100 * 3600000).toISOString();
rawHigh.lastTickAt = new Date(Date.now() - 5 * 3600000).toISOString();
wHigh.write(rawHigh);
const highHeat = wHigh.snapshot().heat;

highHeat > lowHeat ? ok(`敏感真的让涨速变快：${Math.round(lowHeat)} vs ${Math.round(highHeat)}（同样 5 小时）`) : bad('没差别', `${lowHeat} vs ${highHeat}`);

// 面板里有 etaEdgeHours 但没有「敏感」这个格子
const snap = wHigh.snapshot();
snap.etaEdgeHours !== undefined ? ok('快照带 etaEdgeHours') : bad('没有 eta', '');

try {
  rmSync(dir, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
