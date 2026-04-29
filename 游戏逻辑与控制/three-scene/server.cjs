// three-scene/server.cjs
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 12345 });
console.log('WS server running at ws://localhost:12345');

// 每有一个客户端连接（浏览器 three / 摄像头页面）都会触发这里
wss.on('connection', (socket) => {
  console.log('Client connected');

  // 收到某个客户端发来的消息（比如摄像头那边 sendWS）
  socket.on('message', (msg) => {
    console.log('From client:', msg.toString());

    // ⭐ 把这条消息转发给所有其它客户端（包括 three-scene 页面）
    for (const client of wss.clients) {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});