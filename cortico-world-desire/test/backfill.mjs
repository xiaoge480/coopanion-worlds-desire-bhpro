/**
 * 往她真实的档案里补扫一次（会真写）。
 *   node test/backfill.mjs [dryRun]
 *
 * 用 Coopanion 真实的 dataDir / chatLog / workspace，
 * 把「上次扫过之后」的事扫进来；没有 lastScanAt 就回看 48 小时。
 */
import { DesireWorld } from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';

const dry = process.argv[2] === 'dryRun';

const w = new DesireWorld({
  dataDir: 'D:/Applications/Coopanion/data/home/companion/data',
  cfg: {
    workspace: 'D:/Applications/Coopanion/data/home/companion/workspace',
    chatLog: 'D:/Applications/Coopanion/data/home/companion/data/session-main.jsonl',
  },
});

const before = w.read();
console.log(`补扫前：欲求 ${before.heat.toFixed(1)}　满足 ${before.satiety}　事件 ${before.events.length} 条`);
console.log(`lastScanAt：${before.lastScanAt ?? '（还没有，会回看 48 小时）'}`);

if (dry) {
  const out = await w.rememberFromNotes({ days: 2, source: 'chat', dryRun: true });
  console.log('\n--- dryRun 会认出来的 ---');
  console.log(out);
} else {
  const r = await w.autoScan();
  const after = w.read();
  console.log(`\n扫到 ${r.added} 条新的`);
  console.log(`补扫后：欲求 ${after.heat.toFixed(1)}　满足 ${after.satiety}　留存 ${after.retention}　事件 ${after.events.length} 条`);
  if (after.events.length) {
    console.log('\n近期：');
    for (const e of after.events.slice(-10).reverse()) {
      const t = String(e.at).slice(5, 16).replace('T', ' ');
      console.log(`  · ${t}  [${e.zh}]  ${String(e.note || '').slice(0, 50)}`);
    }
  } else {
    console.log('\n（还是空的——48 小时内没有能认出来的句子）');
  }
}
