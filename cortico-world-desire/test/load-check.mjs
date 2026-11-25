import DesireWorld from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/index.js';
import webui from 'file:///C:/Users/User/.dsh/cortico-world-desire/src/webui.js';

const w = new DesireWorld({ dataDir: 'D:/Applications/Coopanion/data/tmp-desire-check', cfg: {} });
console.log('id        :', w.id);
console.log('tools     :', w.tools().map((t) => t.name).join(', '));
const s = await w.state();
console.log('state keys:', Object.keys(s).join(','));
console.log('band      :', s.band.zh, '| mood:', s.mood);
console.log('panels    :', Object.keys(webui.panels));
