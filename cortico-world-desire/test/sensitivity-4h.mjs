/**
 * 敏感度：存量模型（进入想要自然涨、平静时退、事件叠一下）
 *   node test/sensitivity-4h.mjs
 *
 * 2026-11-23 机主的改法，两次迭代后定型：
 *   ① 一次灌满后，4 小时内自然衰减回 1 倍（原来挂 72 小时，长期封顶 ×1.5）；
 *   ② 欲求进「想要」（≥45）时**自然涨** 5/时 —— 身体在那个状态里本来就更容易敏感；
 *   ③ 平静时比例衰减，4 小时归零；
 *   ④ 事件（灌满/到了…）发生时再叠一下，且只有当时已经在想要里才叠。
 *
 * 系数 10：灌满 50、到了 30，所以「到了 + 灌满」= 80（×1.40）。
 */
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const W = Object.values(mod).find((v) => typeof v === 'function' && v.prototype && v.prototype.touch);

const dir = mkdtempSync(join(tmpdir(), 'desire-sens-'));
const mk = () =>
  new W({
    dataDir: join(dir, 'd' + Math.random().toString(36).slice(2)),
    cfg: { sensRisePerHour: 5, sensFallHours: 4, sleepPauseEnabled: false, chatLog: join(dir, 'none.jsonl') },
  });

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const band = (v) => '×' + (1 + v / 200).toFixed(2);
const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();

console.log('\n[1] 碰一下给多少（系数 10）');

let w = mk();
w.tune({ heat: 60, satiety: 0 });
w.touch('fill', 'test');
let s = w.snapshot();
Math.abs(s.sensitivity - 50) <= 2 ? ok(`灌满 → ${s.sensitivity.toFixed(0)}（${band(s.sensitivity)}）`) : bad('不是 50', String(s.sensitivity));

w = mk();
w.tune({ heat: 60, satiety: 0 });
w.touch('one', 'test');
s = w.snapshot();
Math.abs(s.sensitivity - 30) <= 2 ? ok(`到了 → ${s.sensitivity.toFixed(0)}`) : bad('不是 30', String(s.sensitivity));

console.log('\n[2] 「到了 + 灌满」同一口气 = 80');

w = mk();
w.tune({ heat: 60, satiety: 0 });
w.touch('one', 'test');
w.touch('fill', 'test');
s = w.snapshot();
Math.abs(s.sensitivity - 80) <= 3 ? ok(`合计 ${s.sensitivity.toFixed(0)} → ${band(s.sensitivity)}`) : bad('不对', String(s.sensitivity));
s.sensitivity < 100 ? ok('没直接封顶') : bad('一上来就满', '');

console.log('\n[3] 进「想要」自然涨（不碰也会涨）');

w = mk();
let st = w.read();
st.heat = 50;
st.satiety = 0;
st.sensitivity = 0;
st.lastTickAt = hoursAgo(4);
w.write(st);
const t = w.tick();
Math.abs(t.sensitivity - 20) <= 2
  ? ok(`欲求 50 放 4 小时 → ${t.sensitivity.toFixed(0)}（5/时 × 4）`)
  : bad('自然涨不对', String(t.sensitivity));

console.log('\n[4] 平静时不涨，按比例退');

w = mk();
st = w.read();
st.heat = 20;
st.satiety = 60;
st.sensitivity = 80;
st.lastTickAt = hoursAgo(2);
w.write(st);
const t2 = w.tick();
// 比例衰减：80 × (1 - 2/4) = 40
Math.abs(t2.sensitivity - 40) <= 3
  ? ok(`平静 2 小时 → ${t2.sensitivity.toFixed(0)}（80 减半）`)
  : bad('衰减不对', String(t2.sensitivity));
t2.sensitivity < 80 ? ok('确实在退') : bad('没退', '');

console.log('\n[5] 4 小时退干净');

w = mk();
st = w.read();
st.heat = 10;
st.satiety = 80;
st.sensitivity = 100;
st.lastTickAt = hoursAgo(4);
w.write(st);
const t3 = w.tick();
t3.sensitivity <= 2 ? ok(`4 小时 → ${t3.sensitivity.toFixed(0)}（归零）`) : bad('没归零', String(t3.sensitivity));

console.log('\n[6] 平静时被碰，身体不记');

w = mk();
w.tune({ heat: 30, satiety: 60 });
w.touch('fill', 'test');
st = w.read();
const last = st.events[st.events.length - 1];
last.sensAdd === 0 ? ok('平静时灌满 → sensAdd 0') : bad('记了', String(last.sensAdd));
w.snapshot().sensitivity < 5 ? ok('敏感度没涨') : bad('涨了', String(w.snapshot().sensitivity));

console.log('\n[7] 封顶 ×1.5');

w = mk();
st = w.read();
st.heat = 90;
st.satiety = 0;
st.sensitivity = 100;
st.lastTickAt = hoursAgo(1);
w.write(st);
w.tick().sensitivity === 100 ? ok('上限仍是 100（×1.50）') : bad('上限不对', '');

console.log('\n[8] 自己解决 +20');

w = mk();
w.tune({ heat: 60, satiety: 0 });
w.selfRelieve('test');
s = w.snapshot();
Math.abs(s.sensitivity - 20) <= 2 ? ok(`自己弄 → ${s.sensitivity.toFixed(0)}`) : bad('不是 20', String(s.sensitivity));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
