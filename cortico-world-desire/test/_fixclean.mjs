import { readFileSync, writeFileSync } from 'node:fs';

const p = 'C:/Users/User/.dsh/cortico-world-desire/test/clean-meta-events.mjs';
let s = readFileSync(p, 'utf-8');

const old = `  if (!note.trim()) keep.push(e);
  else if (Cls.isMetaTalk(note)) drop.push(e);
  else keep.push(e);`;

const neu = `  // 摘要行也算「讨论」：那是我写给机主看的汇总，不是她经历过的
  // （「最近：11-22 00:36 灌满　11-22 00:00 一次…」「· 11-21 16:36 灌满 [1 new event]」）
  const isDigest = /^(最近：|·\\s*\\d|最近\\s*[:：])/.test(note.trim()) || /\\[\\d+ new events?\\]/.test(note);
  if (!note.trim()) keep.push(e);
  else if (isDigest || Cls.isMetaTalk(note)) drop.push(e);
  else keep.push(e);`;

if (!s.includes(old)) {
  console.log('x 锚点没找到');
} else {
  s = s.replace(old, neu);
  writeFileSync(p, s, 'utf-8');
  console.log('v 摘要行也算讨论');
}
