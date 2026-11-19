import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { requestOriginAllowed } from './http.ts';
import driver from 'websocket-driver';
import { sessionUser, type User } from './identity.ts';
import type { PartyClientEvents, PartyServerEvents, Reply } from '@abyssal/shared';

type IncomingEvent = keyof PartyClientEvents;
type OutgoingEvent = keyof PartyServerEvents;
type Middleware = (packet: [IncomingEvent, ...unknown[]], next: () => void) => void;
interface WireEvent { event?: string; id?: number; payload?: unknown }
export interface PartySocket {
  data: { user: User };
  request: IncomingMessage;
  join(room: string): void; leave(room: string): void; disconnect(): void;
  on<E extends IncomingEvent>(event: E, handler: PartyClientEvents[E]): void;
  on(event: 'disconnect', handler: () => void): void;
  emit<E extends OutgoingEvent>(event: E, ...args: Parameters<PartyServerEvents[E]>): void;
  use(handler: Middleware): void;
}
const noPayload = new Set(['room:leave', 'game:start', 'game:rematch', 'queue:cancel']);

function upgradeAllowed(req: IncomingMessage) {
  return req.url === '/party-socket' && req.headers['sec-websocket-version'] === '13' &&
    driver.isWebSocket(req) && requestOriginAllowed(req);
}
export function partyTransport(server: Server) {
  const active = new Map<PartySocket, Set<string>>();
  let connect: ((socket: PartySocket) => void) | undefined;
  function upgrade(request: IncomingMessage, transport: Duplex, head: Buffer) {
    const user = upgradeAllowed(request) ? sessionUser(request.headers.cookie) : undefined;
    if (!user || active.size >= 1500) { transport.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    const ws = driver.http(request, { requireMasking: true, maxLength: 4096 });
    const groups = new Set<string>();
    const listen = new Map<string, (...args: never[]) => void>();
    let middleware: Middleware = (_packet, next) => next();
    let alive = true;
    let closed = false;
    const connection: PartySocket = {
      data: { user }, request,
      join(room) { groups.add(room); },
      leave(room) { groups.delete(room); },
      disconnect() { ws.close('Session closed', 1008); transport.end(); },
      on(event: string, handler: (...args: never[]) => void) { listen.set(event, handler); },
      emit(event, ...args) {
        if (transport.writableLength > 1_000_000) { transport.destroy(); return; }
        ws.text(JSON.stringify({ event, payload: args[0] }));
      },
      use(handler) { middleware = handler; },
    };
    const heartbeat = setInterval(() => {
      if (!alive) { transport.destroy(); return; }
      alive = false;
      ws.ping('abyssal');
    }, 12_000);
    heartbeat.unref();
    const close = () => {
      if (closed) return;
      closed = true;
      clearInterval(heartbeat);
      active.delete(connection);
      listen.get('disconnect')?.();
      transport.end();
    };
    transport.on('error', close);
    transport.on('close', close);
    transport.on('end', close);
    ws.on('error', close);
    ws.on('close', close);
    ws.on('pong', () => { alive = true; });
    ws.on('open', () => { active.set(connection, groups); connect?.(connection); });
    ws.messages.on('data', (data: unknown) => {
      if (typeof data !== 'string') return;
      let message: WireEvent;
      try { message = JSON.parse(data); } catch { return; }
      if (!message || typeof message.event !== 'string' || !Number.isSafeInteger(message.id) || message.event === 'disconnect') return;
      const handler = listen.get(message.event);
      if (!handler) return;
      const reply: Reply = value => ws.text(JSON.stringify({ id: message.id, payload: value }));
      const args = noPayload.has(message.event) ? [reply] : [message.payload, reply];
      try { middleware([message.event as IncomingEvent, ...args], () => handler(...args as never[])); }
      catch (error) { console.error(error); reply({ ok: false, error: 'That action could not be completed.' }); }
    });
    transport.pipe(ws.io).pipe(transport);
    ws.start();
    if (head.length) ws.io.write(head);
  }
  server.on('upgrade', upgrade);
  function broadcast<E extends OutgoingEvent>(group: string | null, event: E, args: Parameters<PartyServerEvents[E]>) {
    for (const [socket, rooms] of active) if (!group || rooms.has(group)) socket.emit(event, ...args);
  }
  return {
    on: (_event: 'connection', handler: (socket: PartySocket) => void) => { connect = handler; },
    emit: <E extends OutgoingEvent>(event: E, ...args: Parameters<PartyServerEvents[E]>) => broadcast(null, event, args),
    to: (group: string) => ({ emit: <E extends OutgoingEvent>(event: E, ...args: Parameters<PartyServerEvents[E]>) => broadcast(group, event, args) }),
    close: () => { server.off('upgrade', upgrade); for (const socket of active.keys()) socket.disconnect(); },
  };
}
