/**
 * 校准器部署打包脚本
 *
 * 把 tools/calibrator.html + public/models/level2/*.glb 打包到一个独立目录
 * calibrator-deploy/，可直接拖到 Netlify Drop 部署。
 *
 * 用法（在 three-scene 目录下）：
 *   node tools/build-calibrator-deploy.cjs
 *
 * 之后会在项目根生成 calibrator-deploy/ 目录，结构：
 *   calibrator-deploy/
 *   ├─ index.html          (从 calibrator.html 复制而来)
 *   └─ models/level2/      (复制自 public/models/level2/)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');                  // three-scene/
const SRC_HTML = path.join(ROOT, 'tools', 'calibrator.html');
const SRC_MODELS = path.join(ROOT, 'public', 'models', 'level2');
const OUT_DIR = path.join(ROOT, 'calibrator-deploy');
const OUT_MODELS = path.join(OUT_DIR, 'models', 'level2');

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

console.log('[Build] 清理旧的 calibrator-deploy/');
fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

console.log('[Build] 复制 calibrator.html → calibrator-deploy/index.html');
fs.copyFileSync(SRC_HTML, path.join(OUT_DIR, 'index.html'));

console.log('[Build] 复制 models/level2/ → calibrator-deploy/models/level2/');
copyDir(SRC_MODELS, OUT_MODELS);

const totalSize = (function dirSize(p) {
  let total = 0;
  for (const name of fs.readdirSync(p)) {
    const f = path.join(p, name);
    const s = fs.statSync(f);
    total += s.isDirectory() ? dirSize(f) : s.size;
  }
  return total;
})(OUT_DIR);

console.log(`\n✅ 完成！`);
console.log(`   目录: ${OUT_DIR}`);
console.log(`   总大小: ${(totalSize / 1024 / 1024).toFixed(1)} MB`);
console.log(`\n下一步：`);
console.log(`  1. 打开 https://app.netlify.com/drop`);
console.log(`  2. 把整个 calibrator-deploy/ 文件夹拖进去`);
console.log(`  3. 等待上传，得到一个 https://xxx.netlify.app 的 URL`);
console.log(`  4. 把 URL 发给组员即可`);
