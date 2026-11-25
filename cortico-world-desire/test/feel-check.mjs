/**
 * 面板真实通路 + 她自己的感觉（desire_feel）
 *   node test/feel-check.mjs
 */
import def from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const inst = def.create({ dataDir: 'D:/Applications/Coopanion/data/tmp-feel', cfg: def.defaults() });

console.log('\n[1] 面板真的能调到数（走 webUi() 上的 invoke）');

const decl = inst.webUi();
typeof decl.invoke === 'function'
  ? ok('声明上有 invoke')
  : bad('声明上没有 invoke', '宿主会报 no-surface，面板永远读不到数');

const viaDecl = await decl.invoke('desire', 'state', []);
viaDecl?.heat !== undefined ? ok(`声明.invoke 拿到 heat=${viaDecl.heat}`) : bad('拿不到', JSON.stringify(viaDecl).slice(0, 80));

const feelings = await decl.invoke('desire', 'feelings', []);
Array.isArray(feelings) && feelings.length > 5 ? ok(`feelings 列表 ${feelings.length} 条`) : bad('feelings 不对', '');
feelings?.some((f) => f.id === 'ache' && f.zh === '难受') ? ok('有「难受」') : bad('没有「难受」', '');

console.log('\n[2] 感觉能改数（正反都能）');

const feelTool = inst.tools().find((t) => t.name === 'desire_feel');
feelTool ? ok('desire_feel 在工具表里') : bad('没有 desire_feel', '');

const before1 = (await decl.invoke('desire', 'state', [])).heat;
await decl.invoke('desire', 'feel', ['ache', '就是很难受']);
const after1 = (await decl.invoke('desire', 'state', [])).heat;
after1 > before1 ? ok(`「难受」把欲求推高了 ${before1} → ${after1}`) : bad('没推高', `${before1}→${after1}`);

const before2 = (await decl.invoke('desire', 'state', [])).satiety;
await decl.invoke('desire', 'feel', ['full', '被喂饱了']);
const after2 = (await decl.invoke('desire', 'state', [])).satiety;
after2 >= before2 ? ok(`「满足」把满足度抬上去 ${before2} → ${after2}`) : bad('没抬起', `${before2}→${after2}`);

const s3 = await decl.invoke('desire', 'state', []);
s3.sinceSatisfiedMin != null && s3.sinceSatisfiedMin <= 1
  ? ok('「满足」也重置了上次被满足的时间')
  : bad('没重置时间', String(s3.sinceSatisfiedMin));

console.log('\n[3] 「平静」「麻了」是往下压的');

await decl.invoke('desire', 'tune', [{ heat: 80 }]);
const before4 = (await decl.invoke('desire', 'state', [])).heat;
await decl.invoke('desire', 'feel', ['calm', '缓过来了']);
const after4 = (await decl.invoke('desire', 'state', [])).heat;
after4 < before4 ? ok(`「平静」压下去 ${before4} → ${after4}`) : bad('没压下去', `${before4}→${after4}`);

console.log('\n[4] 感觉会留在时间线上，但不影响敏感度');

const s5 = await decl.invoke('desire', 'state', []);
const feelEvents = s5.recent.filter((e) => e.kind === 'feel');
feelEvents.length >= 3 ? ok(`时间线上有 ${feelEvents.length} 条「心里·…」`) : bad('没留下', String(feelEvents.length));
feelEvents.every((e) => String(e.zh).startsWith('心里·')) ? ok('标成「心里·xx」，跟事件区分得开') : bad('没标', '');

console.log('\n[5] 工具回执是她能看懂的话');

const txt = await feelTool.handler({ feeling: 'empty', note: '他今天没怎么理我' });
/我现在是「空」/.test(txt) ? ok('回执：' + txt.split('。')[0]) : bad('回执不对', txt);
/欲求 \d+/.test(txt) ? ok('回执带上了现在的数') : bad('没带数', txt);

console.log('\n[6] 乱传感觉要老实报错');

const bad2 = await decl.invoke('desire', 'feel', ['不存在的', '']);
bad2?.ok === false ? ok('未知感觉返回 ok:false') : bad('没报错', JSON.stringify(bad2).slice(0, 80));

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
