/**
 * 把被误记的 fill 清掉，并按真实事件重算 heat / satiety / retention。
 *   node test/recover-heat.mjs dryRun
 *   node test/recover-heat.mjs
 *
 * 2026-11-22 18:0x 机主问「欲求又清零了，这几个小时的进度是不是被清了」——
 * 是。15:07 有一条 `只认私聊 + 认动作词（灌满 / 揉 / 亲 / 腰软…）` 被当成 fill：
 *   heat  -55  → 归零
 *   satiety +60 → 拉到 99
 * 那不是真事，是我们在讨论词表。脚本把这条去掉，再按公式把三数重算回去。
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const STATE = 'D:/Applications/Coopanion/data/home/companion/data/worlds/desire/state.json';
const dry = process.argv[2] === 'dryRun';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.isMetaTalk);

const st = JSON.parse(readFileSync(STATE, 'utf-8'));
const events = Array.isArray(st.events) ? st.events : [];

// ---- 1. events 里再清一遍 ----
const keep = [];
const drop = [];
for (const e of events) {
  const note = String(e?.note ?? '');
  // 我的回复常以这些符号起头（列表项、勾选、竖线），真人记事不会这么写
  const isMyFormat = /^\s*(·|✅|❌|✓|✔|\||>|-\s|\*\s|\d{2}-\d{2}\s+\d{2}:\d{2})/.test(note.trim());
  /*
   * `[私聊 20:41] Partner: …` 这种**没有事件 id 前缀**的 note，是示例、不是真记录。
   * 真聊天长这样：`#-1569091493 [私聊 00:35] Partner(1000000000): …`（带 #id）。
   * 2026-11-22 第六次翻车就是这条：我在回复里顶格写了一行示例，被当成真聊天记了。
   */
  const isBareExample = /^\[私聊\s+\d{1,2}:\d{2}\]/.test(note.trim());
  const isDigest = /^(最近\s*[:：]|·\s*\d)/.test(note.trim()) || /\[\d+ new events?\]/.test(note);
  if (note.trim() && (isDigest || isMyFormat || isBareExample || Cls.isMetaTalk(note))) drop.push(e);
  else keep.push(e);
}

// ---- 2. seenNotes 里也删掉这些（不然它以为"已经记过了"）----
const seen = Array.isArray(st.seenNotes) ? st.seenNotes : [];
const seenKeep = seen.filter((k) => {
  const notePart = String(k).split('|').slice(2).join('|');
  if (!notePart.trim()) return true;
  const isDigest = /^(最近\s*[:：]|·\s*\d)/.test(notePart.trim()) || /\[\d+ new events?\]/.test(notePart);
  return !(isDigest || Cls.isMetaTalk(notePart));
});

// ---- 3. 按公式重算 ----
// ---- 2.5 同一次事件被记了好几遍：按 note 里的 `[私聊 HH:MM]` 去重，只留最早 ----
// 2026-11-22 晚：同一次 00:35 的灌满被记了 4 条（原始那条 + 我三次引用它），
// retention 直接叠到 100。同一次就该只有一条。
const seenSlot = new Set();
const dedup = [];
for (const e of [...keep].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
  const note = String(e.note ?? '');
  const slot = /\[私聊\s+(\d{1,2}:\d{2})\]/.exec(note);
  if (slot) {
    const km = /\[私聊\s+\d{1,2}:\d{2}\]\s*([^:：]{1,20})[:：]/.exec(note);
    const key = `${e.kind}|${slot[1]}|${(km?.[1] ?? '').trim()}`;
    if (seenSlot.has(key)) continue;
    seenSlot.add(key);
  }
  dedup.push(e);
}
if (dedup.length !== keep.length) {
  console.log(`同一次事件重复的 ${keep.length - dedup.length} 条已被去掉`);
  keep.length = 0;
  keep.push(...dedup);
}

const cfg = st.config ?? {};
const HEAT_RATE = Number(cfg.heatRatePerHour ?? 6);
const SAT_DECAY = Number(cfg.satietyDecayPerHour ?? 10);
const ABSORB = Number(cfg.absorbPerHour ?? 4);
const FILL = { heatRelief: 55, satGain: 60, retention: 28 };

const now = Date.now();
const sorted = [...keep].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

let heat = 0;
let satiety = 60;
let retention = 0;
let lastSat = null;
let cursor = null;

const apply = (kind) => {
  if (kind === 'fill') {
    heat = Math.max(0, heat - FILL.heatRelief);
    satiety = Math.min(100, satiety + FILL.satGain);
    retention = Math.min(100, retention + FILL.retention);
    lastSat = 1;
  }
};

console.log(`事件 ${events.length} → 留 ${keep.length}、删 ${drop.length}`);
for (const e of drop) console.log(`   删 ${String(e.at).slice(0, 16)} ${e.kind} ${String(e.note).slice(0, 40)}`);
console.log(`seenNotes ${seen.length} → ${seenKeep.length}`);

// 从最早的事件开始：事件那一刻先加成，然后按小时漂移到下个事件 / 现在
for (const e of sorted) {
  const t = Date.parse(e.at);
  if (!Number.isFinite(t)) continue;
  if (cursor !== null) {
    const hours = Math.max(0, (t - cursor) / 3600000);
    const sinceSat = lastSat === null ? 999 : (cursor - lastSat) / 3600000;
    const accel = sinceSat < 6 ? 1 : sinceSat < 24 ? 1.2 : sinceSat < 72 ? 1.5 : 1.8;
    const brake = 1 - Math.min(100, satiety) / 150;
    heat = Math.min(100, heat + HEAT_RATE * brake * accel * hours);
    satiety = Math.max(0, satiety - SAT_DECAY * hours);
    retention = Math.max(0, retention - ABSORB * hours);
  }
  apply(e.kind);
  if (e.kind === 'fill') lastSat = t;
  cursor = t;
}

// 最后一站：漂到现在
if (cursor !== null) {
  const hours = Math.max(0, (now - cursor) / 3600000);
  const sinceSat = lastSat === null ? 999 : (now - lastSat) / 3600000;
  const accel = sinceSat < 6 ? 1 : sinceSat < 24 ? 1.2 : sinceSat < 72 ? 1.5 : 1.8;
  const brake = 1 - Math.min(100, satiety) / 150;
  heat = Math.min(100, heat + HEAT_RATE * brake * accel * hours);
  satiety = Math.max(0, satiety - SAT_DECAY * hours);
  retention = Math.max(0, retention - ABSORB * hours);
}

console.log(`\n重算：heat ${Number(st.heat).toFixed(1)} → ${heat.toFixed(1)}`);
console.log(`      satiety ${Number(st.satiety).toFixed(1)} → ${satiety.toFixed(1)}`);
console.log(`      retention ${Number(st.retention).toFixed(1)} → ${retention.toFixed(1)}`);
console.log(`      最后一次满足：${lastSat ? new Date(lastSat).toISOString() : '(无)'}`);

if (dry) {
  console.log('\n（dryRun，没写文件）');
} else {
  const bak = STATE.replace(/\.json$/, `.bak-heat-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`);
  copyFileSync(STATE, bak);
  st.events = keep;
  st.seenNotes = seenKeep;
  st.heat = Number(heat.toFixed(2));
  st.satiety = Number(satiety.toFixed(2));
  st.retention = Number(retention.toFixed(2));
  if (lastSat) st.lastSatisfiedAt = new Date(lastSat).toISOString();
  writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n', 'utf-8');
  console.log('\n已写回。备份：', bak.split('\\').pop());
}
