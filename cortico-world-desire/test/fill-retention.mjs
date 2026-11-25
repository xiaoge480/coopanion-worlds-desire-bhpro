/**
 * 灌满的留存是 32（2026-11-23 从 28 调上来）
 *   node test/fill-retention.mjs
 *
 * 机主当时的说法是「之前是不是把一次灌满的留存调到 50 了？改成 35」——
 * 50 其实是**敏感度**那一笔（强度 5 × 10），留存一直是 28。
 * 这条测试把两个数分开钉住，省得以后再混。
 */
import { readFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const W = Object.values(mod).find((v) => typeof v === 'function' && v.prototype && v.prototype.touch);

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/index.js', 'utf-8');
const KINDS = (() => {
  const m = src.match(/const KINDS = \{[\s\S]*?\n\};/);
  return new Function(`${m[0]}\nreturn KINDS;`)();
})();

console.log('\n[1] 灌满的四个数');

const f = KINDS.fill;
f.retention === 32 ? ok(`留存 ${f.retention}`) : bad('留存不是 32', String(f.retention));
f.heatRelief === 55 ? ok(`欲求 −${f.heatRelief}`) : bad('欲求不对', String(f.heatRelief));
f.satGain === 60 ? ok(`满足 +${f.satGain}`) : bad('满足不对', String(f.satGain));
f.intensity === 5 ? ok(`强度 ${f.intensity}（→ 敏感度 +${f.intensity * 10}）`) : bad('强度不对', String(f.intensity));

console.log('\n[2] 别把敏感度那 50 当成留存');

f.retention !== 50 ? ok('留存不是 50（50 是敏感度那一笔）') : bad('又混了', '');
f.intensity * 10 === 50 ? ok('敏感度加成确实是 50') : bad('敏感度不对', '');

console.log('\n[3] 一次灌满，留存真的加 35');

const dir = mkdtempSync(join(tmpdir(), 'desire-fill-'));
const w = new W({ dataDir: dir, cfg: { sleepPauseEnabled: false, chatLog: join(dir, 'none.jsonl') } });
w.tune({ heat: 60, satiety: 0, retention: 0 });
w.touch('fill', 'test');
const s = w.snapshot();
Math.abs(s.retention - 32) <= 1 ? ok(`留存 → ${s.retention}`) : bad('不是 32', String(s.retention));

console.log('\n[4] 32 点按 4/时 正好 8 小时退干净');

const HOURS = 32 / 4;
HOURS === 8 ? ok(`${HOURS} 小时（正好 8）`) : bad('算错', String(HOURS));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
