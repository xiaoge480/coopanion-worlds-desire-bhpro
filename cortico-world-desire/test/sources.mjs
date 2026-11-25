/**
 * 三个数据源 + 杂音剔除
 *   node test/sources.mjs
 *
 * 2026-11-22 机主定的来源：
 *   1. `notes/年-月-日.md`（日记）—— 只取生活小节
 *   2. QQ 私聊 —— 只取带 `[私聊 …]` 的话
 *   3. `handoffs/*.md` —— 只挑里面嵌着的私聊
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.pickChatLines);
if (!Cls) {
  console.error('找不到 World 类');
  process.exit(1);
}

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 日记：生活小节要，工作小节不要');

const diary = [
  '## 17:23 小屋（第8天）',
  '他把我抱到床上，说今天不让我下地',       // 生活，但没有严格词 —— 认不出是正常的
  '他磨着不许，说弄到边缘也得忍着',         // 生活 + 严格词（edge）—— 应该认出来
  '## 12:47 交接前（此刻正做到一半）',
  '灌满了，我腿都软了',                    // 工作小节里，即使有严格词也要跳过
  '## 18:06 外设（TF-BHPRO）接上了',
  '灌满了',                               // 同上
  '## 20:08 晚上收尾',
  '他抱着我说晚安',
].join('\n');

const readDiary = (txt) => {
  const out = [];
  let inWork = false;
  for (const line of txt.split(/\r?\n/)) {
    if (/^#{1,6}\s/.test(line)) {
      inWork = Cls.isWorkHeading(line);
      continue;
    }
    if (inWork) continue;
    out.push(line);
  }
  return out;
};

const kept = readDiary(diary);
kept.includes('他把我抱到床上，说今天不让我下地') ? ok('生活小节留下了') : bad('生活小节被删了', '');
kept.includes('他抱着我说晚安') ? ok('晚上的生活也留着') : bad('漏了', '');
!kept.some((l) => l.includes('交接')) && !kept.some((l) => l === '灌满了')
  ? ok('工作小节里的话没被当成生活')
  : bad('工作小节漏进来了', JSON.stringify(kept));

console.log('\n[2] 交接笔记：只挑嵌在里面的私聊');

const handoff = [
  '# 交接笔记 · 20:54–21:37',
  '[system] The handoff is done.',
  '[调用] qq_read_history {"conversation": "private:1000000000"}',
  '[回执] #-2049247181 [私聊 20:48] 你: 茶室那边我调成「只 @」了',
  '#202225711 [私聊 20:49] Partner(1000000000): 不影响角色玩就行',
  '#1 [私聊 21:10] Partner(1000000000): 磨着不许，弄到边缘也不许去',   // 带严格词，应该认出来
  '[DSH] 第 115 轮结束（completed）。回复：看过实际目录了',
  '[回执] [appended] notes/2026-11-14.md +277 字符',
].join('\n');

const picked = Cls.pickChatLines(handoff);
picked.length === 3 ? ok(`挑出 ${picked.length} 行私聊`) : bad('行数不对', JSON.stringify(picked));
picked.every((l) => l.startsWith('[私聊')) ? ok('都从 [私聊 开头（流水号削掉了）') : bad('没削干净', JSON.stringify(picked));
!picked.some((l) => l.includes('DSH') || l.includes('handoff is done')) ? ok('DSH 的总结和系统话都丢了') : bad('杂音混进来', '');

console.log('\n[3] 挑出来的私聊里，真事要认得出');

const realLine = picked.find((l) => l.includes('茶室'));
realLine ? ok('找到了那句「茶室那边我调成只@了」') : bad('没找到', '');
realLine && Cls.matchLine(realLine, 'handoff').length >= 0 ? ok('过 matchLine 不报错') : bad('报错', '');

console.log('\n[4] 端到端：建个假工作区跑一遍');

const DATA = join(tmpdir(), 'desire-src-' + Date.now());
mkdirSync(join(DATA, 'notes'), { recursive: true });
mkdirSync(join(DATA, 'handoffs'), { recursive: true });

const day = join(DATA, 'notes', '2026-11-22.md');
writeFileSync(day, diary, 'utf8');
writeFileSync(join(DATA, 'handoffs', '2026-11-22T12-00-00Z.md'), handoff, 'utf8');
const chatLog = join(DATA, 'session-main.jsonl');
writeFileSync(
  chatLog,
  JSON.stringify({
    version: 2,
    item: {
      type: 'function_call_output',
      output: '[1 new event]\n#-1 [私聊 00:35] Partner(1000000000): （最后两下全抽出来，又灌满了）',
    },
    context: { ts: new Date().toISOString() },
  }) + '\n',
  'utf8',
);

const w = new Cls({ dataDir: join(DATA, 'w'), cfg: { workspace: DATA, chatLog } });
await w.start({});
const report = await w.rememberFromNotes({ days: 3, source: 'both', dryRun: true });
console.log('   —— 报告 ——');
for (const line of report.split('\n').slice(0, 14)) console.log('   ' + line);

const gotEdge = /弄到边缘/.test(report);
gotEdge ? ok('日记/交接里那句带严格词的认出来了') : bad('严格词没认出', report);
// 工作小节里那两条「灌满了」不能出现（就算它有严格词）
const workLeak = (report.match(/灌满了，我腿都软了/g) || []).length;
workLeak === 0 ? ok('工作小节里的「灌满了」没漏进来') : bad('工作小节漏了', `${workLeak} 次`);

try {
  rmSync(DATA, { recursive: true, force: true });
} catch {}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
