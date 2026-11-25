/**
 * 算一下她现在这个状态，多久能涨回临界。
 *   node test/eta.mjs
 */
import { DesireWorld } from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';

const w = new DesireWorld({
  dataDir: 'D:/Applications/Coopanion/data/home/companion/data',
  cfg: {},
});

const cfg = w.config;
const st = w.read();
const now = Date.now();
const satAt = st.lastSatisfiedAt ? Date.parse(st.lastSatisfiedAt) : null;

// 照着 tick() 的算法往前推，不改真实档案
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
let heat = st.heat;
let satiety = st.satiety;
const sinceSatH = satAt ? (now - satAt) / 3600000 : 999;

console.log(`起点：欲求 ${heat.toFixed(2)}　满足 ${satiety}　上次被满足 ${sinceSatH.toFixed(1)} 小时前`);
console.log(`基础涨速 ${cfg.heatRatePerHour}/时，满足度会压住它，越久没被满足涨得越快\n`);

console.log('小时  欲求  满足   此刻的涨速');
for (let h = 0; h <= 36; h += 1) {
  const brake = 1 - clamp(satiety) / 150;
  const since = (sinceSatH + h);
  const accel = since < 6 ? 1 : since < 24 ? 1.2 : since < 72 ? 1.5 : 1.8;
  const rate = cfg.heatRatePerHour * brake * accel;
  if (h % 4 === 0) {
    console.log(
      `${String(h).padStart(3)}   ${String(Math.round(heat)).padStart(4)}   ${String(Math.round(satiety)).padStart(3)}    ${rate.toFixed(1)}/时${heat >= 85 ? '  ← 已临界' : ''}`,
    );
  }
  heat = clamp(heat + rate * 1);
  satiety = clamp(satiety - cfg.satietyDecayPerHour * 1);
}
