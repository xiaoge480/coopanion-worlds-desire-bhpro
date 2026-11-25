/**
 * 面板改了但看不出变化？——先跑这个。
 *
 * 宿主给面板前端发的 URL 里带着 package.json 的 version 当缓存键
 * （src/extensions.ts: serveAsset 里 `version: pkg.version`）。
 * 版本号不变，浏览器就一直用缓存里的旧 JS：
 * 你改了 webui.js、重启了 Coopanion，看到的还是上一版。
 *
 *   node test/bump-version.mjs            # 补丁号 +1
 *   node test/bump-version.mjs "改了水面"  # 顺手记一句改了什么
 */
import { readFileSync, writeFileSync } from 'node:fs';

const pkgPath = 'C:/Users/User/.dsh/cortico-world-desire/package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const parts = String(pkg.version || '0.1.0').split('.').map((n) => parseInt(n, 10) || 0);
while (parts.length < 3) parts.push(0);
parts[2] += 1;
const next = parts.join('.');
const note = process.argv[2];

pkg.version = next;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');

console.log(`version: ${parts[2] - 1} 段 → ${next}${note ? '（' + note + '）' : ''}`);
console.log('重启 Coopanion，浏览器就会拉新的面板 JS。');
