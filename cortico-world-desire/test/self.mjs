/**
 * 自我满足泻火：涨得难受 + 他半天没说话 → 她自己先降一下温
 *   node test/self.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'desire-self-' + Date.now());
mkdirSync(dir, { recursive: true });
const chatLog = join(dir, 'session-main.jsonl');

const { DesireWorld } = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const hisLine = (minsAgo) =>
  JSON.stringify({
    version: 2,
    item: { type: 'function_call_output', output: `[私聊 20:00] Partner(1000000000): 在忙，等下找你` },
    context: { ts: new Date(Date.now() - minsAgo * 60000).toISOString() },
  });

const mk = (name, cfg = {}) =>
  new DesireWorld({
    dataDir: join(dir, name),
    cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 0, ...cfg },
  });

console.log('\n[1] 他刚说过话 → 不触发');

writeFileSync(chatLog, hisLine(10) + '\n', 'utf-8');
const w1 = mk('a');
await w1.start({});
w1.tune({ heat: 90 });
const c1 = w1.selfReliefCheck();
c1.due === false && /还说过话/.test(c1.reason) ? ok('不触发：' + c1.reason) : bad('不该触发', JSON.stringify(c1));

console.log('\n[2] 欲求高 + 他 2 小时没说话 → 该自己降一下');

writeFileSync(chatLog, hisLine(120) + '\n', 'utf-8');
const w2 = mk('b');
await w2.start({});
w2.tune({ heat: 90 });
const c2 = w2.selfReliefCheck();
c2.due === true ? ok('触发：' + c2.reason) : bad('该触发没触发', JSON.stringify(c2));

const before2 = w2.read().heat;
const r2 = w2.selfRelieve('等不到人');
const after2 = w2.read();
r2.ok ? ok('降下来了：欲求 ' + Math.round(before2) + ' → ' + Math.round(after2.heat)) : bad('没降', r2.text);
after2.heat < before2 ? ok('欲求确实降了 −' + Math.round(before2 - after2.heat)) : bad('没降', '');
after2.satiety > 0 ? ok('满足度上去了 +' + Math.round(after2.satiety)) : bad('满足没动', '');
after2.events.some((e) => e.kind === 'self') ? ok('时间线上记了一条「自己弄了一下」') : bad('没记', '');

console.log('\n[3] 冷却期内不给再弄');

const r3 = w2.selfRelieve('再来一次');
r3.ok === false ? ok('被拒：' + r3.text) : bad('冷却没生效', '会变成刷数值');
const c3 = w2.selfReliefCheck();
c3.due === false && /刚弄过/.test(c3.reason) ? ok('判据也说还不行') : bad('判据没说', JSON.stringify(c3));

console.log('\n[4] 他回来了就停手');

writeFileSync(chatLog, hisLine(5) + '\n', 'utf-8');
const w4 = mk('d');
await w4.start({});
w4.tune({ heat: 95 });
const c4 = w4.selfReliefCheck();
c4.due === false ? ok('他一句「等下找你」，就不自己弄了') : bad('还在弄', JSON.stringify(c4));

console.log('\n[5] 欲求不够高也不弄');

writeFileSync(chatLog, hisLine(200) + '\n', 'utf-8');
const w5 = mk('e');
await w5.start({});
w5.tune({ heat: 40 });
const c5 = w5.selfReliefCheck();
c5.due === false && /还没到/.test(c5.reason) ? ok('不弄：' + c5.reason) : bad('不足也弄了', JSON.stringify(c5));

console.log('\n[6] 关掉开关就完全不自动');

const w6 = mk('f', { selfReliefEnabled: false });
await w6.start({});
w6.tune({ heat: 98 });
const c6 = w6.selfReliefCheck();
c6.due === false && /关着/.test(c6.reason) ? ok('关掉后不触发') : bad('关了还触发', JSON.stringify(c6));

console.log('\n[7] autoScan 里会自动看这一眼');

writeFileSync(chatLog, hisLine(180) + '\n', 'utf-8');
const w7 = mk('g');
await w7.start({});
w7.tune({ heat: 88 });
const r7 = await w7.autoScan();
r7.selfRelieved === true ? ok('autoScan 自己触发了一次') : bad('没触发', JSON.stringify(r7));
w7.read().events.some((e) => e.kind === 'self') ? ok('档案里有记录') : bad('没记录', '');

console.log('\n[8] 面板 invoke 也能问、也能让她弄');

const decl = w2.webUi();
const sc = await decl.invoke('desire', 'selfCheck', []);
sc && typeof sc.due === 'boolean' ? ok('selfCheck 可调用：' + sc.reason) : bad('调不通', JSON.stringify(sc));

try {
  rmSync(dir, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
