// Connexion au serveur : authentification HTTP puis flux temps réel WebSocket.
import { PROTOCOL_VERSION, type C2S, type S2C } from '../../../shared/protocol';

export async function authRequest(mode: 'login' | 'register', name: string, pass: string) {
  try {
    const r = await fetch(`/api/${mode}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, pass }) });
    return (await r.json()) as { ok: boolean; token?: string; name?: string; msg?: string };
  } catch {
    return { ok: false, msg: 'Serveur injoignable. Lancez « npm start » puis rechargez la page.' };
  }
}

export class Connection {
  private ws: WebSocket | null = null;
  private handlers: ((m: S2C) => void)[] = [];
  onState: ((s: 'connecting' | 'on' | 'lost') => void) | null = null;
  private token = '';
  private closedByUs = false;
  private retry = 0;
  bytesIn = 0;

  connect(token: string) {
    this.token = token;
    this.closedByUs = false;
    this.open();
  }

  private open() {
    this.onState?.('connecting');
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      ws.send(JSON.stringify({ t: 'hello', token: this.token, v: PROTOCOL_VERSION }));
      this.onState?.('on');
    };
    ws.onmessage = (e) => {
      this.bytesIn += (e.data as string).length;
      let m: S2C;
      try { m = JSON.parse(e.data as string); } catch { return; }
      for (const h of this.handlers) h(m);
    };
    ws.onclose = () => {
      if (this.closedByUs) return;
      this.onState?.('lost');
      this.retry++;
      if (this.retry < 6) setTimeout(() => this.open(), 1000 * this.retry);
    };
  }

  on(h: (m: S2C) => void) { this.handlers.push(h); }

  send(m: C2S) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  close() {
    this.closedByUs = true;
    this.ws?.close();
  }
}
