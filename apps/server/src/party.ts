import { randomInt, randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { partyTransport, type PartySocket } from './transport.ts';
import { input as z } from './input.ts';
import {
  DEFAULT_PARTY, normalizeAnswer, seededShuffle, validateAnswer, type PartyPlayer,
  type PartySettings, type PartyState, type PublicRoom, type Reply, type TriviaQuestion,
} from '@abyssal/shared';
import { atomic, get, questions, run } from './db.ts';
import { rating, sessionUser, type User } from './identity.ts';

const roomSchema = z.object({
  name: z.string().trim().max(42), private: z.boolean(), capacity: z.number().int().min(2).max(16),
  startingHearts: z.number().int().min(1).max(10), maxHearts: z.number().int().min(1).max(10),
  heartPoints: z.number().int().min(10).max(5000), fuseMin: z.number().int().min(1).max(90), fuseMax: z.number().int().min(1).max(120),
}).refine(value => value.maxHearts >= value.startingHearts && value.fuseMax >= value.fuseMin);
const sizeSchema = z.enum(['2', '3', '4-6', '8-10']);
const answerSchema = z.object({ answer: z.string().trim().min(1).max(120), turn: z.number().int().nonnegative() });
const codeSchema = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z]{4}$/) });
type QueueSize = ReturnType<typeof sizeSchema.parse>;
const sizes: Record<QueueSize, [number, number]> = { '2': [2, 2], '3': [3, 3], '4-6': [4, 6], '8-10': [8, 10] };
const GRACE_MS = 18_000;
const ROOM_MAX_AGE = 45 * 60_000;
const ROOM_IDLE = 20 * 60_000;
const REPLY_OK = { ok: true };
const fail = (reply: Reply, error: string) => reply({ ok: false, error });
const text = (input: string) => input.replace(/[\p{Cc}\p{Cf}<>]/gu, '').trim();

interface Room {
  state: PartyState; createdAt: number; touchedAt: number; expiry: number;
  question?: TriviaQuestion; pool: TriviaQuestion[]; used: Set<string>;
  disconnected: Map<string, number>; eliminated: string[];
}
interface QueueEntry { user: User; time: number; rated: boolean; size: QueueSize }

export const passDeadline = (deadline: number, now: number) => Math.max(deadline, now + 8_000);
export function ratingDelta(player: number, others: { rating: number; result: number }[]) {
  return Math.round(24 * others.reduce((sum, other) => sum + other.result - 1 / (1 + Math.pow(10, (other.rating - player) / 400)), 0) / others.length);
}

export function installParty(server: HttpServer, clock: () => number = Date.now) {
  const io = partyTransport(server);
  const rooms = new Map<string, Room>();
  const roomByUser = new Map<string, Room>();
  const sockets = new Map<string, Set<PartySocket>>();
  const queue = new Map<string, QueueEntry>();
  let newestEvent = 0;

  const publicRooms = (): PublicRoom[] => [...rooms.values()].filter(room => !room.state.settings.private).map(({ state }) => ({
    code: state.code, name: state.settings.name, host: state.players.find(p => p.id === state.hostId)?.name ?? '',
    count: state.players.length, capacity: state.settings.capacity, status: state.status,
    joinable: state.status === 'lobby' && state.players.length < state.settings.capacity,
  }));
  function event(room: Room, kind: NonNullable<PartyState['event']>['kind'], message: string) {
    room.state.event = { id: ++newestEvent, kind, text: message };
  }
  function publish(room: Room, updateRooms = false) {
    room.state.now = clock();
    io.to(room.state.id).emit('room:update', room.state);
    if (room.state.status === 'playing') io.to(room.state.id).emit('game:state', room.state);
    if (updateRooms) io.emit('rooms:list', publicRooms());
  }
  function makeRoom(host: User, settings: PartySettings, rated = false) {
    if (rooms.size >= 500) throw new Error('The party server is full. Try again soon.');
    let code: string;
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    do { code = Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
    const id = randomUUID();
    const now = clock();
    const room: Room = {
      state: { id, code, settings: { ...settings, name: text(settings.name) || host.name + '’s Party' }, hostId: host.id,
        status: 'lobby', players: [], answers: [], round: 0, turn: 0, mood: 'calm', now, rated },
      createdAt: now, touchedAt: now, expiry: 0, used: new Set(), pool: [], disconnected: new Map(), eliminated: [],
    };
    rooms.set(code, room);
    run('INSERT INTO party_rooms VALUES(?,?,?,?,NULL)', id, code, room.state.settings.name, now);
    return room;
  }
  function fetchProfile(user: User) {
    const current = [...sockets.get(user.id) ?? []].map(socket => sessionUser(socket.request.headers.cookie)).find(Boolean);
    return current ?? user;
  }
  function clearQueue(id: string) {
    if (!queue.delete(id)) return;
    for (const socket of sockets.get(id) ?? []) socket.emit('queue:update', null);
  }
  function connectPlayer(room: Room, initialUser: User) {
    const user = fetchProfile(initialUser);
    let player = room.state.players.find(player => player.id === user.id);
    if (player) {
      player.connected = true;
      player.name = user.name;
      player.avatar = user.avatar;
    } else {
      player = { id: user.id, name: user.name, avatar: user.avatar, connected: true, ready: false,
        hearts: room.state.settings.startingHearts, progress: 0, rating: rating(user.id).rating };
      room.state.players.push(player);
    }
    clearQueue(user.id);
    roomByUser.set(user.id, room);
    room.disconnected.delete(user.id);
    room.touchedAt = clock();
    for (const socket of sockets.get(user.id) ?? []) void socket.join(room.state.id);
  }
  function close(room: Room) {
    rooms.delete(room.state.code);
    run('UPDATE party_rooms SET closed_at=? WHERE id=?', clock(), room.state.id);
    for (const player of room.state.players) {
      if (roomByUser.get(player.id) !== room) continue;
      roomByUser.delete(player.id);
      for (const socket of sockets.get(player.id) ?? []) {
        void socket.leave(room.state.id);
        socket.emit('room:update', null);
      }
    }
    io.emit('rooms:list', publicRooms());
  }
  function nextHolder(room: Room, after: string) {
    const players = room.state.players;
    const index = players.findIndex(p => p.id === after);
    for (let offset = 1; offset <= players.length; offset++) {
      const player = players[(index + offset) % players.length];
      if (player.hearts > 0) return player;
    }
    return undefined;
  }
  function recordResult(room: Room, winner: PartyPlayer) {
    const state = room.state;
    const order = [winner.id, ...room.eliminated.slice().reverse()];
    const matchId = randomUUID();
    atomic(() => {
      run('INSERT INTO party_matches VALUES(?,?,?,?)', matchId, state.id, Number(state.rated), clock());
      for (const player of state.players) {
        if (!get('SELECT 1 FROM users WHERE id=?', player.id)) continue;
        const others = state.players.filter(other => other !== player).map(other => ({
          rating: other.rating, result: Number(order.indexOf(player.id) < order.indexOf(other.id)),
        }));
        const previous = rating(player.id);
        const delta = state.rated ? Math.max(100 - previous.rating, ratingDelta(player.rating, others)) : 0;
        player.ratingChange = delta;
        run('INSERT INTO party_results VALUES(?,?,?,?)', matchId, player.id, Number(player === winner), delta);
        run(`INSERT INTO ratings VALUES(?,?,?,1) ON CONFLICT(user_id) DO UPDATE SET rating=excluded.rating,
          wins=ratings.wins+excluded.wins,matches=ratings.matches+1`, player.id, previous.rating + delta, Number(player === winner));
      }
    });
    for (const player of state.players) player.rating += player.ratingChange ?? 0;
  }
  function finishIfNeeded(room: Room) {
    const survivors = room.state.players.filter(player => player.hearts > 0);
    if (survivors.length > 1) return false;
    const winner = survivors[0];
    if (!winner) { close(room); return true; }
    room.state.status = 'finished';
    room.state.holderId = undefined;
    room.state.winnerId = winner.id;
    room.state.mood = 'calm';
    room.touchedAt = clock();
    event(room, 'win', winner.name + ' survived the party!');
    recordResult(room, winner);
    publish(room, true);
    io.to(room.state.id).emit('game:finished', room.state);
    return true;
  }
  function newFuse(room: Room, holder?: PartyPlayer) {
    if (!room.pool.length) {
      const bank = questions().filter(q => q.acceptedAnswers.length >= 8);
      room.pool = seededShuffle(bank, randomUUID());
      if (room.state.round === 0) {
        const ocean = room.pool.findIndex(q => q.id === 'animals-1');
        if (ocean >= 0) room.pool.push(...room.pool.splice(ocean, 1));
      }
    }
    room.question = room.pool.pop()!;
    room.state.prompt = room.question.prompt;
    room.state.answers = [];
    room.state.round++;
    room.state.turn++;
    room.state.holderId = holder?.id;
    room.used.clear();
    room.expiry = clock() + randomInt(room.state.settings.fuseMin * 1000, room.state.settings.fuseMax * 1000 + 1);
    room.state.mood = 'calm';
  }
  function start(room: Room) {
    room.state.status = 'playing';
    room.touchedAt = clock();
    newFuse(room, room.state.players[0]);
    publish(room, true);
  }
  function pop(room: Room) {
    const holder = room.state.players.find(player => player.id === room.state.holderId)!;
    holder.hearts--;
    event(room, 'pop', holder.name + ' lost a heart!');
    io.to(room.state.id).emit('puffer:pop', room.state.event);
    if (!holder.hearts) {
      room.eliminated.push(holder.id);
      event(room, 'eliminated', holder.name + ' was eliminated.');
      io.to(room.state.id).emit('player:eliminated', room.state.event);
    }
    if (finishIfNeeded(room)) return;
    newFuse(room, nextHolder(room, holder.id));
    publish(room);
  }
  function detach(room: Room, id: string) {
    if (roomByUser.get(id) !== room) return;
    roomByUser.delete(id);
    room.disconnected.delete(id);
    for (const socket of sockets.get(id) ?? []) {
      void socket.leave(room.state.id);
      socket.emit('room:update', null);
    }
    const player = room.state.players.find(value => value.id === id)!;
    if (room.state.status === 'playing') {
      if (player.hearts) {
        room.eliminated.push(id);
        event(room, 'eliminated', player.name + ' left the match.');
      }
      player.connected = false;
      player.hearts = 0;
      if (finishIfNeeded(room)) {
        migrateHost(room);
        if (rooms.has(room.state.code)) publish(room, true);
        return;
      }
      if (room.state.holderId === id) {
        room.state.holderId = nextHolder(room, id)?.id;
        room.state.turn++;
      }
    } else if (room.state.status === 'lobby') {
      room.state.players = room.state.players.filter(value => value.id !== id);
    } else {
      player.connected = false;
    }
    migrateHost(room);
    if (!room.state.players.some(value => roomByUser.get(value.id) === room)) close(room);
    else publish(room, true);
  }
  function migrateHost(room: Room) {
    const host = room.state.players.find(player => player.id === room.state.hostId);
    if (host && roomByUser.get(host.id) === room) return;
    const next = room.state.players.find(player => player.connected && roomByUser.get(player.id) === room)
      ?? room.state.players.find(player => roomByUser.get(player.id) === room);
    if (next) room.state.hostId = next.id;
  }
  function matchQueue() {
    for (const [id, entry] of queue) {
      if (!queue.has(id)) continue;
      const [minimum, maximum] = sizes[entry.size];
      const baseRating = rating(id).rating;
      const group = [...queue.values()].filter(item => item.size === entry.size && item.rated === entry.rated &&
        (!entry.rated || Math.abs(rating(item.user.id).rating - baseRating) <= 150 + Math.min(550, Math.floor((clock() - entry.time) / 1000) * 6)));
      if (group.length < minimum || (group.length < maximum && clock() - entry.time < 2400) || rooms.size >= 500) continue;
      const participants = group.slice(0, maximum);
      const room = makeRoom(entry.user, { ...DEFAULT_PARTY, name: entry.rated ? 'Rated waters' : 'Quick Play', capacity: maximum, private: true }, entry.rated);
      for (const participant of participants) connectPlayer(room, participant.user);
      start(room);
    }
    for (const [id, entry] of queue) {
      const waiting = [...queue.values()].filter(item => item.size === entry.size && item.rated === entry.rated).length;
      for (const socket of sockets.get(id) ?? []) socket.emit('queue:update', { size: entry.size, rated: entry.rated, waiting });
    }
  }

  io.on('connection', socket => {
    const user = socket.data.user;
    const connections = sockets.get(user.id) ?? new Set<PartySocket>();
    connections.add(socket);
    sockets.set(user.id, connections);
    socket.emit('rooms:list', publicRooms());
    const restored = roomByUser.get(user.id);
    if (restored) { connectPlayer(restored, user); publish(restored, true); }
    const check = (reply: Reply) => {
      if (typeof reply !== 'function') return false;
      if (sessionUser(socket.request.headers.cookie)?.id === user.id) return true;
      fail(reply, 'Your player session changed. Reopen Puffer Party.');
      socket.disconnect();
      return false;
    };
    let budget = 22;
    let refill = clock();
    socket.use(([name, ...args], next) => {
      const now = clock();
      if (now - refill >= 5000) { budget = 22; refill = now; }
      if (--budget >= 0) return next();
      const reply = args.at(-1);
      if (typeof reply === 'function') fail(reply, 'Slow down a little and try again.');
      if (name !== 'answer:submit' && budget < -100) socket.disconnect();
    });
    socket.on('room:create', (value, reply) => {
      if (!check(reply)) return;
      const parsed = roomSchema.safeParse(value);
      if (!parsed.success) return fail(reply, 'Check the capacity, hearts, and fuse settings.');
      if (roomByUser.has(user.id)) return fail(reply, 'Leave your current room first.');
      if (rooms.size >= 500) return fail(reply, 'The party server is full.');
      const room = makeRoom(fetchProfile(user), parsed.data);
      connectPlayer(room, user);
      publish(room, true);
      reply(REPLY_OK);
    });
    socket.on('room:join', (value, reply) => {
      if (!check(reply)) return;
      const parsed = codeSchema.safeParse(value);
      if (!parsed.success) return fail(reply, 'Enter a four-letter room code.');
      const room = rooms.get(parsed.data.code);
      if (!room) return fail(reply, 'Room not found.');
      const existing = roomByUser.get(user.id);
      if (existing === room) { connectPlayer(room, user); publish(room); return reply(REPLY_OK); }
      if (existing) return fail(reply, 'Leave your current room first.');
      if (room.state.status !== 'lobby') return fail(reply, 'This match has already started.');
      if (room.state.players.length >= room.state.settings.capacity) return fail(reply, 'This room is full.');
      connectPlayer(room, user);
      publish(room, true);
      reply(REPLY_OK);
    });
    socket.on('room:leave', reply => {
      if (!check(reply)) return;
      const room = roomByUser.get(user.id);
      if (room) detach(room, user.id);
      clearQueue(user.id);
      reply(REPLY_OK);
    });
    socket.on('player:ready', (value, reply) => {
      if (!check(reply)) return;
      const room = roomByUser.get(user.id);
      if (!room || room.state.status !== 'lobby' || typeof value?.ready !== 'boolean') return fail(reply, 'Ready is available in the lobby.');
      room.state.players.find(player => player.id === user.id)!.ready = value.ready;
      room.touchedAt = clock();
      publish(room);
      reply(REPLY_OK);
    });
    socket.on('game:start', reply => {
      if (!check(reply)) return;
      const room = roomByUser.get(user.id);
      if (!room || room.state.hostId !== user.id || room.state.status !== 'lobby') return fail(reply, 'Only the host can start a lobby.');
      if (room.state.players.length < 2 || room.state.players.some(player => !player.connected || (player.id !== user.id && !player.ready))) {
        return fail(reply, 'Wait for at least two players and for everyone to be ready.');
      }
      start(room);
      reply(REPLY_OK);
    });
    socket.on('game:rematch', reply => {
      if (!check(reply)) return;
      const room = roomByUser.get(user.id);
      if (!room || room.state.hostId !== user.id || room.state.status !== 'finished') return fail(reply, 'Only the host can reopen a finished room.');
      if (room.state.rated) return fail(reply, 'Return to matchmaking for another rated game.');
      room.state.players = room.state.players.filter(player => roomByUser.get(player.id) === room);
      for (const player of room.state.players) Object.assign(player, { hearts: room.state.settings.startingHearts, progress: 0, ready: false, ratingChange: undefined });
      Object.assign(room.state, { status: 'lobby', round: 0, event: undefined, prompt: undefined, winnerId: undefined, answers: [] });
      room.eliminated = [];
      room.touchedAt = clock();
      publish(room, true);
      reply(REPLY_OK);
    });
    socket.on('answer:submit', (value, reply) => {
      if (!check(reply)) return;
      const room = roomByUser.get(user.id);
      const parsed = answerSchema.safeParse(value);
      if (!room || room.state.status !== 'playing' || !parsed.success) return fail(reply, 'Enter an answer while you hold the puffer.');
      const now = clock();
      if (now >= room.expiry) { pop(room); return fail(reply, 'The puffer popped before that answer arrived.'); }
      if (room.state.holderId !== user.id || parsed.data.turn !== room.state.turn) return fail(reply, 'That turn has ended.');
      const player = room.state.players.find(player => player.id === user.id)!;
      if (!player.hearts || !player.connected) return fail(reply, 'You are out of this round.');
      const result = validateAnswer(room.question!, parsed.data.answer, room.used);
      if (!result.ok) {
        const reason = result.reason === 'duplicate' ? 'That answer was already used.' : result.reason === 'ambiguous' ? 'Try a more specific spelling.' : 'That answer isn’t in this category’s bank.';
        socket.emit('answer:rejected', reason);
        return fail(reply, reason);
      }
      const { canonical, points, tier } = result.answer;
      room.used.add(normalizeAnswer(canonical));
      room.state.answers.push({ answer: canonical, points, name: player.name, tier });
      player.progress += points;
      const oldHearts = player.hearts;
      while (player.progress >= room.state.settings.heartPoints && player.hearts < room.state.settings.maxHearts) {
        player.progress -= room.state.settings.heartPoints;
        player.hearts++;
      }
      player.progress = Math.min(player.progress, room.state.settings.heartPoints - 1);
      const holder = nextHolder(room, user.id)!;
      room.state.holderId = holder.id;
      room.state.turn++;
      room.expiry = passDeadline(room.expiry, now);
      room.state.mood = mood(room.expiry - now);
      room.touchedAt = now;
      event(room, player.hearts > oldHearts ? 'heart' : 'pass', player.name + ' found ' + canonical + ' · +' + points + (player.hearts > oldHearts ? ' · Extra heart!' : ''));
      socket.emit('answer:accepted', { points, tier });
      io.to(room.state.id).emit('puffer:pass', room.state.event);
      publish(room);
      reply(REPLY_OK);
    });
    socket.on('queue:join', (value, reply) => {
      if (!check(reply)) return;
      const parsed = z.object({ size: sizeSchema, rated: z.boolean() }).safeParse(value);
      if (!parsed.success || roomByUser.has(user.id)) return fail(reply, 'Leave your room before joining a queue.');
      queue.set(user.id, { ...parsed.data, user, time: clock() });
      matchQueue();
      reply(REPLY_OK);
    });
    socket.on('queue:cancel', reply => { if (check(reply)) { clearQueue(user.id); reply(REPLY_OK); } });
    socket.on('disconnect', () => {
      connections.delete(socket);
      if (connections.size) return;
      sockets.delete(user.id);
      clearQueue(user.id);
      const room = roomByUser.get(user.id);
      if (!room) return;
      room.disconnected.set(user.id, clock() + GRACE_MS);
      const player = room.state.players.find(player => player.id === user.id);
      if (player) player.connected = false;
      publish(room, true);
    });
  });

  const mood = (remaining: number): PartyState['mood'] => remaining <= 3300 ? 'critical' : remaining <= 6200 ? 'tense' : 'calm';
  const tick = setInterval(() => {
    const now = clock();
    for (const room of rooms.values()) {
      for (const [id, deadline] of room.disconnected) if (now >= deadline) detach(room, id);
      if (!rooms.has(room.state.code)) continue;
      if (room.state.status === 'playing') {
        if (now - room.createdAt > ROOM_MAX_AGE) { close(room); continue; }
        if (now >= room.expiry) pop(room);
        else if (room.state.mood !== mood(room.expiry - now)) {
          room.state.mood = mood(room.expiry - now);
          publish(room);
        }
      } else if (now - room.touchedAt > ROOM_IDLE) close(room);
    }
    if (queue.size) matchQueue();
  }, 250);
  tick.unref();
  return { io, shutdown: () => { clearInterval(tick); for (const room of rooms.values()) close(room); io.close(); } };
}
