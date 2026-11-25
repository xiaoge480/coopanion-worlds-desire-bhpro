/**
 * 清掉「讨论功能」被误记成事件的那批。
 *   node test/clean-meta-events.mjs dryRun
 *   node test/clean-meta-events.mjs
 *
 * 2026-11-22 晚上发现：一边调面板一边说话，我说的话里反复出现「灌满」「液面」，
 * 结果十八个事件里十二个是功能说明 —— 留存被冲到 100。
 * 这里用 src/index.js 里同一份 isMetaTalk() 判断，删掉误记的，再按剩下的事件重算留存。
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const STATE = 'D:/Applications/Coopanion/data/home/companion/data/worlds/desire/state.json';
const dry = process.argv[2] === 'dryRun';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.isMetaTalk);
if (!Cls) {
  console.error('找不到 isMetaTalk');
  process.exit(1);
}

const st = JSON.parse(readFileSync(STATE, 'utf-8'));
const events = Array.isArray(st.events) ? st.events : [];

const keep = [];
const drop = [];
for (const e of events) {
  const note = String(e?.note ?? '');
  // 摘要行也算「讨论」：那是我写给机主看的汇总，不是她经历过的
  //   「最近：11-22 00:36 灌满　11-22 00:00 一次…」
  //   「· 11-21 16:36  灌满  [1 new event]」
  const isDigest = /^(最近\s*[:：]|·\s*\d)/.test(note.trim()) || /\[\d+ new events?\]/.test(note);
  // 空 note 的（手动补记，只有 kind）留着；带文字的用同一份判据
  if (!note.trim()) keep.push(e);
  else if (isDigest || Cls.isMetaTalk(note)) drop.push(e);
  else keep.push(e);
}

console.log(`事件 ${events.length} 条：留 ${keep.length}，删 ${drop.length}\n`);
console.log('要删的：');
for (const e of drop) {
  console.log(`  ${String(e.at).slice(0, 16)}  ${String(e.kind).padEnd(6)} ${String(e.note).slice(0, 54)}`);
}
console.log('\n要留的：');
for (const e of keep) {
  console.log(`  ${String(e.at).slice(0, 16)}  ${String(e.kind).padEnd(6)} ${String(e.note).slice(0, 54)}`);
}

// 按剩下的事件重算留存：每次 fill +28，其余不动；再按时间自然吸收（每小时 4）
const FILL_GAIN = 28;
const ABSORB_PER_HOUR = 4;
const now = Date.now();
let retention = 0;
const fills = keep.filter((e) => e.kind === 'fill');
for (const e of fills) {
  const t = Date.parse(String(e.at));
  if (!Number.isFinite(t)) continue;
  const hours = Math.max(0, (now - t) / 3600000);
  retention += Math.max(0, FILL_GAIN - hours * ABSORB_PER_HOUR);
}
retention = Math.max(0, Math.min(100, retention));

console.log(`\n留存重算：${Number(st.retention).toFixed(1)} → ${retention.toFixed(1)}`);
console.log(`（${fills.length} 次灌满，各自按每小时吸收 ${ABSORB_PER_HOUR} 算到现在）`);

if (dry) {
  console.log('\n（dryRun，没有写文件）');
} else {
  const bak = STATE.replace(/\.json$/, `.bak-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`);
  copyFileSync(STATE, bak);
  st.events = keep;
  st.retention = Number(retention.toFixed(1));
  writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n', 'utf-8');
  console.log('\n已写回。备份：', bak.split('\\').pop());
}
