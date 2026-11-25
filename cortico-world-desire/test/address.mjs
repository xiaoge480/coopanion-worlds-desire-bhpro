/**
 * 称呼：认「角色」，不只认「她」
 *   node test/address.mjs
 */
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const dir = join(tmpdir(), 'desire-addr-' + Date.now());
mkdirSync(dir, { recursive: true });
const chatLog = join(dir, 'session-main.jsonl');

const { DesireWorld } = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 称呼词表');

for (const t of ['角色', '她', '角色名', '角色名', '角色名', '角色名']) {
  DesireWorld.mentionsHer(`叫${t}一声`) ? ok(`认「${t}」`) : bad(`不认「${t}」`, '');
}
for (const t of ['今天天气不错', '嗯，只给机主看', '我去买菜了']) {
  DesireWorld.mentionsHer(t) ? bad(`误认成她`, t) : ok(`不误认：${t.slice(0, 6)}…`);
}

console.log('\n[2] 群聊整条跳过（不看称呼，宁可少认）');

const line = (text, minsAgo = 5) =>
  JSON.stringify({
    version: 2,
    item: { type: 'function_call_output', output: text },
    context: { ts: new Date(Date.now() - minsAgo * 60000).toISOString() },
  });

writeFileSync(
  chatLog,
  [line('#1 [群「某群」 20:39] 某人(111): 角色帮我揉揉，灌满了')].join('\n') + '\n',
  'utf-8',
);
const w1 = new DesireWorld({
  dataDir: join(dir, 'a'),
  cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 0 },
});
await w1.start({});
const r1 = await w1.autoScan();
r1.added === 0 ? ok('群里就算叫「角色」也不认') : bad(`认了 ${r1.added} 条`, '别人也叫角色，不能算');

console.log('\n[3] 私聊里叫「角色」的句子更有分量');

// 两份聊天：各 20 行（够 minLines），其中 8 行是动作描写（不够 15 分，除非加权）
// 差别只在动作那几句有没有叫她
const noAddr = [];
const withAddr = [];
const HALF = 30 * 60000;
const base = Math.floor((Date.now() - 3 * 3600000) / HALF) * HALF + 60000;
for (let i = 0; i < 20; i += 1) {
  const ts = new Date(base + i * 20000).toISOString();
  const act = i < 8; // 前 8 行是动作描写，后 12 行是普通对话
  const body = act ? '（揉着）' : '今天外面风有点大，我把窗关上了';
  noAddr.push(
    JSON.stringify({ item: { type: 'function_call_output', output: `[私聊] Partner: ${body}` }, context: { ts } }),
  );
  withAddr.push(
    JSON.stringify({
      item: { type: 'function_call_output', output: `[私聊] Partner: ${act ? '（角色，揉着）' : body}` },
      context: { ts },
    }),
  );
}

writeFileSync(chatLog, noAddr.join('\n') + '\n', 'utf-8');
const wNo = new DesireWorld({
  dataDir: join(dir, 'b'),
  cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 0 },
});
await wNo.start({});
const rNo = await wNo.scanByDensity();

writeFileSync(chatLog, withAddr.join('\n') + '\n', 'utf-8');
const wYes = new DesireWorld({
  dataDir: join(dir, 'c'),
  cfg: { workspace: join(dir, 'notes'), chatLog, autoScanMinutes: 0 },
});
await wYes.start({});
const rYes = await wYes.scanByDensity();

ok(`20 行里 8 句动作、没称呼 → 认出 ${rNo.added} 条（8 分，不够 15）`);
ok(`20 行里 8 句动作、带「角色」→ 认出 ${rYes.added} 条（16 分，够了）`);

// 同样 8 行，带称呼的命中是 8×2=16，刚好过 15 的线；不带的 8 分，不够
rNo.added === 0 && rYes.added >= 1
  ? ok('同样 20 行，带「角色」的够格、不带的还不够——称呼真的在加权')
  : bad('加权没体现出来', `无称呼 ${rNo.added} / 有称呼 ${rYes.added}`);

try {
  rmSync(dir, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
