import ws from "ws";

const wss = new ws.Server({ port: 12345 });

console.log("WS server running at ws://localhost:12345");

wss.on("connection", (client) => {
  console.log("Client connected");
});