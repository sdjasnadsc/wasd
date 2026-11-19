import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { once } from 'node:events';
import { test } from 'node:test';
import { setTimeout as pause } from 'node:timers/promises';
import driver from 'websocket-driver';
import { DEFAULT_PARTY, type PartyState, type PublicRoom } from '@abyssal/shared';
process.env.DATABASE_PATH = ':memory:';
const { installParty, passDeadline, ratingDelta } = await import('../apps/server/src/party.ts');
const { get, run } = await import('../apps/server/src/db.ts');

function createIdentity(id: string) {
  run('INSERT INTO users (id,name,created_at) VALUES (?,?,?)', id, id, Date.now());
  const token = randomBytes(32).toString('base64url');
  run('INSERT INTO sessions VALUES (?,?,?)', createHash('sha256').update(token).digest('hex'), id, Date.now() + 300_000);
  return 'abyssalSession=' + token;
}
interface ClientSocket {
  state: () => PartyState | null;
  rooms: () => PublicRoom[];
  send: (event: string, payload?: unknown) => Promise<{ok: boolean; error?: string}>;
  close: () => void;
}
async function openClient(port: number, cookie: string): Promise<ClientSocket> {
  const wire = connect(port, '127.0.0.1');
  await once(wire, 'connect');
  const ws = driver.client('ws://127.0.0.1:' + port + '/party-socket');
  ws.setHeader('Cookie', cookie);
  const pending = new Map();
  let room: PartyState | null = null;
  let listing: PublicRoom[] = [];
  let n = 0;
  wire.on('error', () => {});
  ws.on('error', () => wire.destroy());
  ws.messages.on('data', (data: string) => {
    const { event, payload, id } = JSON.parse(data);
    if (event === 'room:update') room = payload;
    if (event === 'rooms:list') listing = payload;
    if (id) { pending.get(id)?.(payload); pending.delete(id); }
  });
  wire.pipe(ws.io).pipe(wire);
  const opened = once(ws, 'open');
  ws.start();
  await opened;
  return {
    state: () => room, rooms: () => listing, close: () => wire.destroy(),
    send: (event, payload) => new Promise(resolve => {
      const id = ++n;
      pending.set(id, resolve);
      ws.text(JSON.stringify({ event, payload, id }));
    }),
  };
}
async function until(condition: () => boolean) {
  for (let tries = 0; tries < 120; tries++) {
    if (condition()) return;
    await pause(20);
  }
  assert.fail('Timed out waiting for multiplayer state.');
}

test('passes preserve the shared fuse and maintain the eight-second lower bound', () => {
  assert.equal(passDeadline(28_000, 5000), 28_000);
  assert.equal(passDeadline(12_000, 5000), 13_000);
  assert.equal(ratingDelta(1000, [{rating: 1000, result: 1}]), 12);
  assert.equal(ratingDelta(1000, [{rating: 1000, result: 0}]), -12);
});
test('real party sockets cover host, ready, pass, duplicate, reconnect, fuse expiry, hearts, and winner', { timeout: 10_000 }, async t => {
  let now = Date.now();
  const server = createServer();
  const party = installParty(server, () => now);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server needs a TCP port.');
  const { port } = address;
  const hostCookie = createIdentity('Host');
  const guestCookie = createIdentity('Guest');
  const thirdCookie = createIdentity('Third');
  const clients = new Set<ClientSocket>();
  t.after(() => {
    for (const client of clients) client.close();
    party.shutdown();
    server.close();
  });
  async function joinSocket(cookie: string) {
    const client = await openClient(port, cookie);
    clients.add(client);
    return client;
  }
  const a = await joinSocket(hostCookie);
  let b = await joinSocket(guestCookie);
  const c = await joinSocket(thirdCookie);
  assert.equal((await a.send('room:create', { ...DEFAULT_PARTY, name: 'Test waters', fuseMin: 10, fuseMax: 10, startingHearts: 1, heartPoints: 10, capacity: 2 })).ok, true);
  const code = a.state()!.code;
  await until(() => b.rooms()[0]?.code === code);
  assert.equal(b.rooms()[0].joinable, true);
  assert.equal((await b.send('room:join', { code })).ok, true);
  assert.equal((await c.send('room:join', { code })).error, 'This room is full.');
  assert.equal((await b.send('game:start')).ok, false);
  assert.equal((await a.send('game:start')).ok, false);
  assert.equal((await b.send('player:ready', { ready: true })).ok, true);
  assert.equal((await a.send('game:start')).ok, true);
  await until(() => b.state()?.status === 'playing');
  assert.equal(a.state()?.holderId, 'Host');
  assert.match(b.state()!.prompt!, /ocean/);
  assert.equal(Object.hasOwn(a.state()!, 'expiry'), false);
  const initialTurn = a.state()!.turn;
  assert.equal((await b.send('answer:submit', { turn: initialTurn, answer: 'Dolphin' })).ok, false);
  assert.equal((await a.send('answer:submit', { turn: initialTurn, answer: 'armchair' })).ok, false);
  now += 7000;
  const simultaneous = await Promise.all([a.send('answer:submit', { turn: initialTurn, answer: 'shark' }), a.send('answer:submit', { turn: initialTurn, answer: 'octopus' })]);
  assert.equal(simultaneous.filter(reply => reply.ok).length, 1);
  await until(() => b.state()?.holderId === 'Guest');
  assert.equal(a.state()?.answers.length, 1);
  assert.equal(b.state()?.answers[0].playerId, 'Host');
  assert.equal(a.state()?.players[0].hearts, 2);
  assert.equal(a.state()?.players[0].progress, 0);
  assert.equal((await b.send('answer:submit', { turn: b.state()!.turn, answer: 'SHARK!' })).error, 'That answer was already used.');
  b.close();
  await until(() => a.state()?.players[1].connected === false);
  b = await joinSocket(guestCookie);
  await until(() => b.state()?.players[1].connected === true);
  assert.equal(b.state()?.holderId, 'Guest');
  now += 3900;
  await pause(280);
  assert.equal(b.state()?.round, 1);
  now += 4200;
  await until(() => b.state()?.status === 'finished');
  assert.equal(a.state()?.winnerId, 'Host');
  assert.equal(a.state()?.players[1].hearts, 0);
  assert.deepEqual({ ...get('SELECT rating,wins,matches FROM ratings WHERE user_id=?', 'Host') }, { rating: 1000, wins: 1, matches: 1 });
  assert.equal((await b.send('answer:submit', { turn: b.state()!.turn, answer: 'Whale' })).ok, false);
  assert.equal((await a.send('game:rematch')).ok, true);
  a.close();
  await until(() => b.state()?.players[0].connected === false);
  now += 19_000;
  await until(() => b.state()?.hostId === 'Guest');
  assert.equal(b.state()?.players.length, 1);
  assert.equal((await c.send('queue:join', { size: '2', rated: true })).ok, true);
  assert.equal((await c.send('queue:cancel')).ok, true);
  assert.equal((await b.send('room:leave')).ok, true);
  assert.equal((await b.send('queue:join', { size: '2', rated: true })).ok, true);
  assert.equal((await c.send('queue:join', { size: '2', rated: true })).ok, true);
  await until(() => b.state()?.rated === true && c.state()?.code === b.state()?.code);
  assert.equal(b.state()?.status, 'playing');
});
