import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import basicSsl from '@vitejs/plugin-basic-ssl';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// SHARE_LAN=1 → 启用局域网共享模式
//   · 监听 0.0.0.0（所有网卡），同 WiFi 的组员可通过 IP 访问
//   · 启用自签 HTTPS（MediaPipe / 摄像头授权要求 secure context）
//   · 组员首次访问会看到"不安全"警告，点"高级 → 继续访问"即可
const SHARE_LAN = process.env.SHARE_LAN === '1';

export default defineConfig({
  plugins: SHARE_LAN ? [basicSsl()] : [],
  server: {
    port: 5173,
    // npm run dev 自动打开新版门户首页（旧版门户仍可手动访问 /index.html）
    open: '/home2.html',
    host: SHARE_LAN ? true : 'localhost',
  },
  preview: {
    port: 5173,
    host: SHARE_LAN ? true : 'localhost',
  },
  build: {
    rollupOptions: {
      input: {
        // 门户首页（mockup 改造）
        main: resolve(__dirname, 'index.html'),
        // 新版首页 Demo（独立入口，不影响现有页面）
        home2: resolve(__dirname, 'home2.html'),
        // 新版万象图鉴 Demo（独立入口，数据只读复用 portal/buildings.js）
        catalog2: resolve(__dirname, 'catalog2.html'),
        // 新版古建舆图 Demo（独立入口，GeoJSON 数据驱动 + 真实经纬度点位）
        map2: resolve(__dirname, 'map2.html'),
        // 新版古建鉴赏 Demo（独立入口，3D 舞台 + 大图版式图文）
        view2: resolve(__dirname, 'view2.html'),
        // 新版探微（独立全屏页，六集合爆炸拆解，逻辑移植自旧版浮层）
        explore2: resolve(__dirname, 'explore2.html'),
        // 游艺坊（趣味模式集合：斗拱在哪儿 / 千钧一刻 / 拾遗补缺 入口）
        arcade: resolve(__dirname, 'arcade.html'),
        // 藏宝阁（成就卡牌 + 建筑图鉴，记录存 localStorage）
        collection2: resolve(__dirname, 'collection2.html'),
        // 拾遗补缺（3D 残件修复小游戏）
        repair: resolve(__dirname, 'repair.html'),
        // 稳如山（地震台试炼：cannon-es 物理 + 斗拱/砖墙对照）
        quake: resolve(__dirname, 'quake.html'),
        // 筑梦游戏（原 main.js 入口）
        forge: resolve(__dirname, 'forge.html'),
        // 精微匠造（精细模式：键鼠精确摆放 + 数值微调 + 等级校验）
        precision: resolve(__dirname, 'precision.html'),
        // 开发者工具大厅入口（部署到 /tools/）
        tools: resolve(__dirname, 'tools/index.html'),
        // 工具：斗拱关卡校准器（3D 位姿可视化校准 → JSON 导出）
        calibrator: resolve(__dirname, 'tools/calibrator.html'),
        // 工具：古建舆图标注器（2D 点位拖拽 → MAP_SPOTS JSON）
        mapPinTagger: resolve(__dirname, 'tools/map-pin-tagger.html'),
        // 工具：热区智能标定器（mockup 热区 → 前端交互逻辑绑定）
        hotspotTagger: resolve(__dirname, 'tools/hotspot-tagger.html'),
      },
    },
  },
});
