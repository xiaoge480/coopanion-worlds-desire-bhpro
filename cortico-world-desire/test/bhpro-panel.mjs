import { readFileSync, writeFileSync } from 'node:fs';

// 外设面板自测：伪造 state 各种情况，看 connText 怎么说
const p = 'C:/Users/User/.dsh/cortico-world-bhpro/src/webui-v2.js';
const src = readFileSync(p, 'utf-8');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 源码里有连接状态这一行');

/conn:\s*'连接状态'/.test(src) ? ok('有「连接状态」文案') : bad('没有', '');
/const connText = \(s\) =>/.test(src) ? ok('有 connText 帮手') : bad('没有', '');
/\{ k: TEXT\.conn, v: connText\(s\) \}/.test(src) ? ok('插进键值行了') : bad('没插进', '');
/TEXT\.ping/.test(src) ? ok('有「检查连接」按钮') : bad('没有按钮', '');

console.log('\n[2] 四种情形怎么说');

// 把 connText 抠出来单独跑
const m = src.match(/const connText = \(s\) => \{[\s\S]*?\n    \};/);
if (!m) {
  bad('抠不出 connText', '');
} else {
  const TEXT = {
    noAddr: '（没扫到过）',
    connNever: '还没检查过',
    connOk: '已记住设备 · 已连接（可以正常操控）',
    connFail: '已记住设备 · 未连接（关机 / 找不到 / 被手机占着）',
    connStale: '已记住设备 · 不知道现在连不连得上',
  };
  const fn = new Function('TEXT', m[0] + '\n return connText;')(TEXT);

  fn({ address: '', lastPing: null }).includes('没扫到') ? ok('没地址 → 没扫到') : bad('', fn({ address: '' }));

  fn({ address: 'B4:AA', lastPing: null }).includes('还没检查过') ? ok('有地址没查过 → 还没检查过') : bad('', '');

  const freshOk = fn({
    address: 'B4:AA',
    lastPing: { ok: true, at: new Date(Date.now() - 60000).toISOString() },
  });
  freshOk.includes('已连接') ? ok('刚查过通了 → 已连接：' + freshOk) : bad('', freshOk);

  const freshFail = fn({
    address: 'B4:AA',
    lastPing: { ok: false, at: new Date(Date.now() - 120000).toISOString() },
  });
  freshFail.includes('未连接') ? ok('刚查过不通 → 未连接：' + freshFail) : bad('', freshFail);

  const stale = fn({
    address: 'B4:AA',
    lastPing: { ok: true, at: new Date(Date.now() - 1035 * 60000).toISOString() },
  });
  stale.includes('不知道') ? ok('1035 分钟前的结果 → 不知道：' + stale) : bad('还在说已连接', stale);
}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
