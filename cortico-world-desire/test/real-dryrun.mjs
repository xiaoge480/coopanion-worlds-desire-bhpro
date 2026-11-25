/**
 * 拿她真实的记录跑一遍 dryRun —— 只看认出什么，不写进档案。
 *   node test/real-dryrun.mjs [天数]
 */
import { DesireWorld } from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const days = Number(process.argv[2]) || 7;
const w = new DesireWorld({
  dataDir: join(tmpdir(), 'desire-dryrun-' + Date.now()),
  cfg: {
    workspace: 'D:/Applications/Coopanion/data/home/companion/workspace',
    chatLog: 'D:/Applications/Coopanion/data/home/companion/data/session-main.jsonl',
  },
});
await w.start({});

for (const source of ['notes', 'chat', 'both']) {
  const out = await w.rememberFromNotes({ days, source, dryRun: true });
  console.log(`\n===== ${source}（最近 ${days} 天）=====`);
  console.log(out.slice(0, 1800));
}
console.log('\n（dryRun，档案里一条都没写）');
