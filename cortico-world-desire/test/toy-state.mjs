/**
 * 连接状态要「说实话」：设备关机了就不能显示「连着」
 *   node test/toy-state.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'desire-toystate-' + Date.now());
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

const mk = (name) =>
  new DesireWorld({
    dataDir: join(dir, name),
    cfg: { toyStatePath: toyState, toyPingPath: toyPing },
  });

const minsAgo = (m) => new Date(Date.now() - m * 60000).toISOString();

console.log('\n[1] 从来没查过 → 不知道，不能编「连着」');

writeFileSync(toyState, JSON.stringify({ pattern: 1, level: 4, stopped: true }), 'utf-8');
try {
  rmSync(toyPing, { force: true });
} catch {}
const w1 = mk('a');
await w1.start({});
const s1 = w1.readToy();
s1.connected === null ? ok('connected = null（不知道）') : bad('不该有值', String(s1.connected));

console.log('\n[2] 三小时前查过「连上了」，但设备早关了 → 仍然是不知道');

writeFileSync(toyPing, JSON.stringify({ ok: true, at: minsAgo(180) }), 'utf-8');
const w2 = mk('b');
await w2.start({});
const s2 = w2.readToy();
s2.connected === null ? ok('过期结果不当真：connected = null') : bad('还在说连着', String(s2.connected));
s2.pingAgeMin === 180 ? ok('带着「上次查是 180 分钟前」') : bad('年龄不对', String(s2.pingAgeMin));
s2.connectedFresh === false ? ok('标成不新鲜') : bad('没标', '');

console.log('\n[3] 刚刚查过、连不上 → 明确说连不上');

writeFileSync(toyPing, JSON.stringify({ ok: false, kind: 'not-found', at: minsAgo(2) }), 'utf-8');
const w3 = mk('c');
await w3.start({});
const s3 = w3.readToy();
s3.connected === false ? ok('connected = false（连不上）') : bad('没说连不上', String(s3.connected));
s3.connectedFresh === true ? ok('是新鲜结果') : bad('', '');

console.log('\n[4] 刚刚查过、连上了 → 才敢说连着');

writeFileSync(toyPing, JSON.stringify({ ok: true, at: minsAgo(1) }), 'utf-8');
const w4 = mk('d');
await w4.start({});
const s4 = w4.readToy();
s4.connected === true ? ok('connected = true') : bad('', String(s4.connected));

console.log('\n[5] 正在震的时候，running 优先，不受 ping 影响');

writeFileSync(toyState, JSON.stringify({ pattern: 2, level: 6, stopped: false }), 'utf-8');
const s5 = w4.readToy();
s5.running === true && s5.pattern === 2 && s5.level === 6 ? ok('running 判对了') : bad('', JSON.stringify(s5));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
