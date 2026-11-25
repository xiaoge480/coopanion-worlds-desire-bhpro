/**
 * Coopanion WebUI 面板：显示 TF-BHPRO 的配置与设备状态，并提供扫描按钮。
 *
 * 导出的形状必须和 cortico-world-fatfish 那个一致：{ panels: { <面板id>: 组件 } }
 * 组件是一根 function，收 ctx，用 ctx.ui 造元素、ctx.invoke 调 core 侧方法。
 */

const TEXT = {
  title: '外设（TF-BHPRO）· v2',
  desc: '这台机器上装了 bleak 的 python，以及蓝牙设备的地址。没设备时也能看，只是调不动。',
  python: 'python',
  script: '控制脚本',
  address: '设备地址',
  timeout: '超时',
  lastCmd: '上一次指令',
  none: '（还没下发过）',
  ok: '在',
  missing: '找不到',
  scanning: '扫描中…（10 秒）',
  scan: '扫描附近设备',
  scanHint: '扫到名字像 BHPRO / 春风 的设备就会列出地址',
  noAddr: '（没扫到过，也没手动填）',
  conn: '连接状态',
  connNever: '还没检查过 —— 点上面的「检查连接」',
  connOk: '已记住设备 · 已连接（可以正常操控）',
  connFail: '已记住设备 · 未连接（关机 / 找不到 / 被手机占着）',
  connStale: '已记住设备 · 不知道现在连不连得上',
  ping: '检查连接',
  pinging: '正在连一次…（几秒）',
};

const bhproPanel = {
  async mount(ctx) {
    const { ui } = ctx;

    const sheet = ui.sheet({ title: TEXT.title, desc: TEXT.desc });
    const facts = ui.h('div');
    const bar = ui.rowbar();
    const msg = ui.h('div');
    msg.style.whiteSpace = 'pre-wrap';
    msg.style.fontSize = '12px';
    msg.style.opacity = '0.8';
    msg.style.marginTop = '8px';

    sheet.body.append(facts, bar, msg);
    ctx.root.appendChild(sheet.el);

    /**
     * 连接状态怎么说。
     *
     * 三件事别混：地址记住了没有 / 上次查的结果 / 那份结果有多旧。
     * ping 只是「上次连一次」的结果，十分钟前的「连上了」不代表现在还连着——
     * 设备关机之后文件还留着旧结果（2026-11-22 欲求面板就是这么显示错的）。
     */
    const connText = (s) => {
      if (!s.address) return TEXT.noAddr;
      const p = s.lastPing;
      if (!p) return TEXT.connNever;
      const at = Date.parse(p.at || '');
      const ageMin = Number.isFinite(at) ? Math.round((Date.now() - at) / 60000) : null;
      const stale = ageMin === null || ageMin > 15;
      const ago = ageMin === null ? '' : ageMin < 1 ? '（刚刚）' : `（${ageMin} 分钟前）`;
      if (stale) {
        return `${TEXT.connStale}（上次检查是 ${ageMin ?? '?'} 分钟前）`;
      }
      return (p.ok ? TEXT.connOk : TEXT.connFail) + ago;
    };

    /** 重画那些键值行。 */
    const render = (s) => {
      while (facts.firstChild) facts.removeChild(facts.firstChild);
      // ui.kv 收的是 [{k, v}, ...] 数组，一次生成整块，不是 (label, value) 两个参数
      const rows = [
        { k: TEXT.python, v: (s.pythonExists ? '✓ ' : '✗ ') + s.pythonPath },
        { k: TEXT.script, v: s.scriptPath || '（用包内自带的）' },
        {
          k: TEXT.address,
          v: s.address
            ? `${s.address}${s.addressFromConfig ? '（配置里的）' : '（扫到的）'}`
            : TEXT.noAddr,
        },
        { k: TEXT.conn, v: connText(s) },
        { k: TEXT.timeout, v: `${s.timeoutSec} 秒` },
        {
          k: TEXT.lastCmd,
          v:
            s.pattern === null
              ? TEXT.none
              : `花样 ${s.pattern}${s.level !== null ? `，强度 ${s.level}` : ''}${s.stopped ? '（已停）' : ''}`,
        },
      ];
      facts.append(ui.kv(rows));
    };

    const refresh = async () => {
      try {
        const s = await ctx.invoke('state');
        render(s);
      } catch (err) {
        msg.textContent = `读状态失败：${err?.message ?? err}`;
      }
    };

    const scanBtn = ui.button(TEXT.scan, { size: 'sm', variant: 'primary' });
    scanBtn.addEventListener('click', async () => {
      msg.textContent = TEXT.scanning;
      try {
        const r = await ctx.invoke('scan');
        if (!r?.ok) {
          msg.textContent = r?.text ?? '扫描失败';
          return;
        }
        const hit = (r.hits || []).length;
        msg.textContent =
          (hit ? `扫到 ${hit} 个像设备的：\n${r.hits.join('\n')}\n\n` : '没扫到名字像 BHPRO 的设备。\n\n') +
          r.text;
      } catch (err) {
        msg.textContent = `扫描失败：${err?.message ?? err}`;
      }
    });
    const pingBtn = ui.button(TEXT.ping, { size: 'sm' });
    pingBtn.addEventListener('click', async () => {
      msg.textContent = TEXT.pinging;
      try {
        const r = await ctx.invoke('ping');
        msg.textContent = typeof r === 'string' ? r : r?.text ?? '（没有回执）';
        await refresh();
      } catch (err) {
        msg.textContent = `检查失败：${err?.message ?? err}`;
      }
    });
    bar.append(scanBtn, pingBtn);

    const hint = ui.h('div');
    hint.textContent = TEXT.scanHint;
    hint.style.fontSize = '12px';
    hint.style.opacity = '0.6';
    hint.style.marginTop = '6px';
    sheet.body.append(hint);

    await refresh();
    // 3 秒轮询一次，跟 fatfish 面板一个节奏
    ctx.interval(refresh, 3000);
  },
};

export default {
  panels: {
    bhpro: bhproPanel,
  },
};
