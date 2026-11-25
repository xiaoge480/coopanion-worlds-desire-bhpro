/**
 * 假设备 + ping 的自测（不碰真实蓝牙）。
 *   node scripts/_selftest-mock.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(HERE, '..', 'src', 'index.js'), 'utf-8');

let fail = 0;
const ok = (n) => console.log(`  ✓ ${n}`);
const bad = (n, w) => {
  fail += 1;
  console.log(`  ✗ ${n}  ← ${w}`);
};

console.log('\n[1] 工具表');

const names = [...code.matchAll(/name: '([a-z_]+)'/g)].map((m) => m[1]);
for (const want of ['toy_set', 'toy_stop', 'toy_scan', 'toy_status', 'toy_pulse', 'toy_ping']) {
  names.includes(want) ? ok(`${want} 在`) : bad(`${want} 不在`, '没注册');
}

console.log('\n[2] 假设备开关');

/raw\.mock === true \|\| process\.env\.TOY_MOCK === '1'/.test(code)
  ? ok('config 里能开，也能用 TOY_MOCK=1')
  : bad('没有假设备开关', '配置读不到 mock');
/if \(cfg\.mock\) return this\.runMock\(args\)/.test(code)
  ? ok('开了就完全不碰 python')
  : bad('没分流', '假设备模式下还会去跑脚本');
/worlds\.bhpro\.mock/.test(code)
  ? ok('设置页能看到这个开关')
  : bad('设置页没有', '只能在配置文件里手改');

console.log('\n[3] 真跑一遍假设备');

// 抠出 class，垫上最小依赖
const clsStart = code.indexOf('class BhproWorld');
const clsBody = code.slice(clsStart).replace(/^export default[\s\S]*$/m, '');
const fakeSrc = `
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const SCRIPT_DIR = 'E:/tmp';
const DEFAULT_PYTHON = 'C:/fake/python.exe';
const BHPRO_DEFAULTS = { pythonPath: DEFAULT_PYTHON, scriptPath: '', address: '', timeoutSec: 40, mock: false };
const execFileAsync = async () => ({ stdout: '', stderr: '' });
const STATE_FILE = join(SCRIPT_DIR, 'toy-state.json');
function readState(){ return {}; }
function writeState(){}
function readCachedAddress(){ return 'AA:BB:CC:DD:EE:FF'; }
function readPulseProgress(){ return null; }
function writePulseProgress(){}
function readPing(){ return null; }
function writePing(){}
function isPulseRunning(){ return false; }
const PING_FILE = join(SCRIPT_DIR, 'toy-ping.json');
let pulseStopFlag = false;
function pulseStopRequested(){ return pulseStopFlag; }
function requestPulseStop(){ pulseStopFlag = true; }
function resetPulseStop(){ pulseStopFlag = false; }
function sleepUnlessStopped(ms){ return new Promise((r)=>{ const u=Date.now()+ms; const t=()=>{ if(pulseStopRequested()) return r(false); if(Date.now()>=u) return r(true); setTimeout(t,5); }; t(); }); }
${clsBody}
export { BhproWorld };
`;

const tmp = join(HERE, '_fake-mock.mjs');
writeFileSync(tmp, fakeSrc, 'utf-8');

try {
  const { BhproWorld } = await import('file://' + tmp.replace(/\\/g, '/'));
  const w = new BhproWorld({ cfg: { mock: true } });
  const ping = w.tools().find((t) => t.name === 'toy_ping');
  const pulse = w.tools().find((t) => t.name === 'toy_pulse');
  const stop = w.tools().find((t) => t.name === 'toy_stop');

  // ping：连通
  const r1 = await ping.handler({});
  /连上了/.test(r1) ? ok(`ping 说连上了（${r1}）`) : bad('ping 没说连上', r1);

  // ping：断开
  w._mock.connected = false;
  const r2 = await ping.handler({});
  /连不上|没找到/.test(r2) ? ok('ping 能报告连不上') : bad('断开时没说清', r2);
  w._mock.connected = true;

  // pulse 在假设备上：现在是一次调用、内部记拍
  w._mock.log.length = 0;
  const r3 = await pulse.handler({ times: 3, onMs: 60, offMs: 60, level: 7, pattern: 2 });
  const beats = w._mock.log.filter((x) => x.cmd === 'beat');
  const call = w._mock.log.find((x) => x.cmd === 'pulse');
  beats.length === 3 && call?.level === 7 && call?.pattern === 2
    ? ok(`pulse 在假设备上记了 3 拍、参数对（${r3}）`)
    : bad('pulse 假设备跑得不对', JSON.stringify(w._mock.log));

  // stop 之后 running=false
  await stop.handler({});
  w._mock.running === false ? ok('stop 把假设备关了') : bad('stop 没生效', '');
} finally {
  try { unlinkSync(tmp); } catch {}
}

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
