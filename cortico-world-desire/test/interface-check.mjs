/**
 * 对着宿主 World 接口的**必需成员**逐项核对，少一个就会像 2026-11-22 那样报
 * 「mod.envPromptVars is not a function」，整页 World 清单加载失败。
 *   node test/interface-check.mjs
 */
import def from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const inst = def.create({ dataDir: 'D:/Applications/Coopanion/data/tmp-iface', cfg: def.defaults() });

console.log('\n[必需成员]（接口里没有 ? 的都是必需）');

const required = [
  ['id', 'string'],
  ['envPromptVars', 'function'],
  ['tools', 'function'],
  ['start', 'function'],
  ['stop', 'function'],
];
for (const [k, t] of required) {
  const got = typeof inst[k];
  got === t ? ok(`${k} : ${t}`) : bad(`${k} 是 ${got}，要 ${t}`, '宿主会报错');
}

console.log('\n[可选成员]（有就给，没有也不报错）');

for (const k of ['webUi', 'outputTap', 'onHandoffEnded', 'invoke', 'state']) {
  console.log(`  · ${k} : ${typeof inst[k]}`);
}

console.log('\n[envPromptVars 的返回值]');

// 有 promptDocs 就必须返回变量对象；没有 promptDocs 才返回 null。
// 2026-11-22 之后这个包是「有」——她的状态要自动进上下文。
const hasDocs = (inst.webUi()?.promptDocs ?? []).length > 0;
const v = await inst.envPromptVars();
if (hasDocs) {
  v && typeof v === 'object' && !Array.isArray(v)
    ? ok('有 promptDocs，返回变量对象（' + Object.keys(v).length + ' 个变量）')
    : bad('返回了 ' + JSON.stringify(v), '有 promptDocs 就该给变量，不然模板填不上');
  const miss = (inst.webUi().promptDocs[0].vars ?? []).map((x) => x.name).filter((n) => !(n in v));
  miss.length === 0 ? ok('每个声明的变量都给了') : bad('缺变量', miss.join(','));
} else {
  v === null ? ok('返回 null（不提供环境段）') : bad('返回了 ' + JSON.stringify(v), '没有 promptDocs 时应给 null');
}

console.log('\n[describe 的形状]');

const t = def.describe?.tools ?? [];
Array.isArray(t) ? ok('describe.tools 是数组') : bad('不是数组', typeof t);
t.every((x) => typeof x.name === 'string' && typeof x.description === 'string')
  ? ok('每条都有 name + description')
  : bad('有条目缺字段', '');
t.every((x) => x.parameters?.type === 'object') ? ok('每条 parameters 都是 object schema') : bad('parameters 不对', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
