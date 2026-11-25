/**
 * 撤销一条误记事件的影响（不做全量重算）
 *   node test/undo-event.mjs dryRun
 *
 * 2026-11-22 第六次翻车：`15:31 灌满` 那条是我回复里顶格写的示例（`[私聊 20:41]`），
 * 被当成真聊天记了一次灌满（欲求 -38、满足 +59）。
 *
 * 这里只把它的影响**减回去**，不重算全部 ——
 * 重算要靠一个初值（之前拿 60/0 当起点），推出来的绝对数不可信；
 * 撤销用的是面板上实际发生的差值，更接近真相。
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const STATE = 'D:/Applications/Coopanion/data/home/companion/data/worlds/desire/state.json';
const dry = process.argv[2] === 'dryRun';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.isMetaTalk);

const st = JSON.parse(readFileSync(STATE, 'utf-8'));
const events = Array.isArray(st.events) ? st.events : [];

// KINDS 表
const KINDS = (() => {
  const src = readFileSync('C:/Users/User/.dsh/cortico-world-desire/src/index.js', 'utf-8');
  const m = src.match(/const KINDS = \{[\s\S]*?\n\};/);
  return new Function(`${m[0]}\nreturn KINDS;`)();
})();

const isBad = (e) => {
  const n = String(e?.note ?? '').trim();
  if (!n) return false;
  if (/^(最近\s*[:：]|·\s*\d)/.test(n)) return true;
  if (/\[\d+ new events?\]/.test(n)) return true;
  if (/^\s*(·|✅|❌|✓|✔|\||>|-\s|\*\s)/.test(n)) return true;
  // 顶格 `[私聊` 但没有 `#id` 前缀 → 示例，不是记录
  if (/^\[私聊\s+\d{1,2}:\d{2}\]/.test(n)) return true;
  return Cls.isMetaTalk(n);
};

const drop = events.filter(isBad);
const keep = events.filter((e) => !isBad(e));

console.log(`事件 ${events.length} → 留 ${keep.length}、删 ${drop.length}`);
for (const e of drop) console.log(`   删 ${String(e.at).slice(0, 16)} ${e.kind} ${String(e.note).slice(0, 44)}`);

let heat = Number(st.heat) || 0;
let satiety = Number(st.satiety) || 0;
let retention = Number(st.retention) || 0;
const before = { heat, satiety, retention };

/*
 * 撤销要用**面板上实际发生的差值**，不是 KINDS 里的名义值。
 *
 * fill 名义上是 heatRelief 55 / satGain 60，可那一次 heat 只有 39.6，
 * 被 clamp 到 0 只扣掉了 39.6；面板显示的是「欲求 -38、满足 +59」。
 * 用名义值 55 倒推会多算 17，反而不准。
 *
 * 所以：填面板给的实测差值；没有实测值才退回名义值。
 */
const MEASURED = {
  // 2026-11-22 15:31 那条误记，面板实际显示的变化
  '2026-11-22T07:31': { heat: 38, satiety: 59, retention: 28 },
};

for (const e of drop) {
  const k = KINDS[e.kind];
  if (!k) continue;
  const key = Object.keys(MEASURED).find((t) => String(e.at).startsWith(t));
  const m = key ? MEASURED[key] : null;
  const dHeat = m ? m.heat : Math.max(0, -k.heatRelief);      // heatRelief 是负的才涨
  const dSat = m ? m.satiety : k.satGain;
  const dRet = m ? m.retention : (k.retention || 0);
  heat = Math.min(100, Math.max(0, heat + dHeat));
  satiety = Math.min(100, Math.max(0, satiety - dSat));
  retention = Math.min(100, Math.max(0, retention - dRet));
}

console.log(`\nheat      ${before.heat.toFixed(1)} → ${heat.toFixed(1)}`);
console.log(`satiety   ${before.satiety.toFixed(1)} → ${satiety.toFixed(1)}`);
console.log(`retention ${before.retention.toFixed(1)} → ${retention.toFixed(1)}`);

if (dry) {
  console.log('\n（dryRun，没写文件）');
} else {
  const bak = STATE.replace(/\.json$/, `.bak-undo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`);
  copyFileSync(STATE, bak);
  st.events = keep;
  st.heat = Number(heat.toFixed(2));
  st.satiety = Number(satiety.toFixed(2));
  st.retention = Number(retention.toFixed(2));
  // 那条假的"最近满足时刻"也要退回去：改成真正最后一次 fill 的时间
  const fills = keep.filter((e) => e.kind === 'fill').map((e) => Date.parse(e.at)).filter(Number.isFinite);
  if (fills.length) st.lastSatisfiedAt = new Date(Math.max(...fills)).toISOString();
  writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n', 'utf-8');
  console.log('\n已写回。备份：', bak.split('\\').pop());
  if (st.lastSatisfiedAt) console.log('上次满足改为：', st.lastSatisfiedAt);
}
