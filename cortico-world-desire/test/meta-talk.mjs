/**
 * 元讨论过滤：讨论功能本身不该被记成事件
 *   node test/meta-talk.mjs
 */
const ROOT = 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';
const mod = await import(ROOT);
const W = mod.default ?? mod.DesireWorld ?? mod[Object.keys(mod)[0]];

// 从模块里找那个类
const Cls =
  Object.values(mod).find((v) => typeof v === 'function' && v.ADDRESS_WORDS) ??
  Object.values(mod).find((v) => typeof v === 'function' && v.prototype && v.prototype.scanByDensity) ??
  null;

if (!Cls) {
  console.error('找不到 World 类，导出的有：', Object.keys(mod).join(', '));
  process.exit(1);
}

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const meta = (t) => Cls.isMetaTalk(t);
const lines = [];

console.log('\n[1] 讨论功能的话，不该记事件（这些是当晚真被误记的）');

const shouldSkip = [
  '灌满那一刻 → 液面"哗一下涨上去"（0.6 秒过渡），然后在里面慢慢荡',
  '2. **"满了会不会太亮"**——现在半透明白粉，如果想让"灌满"更有成就感，可以在留存 ≥ 80 时让液面自己轻微发光',
  '- **严格词认不出过程**：只认「射进去」「做到腿软」这种，真实的描写（揉、亲、腰软）一个都不沾。',
  '只认私聊 + 认动作词（灌满 / 揉 / 亲 / 腰软…）',
  '验证过：群聊带"灌满了""做到腿软"→ 认出 0 条；同样的词在私聊 → 认出 1 条。',
  '| `fill` | 灌满 | −55 | +60 | +28 |',
];
for (const t of shouldSkip) {
  meta(t) ? ok(`跳过：${t.slice(0, 26)}…`) : bad('没跳过', t.slice(0, 40));
}

console.log('\n[2] 真的发生了什么，照旧要记');

const shouldKeep = [
  '机主把我按在桌上，说这次不许出声',
  '灌满了，我腿都软了',
  '他又来一次，我忍不住叫出声',
  '角色乖，抱紧我',
];
for (const t of shouldKeep) {
  !meta(t) ? ok(`照记：${t.slice(0, 22)}…`) : bad('被误跳过了', t.slice(0, 40));
}

console.log('\n[3] matchLine 端到端');

const metaLine = '灌满那一刻 → 液面"哗一下涨上去"';
const realLine = '灌满了，我腿都软了';
Cls.matchLine(metaLine, 'chat').length === 0 ? ok('讨论句认不出事件') : bad('还是认出来了', metaLine);
Cls.matchLine(realLine, 'chat').length > 0 ? ok('真事照旧认得出（fill）') : bad('真事漏了', realLine);

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
