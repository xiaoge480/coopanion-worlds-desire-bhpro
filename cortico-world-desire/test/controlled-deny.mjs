/**
 * 她带着、自己收住 —— 欲求反而涨
 *   node test/controlled-deny.mjs
 *
 * 2026-11-24 机主定的：
 * 外设不是她自己弄时的小玩具，是**两个人做的时候她主导**的工具。
 * 主导意味着「什么时候让自己到」由她定，所以会出现「带一阵、然后收住」。
 * 那种收住不会让人平静，反而更勾——吊着的比满足了更磨人。
 *
 * 判据只用事实：
 *   上一轮 running、这一轮不 running，且开始带之后没有满足事件 → 算收住。
 * 不判「她主动开的」——开关不一定归她。
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

function makeWorld(toyState) {
  const dir = mkdtempSync(join(tmpdir(), 'desire-deny-'));
  const toyPath = join(dir, 'toy-state.json');
  writeFileSync(toyPath, JSON.stringify(toyState), 'utf-8');
  const w = new W({ dataDir: dir, cfg: { toyStatePath: toyPath, toyPingPath: join(dir, 'none.json') } });
  return w;
}

console.log('\n[1] 带着 → 收住 → 没到：欲求涨');

{
  const w = makeWorld({ stopped: true, level: 0 });
  const st = w.read();
  st.heat = 30;
  st.satiety = 50;
  st.lastSatisfiedAt = new Date(Date.now() - 3 * 3600_000).toISOString();
  // 上一轮在带，这一轮停了
  st.toyRunningPrev = true;
  st.toyStartedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  w.write(st);

  const before = w.read().heat;
  w.tick();
  const after = w.read().heat;

  after > before ? ok(`欲求 ${before.toFixed(1)} → ${after.toFixed(1)}（涨了）`) : bad('没涨', `${before} → ${after}`);
  (w.read().controlledDenyCount || 0) === 1 ? ok('记了一次「收住」') : bad('没记', String(w.read().controlledDenyCount));
}

console.log('\n[2] 带着 → 到了 → 收住：不算，不加');

{
  const w = makeWorld({ stopped: true, level: 0 });
  const st = w.read();
  st.heat = 30;
  st.satiety = 50;
  st.toyStartedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  // 开始带之后到过
  st.lastSatisfiedAt = new Date(Date.now() - 5 * 60_000).toISOString();
  st.toyRunningPrev = true;
  w.write(st);

  const before = w.read().heat;
  w.tick();
  const after = w.read().heat;

  // 只是没有那 +8，自然衰减/增长照常；关键是没记 count
  (w.read().controlledDenyCount || 0) === 0 ? ok('没算成收住') : bad('误算了', String(w.read().controlledDenyCount));
  after - before < 8 ? ok(`欲求没跳 ${before.toFixed(1)} → ${after.toFixed(1)}`) : bad('还是加了', `${before} → ${after}`);
}

console.log('\n[3] 一直都在带：不触发');

{
  const w = makeWorld({ stopped: false, level: 6, pattern: 2 });
  const st = w.read();
  st.heat = 30;
  st.toyRunningPrev = true;
  st.toyStartedAt = new Date(Date.now() - 20 * 60_000).toISOString();
  w.write(st);

  w.tick();
  (w.read().controlledDenyCount || 0) === 0 ? ok('一直带着不算收住') : bad('误算', String(w.read().controlledDenyCount));
}

console.log('\n[4] 第一次见到在带：只记开始时间，不算');

{
  const w = makeWorld({ stopped: false, level: 5, pattern: 1 });
  const st = w.read();
  st.heat = 30;
  st.toyRunningPrev = undefined;
  w.write(st);

  w.tick();
  const s = w.read();
  (s.controlledDenyCount || 0) === 0 ? ok('没误算') : bad('误算', String(s.controlledDenyCount));
  s.toyStartedAt ? ok('记下了开始时间') : bad('没记开始时间', 'undefined');
}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
