#!/usr/bin/env node
// Simple WebSocket gesture simulator for frontend testing
// Run: node gesture-simulator.js

import { WebSocketServer } from 'ws';

const HOST = '0.0.0.0';
const PORT = 12345;
const FPS = 30;

const wss = new WebSocketServer({ host: HOST, port: PORT });

wss.on('listening', () => {
  console.log(`[sim] Gesture simulator running ws://${HOST}:${PORT} @ ${FPS}Hz`);
});

wss.on('connection', (ws, req) => {
  const addr = req.socket.remoteAddress + ':' + req.socket.remotePort;
  console.log(`[sim] Client connected: ${addr}`);

  let t = 0;
  const gestures = ['open', 'fist', 'point', 'none'];
  const interval = setInterval(() => {
    t += 1 / FPS;
    // generate a smooth x,y between 0..1
    const x = 0.5 + 0.35 * Math.sin(t * 0.8);
    const y = 0.5 + 0.25 * Math.cos(t * 1.1);
    // pick a gesture every second
    const gIndex = Math.floor(t) % gestures.length;
    const payload = {
      gesture: gestures[gIndex],
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      timestamp: Date.now()
    };
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, 1000 / FPS);

  ws.on('close', () => {
    clearInterval(interval);
    console.log(`[sim] Client disconnected: ${addr}`);
  });

  ws.on('message', (msg) => {
    // echo or simple ping handling
    try {
      const data = msg.toString();
      if (data === 'ping') ws.send('pong');
    } catch (e) {}
  });
});

wss.on('error', (err) => {
  console.error('[sim] WebSocket server error:', err);
});
