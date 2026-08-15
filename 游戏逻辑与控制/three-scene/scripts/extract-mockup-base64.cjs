/**
 * 提取 index.html 中内联的 mockup base64 图片为外部 PNG
 *
 * 背景：开发期间 _transform_mockup.cjs 把 6 张 mockup PNG 直接内联进 HTML，
 *      导致 dist/index.html 膨胀到 33 MB。上生产前必须改为外部资源引用。
 *
 * 操作：
 *   1. 解析 window.MOCKUP_IMG = { key: "data:image/png;base64,XXX", ... }
 *   2. 把每张 base64 解码后保存到 public/images/mockups/<key>.png
 *   3. 把 HTML 里的 base64 字符串替换为 "/images/mockups/<key>.png"
 *
 * 用法：node scripts/extract-mockup-base64.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'index.html');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'mockups');

if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`[mkdir] ${OUT_DIR}`);
}

let html = fs.readFileSync(HTML_PATH, 'utf-8');
const beforeBytes = Buffer.byteLength(html, 'utf-8');
console.log(`[in]  index.html  ${(beforeBytes / 1024 / 1024).toFixed(2)} MB`);

// 匹配形如:  key: "data:image/png;base64,XXXXX"
//   key 为 home / catalog / appreciation / detail / collection / map 等
const re = /(\w+)\s*:\s*"data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)"/g;

let replaced = 0;
let saved = [];

html = html.replace(re, (_match, key, ext, b64) => {
  const filename = `${key}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const outPath = path.join(OUT_DIR, filename);
  const buffer = Buffer.from(b64, 'base64');
  fs.writeFileSync(outPath, buffer);
  saved.push({ key, filename, kb: (buffer.length / 1024).toFixed(1) });
  replaced++;
  return `${key}: "/images/mockups/${filename}"`;
});

if (replaced === 0) {
  console.log('[skip] 未发现内联 base64 图片，可能已经处理过。');
  process.exit(0);
}

fs.writeFileSync(HTML_PATH, html, 'utf-8');
const afterBytes = Buffer.byteLength(html, 'utf-8');
console.log(`[out] index.html  ${(afterBytes / 1024).toFixed(1)} KB  (was ${(beforeBytes / 1024 / 1024).toFixed(2)} MB)`);
console.log(`[ok]  替换了 ${replaced} 处内联 base64`);
console.log('[ok]  保存的外部图片：');
for (const it of saved) {
  console.log(`        ${it.filename}  ${it.kb} KB`);
}
