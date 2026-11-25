/**
 * 面板跟 World 之间的接口自测：模拟宿主的两种叫法，确认都能拿到 state。
 *   node test/invoke-check.mjs
 */
import def from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const inst = def.create({ dataDir: 'D:/Applications/Coopanion/data/tmp-invoke', cfg: def.defaults() });

console.log('\n[1] 面板声明里必须有 getMethods');

const decl = inst.webUi();
const panel = decl?.panels?.[0];
panel ? ok('panels[0] 在：' + panel.id) : bad('没有面板声明', '');
panel?.getMethods?.includes('state')
  ? ok('getMethods 含 state')
  : bad('getMethods 没含 state', '前端 GET 会被拒 → 页面显示读不到状态');
panel?.getMethods?.includes('kinds') ? ok('getMethods 含 kinds') : bad('getMethods 没含 kinds', '');

console.log('\n[2] 两种 invoke 叫法');

const a = await inst.invoke('desire', 'state', []); // 宿主标准叫法
a?.heat !== undefined ? ok(`invoke('desire','state',[]) → heat=${a.heat}`) : bad('标准叫法拿不到', JSON.stringify(a).slice(0, 80));

const b = await inst.invoke('state'); // 只传方法名
b?.heat !== undefined ? ok(`invoke('state') → heat=${b.heat}`) : bad('单参叫法拿不到', JSON.stringify(b).slice(0, 80));

const c = await inst.invoke('state', []); // 方法名 + 空数组
c?.heat !== undefined ? ok(`invoke('state',[]) → heat=${c.heat}`) : bad('方法名+数组拿不到', JSON.stringify(c).slice(0, 80));

console.log('\n[3] touch 也得两种叫法都行');

const d = await inst.invoke('desire', 'touch', ['tease', '试试']);
d?.ok === true ? ok("invoke('desire','touch',[...]) 成功") : bad('标准叫法 touch 失败', JSON.stringify(d).slice(0, 80));

const e = await inst.invoke('touch', ['one', '再试']);
e?.ok === true ? ok("invoke('touch',[...]) 成功") : bad('单参 touch 失败', JSON.stringify(e).slice(0, 80));

console.log('\n[4] 未知方法要老实报错，不能假装成功');

const f = await inst.invoke('desire', 'nope', []);
f?.ok === false ? ok('未知方法返回 ok:false') : bad('未知方法没报错', JSON.stringify(f));

console.log('\n[5] snapshot 里的字段够面板用');

const s = await inst.invoke('desire', 'state', []);
const need = ['heat', 'satiety', 'retention', 'sensitivity', 'band', 'mood', 'rates', 'recent', 'toy'];
const miss = need.filter((k) => !(k in s));
miss.length === 0 ? ok('字段齐') : bad('缺字段', miss.join(','));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
