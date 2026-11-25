/**
 * 外设联动自测：造两份假状态文件，看这边读不读得到、会不会影响欲求。
 *   node test/toy-link.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'desire-toy-' + Date.now());
mkdirSync(dir, { recursive: true });
const toyState = join(dir, 'toy-state.json');
const toyPing = join(dir, 'toy-ping.json');

const { DesireWorld } = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const mk = () =>
  new DesireWorld({
    dataDir: join(dir, 'data'),
    cfg: { toyStatePath: toyState, toyPingPath: toyPing, toyBoostPerHour: 2 },
  });

console.log('\n[1] 没有外设文件时不炸');

const w0 = mk();
await w0.start({});
const s0 = w0.snapshot();
s0.toy === null ? ok('读不到就返回 null') : bad('应该返回 null', JSON.stringify(s0.toy));

console.log('\n[2] 设备开着');

writeFileSync(
  toyState,
  JSON.stringify({ pattern: 2, level: 6, stopped: false, updatedAt: new Date().toISOString() }),
  'utf-8',
);
writeFileSync(toyPing, JSON.stringify({ ok: true, at: new Date().toISOString() }), 'utf-8');

const w1 = mk();
await w1.start({});
const s1 = w1.snapshot();
s1.toy?.running === true ? ok('认得出在震') : bad('没认出在震', JSON.stringify(s1.toy));
s1.toy?.pattern === 2 && s1.toy?.level === 6 ? ok('花样 2、强度 6 读对了') : bad('数值不对', JSON.stringify(s1.toy));
s1.toy?.connected === true ? ok('连接状态也带上了') : bad('没有连接状态', '');

const txt = await w1.tools().find((t) => t.name === 'desire_status').handler({});
/我带着 · 花样 2 · 强度 6/.test(txt) ? ok('desire_status 会报我带着') : bad('status 没报', txt);

console.log('\n[3] 开着的时候欲求涨得更快');

// 两份档案，其他条件一样，一份外设在震一份不在
// 两份实例要各读各的文件：readToy() 是实时读盘的，共用一份就分不开了
const mkWithToy = (running) => {
  const own = join(dir, running ? 'toy-on.json' : 'toy-off.json');
  writeFileSync(
    own,
    JSON.stringify({ pattern: 1, level: running ? 8 : 0, stopped: !running }),
    'utf-8',
  );
  const w = new DesireWorld({
    dataDir: join(dir, running ? 'on' : 'off'),
    cfg: { toyStatePath: own, toyPingPath: toyPing, toyBoostPerHour: 2, heatRatePerHour: 1 },
  });
  return w;
};

const wOn = mkWithToy(true);
const wOff = mkWithToy(false);
await wOn.start({});
await wOff.start({});

// 两个都从同一个起点、往回拨 10 小时
const seed = (w) => {
  const raw = w.read();
  raw.heat = 10;
  raw.satiety = 0;
  raw.retention = 0;
  raw.lastSatisfiedAt = new Date(Date.now() - 999 * 3600000).toISOString();
  raw.lastTickAt = new Date(Date.now() - 5 * 3600000).toISOString();
  w.write(raw);
};
seed(wOn);
seed(wOff);

const on = wOn.snapshot().heat;
const off = wOff.snapshot().heat;
on > off ? ok(`设备在震那一份涨得更多：${on} vs ${off}（多 ${Math.round((on - off) * 10) / 10}）`) : bad('没有差别', `${on} vs ${off}`);

console.log('\n[4] 停下之后就不算了');

writeFileSync(toyState, JSON.stringify({ pattern: 1, level: 0, stopped: true }), 'utf-8');
const s2 = w1.snapshot();
s2.toy?.running === false ? ok('停止状态认得出来') : bad('没认出停止', JSON.stringify(s2.toy));

console.log('\n[5] 假设备会被标出来');

writeFileSync(toyState, JSON.stringify({ pattern: 1, level: 3, stopped: false, mock: true }), 'utf-8');
const s3 = w1.snapshot();
s3.toy?.mock === true ? ok('标了假设备') : bad('没标', JSON.stringify(s3.toy));
const t3 = await w1.tools().find((t) => t.name === 'desire_status').handler({});
/假设备/.test(t3) ? ok('回执里也说了是假设备') : bad('回执没提', t3);

try {
  rmSync(dir, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
