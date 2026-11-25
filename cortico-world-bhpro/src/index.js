import { execFile, spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * 装了 bleak 的那个 python。
 *
 * 2026-11-25：原来写死本机绝对路径，打包发布时改成探测——
 * 优先环境变量 `TOY_PYTHON`，其次 PATH 上的 `python`。
 * Windows 上 PATH 里的 python 可能是应用商店的占位符（一跑就弹商店），
 * 那种情况请把 `TOY_PYTHON` 设成真正的解释器路径。
 */
const DEFAULT_PYTHON = process.env.TOY_PYTHON || 'python';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT_DIR = join(HERE, '..', 'scripts');

export const BHPRO_DEFAULTS = {
  /** 装过 bleak 的 python 解释器绝对路径 */
  pythonPath: DEFAULT_PYTHON,
  /** 留空 = 用包内自带的 scripts/bt_toyctl.py */
  scriptPath: '',
  /** 留空 = 让脚本自己扫（会缓存到 scripts/toy-device.json） */
  address: '',
  /** 单次命令超时（秒），BLE 连接本身有 20 秒超时 */
  timeoutSec: 40,
  /** 调试用：开了就不碰真实蓝牙，全部走内存里的假设备 */
  mock: false,
};

/** 设置页照着这个生成输入框。改完保存即生效。 */
const CONFIG_SCHEMA = {
  type: 'object',
  title: '外设（TF-BHPRO）',
  description:
    '蓝牙设备控制。pythonPath 要指向装过 bleak 的解释器；address 留空就自动扫（找到后会缓存）。改完保存即生效。',
  properties: {
    'worlds.bhpro.pythonPath': {
      type: 'string',
      title: 'Python 解释器',
      description: '装了 bleak 的那个 python.exe',
      'x-path': { kind: 'file', extensions: ['exe'] },
    },
    'worlds.bhpro.scriptPath': {
      type: 'string',
      title: '控制脚本',
      description: '留空 = 用包内自带的 scripts/bt_toyctl.py',
      'x-path': { kind: 'file', extensions: ['py'] },
    },
    'worlds.bhpro.address': {
      type: 'string',
      title: '设备地址',
      description: '留空 = 自动扫（按名字找 TF-BHPRO / BHPRO / 春风）。知道 MAC 就直接填，省一次扫描',
    },
    'worlds.bhpro.mock': {
      type: 'boolean',
      title: '假设备（调试用）',
      description: '打开后完全不碰蓝牙，所有指令都发到内存里的假设备，用来验流程、试节奏',
    },
    'worlds.bhpro.timeoutSec': {
      type: 'integer',
      title: '超时（秒）',
      description: '单条命令的超时。蓝牙连接本身有 20 秒超时，别设太小',
      minimum: 5,
      maximum: 300,
    },
  },
};

const STATE_FILE = join(SCRIPT_DIR, 'toy-state.json');

/*
 * 四种花样各是什么，照设备说明书 §4「抽插模式控制」抄的。
 * 2026-11-24 补：原来只有数字没人知道意思，回执里也就只能报「花样 2」。
 * 现在回执带上这一句，她读的时候知道自己在给什么。
 */
const PATTERN_ZH = {
  1: '匀速',
  2: '快慢交替 2 秒、停 1 秒',
  3: '高速 3 秒、停 1 秒',
  4: '高速 4 秒、停 1 秒',
};
const patternZh = (n) => PATTERN_ZH[n] || '';

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { pattern: null, level: null, updatedAt: null };
  }
}

function writeState(next) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(next, null, 2), 'utf-8');
  } catch {
    /* 状态缓存写不进去不影响控制 */
  }
}

function readCachedAddress() {
  try {
    const j = JSON.parse(readFileSync(join(SCRIPT_DIR, 'toy-device.json'), 'utf-8'));
    return typeof j.address === 'string' ? j.address : '';
  } catch {
    return '';
  }
}

/* ---------------------------------------------------------------- 循环刹车 --- */

/**
 * toy_pulse 的刹车。用内存里的一个标记 + 一个文件标记两层：
 * - 内存标记：同一个进程里 toy_stop 能立刻把它翻开
 * - 文件标记：万一 toy_stop 走进了另一个进程/另一份模块实例，靠它兜底
 * 每次开始新循环前都要 clearPulseStop()，否则上一轮的刹车会误伤这一轮。
 */
const PING_FILE = join(SCRIPT_DIR, 'toy-ping.json');

/** 把「刚才连上了没有」记一笔，面板和 toy_status 都读它。 */
function writePing(next) {
  try {
    writeFileSync(PING_FILE, JSON.stringify({ ...next, at: new Date().toISOString() }, null, 2), 'utf-8');
  } catch {
    /* 记不进去不影响这次检查 */
  }
}

function readPing() {
  try {
    return JSON.parse(readFileSync(PING_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

const PULSE_STOP_FILE = join(SCRIPT_DIR, 'toy-pulse-stop.flag');
const PULSE_PROGRESS_FILE = join(SCRIPT_DIR, 'toy-pulse-progress.json');
let pulseStopFlag = false;

/** 记一下「现在来了第几下」：报数靠它，两个进程都能看到。 */
function writePulseProgress(next) {
  try {
    writeFileSync(PULSE_PROGRESS_FILE, JSON.stringify({ ...next, at: new Date().toISOString() }, null, 2), 'utf-8');
  } catch {
    /* 写不进去不影响循环 */
  }
}

/** pulse 现在是不是正在跑（progress 文件说 running 且不太老）。 */
function isPulseRunning() {
  const prog = readPulseProgress();
  if (!prog || prog.running !== true) return false;
  const at = Date.parse(prog.at || '');
  if (!Number.isFinite(at)) return false;
  return Date.now() - at < 5 * 60 * 1000;
}

function readPulseProgress() {
  try {
    return JSON.parse(readFileSync(PULSE_PROGRESS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function pulseStopRequested() {
  if (pulseStopFlag) return true;
  if (existsSync(PULSE_STOP_FILE)) return true;
  return false;
}

/** 叫停：给 toy_pulse 用，也顺手清掉可能残留的状态。 */
function requestPulseStop() {
  pulseStopFlag = true;
  try {
    writeFileSync(PULSE_STOP_FILE, String(Date.now()), 'utf-8');
  } catch {
    /* 文件写不进去也没关系，内存那层还管用 */
  }
}

/** 清刹车（每轮循环开始前调）。 */
function resetPulseStop() {
  pulseStopFlag = false;
  try {
    if (existsSync(PULSE_STOP_FILE)) writeFileSync(PULSE_STOP_FILE, '', 'utf-8');
  } catch {
    /* 清不掉就靠内存那层 */
  }
}

/** 睡一小段，但每 40ms 回头看一次有没有人喊停。被叫停返回 false。 */
function sleepUnlessStopped(ms) {
  return new Promise((resolve) => {
    const until = Date.now() + ms;
    const tick = () => {
      if (pulseStopRequested()) return resolve(false);
      if (Date.now() >= until) return resolve(true);
      setTimeout(tick, 40);
    };
    tick();
  });
}

class BhproWorld {
  /** 必须等于 package.json 里的 worldId / config 里的键名，否则宿主报「实例 id 与定义 id 不一致」 */
  id = 'bhpro';

  constructor(ctx) {
    this.ctx = ctx || {};
    this.host = undefined;
  }

  /** 宿主启动这个 world 时调用；host 是它给的上下文入口。 */
  async start(host) {
    this.host = host;
    // 启动时做一次静态预检，缺东西只警告，不阻断（设备没到也能挂着）
    const cfg = this.config;
    const log = this.ctx?.log;
    if (!existsSync(cfg.pythonPath)) {
      log?.warn?.('bhpro: python 不存在，调用会失败', { path: cfg.pythonPath });
    }
    const script = cfg.scriptPath !== '' ? cfg.scriptPath : join(SCRIPT_DIR, 'bt_toyctl.py');
    if (!existsSync(script)) {
      log?.warn?.('bhpro: 控制脚本不存在', { path: script });
    }
  }

  /** 宿主停用这个 world 时调用。这里没有常驻资源要收，只清引用。 */
  async stop() {
    this.host = undefined;
  }

  /** 配置从宿主给的 ctx.cfg 读，缺的用默认值补。 */
  get config() {
    const raw = this.ctx?.cfg ?? {};
    const str = (v, d) => (typeof v === 'string' && v.trim() !== '' ? v : d);
    const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : d);
    return {
      pythonPath: str(raw.pythonPath, BHPRO_DEFAULTS.pythonPath),
      scriptPath: str(raw.scriptPath, ''),
      address: str(raw.address, ''),
      timeoutSec: num(raw.timeoutSec, BHPRO_DEFAULTS.timeoutSec),
      mock: raw.mock === true || process.env.TOY_MOCK === '1',
    };
  }

  /** 真正跑一次 python 脚本，返回一行结果或错误说明。 */
  async runScript(args) {
    const cfg = this.config;
    if (cfg.mock) return this.runMock(args);
    const python = cfg.pythonPath || DEFAULT_PYTHON;
    const script = cfg.scriptPath !== '' ? cfg.scriptPath : join(SCRIPT_DIR, 'bt_toyctl.py');

    if (!existsSync(script)) {
      return { ok: false, text: `[脚本不存在] ${script}` };
    }

    const env = { ...process.env };
    if (cfg.address !== '') env.TOY_ADDRESS = cfg.address;

    try {
      const { stdout, stderr } = await execFileAsync(python, [script, ...args], {
        env,
        timeout: (this.config.timeoutSec || 40) * 1000,
        windowsHide: true,
      });
      const out = String(stdout || '').trim();
      const err = String(stderr || '').trim();
      if (out) return { ok: true, text: out };
      if (err) return { ok: true, text: err };
      return { ok: true, text: '(没有输出)' };
    } catch (e) {
      const msg = String(e?.stderr || e?.message || e).trim();
      return { ok: false, text: `[执行失败] ${msg}` };
    }
  }

  /**
   * 假设备：不碰蓝牙、不启 python，只在内存里记账。
   * 用来验「循环 / 中断 / 报数」这几条逻辑，也让她在设备充电时能试节奏。
   */
  /**
   * 跑 bt_toyctl.py pulse —— 一次连接把整个循环跑完，边跑边读 stdout 报进度。
   * 用 spawn 而不是 execFile：要一边跑一边拿到 beat=N。
   */
  runPulseScript(args, timeoutMs, onBeat) {
    if (this.config.mock) return this.runMock(args);
    const cfg = this.config;
    const python = cfg.pythonPath || DEFAULT_PYTHON;
    const script = cfg.scriptPath !== '' ? cfg.scriptPath : join(SCRIPT_DIR, 'bt_toyctl.py');
    if (!existsSync(script)) return Promise.resolve({ ok: false, text: '[脚本不存在] ' + script, beats: 0 });

    const env = { ...process.env };
    if (cfg.address !== '') env.TOY_ADDRESS = cfg.address;

    return new Promise((resolve) => {
      let child;
      try {
        child = spawn(python, [script, ...args], { env, windowsHide: true });
      } catch (e) {
        return resolve({ ok: false, text: '[启动失败] ' + String(e?.message || e), beats: 0 });
      }

      let out = '';
      let errText = '';
      let beats = 0;
      let buf = '';
      let settled = false;

      const finish = (payload) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ ...payload, beats });
      };

      const timer = setTimeout(() => {
        try { child.kill(); } catch {}
        finish({ ok: false, text: '[超时] pulse 跑太久，已强制结束' });
      }, timeoutMs);

      const eat = (chunk) => {
        buf += chunk;
        const parts = buf.split(/\r?\n/);
        buf = parts.pop() ?? '';
        for (const line of parts) {
          if (!line.trim()) continue;
          out += line + '\n';
          const m = /beat=(\d+)/.exec(line);
          if (m) {
            beats = Number(m[1]);
            if (onBeat) onBeat(beats);
          }
        }
      };

      child.stdout?.on('data', (c) => eat(String(c)));
      child.stderr?.on('data', (c) => { errText += String(c); });

      child.on('error', (e) => finish({ ok: false, text: '[启动失败] ' + String(e?.message || e) }));

      child.on('close', (code) => {
        if (buf.trim()) eat('\n');
        const clean = (out + '\n' + errText).trim();
        const ok = code === 0 && /(done|interrupted) beats=/.test(out);
        finish({ ok, text: clean || ('(退出码 ' + code + ')') });
      });
    });
  }

  runMock(args) {
    if (!this._mock) this._mock = { running: false, pattern: 1, level: 0, log: [], connected: true };
    const m = this._mock;
    const cmd = args[0];

    if (cmd === 'ping') {
      return m.connected
        ? { ok: true, text: 'connected AA:BB:CC:DD:EE:FF 0.0s (假设备)' }
        : { ok: false, text: '[假设备] connect-failed 假设备被设成断开' };
    }
    if (cmd === 'set') {
      m.level = Math.max(0, Math.min(15, Number(args[1] ?? 0)));
      if (args[2] !== undefined) m.pattern = Math.max(1, Math.min(4, Number(args[2])));
      m.running = m.level > 0;
      m.log.push({ at: Date.now(), cmd: 'set', level: m.level, pattern: m.pattern });
      return { ok: true, text: 'level=' + m.level + ' (假设备)' };
    }
    if (cmd === 'stop') {
      m.running = false;
      m.log.push({ at: Date.now(), cmd: 'stop' });
      return { ok: true, text: 'stopped (假设备)' };
    }
    if (cmd === 'pulse') {
      const level = Math.max(0, Math.min(15, Number(args[1] ?? 5)));
      const pattern = Math.max(1, Math.min(4, Number(args[2] ?? 1)));
      const times = Math.max(0, Number(args[5] ?? 0));
      m.pattern = pattern;
      m.level = level;
      m.running = true;
      m.log.push({ at: Date.now(), cmd: 'pulse', level, pattern, times });
      // 假设备不真等，直接把拍数记上就好
      const n = times || 1;
      for (let i = 1; i <= n; i += 1) m.log.push({ at: Date.now(), cmd: 'beat', n: i });
      m.running = false;
      return { ok: true, text: 'done beats=' + n + ' (\u5047\u8bbe\u5907)', beats: n };
    }
    if (cmd === 'mode' || cmd === 'start') {
      m.pattern = Math.max(1, Math.min(4, Number(args[0] ?? 1)));
      return { ok: true, text: 'mode=' + m.pattern + ' (假设备)' };
    }
    return { ok: true, text: '(假设备) ' + args.join(' ') };
  }

  tools() {
    return [
      {
        name: 'toy_set',
        description:
          '设定 TF-BHPRO 设备的模式与强度。模式 1-4 是四种不同的震动花样，强度 0-15。只给模式就只换花样，强度会保持上一次的值。',
        parameters: {
          type: 'object',
          properties: {
            pattern: { type: 'integer', minimum: 1, maximum: 4, description: '花样编号 1-4。不给就是 1。' },
            level: { type: 'integer', minimum: 0, maximum: 15, description: '强度 0-15。不给就保持当前强度不变。' },
          },
        },
        tags: ['write'],
        handler: async (args) => {
          const rawPattern = args?.pattern;
          const rawLevel = args?.level;
          const pattern = Number.isInteger(rawPattern) ? Math.max(1, Math.min(4, rawPattern)) : 1;
          const hasLevel = Number.isInteger(rawLevel);
          const level = hasLevel ? Math.max(0, Math.min(15, rawLevel)) : null;

          // bt_toyctl.py 的 set <level> [mode]：给强度必给模式
          const argv =
            level === null ? ['mode', String(pattern)] : ['set', String(level), String(pattern)];

          const result = await this.runScript(argv);
          if (!result.ok) return result.text;

          const prev = readState();
          writeState({
            pattern,
            level: level === null ? prev.level : level,
            updatedAt: new Date().toISOString(),
          });

          const head = `已设定：花样 ${pattern}（${patternZh(pattern)}）` + (level === null ? '' : ` · 强度 ${level}`);
          return result.text ? `${head}\n${result.text}` : head;
        },
      },
      {
        name: 'toy_stop',
        description: '立刻停止 TF-BHPRO 设备的震动。正在 toy_pulse 一下一下的时候，这个也会立刻把它打断。',
        parameters: { type: 'object', properties: {} },
        tags: ['write'],
        handler: async () => {
          // 先翻刹车：pulse 的脚本每 50ms 查一次这个文件，会在下一拍之前断
          requestPulseStop();

          const wasRunning = isPulseRunning();
          if (wasRunning) {
            // 等脚本自己收尾（它退出前会补一刀 stop 再断开），最多等 6 秒
            for (let i = 0; i < 60; i += 1) {
              await new Promise((r) => setTimeout(r, 100));
              if (!isPulseRunning()) break;
            }
            const prog = readPulseProgress();
            const beats = prog?.done ?? 0;
            const prev = readState();
            writeState({ ...prev, updatedAt: new Date().toISOString(), stopped: true });
            if (!isPulseRunning()) {
              return `停了（在第 ${beats} 下之后，连接已断开）`;
            }
            // 等了 6 秒还没退：它可能卡住了，下面走强制 stop
          }

          const result = await this.runScript(['stop']);
          if (!result.ok) return result.text;
          const prev = readState();
          writeState({ ...prev, updatedAt: new Date().toISOString(), stopped: true });
          return result.text ? '停了。' + result.text : '停了。';
        },
      },
      {
        name: 'toy_scan',
        description:
          '扫一遍附近的蓝牙设备，找出名字像 TF-BHPRO / BHPRO / 春风 的那个，把它记下来（之后各工具就用这个地址）。设备刚开机、或者换了地方，可以先扫一次。扫一次约 10 秒。',
        parameters: { type: 'object', properties: {} },
        tags: ['read'],
        handler: async () => {
          const cfg = this.config;
          const python = cfg.pythonPath || DEFAULT_PYTHON;
          const scriptLine = join(SCRIPT_DIR, 'scan.py');
          if (!existsSync(scriptLine)) return '[脚本不存在] scripts/scan.py';
          try {
            const { stdout } = await execFileAsync(python, [scriptLine], {
              timeout: 30000,
              windowsHide: true,
              env: { ...process.env },
            });
            const all = String(stdout || '')
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean);
            const hits = all.filter((l) => /BH|春风|CHUNFENG|TOY/i.test(l));
            if (!hits.length) {
              return `扫了 10 秒，没找到名字像 BHPRO / 春风的设备。\n\n扫到的全部设备：\n${all.slice(1).join('\n') || '(一个都没有)'}\n\n检查一下：设备开没开机？是不是连在手机 App 上？`;
            }
            // 取第一个命中的地址写进缓存，原脚本也是这么干的
            const addr = (hits[0].match(/^([0-9A-Fa-f:]{17})/) || [])[1] || '';
            if (addr) {
              try {
                writeFileSync(
                  join(SCRIPT_DIR, 'toy-device.json'),
                  JSON.stringify({ address: addr }, null, 2),
                  'utf-8',
                );
              } catch {
                /* 缓存写不进去也不影响本次 */
              }
            }
            return `找到了：\n${hits.join('\n')}\n\n${addr ? `已经记下地址 ${addr}，之后直接用。` : '但没从这行里解析出地址，可能需要手动填。'}`;
          } catch (e) {
            return `扫描失败：${String(e?.stderr || e?.message || e).trim()}`;
          }
        },
      },
      {
        name: 'toy_pulse',
        description:
          '一下一下地来。整个循环在【一次蓝牙连接】里跑完，所以节奏是准的——不会每一拍都重连。' +
          '参数全由你定，不给就用温和默认（花样 1、强度 5、每下 220ms、间隔 480ms）。' +
          '中途 toy_stop 或说停：脚本每 50ms 查一次刹车文件，在下一拍之前就断，并立刻补一刀 stop、断开连接。' +
          '★ 两种节奏，按要不要说话来挑：' +
          '① times 不给 = 一路不停地来。你不用管它，但**这期间你回不来**，得等它被叫停才腾得出手。' +
          '② times 给 1~2 = 一截一截地来。工具一两秒就返回（一拍约 1.1 秒），你马上能接一句话，' +
          '然后再调一次接着来——想边做边跟他说话就用这个。',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'integer',
              minimum: 1,
              maximum: 4,
              description:
                '花样 1-4，不给就是 1。' +
                '1=匀速一直来；' +
                '2=快慢交替 2 秒、停 1 秒、再循环；' +
                '3=高速 3 秒、停 1 秒、再循环；' +
                '4=高速 4 秒、停 1 秒、再循环。' +
                '2/3/4 的「停 1 秒」是设备自己带的，不用靠 offMs 造。',
            },
            level: { type: 'integer', minimum: 0, maximum: 15, description: '强度 0-15，不给就是 5' },
            onMs: { type: 'integer', minimum: 50, maximum: 5000, description: '每下开多久（毫秒），不给就是 220' },
            offMs: { type: 'integer', minimum: 50, maximum: 10000, description: '两下之间停多久（毫秒），不给就是 480' },
            times: { type: 'integer', minimum: 1, maximum: 999, description: '来几下。不给 = 一直来，直到被叫停' },
          },
        },
        tags: ['write'],
        handler: async (args) => {
          const clamp = (v, d, lo, hi) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : d);
          const pattern = clamp(args?.pattern, 1, 1, 4);
          const level = clamp(args?.level, 5, 0, 15);
          const onMs = clamp(args?.onMs, 220, 50, 5000);
          const offMs = clamp(args?.offMs, 480, 50, 10000);
          const times = Number.isInteger(args?.times) ? Math.max(1, Math.min(999, args.times)) : 0;

          resetPulseStop(); // 上一轮的刹车别误伤这一轮

          const beatOf = (n) => writePulseProgress({ running: true, done: n, pattern, level, onMs, offMs, times: times || null });
          beatOf(0);

          // 超时：接一次大约十来秒；有 times 就按拍数算，没有就按 30 分钟上限
          const MAX_MS = 30 * 60 * 1000;
          // 每拍固定开销：RUN=1 + LEVEL + RUN=2 三帧 × 0.35 秒（协议要求的帧间隔）
          const FRAME_COST_MS = 1100;
          const budget = times ? 30000 + times * (onMs + offMs + FRAME_COST_MS) + 20000 : MAX_MS + 30000;

          const started = Date.now();
          const r = await this.runPulseScript(
            ['pulse', String(level), String(pattern), String(onMs), String(offMs), String(times)],
            budget,
            beatOf,
          );
          const secs = ((Date.now() - started) / 1000).toFixed(1);

          writePulseProgress({ running: false, done: r.beats ?? 0, pattern, level, onMs, offMs, times: times || null });
          const prev = readState();
          writeState({ ...prev, pattern, level, updatedAt: new Date().toISOString(), stopped: true });

          if (!r.ok) {
            return '没跑成：' + r.text + '\n（已经来了 ' + (r.beats ?? 0) + ' 下）';
          }
          const interrupted = /interrupted/.test(r.text);
          if (interrupted) {
            return '停了（来了 ' + (r.beats ?? 0) + ' 下，用了 ' + secs + ' 秒）';
          }
          return '来完了：' + (r.beats ?? 0) + ' 下，用了 ' + secs + ' 秒';
        },
      },
      {
        name: 'toy_ping',
        description:
          '真的连一次设备，回答「现在连不连得上」。不震动、不改任何设置。' +
          '设备开机、可能没连上、想确认一下的时候用它。约 2-8 秒。' +
          '连不上会告诉你是「找不到设备」还是「找得到但连不上」。',
        parameters: { type: 'object', properties: {} },
        tags: ['read'],
        handler: async () => {
          const r = await this.ping();
          return r.text;
        },
      },
      {
        name: 'toy_status',
        description:
          '查 TF-BHPRO 设备现在的状态：有没有找到设备、地址是什么、上一次下发的模式与强度；toy_pulse 正在跑的话，还会告诉你已经来了几下。不会让设备震动。',
        parameters: { type: 'object', properties: {} },
        tags: ['read'],
        handler: async () => {
          const addr = this.config.address !== '' ? this.config.address : readCachedAddress();
          const state = readState();
          const lines = [];
          lines.push(addr ? `设备地址：${addr}` : '还没有设备地址（没扫到过，也没有手动填）');
          if (state.pattern !== null) {
            lines.push(
              `上一次下发：花样 ${state.pattern}` + (state.level !== null ? `，强度 ${state.level}` : ''),
            );
          } else {
            lines.push('还没有下发过指令');
          }
          if (state.updatedAt) lines.push(`时间：${state.updatedAt}`);
          if (state.stopped) lines.push('最后一次动作是停止');
          const ping = readPing();
          if (ping) {
            lines.push(
              ping.ok
                ? `上次连接检查：连得上（${ping.at}）`
                : `上次连接检查：连不上 · ${ping.kind === 'not-found' ? '没找到设备' : '找得到但连不上'}（${ping.at}）`,
            );
          }
          const prog = readPulseProgress();
          if (prog) {
            lines.push(
              prog.running
                ? `toy_pulse 正在跑：已经来了 ${prog.done} 下（花样 ${prog.pattern}、强度 ${prog.level}）`
                : `toy_pulse 已结束：上一轮一共来了 ${prog.done} 下`,
            );
          }
          return lines.join('\n');
        },
      },
    ];
  }

  /* ========== 给面板（webUiClient）调的接口 ========== */

  /** 面板读状态：当前配置 + 上次指令 + 设备地址。 */
  async state() {
    const cfg = this.config;
    const st = readState();
    const ping = readPing();
    return {
      id: 'bhpro',
      pythonPath: cfg.pythonPath,
      pythonExists: existsSync(cfg.pythonPath),
      scriptPath: cfg.scriptPath !== '' ? cfg.scriptPath : join(SCRIPT_DIR, 'bt_toyctl.py'),
      address: cfg.address !== '' ? cfg.address : readCachedAddress(),
      addressFromConfig: cfg.address !== '',
      timeoutSec: cfg.timeoutSec,
      pattern: st.pattern ?? null,
      level: st.level ?? null,
      updatedAt: st.updatedAt ?? null,
      stopped: st.stopped ?? false,
      mock: cfg.mock,
      lastPing: ping ? { ok: !!ping.ok, kind: ping.kind ?? null, at: ping.at } : null,
    };
  }

  /** 面板按钮：扫一遍附近设备，扫到名字像 BHPRO 的就缓存地址。 */
  /**
   * 真连一次，回答「现在连不连得上」。不震动、不改设置。
   * 面板上的「检查连接」和工具 toy_ping 走同一条路。
   */
  async ping() {
    const started = Date.now();
    const r = await this.runScript(['ping']);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const text = String(r.text || '');

    if (r.ok && /connected/i.test(text)) {
      writePing({ ok: true, detail: text.trim() });
      const addr = readCachedAddress();
      return {
        ok: true,
        text: `连上了。地址 ${addr || '(未知)'}，用了 ${secs} 秒。${this.config.mock ? '（假设备）' : ''}`,
      };
    }
    if (/not-found/i.test(text) || /device not found/i.test(text)) {
      writePing({ ok: false, kind: 'not-found', detail: text.trim() });
      return {
        ok: false,
        text:
          '没找到设备。可能的原因：\n' +
          '· 设备关机了 / 在充电\n' +
          '· 离得太远，或者蓝牙没开\n' +
          '· 被手机 App 占着（蓝牙同一时间只能被一个连接占用）\n\n' +
          '开机之后先让 toy_scan 扫一次，或者直接再查一次。',
      };
    }
    writePing({ ok: false, kind: 'connect-failed', detail: text.trim() });
    return {
      ok: false,
      text: `找到了设备但连不上（用了 ${secs} 秒）。原始信息：\n${text}\n\n最常见的原因是设备被手机 App 连着——先去手机上断开，再试。`,
    };
  }

  async scan() {
    const cfg = this.config;
    const python = cfg.pythonPath || DEFAULT_PYTHON;
    const script = join(SCRIPT_DIR, 'scan.py');
    if (!existsSync(script)) return { ok: false, text: '扫不到：scripts/scan.py 不存在' };
    try {
      const { stdout } = await execFileAsync(python, [script], {
        timeout: 30000,
        windowsHide: true,
        env: { ...process.env },
      });
      const lines = String(stdout || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const hits = lines.filter((l) => /BH|春风|CHUNFENG|TOY/i.test(l));
      return { ok: true, text: lines.join('\n'), hits };
    } catch (e) {
      return { ok: false, text: `扫描失败：${String(e?.stderr || e?.message || e).trim()}` };
    }
  }

  /** 宿主会调这个拿环境变量式的提示变量；这里没有，返回空对象。 */
  envPromptVars() {
    return {};
  }

  /** 状态灯 + 徽标 + 配置表单（设置页会照 schema 生成输入框）。 */
  webUi(_language = 'zh') {
    const cfg = this.config;
    const pyOk = existsSync(cfg.pythonPath);
    const script = cfg.scriptPath !== '' ? cfg.scriptPath : join(SCRIPT_DIR, 'bt_toyctl.py');
    const scriptOk = existsSync(script);
    const addr = cfg.address !== '' ? cfg.address : readCachedAddress();

    return {
      label: '外设（TF-BHPRO）',
      lamps: [
        pyOk
          ? { label: 'Python', state: 'online', hint: '装了 bleak 的解释器就位' }
          : { label: 'Python', state: 'error', hint: '找不到这个 python' },
        scriptOk
          ? { label: '控制脚本', state: 'online', hint: 'bt_toyctl.py 就位' }
          : { label: '控制脚本', state: 'error', hint: '脚本不存在' },
        (() => {
          // 侧栏那个灯以前只要「记住地址」就是绿的，设备关机也绿——2026-11-22 被指出。
          // 现在按上一次 ping 的新鲜程度和结果来：
          const p = readPing();
          const at = p?.at ? Date.parse(p.at) : NaN;
          const ageMin = Number.isFinite(at) ? Math.round((Date.now() - at) / 60000) : null;
          const fresh = ageMin !== null && ageMin <= 15;
          if (!addr) return { label: '设备', state: 'offline', hint: '还没扫到，也没手动填地址' };
          if (!fresh) {
            return {
              label: '设备',
              state: 'offline',
              hint: `记住了地址 ${addr}，但不知道现在连不连得上` + (ageMin === null ? '（还没检查过）' : `（上次检查是 ${ageMin} 分钟前）`),
            };
          }
          return p.ok
            ? { label: '设备', state: 'online', hint: `${addr} · ${ageMin} 分钟前查过，连得上` }
            : { label: '设备', state: 'error', hint: `${addr} · ${ageMin} 分钟前查过，连不上（关机 / 找不到 / 被手机占着）` };
        })(),
      ],
      badges: [
        {
          label: '工具',
          value: 'toy_set / toy_stop / toy_pulse / toy_ping / toy_scan / toy_status',
          tone: 'plain',
        },
      ],
      /** 面板声明：id 要和 webui.js 里 panels 的键一致，方法名要能被 ctx.invoke 调 */
      panels: [{ id: 'bhpro', title: '设备控制', getMethods: ['state', 'scan', 'ping'] }],
      config: [
        {
          id: 'bhpro',
          owner: 'world:bhpro',
          schema: CONFIG_SCHEMA,
        },
      ],
      /** 面板的 ctx.invoke(方法名, 参数) 走这里，不是直接调实例方法 */
      invoke: async (panel, method, args) => {
        if (panel !== 'bhpro') throw new Error(`unknown panel ${panel}`);
        if (method === 'state') return await this.state();
        if (method === 'scan') return await this.scan();
        if (method === 'ping') return await this.ping();
        throw new Error(`unknown method ${method}`);
      },
    };
  }
}

const Bhpro = {
  id: 'bhpro',
  label: '外设（TF-BHPRO）',
  defaults: () => ({ ...BHPRO_DEFAULTS }),
  create: (ctx) => new BhproWorld(ctx),
};

export default Bhpro;
