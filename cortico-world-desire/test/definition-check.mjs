import def from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';
import webui from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/webui.js';

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 默认导出是 WorldDefinition');

for (const k of ['id', 'label', 'defaults', 'create', 'describe']) {
  def[k] !== undefined ? ok(`有 ${k}`) : bad(`缺 ${k}`, '宿主会报加载失败');
}
typeof def.defaults === 'function' ? ok('defaults() 是函数') : bad('defaults 不是函数', typeof def.defaults);
typeof def.create === 'function' ? ok('create() 是函数') : bad('create 不是函数', typeof def.create);

const d1 = def.defaults();
const d2 = def.defaults();
d1 !== d2 ? ok('默认值每次给新对象') : bad('默认值共用了同一个对象', '');
d1.enabled === false ? ok('enabled 默认 false（由部署配置开）') : bad('enabled 默认不是 false', String(d1.enabled));
typeof d1.heatRatePerHour === 'number' ? ok('带配置默认值：heatRatePerHour=' + d1.heatRatePerHour) : bad('没有配置默认值', '');

console.log('\n[2] describe.tools');

const tools = def.describe?.tools ?? [];
tools.length >= 4 ? ok(`声明了 ${tools.length} 个工具`) : bad('工具声明太少', String(tools.length));
const missingSummary = tools.filter((t) => !t.summary || !t.summary.zh);
missingSummary.length === 0 ? ok('每个都带中文 summary') : bad('有缺 summary 的', missingSummary.map((t) => t.name).join(','));
const withHandler = tools.filter((t) => t.handler !== undefined);
withHandler.length === 0 ? ok('声明里没有混进 handler（宿主不需要）') : bad('声明里带了 handler', String(withHandler.length));

console.log('\n[3] create() 造出来的实例');

const inst = def.create({ dataDir: 'D:/Applications/Coopanion/data/tmp-desire-loadcheck', cfg: d1 });
inst.id === 'desire' ? ok('实例 id = desire') : bad('实例 id 不对', inst.id);
typeof inst.start === 'function' ? ok('有 start()') : bad('没有 start', '');
typeof inst.tools === 'function' ? ok('有 tools()') : bad('没有 tools', '');
const names = inst.tools().map((t) => t.name);
names.includes('desire_status') ? ok('工具能拿到：' + names.join(', ')) : bad('工具不对', names.join(','));

console.log('\n[4] webui');

Object.keys(webui.panels).includes('desire') ? ok('面板 id = desire') : bad('面板 id 不对', Object.keys(webui.panels).join(','));
typeof webui.panels.desire.mount === 'function' ? ok('有 mount()') : bad('没有 mount', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
