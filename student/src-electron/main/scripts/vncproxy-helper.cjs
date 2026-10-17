#!/usr/bin/env node

// Small helper process that runs a WebSocket-to-TCP proxy for VNC

const net = require('net');
const { WebSocketServer } = require('ws');

const host = process.argv[2] || '127.0.0.1';
const targetPort = parseInt(process.argv[3] || '5900', 10);
const proxyPort = parseInt(process.argv[4] || '6080', 10);

let wss;
try {
  wss = new WebSocketServer({ port: proxyPort });
} catch (err) {
  console.error('vncproxy-helper: failed to create WebSocketServer', err);
  process.exit(1);
}

wss.on('connection', (ws) => {
  const tcp = net.createConnection(
    {
      host,
      port: targetPort
    },
    () => {
      ws.on('message', (data) => {
        tcp.write(data);
      });
      tcp.on('data', (chunk) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(chunk);
        }
      });
    }
  );

  const cleanup = () => {
    if (!tcp.destroyed) {
      tcp.destroy();
    }
    try {
      ws.close();
    } catch (e) {
      // ignore
    }
  };

  ws.on('close', cleanup);
  ws.on('error', cleanup);
  // Surface TCP failures (wrong host/port or VNC not listening) in the helper stderr stream
  tcp.on('error', (err) => {
    console.error('vncproxy-helper: tcp error', host, targetPort, err && err.message ? err.message : err);
    cleanup();
  });
  tcp.on('end', cleanup);
});

wss.on('error', (err) => {
  console.error('vncproxy-helper: WebSocketServer error', err);
});

process.on('SIGINT', () => {
  wss.close(() => process.exit(0));
});

