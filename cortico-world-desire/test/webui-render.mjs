/**
 * 面板自测：用最小 DOM 假货把 mount() 跑一遍，看它会不会炸、画出来有没有东西。
 *   node test/webui-render.mjs
 *
 * 不是像素级验收——是「不报错 + 关键节点都建出来了 + 数值真的写进去了」。
 */

// ---- 最小 DOM ----
class FakeEl {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    // style 也要能接 setProperty —— 面板里用 core.style.setProperty('--d-s', …) 传变量
    this.style = {
      setProperty(k, v) {
        this[k] = String(v);
      },
      removeProperty(k) {
        delete this[k];
      },
    };
    this.children = [];
    this.parentElement = null;
    this.textContent = '';
    this._html = '';
    this.listeners = {};
    this.disabled = false;
    this.dataset = {};
  }
  get firstChild() {
    return this.children[0] ?? null;
  }
  appendChild(c) {
    this.children.push(c);
    c.parentElement = this;
    return c;
  }
  append(...cs) {
    for (const c of cs) this.appendChild(c);
  }
  removeChild(c) {
    const i = this.children.indexOf(c);
    if (i >= 0) this.children.splice(i, 1);
    return c;
  }
  addEventListener(k, fn) {
    (this.listeners[k] ||= []).push(fn);
  }
  setAttribute(k, v) {
    (this.attrs ||= {})[k] = String(v);
  }
  getAttribute(k) {
    return (this.attrs || {})[k] ?? null;
  }
  setProperty(k, v) {
    (this.style ||= {})[k] = String(v);
  }
  set innerHTML(v) {
    this._html = v;
  }
  get innerHTML() {
    return this._html;
  }
  querySelector() {
    // 够用就行：只要不炸，返回一个假节点让 render 去写 style
    return new FakeEl('div');
  }
}

globalThis.document = {
  createElement: (t) => new FakeEl(t),
  body: new FakeEl('body'),
};

const { default: webui } = await import('file:///C:/Users/User/.dsh/cortico-world-desire/src/webui.js');

let fail = 0;
const ok = (n) => console.log('  v ' + n);
const bad = (n, w) => {
  fail += 1;
  console.log('  x ' + n + '  <- ' + w);
};

console.log('\n[1] 面板声明');

const panel = webui.panels.desire;
panel ? ok('panels.desire 在') : bad('找不到面板', '');
typeof panel.mount === 'function' ? ok('有 mount()') : bad('没有 mount', '');

console.log('\n[2] 跑一次 mount');

const fakeState = {
  id: 'desire',
  heat: 62.4,
  satiety: 31.2,
  retention: 47.8,
  sensitivity: 24,
  band: { id: 'hard', zh: '难受' },
  mood: '很难受。坐不住，一直想被碰，忍着才没开口。',
  sinceSatisfiedMin: 137,
  lastSatisfiedAt: new Date().toISOString(),
  overflow: false,
  rates: { heatPerHour: 6, satietyDecayPerHour: 10, absorbPerHour: 4 },
  overflowAt: 95,
  toy: { running: true, pattern: 2, level: 6, connected: true, mock: false },
  recent: [
    { at: '2026-11-22T11:13:00.000Z', kind: 'one', zh: '一次', note: '下班回来那一次', delta: { heat: -25, satiety: 30, retention: 0 } },
    { at: '2026-11-22T08:23:00.000Z', kind: 'fill', zh: '灌满', note: '', delta: { heat: -55, satiety: 60, retention: 28 } },
  ],
  updatedAt: new Date().toISOString(),
};

const root = new FakeEl('div');
let intervals = 0;
try {
  await panel.mount({
    root,
    ui: {},
    invoke: async (method) => {
      if (method === 'state') return fakeState;
      if (method === 'touch') return { ok: true };
      return null;
    },
    interval: () => {
      intervals += 1;
    },
  });
  ok('mount() 没抛错');
} catch (e) {
  bad('mount() 抛错了', String(e?.stack || e).slice(0, 300));
}

root.children.length > 0 ? ok('有东西挂到 root 上') : bad('root 是空的', '');
intervals > 0 ? ok(`挂了轮询（${intervals} 次）`) : bad('没挂轮询', '面板不会自动刷新');

// 找到那棵树里所有文本，核对关键读数有没有写进去
const texts = [];
const walk = (n) => {
  if (!n) return;
  if (n.textContent !== '' && n.textContent != null) texts.push(String(n.textContent));
  for (const c of n.children || []) walk(c);
};
walk(root);
const all = texts.join(' | ');

for (const want of ['欲求档案', 'DESIRE STATUS ARCHIVE', '状态总览', '事件日志', '留存 · 身体里还留着的', '欲求 · 想要的程度', '近期事件', '她在带']) {
  all.includes(want) ? ok(`有「${want}」`) : bad(`缺「${want}」`, all.slice(0, 120));
}

// 敏感不再单独占一格（它只做涨速系数），所以这里只查前三格
for (const want of ['62', '31', '48']) {
  all.includes(want) ? ok(`数值 ${want} 写进去了`) : bad(`没有 ${want}`, '');
}

all.includes('很难受。坐不住') ? ok('心情句写进去了') : bad('心情句没有', '');
all.includes('她在带 · 花样 2 · 强度 6') ? ok('她在带状态写进去了') : bad('她在带状态没有', '');
// 敏感没消失，只是换了个说法：核心状态参数里显示成倍率
all.includes('身体敏感度') ? ok('核心参数里还有「身体敏感度」') : bad('敏感彻底不见了', '');
all.includes('×') ? ok('敏感显示成倍率（×1.48 这种）') : bad('没有倍率', '');

all.includes('一次') && all.includes('灌满') ? ok('近期事件写进去了') : bad('近期事件没有', '');

console.log('\n[3] SVG 有没有真的插进 DOM');

const htmls = [];
const walkHtml = (n) => {
  if (!n) return;
  if (n._html) htmls.push(n._html);
  for (const c of n.children || []) walkHtml(c);
};
walkHtml(root);
const svg = htmls.find((h) => h.includes('<svg'));
svg ? ok('SVG 插进去了（' + svg.length + ' 字节）') : bad('没有 SVG', '');
svg && svg.includes('d-core') ? ok('有核心节点 d-core') : bad('核心节点不在', '');
svg && svg.includes('d-halo') ? ok('有光晕节点 d-halo') : bad('光晕不在', '');

console.log(fail === 0 ? '\n全部通过。' : `\n有 ${fail} 项没过。`);
process.exitCode = fail === 0 ? 0 : 1;
