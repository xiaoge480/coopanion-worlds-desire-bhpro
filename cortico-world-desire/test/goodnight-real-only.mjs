/**
 * 「想过」不等于「说过」
 *   node test/goodnight-real-only.mjs
 *
 * 2026-11-22 深夜的坑：她在自己的思考里琢磨「Maybe mention 晚安-ish?」，
 * 扫描器把那条 reasoning 当成了真的互道晚安，于是她那边已经「睡着」，
 * 而机主说「我们现在好像还没互道晚安」。
 *
 * 这条测试锁住：思维链里的晚安不算，只有真说出口的才算。
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const W = Object.values(mod).find((v) => typeof v === 'function' && v.prototype && v.prototype.envPromptVars);

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const dir = mkdtempSync(join(tmpdir(), 'desire-gn-'));
const chatLog = join(dir, 'chat.jsonl');
const writeChat = (rows) => writeFileSync(chatLog, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf-8');

// 昨晚 23:05 —— 必须是过去，否则会被 readGoodNight 的 `ts > now` 挡掉
// （这个测试第一次就栽在这儿：凌晨跑的时候 new Date() 设 23:05 得到的是「今晚」，还在未来）
const night = new Date(Date.now() - 24 * 3600 * 1000);
night.setHours(23, 5, 56, 0);
const ts = night.toISOString();

const make = () => new W({ dataDir: join(dir, 'data'), cfg: { chatLog } });

console.log('\n[1] 思维链里提到晚安 → 不算');

writeChat([
  {
    version: 2,
    item: {
      type: 'reasoning',
      status: 'completed',
      content: [{ type: 'reasoning_text', text: 'Short, sweet. Maybe mention 晚安-ish?' }],
    },
    context: { ts },
  },
]);
let w = make();
w.readGoodNight(Date.now()) === null
  ? ok('reasoning 里的「晚安」不算数')
  : bad('又当成真的了', '');

console.log('\n[2] 真说出口了 → 算');

writeChat([
  {
    version: 2,
    item: { type: 'message', role: 'user', content: [{ type: 'text', text: '晚安啦，明天见' }] },
    context: { ts },
  },
]);
w = make();
let gn = w.readGoodNight(Date.now());
gn !== null ? ok(`识别到真・晚安：${new Date(gn).toLocaleString('zh-CN')}`) : bad('没认出来', '');

console.log('\n[3] 她的回执里说了晚安 → 也算（function_call_output）');

writeChat([
  {
    version: 2,
    item: {
      type: 'function_call_output',
      output: '#-123456789 [私聊 23:06] 你: 晚安，机主也早点睡',
    },
    context: { ts },
  },
]);
w = make();
w.readGoodNight(Date.now()) !== null ? ok('回执里的晚安认得出来') : bad('漏了', '');

console.log('\n[4] 她的 assistant 草稿不算（那是没发出去的话）');

const draftTs = new Date(night.getTime() + 60000).toISOString();
writeChat([
  {
    version: 2,
    item: { type: 'message', role: 'assistant', content: [{ type: 'text', text: '晚安' }] },
    context: { ts: draftTs },
  },
]);
w = make();
w.readGoodNight(Date.now()) === null ? ok('assistant 草稿不算') : bad('当成说出口了', '');

console.log('\n[5] 两条都有时，取最近的那条真话');

writeChat([
  { version: 2, item: { type: 'message', role: 'user', content: [{ type: 'text', text: '晚安' }] }, context: { ts } },
  {
    version: 2,
    item: { type: 'message', role: 'user', content: [{ type: 'text', text: '晚安，真的睡了' }] },
    context: { ts: new Date(night.getTime() + 300000).toISOString() },
  },
]);
w = make();
gn = w.readGoodNight(Date.now());
gn !== null && gn > night.getTime() ? ok('取的是更晚那条') : bad('取错了', new Date(gn || 0).toString());

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
