import { readFileSync, writeFileSync } from 'node:fs';

const p = 'C:/Users/User/.dsh/cortico-world-desire/src/index.js';
let s = readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');

const old = `  /** 从一条会话记录里刨出所有能读的文本。 */
  static textsOf(rec) {
    const it = rec?.item;
    if (!it) return [];
    const out = [];
    if (it.type === 'message' && Array.isArray(it.content)) {
      if (it.role === 'system') return [];
      for (const c of it.content) {
        if (c && typeof c.text === 'string') out.push(c.text);
      }
    } else if (it.type === 'function_call_output' && typeof it.output === 'string') {
      out.push(it.output);
    }
    return out;
  }`;

const neu = `  /**
   * 从一条会话记录里刨出「真正发生过的对话」。
   *
   * 2026-11-22 晚修：原来这里把 `function_call_output` 的**整个输出**都当成文本收进来了 ——
   * 包括工具读出来的交接笔记、我自己写的功能说明、日志片段。
   * 结果「把交接笔记里 DSH 的回复」也一并记成了她经历的事，
   * 十八个事件里十二个是功能讨论（机主一看：「只是有点亲昵，没搞事呀」）。
   *
   * 现在只认两种：
   *   1. \`message\` 但不是 system、也不是 assistant（assistant 是 DSH 的回复，不是她的经历）
   *   2. \`function_call_output\` 里**带聊天标记的**（\`[私聊 20:41]\` / \`[群「…」 20:39]\` / \`[draft staged]\`）
   *      —— 那才是真的进出过 QQ 的话；其余（工具输出、\`[sent]\`、\`[turn ended]\`）一律不读。
   */
  static isChatPayload(text) {
    return /\\[(私聊|群「|群〕|draft staged)/.test(String(text || ''));
  }

  static textsOf(rec) {
    const it = rec?.item;
    if (!it) return [];
    const out = [];

    if (it.type === 'message' && Array.isArray(it.content)) {
      // system 是框架话；assistant 是 DSH 自己的回复 —— 都不能当她的经历
      if (it.role === 'system' || it.role === 'assistant') return [];
      for (const c of it.content) {
        if (c && typeof c.text === 'string' && c.text.trim()) out.push(c.text);
      }
      return out;
    }

    if (it.type === 'function_call_output' && typeof it.output === 'string') {
      // 只收「真的过了 QQ 的那几句话」，不收工具输出
      if (!DesireWorld.isChatPayload(it.output)) return [];
      // 按行拆开，逐行判断：`[1 new event]` 这种头就不要了
      for (const line of it.output.split(/\\r?\\n/)) {
        if (DesireWorld.isChatPayload(line)) out.push(line);
      }
    }
    return out;
  }`;

if (!s.includes(old)) {
  console.log('x 找不到 textsOf');
} else {
  s = s.replace(old, neu);
  writeFileSync(p, s, 'utf-8');
  console.log('v textsOf 不再收 DSH 回复与工具输出');
}
