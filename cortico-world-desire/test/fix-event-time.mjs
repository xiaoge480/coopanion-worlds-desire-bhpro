/**
 * 把已有事件的 at 改成「事情真正发生的时刻」
 *   node test/fix-event-time.mjs dryRun
 *
 * 2026-11-22 机主指出时间线不对：`12:28 灌满` 那条其实事发生在 00:35，
 * 被记在扫到它的时刻，于是排到了「00:00 一次」上面。
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';

const STATE = 'D:/Applications/Coopanion/data/home/companion/data/worlds/desire/state.json';
const dry = process.argv[2] === 'dryRun';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.happenedAt);

const st = JSON.parse(readFileSync(STATE, 'utf-8'));
const events = Array.isArray(st.events) ? st.events : [];

let changed = 0;
for (const e of events) {
  const note = String(e.note ?? '');
  if (!/\[私聊\s+\d{1,2}:\d{2}\]/.test(note)) continue;
  // from 用事件自己的 at 当"日期线索"（同一天）
  const fixed = Cls.happenedAt(note, String(e.at), String(e.at));
  if (fixed && fixed !== e.at) {
    console.log(`  ${String(e.at).slice(0, 16)}  →  ${String(fixed).slice(0, 16)}   ${note.slice(0, 40)}`);
    e.at = fixed;
    changed += 1;
  }
}

// 按时间重排（面板是倒序显示的，这里按正序存）
events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

console.log(`\n${changed} 条时间已修正。修正后顺序（旧→新）：`);
for (const e of events) {
  console.log(`  ${String(e.at).slice(0, 16)}  ${String(e.kind).padEnd(6)} ${String(e.note).slice(0, 44)}`);
}

if (dry) {
  console.log('\n（dryRun，没写文件）');
} else {
  const bak = STATE.replace(/\.json$/, `.bak-time-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.json`);
  copyFileSync(STATE, bak);
  st.events = events;
  writeFileSync(STATE, JSON.stringify(st, null, 2) + '\n', 'utf-8');
  console.log('\n已写回。备份：', bak.split('\\').pop());
}
