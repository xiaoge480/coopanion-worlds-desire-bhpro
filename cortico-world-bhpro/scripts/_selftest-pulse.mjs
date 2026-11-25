/**
 * 单连接 pulse 的自测（不碰真实蓝牙）。
 *   node scripts/_selftest-pulse.mjs
 *
 * 验的是：循环逻辑、节奏、中断、以及「一次连接跑完」这件事本身。
 * 用一个假 python 脚本冒充 bt_toyctl.py pulse，看 JS 那边怎么起、怎么收。
 */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(HERE, '..', 'src', 'index.js'), 'utf-8');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 结构：pulse 只连一次');

/runPulseScript\(/.test(code) ? ok('有 runPulseScript') : bad('没有', '还在一条条 runScript');
/spawn\(python, \[script, \.\.\.args\]/.test(code)
  ? ok('用 spawn 一次起 python、边跑边读 beat')
  : bad('没用 spawn', '拿不到流式进度');
const argOrder = /'pulse', String\(level\), String\(pattern\), String\(onMs\), String\(offMs\), String\(times\)/.test(code);
argOrder
  ? ok('参数顺序 level/pattern/onMs/offMs/times')
  : bad('参数顺序不对', '跟 python 那边对不上');

console.log('\n[2] python 那边有 pulse');

const py = readFileSync(join(HERE, 'bt_toyctl.py'), 'utf-8');
/pulse/.test(py) ? ok('bt_toyctl.py 认 pulse') : bad('python 没 pulse', '跑不起来');
/async with BleakClient[\s\S]{0,3000}?while True:/.test(py)
  ? ok('循环在 async with 里面 = 一次连接')
  : bad('循环不在连接里', '还是每拍重连');
/print\("beat=" \+ str\(beats\)/.test(py) ? ok('每拍打 beat=N') : bad('没有进度输出', 'JS 报不了数');
/STOP_FLAG/.test(py) ? ok('python 自己查刹车文件') : bad('python 不查刹车', '中途停不下来');
/await sleep_until\(on_ms\)/.test(py) ? ok('onMs 用可中断的睡') : bad('onMs 不可中断', '停不掉');
/WRITE_GAP/.test(py) && /await asyncio\.sleep\(WRITE_GAP\)/.test(py)
  ? ok('每帧隔 WRITE_GAP（协议要求 0.35s）')
  : bad('没有帧间隔', '帧会被丢，设备不动');
/RUN_VALUE = 1/.test(py) ? ok('有 RUN_VALUE=1') : bad('没有运行值', '停了之后重启不了');
/await write\(PROP_RUN, RUN_VALUE\)/.test(py)
  ? ok('每拍先写 RUN=1 再写强度')
  : bad('每拍没写 RUN=1', '只会写强度，可能不重启');
/finally:[\s\S]{0,400}?PROP_RUN, STOP_VALUE/.test(py)
  ? ok('finally 里先 stop 再断开')
  : bad('退出没补 stop', '可能悬着震');

console.log('\n[3] 真跑：假 python 冒充（验 JS 半边）');

// 造一个假 python：只按 pulse 参数打 beat 行，不碰蓝牙
const fakePy = join(HERE, '_fake-pulse.py');
writeFileSync(
  fakePy,
  [
    'import sys, time, os',
    'args = sys.argv[2:]',
    'level, pattern, on_ms, off_ms, times = (int(x) for x in args[:5])',
    'n = 0',
    'while times == 0 or n < times:',
    '    n += 1',
    '    print("beat=" + str(n), flush=True)',
    '    time.sleep((on_ms + off_ms) / 1000.0)',
    'print("done beats=" + str(n), flush=True)',
  ].join('\n'),
  'utf-8',
);

const clsStart = code.indexOf('class BhproWorld');
const clsBody = code.slice(clsStart).replace(/^export default[\s\S]*$/m, '');
const fakeSrc = join(HERE, '_fake-single.mjs');
writeFileSync(
  fakeSrc,
  `
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const SCRIPT_DIR = ${JSON.stringify(HERE.replace(/\\/g, '/'))};
const DEFAULT_PYTHON = 'python';
const BHPRO_DEFAULTS = { pythonPath: DEFAULT_PYTHON, scriptPath: '', address: '', timeoutSec: 40, mock: false };
const execFileAsync = async () => ({ stdout: '', stderr: '' });
const STATE_FILE = join(SCRIPT_DIR, 'toy-state.json');
function readState(){ return {}; }
function writeState(){}
function readCachedAddress(){ return 'AA:BB:CC:DD:EE:FF'; }
const progressLog = [];
function writePulseProgress(n){ progressLog.push({ ...n, at: new Date().toISOString() }); }
function readPulseProgress(){ return progressLog.length ? progressLog[progressLog.length-1] : null; }
function isPulseRunning(){ const p = readPulseProgress(); return !!p && p.running === true; }
function readPing(){ return null; }
function writePing(){}
const PING_FILE = join(SCRIPT_DIR, 'toy-ping.json');
let pulseStopFlag = false;
function pulseStopRequested(){ return pulseStopFlag; }
function requestPulseStop(){ pulseStopFlag = true; }
function resetPulseStop(){ pulseStopFlag = false; }
${clsBody}
export { BhproWorld, progressLog };
`,
  'utf-8',
);

try {
  const { BhproWorld, progressLog } = await import('file://' + fakeSrc.replace(/\\/g, '/'));
  const PY = process.env.TOY_PYTHON || 'python';
  const w = new BhproWorld({ cfg: { scriptPath: fakePy, pythonPath: PY } });
  const pulse = w.tools().find((t) => t.name === 'toy_pulse');

  progressLog.length = 0;
  const r = await pulse.handler({ times: 3, onMs: 60, offMs: 60, level: 4, pattern: 2 });
  /3 下/.test(r) ? ok('回执说 3 下：' + r) : bad('回执不对', r);

  const beatsSeen = progressLog.filter((x) => x.running && x.done > 0).map((x) => x.done);
  JSON.stringify(beatsSeen) === JSON.stringify([1, 2, 3])
    ? ok('进度实时报到了 1,2,3')
    : bad('进度没实时报', JSON.stringify(beatsSeen));

  progressLog[progressLog.length - 1].running === false
    ? ok('收尾写了 running:false')
    : bad('没收尾', '面板会一直显示在跑');
} finally {
  for (const f of [fakePy, fakeSrc]) {
    try { unlinkSync(f); } catch {}
  }
}

console.log(fail === 0 ? '\n全部通过。' : '\n有 ' + fail + ' 项没过。');
process.exitCode = fail === 0 ? 0 : 1;
