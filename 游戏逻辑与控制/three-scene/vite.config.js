import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
    open: false,
  },
  build: {
    rollupOptions: {
      input: {
        // 门户首页（mockup 改造）
        main: resolve(__dirname, 'index.html'),
        // 筑梦游戏（原 main.js 入口）
        forge: resolve(__dirname, 'forge.html'),
        // 精微匠造（精细模式：键鼠精确摆放 + 数值微调 + 等级校验）
        precision: resolve(__dirname, 'precision.html'),
      },
    },
  },
});
