/**
 * 睡觉时欲求停涨
 *   node test/sleep-pause.mjs
 *
 * 2026-11-22 机主说：每天互道晚安之后就睡了，
 * 睡着的这段时间不该再涨；她 7:20 会自己醒，那时候再接着涨。
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

// 造一个临时聊天记录，可控地写「晚安」
const dir = mkdtempSync(join(tmpdir(), 'desire-sleep-'));
const chatLog = join(dir, 'chat.jsonl');

function writeChat(lines) {
  writeFileSync(chatLog, lines.map((l) => JSON.stringify(l)).join('\n') + '\n', 'utf-8');
}

// 真实会话记录的形状是 { version, item, context }，textsOf 读的是 item ——
// 之前这里造的是 { message }，所以永远认不出来（测试自己骗自己）。
const rec = (ts, text) => ({
  version: 2,
  item: { type: 'message', role: 'user', content: [{ type: 'text', text }] },
  context: { ts },
});

const make = (cfg = {}) =>
  new W({
    dataDir: join(dir, 'data'),
    cfg: { chatLog, sleepPauseEnabled: true, wakeHour: 7, wakeMinute: 20, ...cfg },
  });

console.log('\n[1] 认得出「晚安」');

// 今晚 23:30 说了晚安
// 凌晨跑测试时 new Date() 设 23:30 会得到「今晚」（未来），被 ts>now 挡掉 —— 用昨天
const d = new Date(Date.now() - 24 * 3600 * 1000);
d.setHours(23, 30, 0, 0);
writeChat([
  rec(new Date(d.getTime() - 3600000).toISOString(), '在忙'),
  rec(d.toISOString(), '晚安'),
]);

let w = make();
let gn = w.readGoodNight(Date.now());
gn !== null ? ok(`找到晚安：${new Date(gn).toLocaleString('zh-CN')}`) : bad('没找到', '');

const wake = w.wakeAfter(gn);
const wd = new Date(wake);
wd.getHours() === 7 && wd.getMinutes() === 20
  ? ok(`醒在 ${wd.getHours()}:${String(wd.getMinutes()).padStart(2, '0')}`)
  : bad('醒来时刻不对', wd.toString());
wd.getTime() > gn ? ok('醒在晚安之后') : bad('醒在晚安之前', '');

console.log('\n[2] 白天说的「晚安」不算');

const day = new Date(Date.now() - 24 * 3600 * 1000);
day.setHours(14, 0, 0, 0);
writeChat([rec(day.toISOString(), '晚安（开玩笑）')]);
w = make();
w.readGoodNight(Date.now()) === null ? ok('下午的晚安不算数') : bad('误判了', '');

console.log('\n[3] 凌晨说的晚安 → 当天 7:20 醒');

const dawn = new Date(Date.now() - 24 * 3600 * 1000);
dawn.setHours(2, 0, 0, 0);
writeChat([rec(dawn.toISOString(), '晚安')]);
w = make();
gn = w.readGoodNight(Date.now());
const wakeD = new Date(w.wakeAfter(gn));
wakeD.getDate() === dawn.getDate() && wakeD.getHours() === 7
  ? ok(`凌晨 2 点的晚安 → 当天 ${wakeD.getHours()}:${String(wakeD.getMinutes()).padStart(2, '0')} 醒`)
  : bad('日期算错', wakeD.toString());

console.log('\n[4] 睡着期间三个量都不动');

// 造一个已经睡着的 state：晚安在 1 小时前，wake 在 8 小时后
w = make();
const st0 = w.read();
const sleepFrom = new Date(Date.now() - 3600000);
const wakeAt = new Date(Date.now() + 8 * 3600000);
st0.sleepFrom = sleepFrom.toISOString();
st0.wakeAt = wakeAt.toISOString();
st0.heat = 60;
st0.satiety = 40;
st0.retention = 50;
st0.lastTickAt = sleepFrom.toISOString();
w.write(st0);

const t = w.tick();
Math.abs(t.heat - 60) < 0.01 ? ok(`欲求不动 ${t.heat}`) : bad('欲求涨了', String(t.heat));
Math.abs(t.satiety - 40) < 0.01 ? ok(`满足不掉 ${t.satiety}`) : bad('满足掉了', String(t.satiety));
Math.abs(t.retention - 50) < 0.01 ? ok(`留存不吸 ${t.retention}`) : bad('留存被吸了', String(t.retention));
t.sleepFrom ? ok('记着 sleepFrom') : bad('没记', '');
t.wakeAt ? ok(`记着 wakeAt：${t.wakeAt.slice(11, 16)}`) : bad('没记', '');

console.log('\n[5] 关了开关就照常涨（可回退）');

writeChat([rec(new Date(Date.now() - 3600000).toISOString(), '晚安')]);
w = make({ sleepPauseEnabled: false });
w.readGoodNight(Date.now()) === null ? ok('开关关掉后不认识晚安') : bad('还在判', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
