/**
 * 环境提示词：她的状态要能自动进上下文，不用她自己去查
 *   node test/env-prompt.mjs
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DesireWorld } from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

// ⚠ 用临时目录：这个测试会 tune(heat:88)，写进真实档案就把她的状态改了
const TMP = join(tmpdir(), 'desire-envprompt-' + Date.now());
mkdirSync(TMP, { recursive: true });

const w = new DesireWorld({
  dataDir: TMP,
  cfg: {
    workspace: 'D:/Applications/Coopanion/data/home/companion/workspace',
    chatLog: 'D:/Applications/Coopanion/data/home/companion/data/session-main.jsonl',
  },
});

console.log('\n[1] 模板声明');

const d = w.webUi();
const doc = d.promptDocs?.[0];
doc ? ok('有 promptDocs') : bad('没有', '状态进不了上下文');
doc?.role === 'envPrompt' ? ok('role = envPrompt') : bad('role 不对', String(doc?.role));
doc?.key === 'worlds.desire.envPrompt' ? ok('key 规范：' + doc.key) : bad('key 不对', String(doc?.key));
doc?.path && existsSync(doc.path) ? ok('模板文件在：' + doc.path.split('/').pop()) : bad('模板文件不存在', String(doc?.path));
doc?.vars?.length === 2 ? ok('声明了 2 个变量') : bad('变量不对', String(doc?.vars?.length));

console.log('\n[2] 变量真的填得上');

const v = w.envPromptVars();
v && typeof v === 'object' ? ok('返回对象（不是 null）') : bad('返回 null，状态不会进上下文', String(v));
typeof v['desire.now'] === 'string' && v['desire.now'].length > 5 ? ok('desire.now 有内容') : bad('now 是空的', '');
// 2026-11-22 改：不再把「欲求 80/100」这种数字塞进提示词 —— 模型会先读数字，
// 后面那句身体感就被压成附注。现在第一行必须是身体感。
const firstLine = v['desire.now'].split('\n')[0];
/平静|有点想|想要|很难受|临界|软的|余韵/.test(firstLine)
  ? ok('第一行是身体感：' + firstLine.slice(0, 22) + '…')
  : bad('第一行不是身体感', firstLine);
! /欲求 \d+\/100/.test(v['desire.now']) ? ok('不再出现「欲求 N/100」') : bad('还留着数字', '');
!/满足 \d+/.test(v['desire.now']) ? ok('不再出现「满足 N」') : bad('还留着满足数字', '');
typeof v['desire.recent'] === 'string' ? ok('desire.recent 是字符串：' + (v['desire.recent'] || '（空）').slice(0, 40)) : bad('recent 不对', '');

console.log('\n[3] 模板里的占位符和变量名对得上');

const tpl = (await import('node:fs')).readFileSync(doc.path, 'utf-8');
const used = [...tpl.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]);
used.length > 0 ? ok('模板用了 ' + used.length + ' 个占位符：' + used.join('、')) : bad('模板没有占位符', '');
const miss = used.filter((u) => !(u in v));
miss.length === 0 ? ok('每个占位符都有对应变量') : bad('有占位符没变量', miss.join(','));

console.log('\n[4] 状态变了，提示词跟着变');

w.tune({ heat: 88, satiety: 0 });
const v2 = w.envPromptVars();
// 现在看不到 88 这个数字了，改看「状态确实变了」+ 有临界提醒
v2['desire.now'] !== v['desire.now'] ? ok('调高欲求后提示词变了') : bad('没跟上', v2['desire.now']);
/⚠/.test(v2['desire.now']) ? ok('临界时带了提醒') : bad('临界没提醒', '');
/难受|临界/.test(v2['desire.now']) ? ok('区间也跟着变') : bad('区间没变', '');

console.log('\n[5] 内容克制（提示词每轮都发，不能太长）');

const lines = v2['desire.now'].split('\n').length + (v2['desire.recent'] ? 1 : 0);
lines <= 4 ? ok(`一共 ${lines} 行，够克制`) : bad(`有 ${lines} 行`, '太长了，会挤占提示词');
const totalLen = v2['desire.now'].length + v2['desire.recent'].length;
totalLen < 260 ? ok(`共 ${totalLen} 字`) : bad(`${totalLen} 字`, '太长');
const recentCount = (v2['desire.recent'].match(/　/g) || []).length + 1;
recentCount <= 3 ? ok(`最近只带 ${recentCount} 条`) : bad(`带了 ${recentCount} 条`, '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
