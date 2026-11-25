/**
 * 假设备不计入欲求档案
 *   node test/mock-not-counted.mjs
 *
 * 2026-11-24 机主定：bhpro 配置里那个「假设备（调试用）」只往内存里记、
 * 不碰蓝牙，**不能影响欲求档案**。否则调一下试流程，她就凭空"被带着"，欲求白涨。
 *
 * 要验的是三处：
 *   ① toyBoostPerHour（带的时候额外涨）
 *   ② 收住判定（带了又停、没到 → +8）
 *   ③ 面板/status 的「（假设备）」标注还在，只是不影响数
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const W = mod.DesireWorld;

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

function world(toyState) {
  const dir = mkdtempSync(join(tmpdir(), 'desire-mock-'));
  const toyPath = join(dir, 'toy-state.json');
  writeFileSync(toyPath, JSON.stringify(toyState), 'utf-8');
  return new W({ dataDir: dir, cfg: { toyStatePath: toyPath, toyPingPath: join(dir, 'n.json') } });
}

/** 让 tick 真的走一遍结算（lastTickAt 拨到一小时前） */
function tickWithHour(w) {
  const st = w.read();
  st.lastTickAt = new Date(Date.now() - 3600_000).toISOString();
  w.write(st);
  w.tick();
  return w.read();
}

console.log('\n[1] 假设备在带：欲求不额外涨');

{
  const real = world({ stopped: false, level: 6, pattern: 1 });
  const mock = world({ stopped: false, level: 6, pattern: 1, mock: true });

  for (const w of [real, mock]) {
    const st = w.read();
    st.heat = 20;
    st.satiety = 50;
    st.sleepPauseEnabled = false;
    st.wakeAt = null;
    w.write(st);
  }

  const a = tickWithHour(real);
  const b = tickWithHour(mock);

  // 真设备应该比假设备涨得多（多出 toyBoostPerHour = 2）
  a.heat > b.heat
    ? ok(`真设备 ${a.heat.toFixed(2)} > 假设备 ${b.heat.toFixed(2)}`)
    : bad('假设备也涨了', `真 ${a.heat} / 假 ${b.heat}`);

  Math.abs(a.heat - b.heat - 2) < 0.05
    ? ok(`差值正好是 toyBoostPerHour（${(a.heat - b.heat).toFixed(2)}）`)
    : bad('差值不对', (a.heat - b.heat).toFixed(2));
}

console.log('\n[2] 假设备带着又停、没到：不算「收住」');

{
  const w = world({ stopped: true, level: 0, mock: true });
  const st = w.read();
  st.heat = 30;
  st.toyRunningPrev = true;
  st.toyWasMockPrev = true;   // ← 上一轮就是假设备
  st.toyStartedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  st.lastSatisfiedAt = new Date(Date.now() - 3 * 3600_000).toISOString();
  w.write(st);

  w.tick();
  const s = w.read();
  (s.controlledDenyCount || 0) === 0 ? ok('没算成收住') : bad('误算了', String(s.controlledDenyCount));
  s.heat < 32 ? ok(`欲求没跳（${s.heat.toFixed(1)}）`) : bad('还是加了', String(s.heat));
}

console.log('\n[3] 真设备同样情况：算「收住」（对照组）');

{
  const w = world({ stopped: true, level: 0 });
  const st = w.read();
  st.heat = 30;
  st.toyRunningPrev = true;
  st.toyStartedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  st.lastSatisfiedAt = new Date(Date.now() - 3 * 3600_000).toISOString();
  w.write(st);

  w.tick();
  const s = w.read();
  (s.controlledDenyCount || 0) === 1 ? ok('算了收住') : bad('没算', String(s.controlledDenyCount));
}

console.log('\n[4] 假设备的状态在面板/status 里还看得见（只是不影响数）');

{
  const w = world({ stopped: false, level: 4, pattern: 2, mock: true });
  const s = w.snapshot();
  s.toy && s.toy.mock === true ? ok('snapshot 里 mock=true，界面能标「假设备」') : bad('mock 标记丢了', JSON.stringify(s.toy));
}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
