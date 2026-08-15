#!/usr/bin/env node
/**
 * 拾光筑梦 · 局域网共享启动器
 *
 * 用途：让同一 WiFi / 校园网下的组员，无需安装任何东西，直接用浏览器访问你电脑上的 vite 服务试玩。
 *
 * 用法：
 *     npm run share
 *
 * 做了什么：
 *   1. 设置 SHARE_LAN=1，让 vite.config.js 启用：
 *        · host: true  → 监听 0.0.0.0（所有网卡）
 *        · 自签 HTTPS  → 摄像头 / MediaPipe 必须 secure context
 *   2. 检测本机所有 IPv4 网卡，把可用 IP 醒目打印出来
 *   3. spawn vite，并把输出原样转发到当前终端
 *
 * 组员侧操作：见仓库根目录 「分享给组员-必读.md」
 */

import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const PORT = 5173;

// ---------- 收集本机 IPv4 ----------
function collectLanIPs() {
  const ifs = os.networkInterfaces();
  const ips = [];
  for (const [name, addrs] of Object.entries(ifs)) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal && a.address && !a.address.startsWith('169.254.')) {
        ips.push({ name, address: a.address });
      }
    }
  }
  return ips;
}

// ---------- 终端美化 ----------
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function banner(ips) {
  const lines = [
    '',
    `${C.yellow}${C.bold}╔══════════════════════════════════════════════════════════════╗${C.reset}`,
    `${C.yellow}${C.bold}║       拾光筑梦 · 校园网共享模式（HTTPS + 0.0.0.0）           ║${C.reset}`,
    `${C.yellow}${C.bold}╚══════════════════════════════════════════════════════════════╝${C.reset}`,
    '',
    `${C.dim}你（开发者）：${C.reset}https://localhost:${PORT}`,
    '',
    `${C.green}${C.bold}发给组员的链接（同一 WiFi / 校园网）：${C.reset}`,
  ];

  if (ips.length === 0) {
    lines.push(`  ${C.magenta}⚠ 未检测到局域网 IP，请检查 WiFi/网线是否已连接${C.reset}`);
  } else {
    for (const { name, address } of ips) {
      lines.push(`  ${C.cyan}https://${address}:${PORT}${C.reset}   ${C.dim}(${name})${C.reset}`);
    }
  }

  lines.push('');
  lines.push(`${C.dim}组员第一次打开会看到「您的连接不是私密连接」警告，这是因为用了自签证书。${C.reset}`);
  lines.push(`${C.dim}让他们点：高级 → 继续前往（不安全）→ 摄像头授权 → 即可游玩。${C.reset}`);
  lines.push(`${C.dim}详细操作请发给组员：「分享给组员-必读.md」${C.reset}`);
  lines.push('');
  lines.push(`${C.dim}停止服务：在本终端按 Ctrl+C${C.reset}`);
  lines.push('');
  lines.push(`${C.yellow}${'─'.repeat(64)}${C.reset}`);
  console.log(lines.join('\n'));
}

// ---------- 主流程 ----------
const ips = collectLanIPs();
banner(ips);

const env = { ...process.env, SHARE_LAN: '1' };

const child = spawn('npx', ['vite', '--port', String(PORT)], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
  shell: true,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
