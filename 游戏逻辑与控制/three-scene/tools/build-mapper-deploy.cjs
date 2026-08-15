/**
 * 古建舆图标注器 · 一次性上云打包脚本
 *
 * 把 tools/map-pin-tagger.html + public/images/mockups/map.png
 * 打到一个独立目录 mapper-deploy/，结构：
 *   mapper-deploy/
 *   ├─ index.html          (从 map-pin-tagger.html 复制，并改为根路径加载 map)
 *   └─ map.png             (从 public/images/mockups/map.png 复制)
 *
 * 用法（在 three-scene 目录下）：
 *   node tools/build-mapper-deploy.cjs
 *
 * 之后：
 *   1. 打开 https://app.netlify.com/drop
 *   2. 把整个 mapper-deploy/ 文件夹拖进去
 *   3. 等待上传，得到 https://xxx.netlify.app
 *   4. 把 URL 群发给同学，他们标完坐标导出 JSON 发给你即可
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');             // three-scene/
const SRC_HTML = path.join(ROOT, 'tools', 'map-pin-tagger.html');
const SRC_MAP_PNG = path.join(ROOT, 'public', 'images', 'mockups', 'map.png');
const OUT_DIR = path.join(ROOT, 'mapper-deploy');

console.log('[Build] 清理旧的 mapper-deploy/');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('[Build] 读取 map-pin-tagger.html');
let html = fs.readFileSync(SRC_HTML, 'utf8');

// 把工具内 `/images/mockups/map.png` 路径改成 `./map.png`（相对当前 index.html）
html = html.replace(/['"]\/images\/mockups\/map\.png['"]/g, "'./map.png'");

// 移除 fallback 那段 fetch('/index.html') 的逻辑（独立部署没有 index.html 主页）
html = html.replace(
  /\/\/ fallback：从 \/index\.html 抠 base64.*?img\.src = m\[1\];\s*\}\);[\s\S]*?document\.getElementById\('zoom-bar'\)\.style\.display = 'flex';/,
  "// 独立部署 fallback 已禁用\n    throw lastErr || new Error('地图 PNG 加载失败');"
);

fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
console.log('[Build] index.html → mapper-deploy/index.html');

fs.copyFileSync(SRC_MAP_PNG, path.join(OUT_DIR, 'map.png'));
const mapSize = fs.statSync(path.join(OUT_DIR, 'map.png')).size;
console.log(`[Build] map.png  (${(mapSize/1024/1024).toFixed(1)} MB)`);

// 附一个 README 给同学
const readme = `# 古建舆图 · 远程标注协作版

## 怎么用

1. 直接在浏览器打开这个 URL（手机/电脑都行，推荐桌面浏览器）
2. 左侧 15 个建筑列表，点击想标注的那个 → 在右侧地图上点击落点
3. 标完可以拖动微调
4. 完成所有点位 → 右侧 "导出 JSON" → "复制到剪贴板" → 发给项目维护者

## 注意

- 数据自动保存在你浏览器的 localStorage，关闭页面也不会丢
- 不同的人在不同浏览器里互不影响
- 标注完务必导出 JSON 发出来，否则维护者看不到你的成果

## 来源

本工具是 拾光筑梦 / Timeless Arches 项目内部工具的离线协作版。
正式地址：https://arches.redjade.tech/tools/
`;
fs.writeFileSync(path.join(OUT_DIR, 'README.txt'), readme, 'utf8');
console.log('[Build] README.txt');

const totalSize = (function dirSize(p) {
  let total = 0;
  for (const name of fs.readdirSync(p)) {
    const f = path.join(p, name);
    const s = fs.statSync(f);
    total += s.isDirectory() ? dirSize(f) : s.size;
  }
  return total;
})(OUT_DIR);

console.log(`\n完成`);
console.log(`   目录: ${OUT_DIR}`);
console.log(`   总大小: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`\n下一步`);
console.log(`  1. 打开 https://app.netlify.com/drop`);
console.log(`  2. 把整个 mapper-deploy/ 文件夹拖进上传区`);
console.log(`  3. 等待 5-10 秒，拿到 https://xxx.netlify.app`);
console.log(`  4. 把 URL 发到同学群即可（不需要注册账号、不需要登录）`);
