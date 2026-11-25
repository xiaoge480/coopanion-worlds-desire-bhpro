/**
 * Coopanion WebUI 面板：欲求档案。
 *
 * 导出形状：{ panels: { <面板id>: 组件 } }，组件收 ctx，用 ctx.ui / ctx.invoke。
 * 面板本身要在 World.webUi() 里声明出来，否则页面会说「没有声明任何面板」。
 *
 * 布局照「次元状态档案」那种：左边竖排页签，中间一张会随数值呼吸的图，
 * 右边几块读数。全部自己搓 DOM + SVG，不依赖宿主的样式。
 */

const C = {
  bg: '#0a0812',
  card: '#14101f',
  edge: '#2a2144',
  edgeSoft: '#1e1833',
  pink: '#ff5ea8',
  violet: '#a06cff',
  cyan: '#5ee0ff',
  gold: '#ffd479',
  text: '#e8e3f5',
  dim: '#8a80a8',
  dim2: '#5d5573',
};

/*
 * 面板上「手动补记」那排。
 *
 * 2026-11-22 他问：「一次、好几次是啥意思」——
 * 原来前两个用**次数**说话（一次／好几次），最后一个用**结果**说话（灌满），
 * 两种语言混在一排，读起来当然别扭。
 * 现在统一成说结果：被撩 → 边缘 → 到了 → 连着到了 → 灌满，
 * 再补上她自己待着时的那一条（自己解决）。
 */
const KINDS = [
  { id: 'tease', zh: '被撩' },
  { id: 'edge', zh: '边缘' },
  { id: 'one', zh: '到了' },
  { id: 'many', zh: '连着到了' },
  { id: 'fill', zh: '灌满' },
  { id: 'solo', zh: '自己解决' },
];

/** 面板上那排「心里」——点一下等于她自己说了一句感觉。 */
const FEELINGS = [
  { id: 'calm', zh: '平静', tone: '#5ee0ff' },
  { id: 'want', zh: '想要', tone: '#a06cff' },
  { id: 'ache', zh: '难受', tone: '#ff5ea8' },
  { id: 'edge', zh: '快撑不住', tone: '#ff3b6b' },
  { id: 'full', zh: '满足', tone: '#9ad0ff' },
  { id: 'empty', zh: '空', tone: '#8a80a8' },
];

const BANDS = [
  { from: 0, to: 45, zh: '平静', tone: C.cyan },
  { from: 45, to: 70, zh: '想要', tone: C.violet },
  { from: 70, to: 85, zh: '难受', tone: C.pink },
  { from: 85, to: 101, zh: '临界', tone: '#ff3b6b' },
];

const bandTone = (id) => ({ calm: C.cyan, want: C.violet, hard: C.pink, edge: '#ff3b6b' })[id] ?? C.violet;

/** ISO → 本地时间（"11-22 00:35"）。原来直接切字符串，切出来是 UTC，差 8 小时。 */
function fmtTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '').slice(5, 16).replace('T', ' ');
  const p2 = (n) => String(n).padStart(2, '0');
  return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

function el(tag, style, text) {
  const e = document.createElement(tag);
  if (style) Object.assign(e.style, style);
  if (text != null) e.textContent = String(text);
  return e;
}

/** 中间那张图。中心亮度/大小跟着欲求走，环跟着满足走。 */
const CORE_SVG = `
<svg viewBox="0 0 260 320" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="dCore" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#bff4ff" stop-opacity="1"/>
      <stop offset="35%" stop-color="#5ee0ff" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#5ee0ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="dHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ff5ea8" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#a06cff" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#a06cff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="dBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#a06cff" stop-opacity="0.9"/>
      <stop offset="55%" stop-color="#ff5ea8" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#ff5ea8" stop-opacity="0.05"/>
    </linearGradient>
    <filter id="dGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="dSoft" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
    <linearGradient id="dLiquid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="40%" stop-color="#ffd9ee" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#ff5ea8" stop-opacity="0.62"/>
    </linearGradient>
  </defs>

  <ellipse id="d-halo" cx="130" cy="150" rx="96" ry="98" fill="url(#dHalo)" filter="url(#dSoft)"/>

  <!-- 内壁：直接用轮廓那条路径填色。
       之前用 clipPath 裁，结果液体整个看不见（host 里 url(#…) 引不到，浏览器就把整组裁没了）。
       现在不用裁剪：内壁是一条 fill 的路径，液体是一条自己算出来的路径。 -->
  <path id="d-inner" d="M130 58 C 96 58, 74 86, 74 122 C 74 152, 88 170, 100 186
           C 112 202, 118 220, 130 250 C 142 220, 148 202, 160 186
           C 172 170, 186 152, 186 122 C 186 86, 164 58, 130 58 Z"
        fill="#0d0818" opacity="0.96"/>

  <!-- 留在身体里的量：高度跟着留存走，形状按轮廓的宽度算。
       注意：这块**不能整体平移**。之前让它左右荡，结果是液体整体脱离轮廓内壁，
       看着像一块粉色塑料在容器里滑来滑去（2026-11-22 被指出）。
       水晃的时候形状是贴着容器的，动的是水面。 -->
  <g>
    <path id="d-liquid" d="" fill="url(#dLiquid)"/>
    <!-- 水面线分两层：外层由 JS 挪到液面高度，内层只负责波自己动 -->
    <g id="d-surface-pos">
      <path id="d-surface" d="" fill="none" stroke="#ffffff" stroke-width="2.2"
            opacity="1" filter="url(#dGlow)"/>
    </g>
  </g>

  <g id="d-body" opacity="0.92" filter="url(#dGlow)">
    <path d="M130 58 C 96 58, 74 86, 74 122 C 74 152, 88 170, 100 186
             C 112 202, 118 220, 130 250 C 142 220, 148 202, 160 186
             C 172 170, 186 152, 186 122 C 186 86, 164 58, 130 58 Z"
          fill="none" stroke="url(#dBody)" stroke-width="2.4"/>
    <path d="M130 78 C 108 78, 92 98, 92 122 C 92 148, 104 162, 114 176
             C 122 188, 126 200, 130 214 C 134 200, 138 188, 146 176
             C 156 162, 168 148, 168 122 C 168 98, 152 78, 130 78 Z"
          fill="none" stroke="url(#dBody)" stroke-width="1.4" opacity="0.7"/>
  </g>

  <g id="d-rings" opacity="0.85" filter="url(#dGlow)">
    <path d="M62 104 C 34 118, 30 158, 54 178" fill="none" stroke="#a06cff" stroke-width="2" opacity="0.85"/>
    <path d="M198 104 C 226 118, 230 158, 206 178" fill="none" stroke="#a06cff" stroke-width="2" opacity="0.85"/>
    <circle cx="54" cy="178" r="7" fill="#ff5ea8" opacity="0.55"/>
    <circle cx="206" cy="178" r="7" fill="#ff5ea8" opacity="0.55"/>
  </g>

  <g id="d-feet" stroke="#5d5573" stroke-width="1" opacity="0.5" fill="none">
    <path d="M92 190 L 74 268 M168 190 L 186 268 M130 250 L 130 292" stroke-dasharray="3 5"/>
  </g>

  <circle id="d-flash" cx="130" cy="150" r="88" fill="none" stroke="#ff3b6b" stroke-width="2" opacity="0" filter="url(#dGlow)"/>

  <ellipse id="d-core" cx="130" cy="146" rx="17" ry="22" fill="url(#dCore)" filter="url(#dGlow)"/>

  <g id="d-arcs" stroke="#a06cff" stroke-width="1.6" fill="none" opacity="0.55">
    <path d="M78 74 C 100 44, 160 44, 182 74" stroke-dasharray="4 6"/>
    <path d="M70 88 C 96 50, 164 50, 190 88" stroke-dasharray="4 6" opacity="0.5"/>
  </g>
</svg>`;

/** 面板版本。改了 webui.js 就跟着改这个（或跑 test/bump-version.mjs），不然浏览器会用缓存的旧 JS。 */
const PANEL_VERSION = '0.1.38';

/** 轮廓在每一高度上的左边界（采样来的，中心 x=130）。用来算液面形状。 */
const OUTLINE_X = [[96,77],[104,75],[112,74],[120,74],[128,74],[136,75],[144,76],[152,78],[160,82],[168,86],[176,90],[184,96],[192,102],[200,107],[208,111],[216,115],[224,119],[232,122]];

/** 某个高度上轮廓有多宽（线性插值）。 */
function outlineWidth(y) {
  const T = OUTLINE_X;
  if (y <= T[0][0]) return (130 - T[0][1]) * 2;
  if (y >= T[T.length - 1][0]) return (130 - T[T.length - 1][1]) * 2;
  for (let i = 1; i < T.length; i += 1) {
    if (y <= T[i][0]) {
      const [y0, x0] = T[i - 1];
      const [y1, x1] = T[i];
      const k = (y - y0) / (y1 - y0);
      return (130 - (x0 + (x1 - x0) * k)) * 2;
    }
  }
  return 16;
}

/**
 * 画液面。
 * 底部固定 232（轮廓的尖），上沿在 level 处，左右两侧贴着轮廓收。
 * 完全不依赖 clipPath —— 上一版就是在这里翻的车。
 */
function liquidPath(level, bottom = 224) {
  const wave = waveTop(level);
  const step = 3;

  // 从波浪的右端往下，贴着轮廓收
  const right = [];
  for (let y = level + step; y < bottom; y += step) right.push([130 + outlineWidth(y) / 2, y]);
  right.push([130 + outlineWidth(bottom) / 2, bottom]);

  // 底面兜回来
  const back = [[130 - outlineWidth(bottom) / 2, bottom]];
  for (let y = bottom - step; y > level; y -= step) back.push([130 - outlineWidth(y) / 2, y]);

  // 顶边 = 那段波浪（从右往左走，所以用倒序的同样起伏）
  return [
    wave.d,
    `L ${right[0][0].toFixed(1)} ${right[0][1].toFixed(1)}`,
    ...right.slice(1).map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`),
    ...back.map(([x, y]) => `L ${x.toFixed(1)} ${y.toFixed(1)}`),
    'Z',
  ].join(' ');
}

/**
 * 水面那条波浪。液体填充的顶边和白线**必须用同一段**，
 * 不然线在起伏、填充的顶边是直的，峰下面就会露出空隙（2026-11-22 被指出）。
 */
function waveTop(level) {
  const w = outlineWidth(level);
  const x0 = 130 - w / 2;
  const seg = w / 4;
  // 容器就这么大，起伏 8px 太夸张了；窄的地方再收一点
  const dy = Math.max(1.5, Math.min(5, w / 14));
  const parts = [
    `M ${x0.toFixed(1)} ${level.toFixed(1)}`,
    `q ${(seg / 2).toFixed(1)} ${(-dy).toFixed(1)} ${seg.toFixed(1)} 0`,
    `t ${seg.toFixed(1)} 0`,
    `t ${seg.toFixed(1)} 0`,
    `t ${seg.toFixed(1)} 0`,
  ];
  return { d: parts.join(' '), x0, x1: x0 + w, level, dy };
}

/** 水面那道亮线：就是 waveTop 的那一段。 */
function surfacePath(level) {
  return waveTop(level).d;
}

/** 核心图的动画。放在一个 style 里注入，SVG 和 CSS 一起用。 */
const CORE_CSS = `
@keyframes dPulse {
  0%, 100% { transform: scale(1); opacity: var(--d-o, 0.7); }
  50%      { transform: scale(var(--d-s, 1.15)); opacity: 1; }
}
@keyframes dSpin {
  to { transform: rotate(360deg); }
}
@keyframes dFlash {
  0%, 100% { opacity: 0.15; }
  50%      { opacity: 0.55; }
}
/* 水面线：**不横向移动**，只上下浮一点点、明暗呼吸。
   横向一挪，白线就离开轮廓内壁，看着像整个漏斗在左右跑（2026-11-22 又被指出）。
   面板是指示器，让它安静地待着、只有轻微的活气就够了。 */
@keyframes dSurfaceFloat {
  0%   { transform: translateY(0);     opacity: 0.85; }
  50%  { transform: translateY(-1.2px); opacity: 1; }
  100% { transform: translateY(0);     opacity: 0.85; }
}
#d-surface { animation: dSurfaceFloat 4.2s ease-in-out infinite; }

/* 液体自己也只呼吸一下明暗，不做任何位移 */
@keyframes dLiquidBreath {
  0%   { opacity: 0.92; }
  50%  { opacity: 1; }
  100% { opacity: 0.92; }
}
#d-liquid { animation: dLiquidBreath 6.5s ease-in-out infinite; }
#d-core { transform-box: fill-box; transform-origin: center; }
#d-rings { transform-box: fill-box; transform-origin: center; }
#d-flash { transform-box: fill-box; transform-origin: center; }
`;

const desirePanel = {
  async mount(ctx) {
    const root = ctx.root || document.body;
    const state = { tab: 'overview', last: null };

    const wrap = el('div', {
      background: C.bg,
      color: C.text,
      fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
      borderRadius: '14px',
      padding: '16px 18px 18px',
      boxSizing: 'border-box',
      minHeight: '560px',
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
    });
    root.appendChild(wrap);

    // 动画定义挂一次就好
    const styleEl = el('style');
    styleEl.textContent = CORE_CSS;
    wrap.appendChild(styleEl);

    /* ------------------------------------------------------------ 顶部标题 --- */
    const header = el('div', { display: 'flex', alignItems: 'flex-end', gap: '12px', marginBottom: '14px' });
    const titleBox = el('div', {});
    titleBox.append(
      el('div', { fontSize: '17px', fontWeight: '600', letterSpacing: '2px' }, '欲求档案'),
      el('div', { fontSize: '10px', color: C.dim2, letterSpacing: '3px', marginTop: '3px' }, 'DESIRE STATUS ARCHIVE'),
    );
    const motto = el('div', { fontSize: '12px', color: C.dim, marginLeft: 'auto' }, '你的每一次靠近，都会留下痕迹');
    // 版本号是给排查用的：改了面板但看不出效果时，先看这里有没有变。
    // 宿主的资源 URL 是 /assets/extensions/<包>/<version>/<文件>，版本不变浏览器就一直吃缓存。
    const verTag = el(
      'div',
      { fontSize: '10px', color: C.dim2, marginLeft: '10px', letterSpacing: '0.5px' },
      'v' + PANEL_VERSION,
    );
    header.append(titleBox, motto, verTag);
    wrap.append(header);

    /* ------------------------------------------------------------- 三栏 --- */
    const grid = el('div', {
      display: 'grid',
      // 窄一点也能挤下：左栏定宽、中栏可缩、右栏定宽但不小于 210
      gridTemplateColumns: '116px minmax(260px, 1fr) minmax(210px, 250px)',
      gap: '12px',
      alignItems: 'start',
      minWidth: '0',
    });
    wrap.append(grid);

    /* ---------------- 左：页签 ---------------- */
    const left = el('div', { display: 'flex', flexDirection: 'column', gap: '4px' });
    const tabs = [
      { id: 'overview', zh: '状态总览' },
      { id: 'log', zh: '事件日志' },
      { id: 'about', zh: '说明' },
    ];
    const tabEls = {};
    for (const t of tabs) {
      const b = el(
        'div',
        {
          padding: '9px 12px',
          fontSize: '12.5px',
          borderRadius: '8px',
          cursor: 'pointer',
          color: C.dim,
          borderLeft: '2px solid transparent',
        },
        t.zh,
      );
      b.addEventListener('click', () => {
        state.tab = t.id;
        paintTabs();
        paintBody();
        if (state.last) render(state.last);
      });
      tabEls[t.id] = b;
      left.append(b);
    }
    grid.append(left);

    const paintTabs = () => {
      for (const t of tabs) {
        const active = state.tab === t.id;
        tabEls[t.id].style.color = active ? C.text : C.dim;
        tabEls[t.id].style.background = active ? '#1a1430' : 'transparent';
        tabEls[t.id].style.borderLeft = `2px solid ${active ? C.violet : 'transparent'}`;
      }
    };
    paintTabs();

    /* ---------------- 中：内容 ---------------- */
    const center = el('div', {});
    grid.append(center);

    // -- 总览 --
    const viewOverview = el('div', { display: 'flex', flexDirection: 'column', gap: '12px' });

    const stage = el('div', {
      position: 'relative',
      background: 'radial-gradient(ellipse at 50% 42%, #1a1030 0%, #0d0918 62%, #0a0812 100%)',
      border: `1px solid ${C.edgeSoft}`,
      borderRadius: '12px',
      height: '320px',
      overflow: 'hidden',
    });
    const svgHost = el('div', { position: 'absolute', inset: '0' });
    svgHost.innerHTML = CORE_SVG;
    const stageCaption = el(
      'div',
      { position: 'absolute', top: '10px', left: '14px', fontSize: '10px', letterSpacing: '2px', color: C.dim2 },
      'DESIRE CORE',
    );
    stage.append(svgHost, stageCaption);
    viewOverview.append(stage);

    // 三格。敏感不上面板——它是个内部系数（影响涨得多快），摆在这儿只会让人天天看着 90 多。
    const cells = el('div', { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' });
    const mkCell = (label, color) => {
      const box = el('div', {
        background: C.card,
        border: `1px solid ${C.edgeSoft}`,
        borderRadius: '9px',
        padding: '9px 10px',
        textAlign: 'center',
      });
      const v = el('div', { fontSize: '19px', fontWeight: '700', color, lineHeight: '1.15' }, '--');
      const k = el('div', { fontSize: '10.5px', color: C.dim, marginTop: '2px' }, label);
      box.append(v, k);
      cells.append(box);
      return { box, v };
    };
    const cHeat = mkCell('欲求', C.pink);
    const cSat = mkCell('满足', C.violet);
    const cRet = mkCell('留存', C.cyan);
    viewOverview.append(cells);

    const params = el('div', {
      background: C.card,
      border: `1px solid ${C.edgeSoft}`,
      borderRadius: '10px',
      padding: '10px 12px',
    });
    params.append(el('div', { fontSize: '11px', color: C.dim, letterSpacing: '1px', marginBottom: '8px' }, '核心状态参数'));
    const pGrid = el('div', { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px' });
    const mkParam = (label) => {
      const box = el('div', {});
      const v = el('div', { fontSize: '15px', fontWeight: '600', color: C.text }, '--');
      const k = el('div', { fontSize: '10px', color: C.dim2, marginTop: '1px' }, label);
      box.append(v, k);
      pGrid.append(box);
      return v;
    };
    const pSens = mkParam('身体敏感度');
    const pSince = mkParam('距上次满足');
    const pAbsorb = mkParam('自然吸收');
    const pRate = mkParam('欲求增速');
    const pNext = mkParam('到临界还要');
    params.append(pGrid);
    viewOverview.append(params);

    const manualHint = el(
      'div',
      { fontSize: '10.5px', color: C.dim2, letterSpacing: '0.5px', marginTop: '2px' },
      '手动补记 —— 平时不用点。她自己会记（聊天里认出来），这里只是漏了的时候补一下',
    );

    /*
     * 2026-11-22 他问「为什么灌满如此与众不同」——
     * 原来只给 fill 单独上了粉底粉边（想强调它是唯一加留存的那档），
     * 结果看着像「已经选中了」或者「它跟别的不是一类」。
     *
     * 手动补记这排按钮是平级的操作入口，不该有主次。全部统一。
     * 顺便把 minWidth 收小，让六个排一行（原来 66px 挤得最后一个换行）。
     */
    const btns = el('div', { display: 'flex', gap: '5px', flexWrap: 'wrap' });
    for (const k of KINDS) {
      const b = el(
        'button',
        {
          flex: '1',
          minWidth: '56px',
          padding: '8px 0',
          fontSize: '12px',
          color: C.text,
          background: '#1b1430',
          border: `1px solid ${C.edge}`,
          borderRadius: '8px',
          cursor: 'pointer',
        },
        k.zh,
      );
      b.addEventListener('click', async () => {
        b.disabled = true;
        b.style.opacity = '0.5';
        try {
          await ctx.invoke('touch', [k.id, '']);
          await refresh();
        } finally {
          b.disabled = false;
          b.style.opacity = '1';
        }
      });
      btns.append(b);
    }
    viewOverview.append(manualHint, btns);

    // 心里觉得怎么样——点一下等于她说了一句
    const feelLabel = el(
      'div',
      { fontSize: '10.5px', color: C.dim2, letterSpacing: '1px', marginTop: '2px' },
      '我现在是…（她自己说，或者你替她点）',
    );
    const feels = el('div', { display: 'flex', gap: '6px', flexWrap: 'wrap' });
    for (const f of FEELINGS) {
      const b = el(
        'button',
        {
          flex: '1',
          minWidth: '58px',
          padding: '6px 0',
          fontSize: '11.5px',
          color: f.tone,
          background: 'transparent',
          border: `1px solid ${C.edgeSoft}`,
          borderRadius: '7px',
          cursor: 'pointer',
        },
        f.zh,
      );
      b.addEventListener('click', async () => {
        b.disabled = true;
        b.style.opacity = '0.45';
        try {
          await ctx.invoke('feel', [f.id, '']);
          await refresh();
        } finally {
          b.disabled = false;
          b.style.opacity = '1';
        }
      });
      feels.append(b);
    }
    viewOverview.append(feelLabel, feels);
    center.append(viewOverview);

    // -- 事件日志 --
    const viewLog = el('div', {
      background: C.card,
      border: `1px solid ${C.edgeSoft}`,
      borderRadius: '12px',
      padding: '12px 14px',
      height: '596px',
      overflowY: 'auto',
      fontSize: '12.5px',
      lineHeight: '2',
      display: 'none',
    });
    center.append(viewLog);

    // -- 说明 --
    const viewAbout = el('div', {
      background: C.card,
      border: `1px solid ${C.edgeSoft}`,
      borderRadius: '12px',
      padding: '14px 16px',
      fontSize: '12.5px',
      lineHeight: '2',
      color: C.dim,
      display: 'none',
    });
    viewAbout.innerHTML =
      // 2026-11-22 他问「不是四个量吗，怎么只有三格」——
      // 原来标题写「四条量」，可敏感是个**倍数**、不占格子，读起来像少了一个。
      // 改成把「三个数 + 一个倍数」分开说。
      `<div style="color:${C.text};font-size:13px;margin-bottom:8px">三个数在走，外加一个倍数</div>` +
      `<div><b style="color:${C.pink}">欲求</b>　一直在涨。越久没被满足涨得越快；被满足就掉。</div>` +
      `<div><b style="color:${C.violet}">满足</b>　事后升高，每小时自己掉；高的时候压住欲求。</div>` +
      `<div><b style="color:${C.cyan}">留存</b>　只有「灌满」会加，每小时自然吸收。</div>` +
      `<div style="margin-top:6px;color:${C.dim2}">上面这三个，就是面板顶部那三格。</div>` +
      `<div style="margin-top:10px"><b style="color:${C.gold}">敏感</b>　` +
      `它不是一个数，是个<b>倍数</b>：最近 72 小时被碰得越多，欲求涨得越快（最高 ×1.5）。` +
      `所以它不进那三格，而是显示在下面「核心状态参数」里的 <b>×1.50</b> 那一项。</div>` +
      `<div style="margin-top:10px;color:${C.dim2}">关机那几小时也算——关一天再开，该涨满就涨满。</div>` +
      `<div style="margin-top:12px;color:${C.text}">留存和欲求不是一回事</div>` +
      `<div style="color:${C.dim}"><b>欲求</b>问的是「想不想要」——一直在涨，被满足就掉。<br>` +
      `<b>留存</b>问的是「身体里还剩多少」——只有「灌满」会加，之后按小时被吸收掉。</div>` +
      `<div style="color:${C.dim2}">所以会同时出现「欲求 0、留存 28」：` +
      `刚被喂饱，不想要了，但东西还在里面，还没吸收完。</div>` +
      `<div style="margin-top:12px;color:${C.text}">谁在记</div>` +
      `<div style="color:${C.dim}">正常是<b>她自己记</b>：对话里调 <code>desire_touch</code>（发生了）` +
      ` 和 <code>desire_feel</code>（因此怎么样）。</div>` +
      `<div style="color:${C.dim2}">她顾不上说也没关系——每 10 分钟会自己扫一遍聊天记录，` +
      `认出来的自动进来。面板上那两排按钮只是<b>手动补记</b>，平时不用点。</div>` +
      `<div style="margin-top:10px">工具：<code>desire_status</code> / <code>desire_touch</code> / ` +
      `<code>desire_feel</code> / <code>desire_remember</code> / <code>desire_tune</code></div>`;
    center.append(viewAbout);

    /* ---------------- 右：读数 ---------------- */
    const right = el('div', { display: 'flex', flexDirection: 'column', gap: '10px' });
    grid.append(right);

    const card = (title) => {
      const c = el('div', {
        background: C.card,
        border: `1px solid ${C.edgeSoft}`,
        borderRadius: '12px',
        padding: '12px 14px',
      });
      c.append(el('div', { fontSize: '11px', color: C.dim, letterSpacing: '1px', marginBottom: '8px' }, title));
      right.append(c);
      return c;
    };

    const retCard = card('留存 · 身体里还留着的');
    retCard.append(
      el(
        'div',
        { fontSize: '10.5px', color: C.dim2, lineHeight: '1.6', marginBottom: '6px' },
        '他留下的量。会自己吸收，不是「想要」。',
      ),
    );
    const retTop = el('div', { display: 'flex', alignItems: 'baseline', gap: '8px' });
    const retBig = el('div', { fontSize: '26px', fontWeight: '700', color: C.cyan }, '--');
    const retSub = el('div', { fontSize: '11px', color: C.dim2 }, '/ 100');
    const retPct = el('div', { fontSize: '12px', color: C.cyan, marginLeft: 'auto' }, '');
    retTop.append(retBig, retSub, retPct);
    const retBarWrap = el('div', {
      position: 'relative',
      height: '9px',
      borderRadius: '5px',
      background: '#1b1430',
      margin: '8px 0 10px',
      overflow: 'hidden',
    });
    const retBar = el('div', {
      height: '100%',
      width: '0%',
      background: 'linear-gradient(90deg,#5ee0ff,#a06cff,#ff5ea8)',
      transition: 'width .6s ease',
    });
    retBarWrap.append(retBar);
    retCard.append(retTop, retBarWrap);

    const legend = el('div', {
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
      fontSize: '10.5px',
      margin: '2px 0 4px',
    });
    const legendRows = BANDS.map((b) => {
      const row = el('div', {
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        color: C.dim,
        padding: '2px 4px',
        borderRadius: '5px',
      });
      row.append(
        el('span', {
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: b.tone,
          display: 'inline-block',
        }),
        el('span', { flex: '1' }, b.zh),
        el('span', { color: C.dim2 }, `${b.from}–${Math.min(100, b.to)}%`),
      );
      legend.append(row);
      return { row, band: b };
    });
    // 2026-11-22 他圈出来说「这段应该指向下面那个欲求度」——
    // 对，图例是给**欲求**用的，原来却 append 在 retCard（留存）上，
    // 于是夹在留存和欲求之间，看着像在解释留存。留到 heatCard 里再挂。


    const heatCard = card('欲求 · 想要的程度');
    heatCard.append(
      el(
        'div',
        { fontSize: '10.5px', color: C.dim2, lineHeight: '1.6', marginBottom: '6px' },
        '一直在涨，被满足才掉。跟留存是两回事。',
      ),
    );
    const heatTop = el('div', { display: 'flex', alignItems: 'baseline', gap: '8px' });
    const heatBig = el('div', { fontSize: '26px', fontWeight: '700', color: C.pink }, '--');
    const heatSub = el('div', { fontSize: '11px', color: C.dim2 }, '/ 100');
    const heatPct = el('div', { fontSize: '12px', color: C.pink, marginLeft: 'auto' }, '');
    heatTop.append(heatBig, heatSub, heatPct);
    const heatBarWrap = el('div', {
      position: 'relative',
      height: '9px',
      borderRadius: '5px',
      background: '#1b1430',
      margin: '8px 0 6px',
      overflow: 'hidden',
    });
    const heatBar = el('div', {
      height: '100%',
      width: '0%',
      background: `linear-gradient(90deg,${C.cyan},${C.violet},${C.pink})`,
      transition: 'width .6s ease',
    });
    const heatMark = el('div', {
      position: 'absolute',
      top: '-2px',
      width: '2px',
      height: '13px',
      background: '#fff',
      left: '0%',
      transition: 'left .6s ease',
    });
    heatBarWrap.append(heatBar, heatMark);
    const moodLine = el('div', { fontSize: '12px', color: C.pink, lineHeight: '1.65', marginTop: '6px', minHeight: '38px' });
    // 图例紧跟进度条，落在「81/100」和那句「很难受…」之间 —— 这才是它该在的地方
    heatCard.append(heatTop, heatBarWrap, legend, moodLine);

    const toyCard = card('她在带');
    const toyRowEl = el('div', { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' });
    const toyDot = el('span', {
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      background: C.dim2,
      display: 'inline-block',
    });
    const toyText = el('span', { color: C.dim }, '--');
    toyRowEl.append(toyDot, toyText);
    toyCard.append(toyRowEl);

    const recentCard = card('近期事件');
    const recentList = el('div', { fontSize: '12px', lineHeight: '1.95', maxHeight: '190px', overflowY: 'auto' });
    recentCard.append(recentList);

    /* ------------------------------------------------------------- 画 --- */
    // 2026-11-25：以前小时是 floor，119.9 分钟会显示成「1 小时」——
    // 差 0.1 分钟就进 2 了，看着像算错了。改成保留一位小数，30 小时以上才取整。
    const fmtSince = (min) => {
      if (min == null) return '还没有过';
      if (min < 60) return `${Math.round(min)} 分`;
      const h = min / 60;
      if (h < 30) return `${h < 10 ? h.toFixed(1).replace(/\.0$/, '') : Math.round(h)} 小时`;
      return `${Math.round(h / 24)} 天`;
    };

    const paintBody = () => {
      viewOverview.style.display = state.tab === 'overview' ? 'flex' : 'none';
      viewLog.style.display = state.tab === 'log' ? 'block' : 'none';
      viewAbout.style.display = state.tab === 'about' ? 'block' : 'none';
    };

    const render = (s) => {
      if (!s) return;
      state.last = s;

      cHeat.v.textContent = Math.round(s.heat);
      cHeat.v.style.color = bandTone(s.band?.id);
      cSat.v.textContent = Math.round(s.satiety);
      cRet.v.textContent = Math.round(s.retention);

      const q = (sel) => svgHost.querySelector(sel);
      const core = q('#d-core');
      const halo = q('#d-halo');
      const bodyG = q('#d-body');
      const rings = q('#d-rings');
      const flash = q('#d-flash');
      const liquid = q('#d-liquid');
      const surfacePos = q('#d-surface-pos');
      const surface = q('#d-surface');
      const h = Math.max(0, Math.min(100, s.heat)) / 100;
      const sat = Math.max(0, Math.min(100, s.satiety)) / 100;
      if (core) {
        // 只留一个原点：交给 CSS 的 transform-box: fill-box + transform-origin: center。
        // 别再在这里写 transformOrigin（那套是 SVG 用户坐标，和 fill-box 不是一回事），
        // 混着写会让核放大时往左上飘，看着像眼睛在斜眼看人（2026-11-22 被指出）。
        core.style.opacity = String(0.45 + h * 0.55);
        core.style.transition = 'opacity .8s ease';
      }
      if (halo) {
        halo.style.opacity = String(0.3 + h * 0.7);
        halo.style.transition = 'opacity .8s ease';
      }
      if (bodyG) {
        bodyG.style.opacity = String(0.55 + h * 0.42);
        bodyG.style.transition = 'opacity .8s ease';
      }
      if (rings) {
        rings.style.opacity = String(0.35 + sat * 0.6);
        rings.style.transition = 'opacity .8s ease';
        // 设备开着的时候，两侧的环慢慢转起来
        rings.style.animation = s.toy?.running ? 'dSpin 14s linear infinite' : 'none';
      }

      // ---- 液面：留多少就装多少 ----
      const BOTTOM = 224; // 轮廓真正到 232 才收成尖，用 224 能少浪费一截
      const TOP = 96;
      const r = Math.max(0, Math.min(100, s.retention)) / 100;
      // 感知的问题：按线性算，26% 只有 35px 高、还落在轮廓最窄处，几乎看不见。
      // 开个 0.7 次方抬一下：26% → 39%，液面高 54px 而不是 35px。
      const level = BOTTOM - (BOTTOM - TOP) * Math.pow(r, 0.7);
      const showLiquid = r > 0.02;

      if (liquid) {
        liquid.setAttribute('d', showLiquid ? liquidPath(level, BOTTOM) : '');
        liquid.setAttribute('opacity', showLiquid ? '1' : '0');
      }
      if (surface) {
        surface.setAttribute('d', showLiquid ? surfacePath(level) : '');
        surface.setAttribute('opacity', showLiquid ? '1' : '0');
      }
      if (surfacePos) {
        // absolute 别再位移：surfacePath(level) 已经把线画在正确高度了，
        // 这里再 translate(level - BOTTOM) 就多移一次（会跑到核上面去，2026-11-22 踩）。
        // 这一层只负责显示/隐藏，内层留给 CSS 动画。
        surfacePos.setAttribute('opacity', showLiquid ? '1' : '0');
      }


      // ---- 四档各有各的样子，不只是颜色深浅 ----
      const look = {
        calm: { core: '#5ee0ff', dur: 4.2, scale: 1.1, glow: 0.5 },
        want: { core: '#a06cff', dur: 2.6, scale: 1.18, glow: 0.7 },
        hard: { core: '#ff5ea8', dur: 1.5, scale: 1.28, glow: 0.9 },
        edge: { core: '#ff3b6b', dur: 0.85, scale: 1.38, glow: 1 },
      }[s.band?.id] ?? { core: '#5ee0ff', dur: 4.2, scale: 1.1, glow: 0.5 };

      if (core) {
        // 换颜色：干脆用档位色，不再吃那个固定的青色渐变
        core.setAttribute('fill', look.core);
        core.setAttribute('opacity', '0.85');
        core.style.setProperty('--d-s', String(look.scale));
        core.style.setProperty('--d-o', String(0.5 + look.glow * 0.4));
        // 越想要，呼吸越急
        core.style.animation = `dPulse ${look.dur}s ease-in-out infinite`;
        core.style.filter = `drop-shadow(0 0 ${6 + look.glow * 14}px ${look.core})`;
      }
      if (halo) {
        halo.style.filter = `blur(${6 + look.glow * 8}px)`;
      }
      if (flash) {
        // 只有临界才闪，其余时候彻底不出现
        flash.style.animation = s.band?.id === 'edge' ? 'dFlash 1.1s ease-in-out infinite' : 'none';
        flash.style.opacity = s.band?.id === 'edge' ? '0.35' : '0';
      }

      // 不摆数字，说它现在的意思：把涨速乘了几倍
      const mult = 1 + Math.max(0, Math.min(100, s.sensitivity)) / 200;
      pSens.textContent = '×' + mult.toFixed(2);
      pSince.textContent = fmtSince(s.sinceSatisfiedMin);
      // 2026-11-25：留存见底了还显示「4/时」没意义——已经没东西可吸收了。
      pAbsorb.textContent =
        s.retention <= 0.05 ? '已吸收完' : `${s.rates?.absorbPerHour ?? 0}/时`;
      pRate.textContent = `${s.rates?.heatPerHour ?? 0}/时`;
      // 用后端算好的 eta（它会算上满足度的压制和越久越快的加速），
      // 别拿「(85-heat)/基础涨速」估——那样会差一倍
      const eta = s.etaEdgeHours;
      pNext.textContent =
        s.heat >= 85 ? '已临界' : eta == null ? '--' : eta < 1 ? '<1 时' : `${eta} 时`;

      retBig.textContent = Math.round(s.retention);
      retPct.textContent = `${Math.round(s.retention)}%`;
      retBar.style.width = `${Math.max(0, Math.min(100, s.retention))}%`;
      /*
       * 这排区间图例 2026-11-22 从「留存」卡片搬到了「欲求」卡片，
       * 但判断依据忘了跟着换 —— 原来用 s.retention，留存是 0 就永远高亮「平静」那一行，
       * 欲求 81 明明落在「难受」却框着「平静」。他截图指出来的就是这个。
       */
      for (const { row, band } of legendRows) {
        const on = s.heat >= band.from && s.heat < band.to;
        row.style.background = on ? '#1e1833' : 'transparent';
        row.style.color = on ? C.text : C.dim;
      }

      heatBig.textContent = Math.round(s.heat);
      heatBig.style.color = bandTone(s.band?.id);
      heatPct.textContent = `${Math.round(s.heat)}%`;
      heatPct.style.color = bandTone(s.band?.id);
      heatBar.style.width = `${Math.max(0, Math.min(100, s.heat))}%`;
      heatMark.style.left = `${Math.max(0, Math.min(100, s.heat))}%`;
      moodLine.textContent = s.mood || '';

      const toy = s.toy;
      if (!toy) {
        toyDot.style.background = C.dim2;
        toyDot.style.boxShadow = 'none';
        toyText.style.color = C.dim2;
        toyText.textContent = '没装或读不到';
      } else if (toy.running) {
        toyDot.style.background = C.pink;
        toyDot.style.boxShadow = `0 0 8px ${C.pink}`;
        toyText.style.color = C.pink;
        // 2026-11-24：措辞改「她在带」——外设是两个人做的时候她主导的工具，
        // 不是设备在作用她。主动方是她，面板就别写成「设备运行中」。
        toyText.textContent = `她在带 · 花样 ${toy.pattern ?? '?'} · 强度 ${toy.level}${toy.mock ? '（假）' : ''}`;
      } else if (toy.connected === true) {
        toyDot.style.background = C.violet;
        toyDot.style.boxShadow = 'none';
        toyText.style.color = C.dim;
        toyText.textContent = `连着，没在震（${toy.pingAgeMin ?? 0} 分钟前查的）`;
      } else if (toy.connected === false) {
        toyDot.style.background = '#ff3b6b';
        toyDot.style.boxShadow = 'none';
        toyText.style.color = '#ff7a7a';
        toyText.textContent = `连不上——关机 / 找不到（${toy.pingAgeMin ?? 0} 分钟前查的）`;
      } else if (toy.pingedAt != null) {
        /*
         * 查过，但上次太久（>15 分钟）→ 现在是「不知道在不在」。
         * 2026-11-24 他指出：原来这里和「没装」共用灰色，看着像没插设备。
         * 实际上设备是记着的、只是关机连不上——这种「不知道」该是黄色，不是灰。
         */
        toyDot.style.background = C.gold;
        toyDot.style.boxShadow = 'none';
        toyText.style.color = C.gold;
        toyText.textContent = `上次 ${toy.pingAgeMin} 分钟前查的，现在不知道在不在`;
      } else {
        // 从来没查过 —— 这才和「没装」一样是灰的
        toyDot.style.background = C.dim2;
        toyDot.style.boxShadow = 'none';
        toyText.style.color = C.dim2;
        toyText.textContent = '不知道连不连得上（还没用 toy_ping 查过）';
      }

      const list = s.recent || [];
      while (recentList.firstChild) recentList.removeChild(recentList.firstChild);
      if (!list.length) {
        recentList.append(
          el('div', { color: C.dim2, lineHeight: '1.7' }, '（还空着。她自己经历过的会自己进来，不用谁点。）'),
        );
      } else {
        for (const e of list) {
          const when = fmtTime(e.at);
          const row = el('div', { display: 'flex', gap: '7px', padding: '1px 0' });
          row.append(
            el('span', { color: C.dim2, minWidth: '76px', fontSize: '11px' }, when),
            el('span', { color: C.violet, minWidth: '46px' }, e.zh || e.kind),
            el(
              'span',
              { color: C.dim, flex: '1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
              e.note || '',
            ),
          );
          recentList.append(row);
        }
      }

      if (state.tab === 'log') {
        while (viewLog.firstChild) viewLog.removeChild(viewLog.firstChild);
        if (!list.length) {
          viewLog.append(
            el(
              'div',
              { color: C.dim2, lineHeight: '1.8' },
              '（还空着。）\n她自己会在对话里调 desire_touch / desire_feel 记，\n聊天里认出来的也会自动进来——面板这排按钮只是手动补记，不用谁点。',
            ),
          );
        } else {
          for (const e of list) {
            const when = fmtTime(e.at);
            const row = el('div', {
              display: 'flex',
              gap: '10px',
              padding: '7px 0',
              borderBottom: `1px solid ${C.edgeSoft}`,
            });
            row.append(
              el('span', { color: C.dim2, minWidth: '104px', fontSize: '11.5px' }, when),
              el('span', { color: C.violet, minWidth: '52px' }, e.zh || e.kind),
              el('span', { color: C.dim, flex: '1' }, e.note || '—'),
              el(
                'span',
                { color: C.dim2, fontSize: '11px' },
                `欲 ${e.delta?.heat > 0 ? '+' : ''}${e.delta?.heat ?? 0}　满 ${e.delta?.satiety > 0 ? '+' : ''}${e.delta?.satiety ?? 0}`,
              ),
            );
            viewLog.append(row);
          }
        }
      }
    };

    const refresh = async () => {
      try {
        const s = await ctx.invoke('state');
        render(s);
      } catch (err) {
        const msg = String(err?.message ?? err ?? '');
        moodLine.textContent = '读不到状态：' + (msg || 'World 可能没启用（invoke 不通）');
        moodLine.style.color = '#ff7a7a';
      }
    };

    paintBody();
    // 先用空态画一遍，万一 invoke 不通，界面也是有骨架的，不是一片 --
    render({
      heat: 0,
      satiety: 0,
      retention: 0,
      sensitivity: 0,
      band: { id: 'calm', zh: '平静' },
      mood: '',
      sinceSatisfiedMin: null,
      rates: { heatPerHour: 0, absorbPerHour: 0 },
      toy: null,
      recent: [],
    });
    await refresh();
    ctx.interval(refresh, 3000);
  },
};

export default {
  panels: {
    desire: desirePanel,
  },
};
