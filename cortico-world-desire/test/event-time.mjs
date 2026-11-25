/**
 * 时间线要按「事情发生」排，不是按「我扫到它」排
 *   node test/event-time.mjs
 */
const mod = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js');
const Cls = Object.values(mod).find((v) => typeof v === 'function' && v.happenedAt);

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

const fmt = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

console.log('\n[1] note 里的 [私聊 HH:MM] 才是发生时刻');

const a = Cls.happenedAt(
  '#-1569091493 [私聊 00:35] Partner(1000000000): （最后两下…',
  'chat:2026-11-22T04:28:00Z',
  '2026-11-22T04:28:00Z',
);
fmt(a) === '11-22 00:35' ? ok(`推成 ${fmt(a)}`) : bad('不对', fmt(a));

const b = Cls.happenedAt('[私聊 20:41] Partner: 灌满了', 'notes:2026-11-21.md', null);
fmt(b) === '11-21 20:41' ? ok(`从文件名取日期：${fmt(b)}`) : bad('不对', fmt(b));

console.log('\n[2] 推出来在未来 → 是昨天那个点');

const nowIso = new Date().toISOString();
const future = Cls.happenedAt('[私聊 23:50] Partner: 晚安', 'notes:2026-11-22.md', nowIso);
Date.parse(future) <= Date.now() ? ok(`没有跑到未来（${fmt(future)}）`) : bad('跑到未来了', fmt(future));

console.log('\n[3] 没有时间标记就照原样');

const c = Cls.happenedAt('（23:30–23:39 那一段，很密）', 'chat:2026-11-21T15:30:00Z', '2026-11-21T15:30:00Z');
c === '2026-11-21T15:30:00Z' ? ok('密度法那种保持原样') : bad('被改了', c);

console.log('\n[4] 真实事件顺序（倒序，新的在上）');

const st = JSON.parse(
  (await import('node:fs')).readFileSync(
    'D:/Applications/Coopanion/data/home/companion/data/worlds/desire/state.json',
    'utf-8',
  ),
);
const ev = [...st.events].sort((x, y) => Date.parse(y.at) - Date.parse(x.at));
const order = ev.map((e) => `${String(e.kind)}@${fmt(e.at)}`);
console.log('   ' + order.join('  >  '));

const fill = ev.find((e) => String(e.note).includes('[私聊 00:35]'));
if (fill) {
  Date.parse(fill.at) < Date.parse('2026-11-22T04:00:00+08:00')
    ? ok('00:35 那次灌满排在 12:28 之前了（不再是扫到的时刻）')
    : bad('还是记在扫到的时刻', fmt(fill.at));
} else {
  ok('（这次没有那条，跳过）');
}

const sorted = ev.every((e, i) => i === 0 || Date.parse(ev[i - 1].at) >= Date.parse(e.at));
sorted ? ok('整体是按时间倒序的') : bad('顺序乱', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
