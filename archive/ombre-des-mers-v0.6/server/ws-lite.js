// Mini serveur WebSocket (RFC 6455) sans dépendance : texte uniquement.
// Suffisant pour le jeu et testable avec le WebSocket natif de Node 22.
import http from 'node:http';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 4096;

class Conn extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this.readyState = 1;
    this.buf = Buffer.alloc(0);
    socket.on('data', (d) => this.onData(d));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }
  finish() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.emit('close');
  }
  send(str) {
    if (this.readyState !== 1) return;
    this.socket.write(frame(0x1, Buffer.from(str)));
  }
  close() {
    if (this.readyState !== 1) return;
    this.readyState = 2;
    this.socket.end(frame(0x8, Buffer.alloc(0)));
  }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > MAX_PAYLOAD * 4) return this.socket.destroy();
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const op = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) return this.socket.destroy(); // trop gros
      if (!masked || len > MAX_PAYLOAD) return this.socket.destroy();
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const data = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op === 0x1) this.emit('message', data);
      else if (op === 0x8) { this.close(); return; }
      else if (op === 0x9) this.socket.write(frame(0xA, data));
    }
  }
}

function frame(op, payload) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | op, n]) : Buffer.from([0x80 | op, 126, n >> 8, n & 255]);
  return Buffer.concat([head, payload]);
}

export function createWsServer({ port, onConnection, onHttp, maxClients = 200 }) {
  const clients = new Set();
  const server = http.createServer((req, res) => { if (onHttp) return onHttp(req, res); res.writeHead(426); res.end('WebSocket requis'); });
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key || clients.size >= maxClients) return socket.destroy();
    const acc = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
    const c = new Conn(socket);
    clients.add(c);
    c.on('close', () => clients.delete(c));
    onConnection(c);
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, clients, port: server.address().port, close: () => { for (const c of clients) c.socket.destroy(); server.close(); } })));
}
