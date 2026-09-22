const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const root = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary'
};

const server = http.createServer((req, res) => {
  const raw = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = raw === '/' ? '/index.html' : raw;
  const file = path.normalize(path.join(root, rel));

  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }

    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': path.extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    fs.createReadStream(file).pipe(res);
  });
});

const wss = new WebSocketServer({ server, path: '/bridge' });
const rooms = new Map();

function roomSet(room) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  return rooms.get(room);
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const room = (url.searchParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const role = url.searchParams.get('role') || 'unknown';
  if (!room) return ws.close(1008, 'room required');

  const peers = roomSet(room);
  ws.room = room;
  ws.role = role;
  peers.add(ws);

  const joined = JSON.stringify({ type: 'peer', event: 'join', role });
  for (const peer of peers) if (peer !== ws && peer.readyState === 1) peer.send(joined);

  ws.on('message', data => {
    if (data.length > 8192) return;
    let parsed;
    try { parsed = JSON.parse(data.toString()); } catch { return; }
    const allowedTypes = new Set(['hello', 'key', 'mouse', 'heartbeat']);
    if (!allowedTypes.has(parsed.type)) return;

    const payload = JSON.stringify(parsed);
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === 1) peer.send(payload);
    }
  });

  ws.on('close', () => {
    peers.delete(ws);
    if (!peers.size) rooms.delete(room);
    else {
      const left = JSON.stringify({ type: 'peer', event: 'leave', role });
      for (const peer of peers) if (peer.readyState === 1) peer.send(left);
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`PvP Trainer listening on ${port}`);
});
