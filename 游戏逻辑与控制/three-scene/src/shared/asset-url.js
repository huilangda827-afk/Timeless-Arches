/**
 * 静态资源 URL 编码。
 *
 * 教训记录（2026-08）：文件名禁止使用 '+'！
 *   - Vercel 把路径里的字面 '+' 解成空格 → 线上 404；
 *   - 而 Vite dev server 对 '%2B' 不解码 → 本地反而 404（SPA fallback 返回 HTML）。
 *   两边行为相反，无法用同一种编码同时满足，唯一稳妥做法是文件名避开 '+'
 *   （level3 曾有 3 个含 '+' 的 GLB，已全部改名为 '与'）。
 *
 * 这里只做 encodeURI（中文/空格等编码，浏览器行为一致），并在开发期
 * 对含 '+' 的路径给出警告，防止将来再引入同类文件名。
 *
 * @param {string} url 原始资源路径（未编码）
 * @returns {string} 可安全用于 fetch/GLTFLoader 的 URL
 */
export function encodeAssetUrl(url) {
  if (import.meta.env?.DEV && url.includes('+')) {
    console.warn(`[asset-url] ⚠️ 资源路径含 '+'，Vercel 线上会 404，请改名: ${url}`);
  }
  return encodeURI(url);
}
