import { stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createServer } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRouter, staticFiles, requestOriginAllowed, HttpError, type RequestHandler, type Request, type Response, type NextFunction } from './http.ts';
import { input as z, InputError } from './input.ts';
import { DEFAULT_SETTINGS, TIERS, dateKey, nextReset, type RarityTier, type Run } from '@abyssal/shared';
import { all, atomic, editQuestion, get, questions, run, sql } from './db.ts';
import { ApiError, dailyInfo, nextRound, prepareCalendar, readDive, startDive, statistics, submitAnswer } from './dive.ts';
import { deleteAccount, exportUser, login, logout, profile, register, saveSettings, getSettings, sessionUser, viewer, type User } from './identity.ts';
import { installParty } from './party.ts';


const app = createRouter();
const server = createServer(app.listener);
const party = installParty(server);
prepareCalendar();
app.use('/', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !requestOriginAllowed(req)) {
    return next(new ApiError(403, 'Use this app to make changes.'));
  }
  next();
});

function rateLimit(limit: number, windowMs: number): RequestHandler {
  const buckets = new Map<string, { expires: number; count: number }>();
  setInterval(() => { for (const [key, bucket] of buckets) if (Date.now() >= bucket.expires) buckets.delete(key); }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip ?? 'local';
    if (!buckets.has(key) || buckets.get(key)!.expires <= Date.now()) buckets.set(key, { expires: Date.now() + windowMs, count: 0 });
    const value = buckets.get(key)!;
    if (++value.count > limit) return next(new ApiError(429, 'Too many requests. Wait a moment and try again.'));
    next();
  };
}
const authRate = rateLimit(16, 60_000);
const feedbackRate = rateLimit(15, 60_000);
app.use('/api', rateLimit(900, 60_000), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const bootstrap = (user: User) => {
  const now = Date.now();
  prepareCalendar(dateKey(now));
  return { profile: profile(user.id), daily: dailyInfo(user.id, now), resetAt: nextReset(now), now };
};
const player: RequestHandler = (req, res, next) => {
  const user = sessionUser(req.headers.cookie);
  if (!user) return next(new ApiError(401, 'Your session expired. Reload the app.'));
  res.locals.player = user;
  next();
};
const who = (res: Response): User => res.locals.player as User;
const id = (req: Request) => String(req.params.id);
const credentials = z.object({ username: z.string().trim().regex(/^[a-zA-Z0-9_-]{3,24}$/, 'Use 3–24 letters, numbers, underscores, or hyphens.'), password: z.string().min(8).max(128), importGuest: z.boolean().default(true) });
const roundSchema = z.object({ round: z.number().int().min(1).max(7) });
const inviteCode = z.string().regex(/^[\w-]{16}$/);
const settingsShape = Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key => [key, key === 'volume' ? z.number().min(0).max(100) : z.boolean()]));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/bootstrap', (req, res) => res.json(bootstrap(viewer(req, res))));
app.post('/api/account/register', authRate, player, (req, res) => {
  const { username, password } = credentials.parse(req.body);
  res.json(register(who(res), req, res, username, password));
});
app.post('/api/account/login', authRate, player, (req, res) => {
  const { username, password, importGuest } = credentials.parse(req.body);
  res.json(login(who(res), req, res, username, password, importGuest));
});
app.post('/api/account/logout', player, (req, res) => res.json(bootstrap(logout(req, res))));
app.delete('/api/account', authRate, player, (req, res) => {
  const { password } = z.object({ password: z.string().max(128).default('') }).parse(req.body ?? {});
  res.json(bootstrap(deleteAccount(who(res), password, res)));
});
app.get('/api/export', player, (_req, res) => res.attachment('abyssal-player-data.json').json(exportUser(who(res))));
app.patch('/api/settings', player, (req, res) => res.json(saveSettings(who(res).id, z.object(settingsShape).partial().parse(req.body))));
app.get('/api/profile', player, (_req, res) => res.json(profile(who(res).id)));
app.patch('/api/profile', player, (req, res) => {
  const user = who(res);
  const update = z.object({ name: z.string().trim().min(3).max(24).regex(/^[\p{L}\p{N} _.-]+$/u, 'Use letters, numbers, spaces, or punctuation _.-').optional(), avatar: z.string().max(30).optional() }).parse(req.body);
  if (update.avatar && !profile(user.id).unlocked.includes(update.avatar as never)) throw new ApiError(400, 'This companion is still locked.');
  run('UPDATE users SET name=?,avatar=? WHERE id=?', update.name ?? user.name, update.avatar ?? user.avatar, user.id);
  res.json(profile(user.id));
});

app.post('/api/dives', player, (req, res) => {
  const { mode, target } = z.object({ mode: z.enum(['daily', 'unlimited', 'archive', 'pack']), target: z.string().max(60).optional() }).parse(req.body);
  res.json(startDive(who(res).id, mode, target));
});
app.get('/api/dives/:id', player, (req, res) => res.json(readDive(who(res).id, id(req))));
app.post('/api/dives/:id/answer', player, (req, res) => {
  const body = roundSchema.extend({ answer: z.string().trim().min(1).max(120) }).parse(req.body);
  res.json(submitAnswer(who(res).id, id(req), body.round, body.answer));
});
app.post('/api/dives/:id/next', player, (req, res) => res.json(nextRound(who(res).id, id(req), roundSchema.parse(req.body).round)));
app.get('/api/dives/:id/statistics', player, (req, res) => res.json(statistics(who(res).id, id(req))));
app.get('/api/records', player, (req, res) => {
  const mode = z.enum(['daily', 'unlimited', 'archive', 'pack']).parse(req.query.mode);
  const user = who(res).id;
  const columns = 'id,mode,target AS key,label,score,completed_at AS completedAt';
  const records = mode === 'archive'
    ? all<Run>(`SELECT ${columns} FROM games WHERE user_id=? AND mode IN ('daily','archive') AND target<? AND completed_at IS NOT NULL ORDER BY completed_at DESC`, user, dateKey())
    : all<Run>(`SELECT ${columns} FROM games WHERE user_id=? AND mode=? AND completed_at IS NOT NULL ORDER BY completed_at DESC`, user, mode);
  res.json(records);
});

function friendCode(userId: string) {
  const existing = get<{ code: string }>('SELECT code FROM friend_invites WHERE user_id=?', userId);
  if (existing) return existing.code;
  const code = randomBytes(12).toString('base64url');
  run('INSERT INTO friend_invites VALUES (?,?)', code, userId);
  return code;
}
function friends(userId: string) {
  const today = dateKey();
  const official = get<{ score: number }>("SELECT score FROM games WHERE user_id=? AND target=? AND mode='daily' AND completed_at IS NOT NULL", userId, today);
  const completed = !!official;
  const people = all<{ id: string; name: string; avatar: string; requester: string; status: 'pending' | 'accepted' }>(`
    SELECT u.id,u.name,u.avatar,f.requester,f.status FROM friendships f JOIN users u
    ON u.id=CASE WHEN f.recipient=? THEN f.requester ELSE f.recipient END
    WHERE f.recipient=? OR f.requester=? ORDER BY u.name COLLATE NOCASE`, userId, userId, userId);
  return {
    today, completed, ownScore: official?.score, invite: friendCode(userId),
    people: people.map(person => {
      const game = completed && person.status === 'accepted' ? get<{ id: string; score: number }>(
        "SELECT id,score FROM games WHERE user_id=? AND target=? AND mode='daily' AND completed_at IS NOT NULL", person.id, today) : undefined;
      const answers = game && getSettings(person.id).shareAnswers ? all<{ entered: string; points: number }>(
        'SELECT entered,points FROM responses WHERE game_id=? ORDER BY round', game.id) : undefined;
      return { ...person, incoming: person.requester !== userId, score: game?.score, answers };
    }),
    blocked: all<{ id: string; name: string }>('SELECT u.id,u.name FROM blocks b JOIN users u ON u.id=b.blocked WHERE b.user_id=?', userId),
  };
}
function sendFriendRequest(from: string, to: string) {
  if (from === to) throw new ApiError(400, 'That invitation is already yours.');
  if (get('SELECT 1 FROM blocks WHERE (user_id=? AND blocked=?) OR (user_id=? AND blocked=?)', from, to, to, from)) {
    throw new ApiError(404, 'Invitation unavailable.');
  }
  if (get("SELECT 1 FROM friendships WHERE requester=? AND recipient=? AND status='pending'", to, from)) {
    run("UPDATE friendships SET status='accepted' WHERE requester=? AND recipient=?", to, from);
  } else if (!get('SELECT 1 FROM friendships WHERE requester=? AND recipient=?', to, from)) {
    run("INSERT OR IGNORE INTO friendships VALUES (?,?,'pending')", from, to);
  }
}
app.get('/api/friends', player, (_req, res) => res.json(friends(who(res).id)));
app.post('/api/friends/invite', player, (_req, res) => {
  const user = who(res).id;
  atomic(() => { run('DELETE FROM friend_invites WHERE user_id=?', user); friendCode(user); });
  res.json(friends(user));
});
app.post('/api/friends/request', player, (req, res) => {
  const request = z.object({ code: inviteCode.optional(), username: z.string().trim().min(3).max(24).optional() }).parse(req.body);
  const receiver = request.code ? get<{ id: string }>('SELECT user_id AS id FROM friend_invites WHERE code=?', request.code)
    : request.username ? get<{ id: string }>('SELECT id FROM users WHERE username=?', request.username) : undefined;
  if (!receiver) throw new ApiError(404, 'That invitation or username could not be found.');
  atomic(() => sendFriendRequest(who(res).id, receiver.id));
  res.json(friends(who(res).id));
});
app.post('/api/friends/action', player, (req, res) => {
  const body = z.object({ id: z.string().uuid(), action: z.enum(['accept', 'reject', 'remove', 'block', 'unblock']) }).parse(req.body);
  const user = who(res).id;
  if (user === body.id || !get('SELECT 1 FROM users WHERE id=?', body.id)) throw new ApiError(404, 'Player not found.');
  atomic(() => {
    if (body.action === 'accept') run("UPDATE friendships SET status='accepted' WHERE requester=? AND recipient=? AND status='pending'", body.id, user);
    if (body.action === 'reject') run("DELETE FROM friendships WHERE requester=? AND recipient=? AND status='pending'", body.id, user);
    if (body.action === 'remove' || body.action === 'block') run('DELETE FROM friendships WHERE (requester=? AND recipient=?) OR (requester=? AND recipient=?)', user, body.id, body.id, user);
    if (body.action === 'block') run('INSERT OR IGNORE INTO blocks VALUES (?,?)', user, body.id);
    if (body.action === 'unblock') run('DELETE FROM blocks WHERE user_id=? AND blocked=?', user, body.id);
  });
  res.json(friends(user));
});
app.post('/api/feedback', feedbackRate, player, (req, res) => {
  const value = z.object({ gameId: z.string().uuid().optional(), kind: z.enum(['game', 'incorrect', 'missing', 'multiplayer']), rating: z.number().int().min(1).max(5).optional(), message: z.string().trim().max(1800) }).parse(req.body);
  if (value.gameId && !get('SELECT 1 FROM games WHERE id=? AND user_id=? AND completed_at IS NOT NULL', value.gameId, who(res).id)) throw new ApiError(404, 'Completed game not found.');
  if (!value.message && !value.rating) throw new ApiError(400, 'Add a rating or a message.');
  run('INSERT INTO feedback (user_id,game_id,kind,rating,message,created_at) VALUES (?,?,?,?,?,?)', who(res).id, value.gameId ?? null, value.kind, value.rating ?? null, value.message, Date.now());
  res.json({ ok: true });
});
function admin(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_TOKEN;
  const supplied = req.headers.authorization?.replace(/^Bearer /, '');
  const hash = (value: string) => createHash('sha256').update(value).digest();
  if (!expected || expected.length < 24 || !supplied || !timingSafeEqual(hash(expected), hash(supplied))) {
    return next(new ApiError(403, 'Admin access requires a configured token.'));
  }
  next();
}
app.get('/api/admin', authRate, admin, (_req, res) => res.json({ questions: questions(), feedback: all('SELECT * FROM feedback ORDER BY id DESC LIMIT 500') }));
app.post('/api/admin/feedback/:id', authRate, admin, (req, res) => {
  run('UPDATE feedback SET reviewed=1 WHERE id=?', z.number().int().parse(Number(req.params.id)));
  res.json({ ok: true });
});
app.put('/api/admin/question/:id', authRate, admin, (req, res) => {
  const tier = z.enum(Object.keys(TIERS) as [RarityTier, ...RarityTier[]]);
  const question = z.object({ prompt: z.string().trim().min(8).max(350), category: z.string().trim().min(2).max(40),
    difficulty: z.number().int().min(1).max(5), restrictions: z.array(z.string().max(160)).max(12).optional(),
    acceptedAnswers: z.array(z.object({ canonical: z.string().trim().min(1).max(120), aliases: z.array(z.string().trim().min(1).max(120)).max(30), tier })).min(3).max(120),
  }).parse(req.body);
  const key = z.string().regex(/^[a-z0-9-]{2,48}$/).parse(req.params.id);
  prepareCalendar();
  try { editQuestion({ ...question, id: key, acceptedAnswers: question.acceptedAnswers.map(a => ({ ...a, points: TIERS[a.tier] })) }); }
  catch (error) { throw new ApiError(400, error instanceof Error ? error.message : 'Question could not be saved.'); }
  res.json({ ok: true });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
const web = fileURLToPath(new URL(production ? '../../web/dist/' : '../../web/', import.meta.url));
if (!production) {
  app.get('/shared.js', (_req, res) => res.set('Content-Type', 'application/javascript').set('Cache-Control', 'no-cache')
    .end(stripTypeScriptTypes(readFileSync(new URL('../../../packages/shared/src/index.ts', import.meta.url), 'utf8'))));
}
app.use('/', staticFiles(web));
app.get('*', (_req, res) => res.sendFile(web + 'index.html'));
app.onError((error: unknown, _req: Request, res: Response) => {
  if (error instanceof InputError) return res.status(400).json({ error: error.message });
  if (error instanceof ApiError || error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (typeof error === 'object' && error && 'status' in error && error.status === 400) return res.status(400).json({ error: 'Malformed request.' });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong. Try again in a moment.' });
});
const { values } = parseArgs({ options: { port: { type: 'string' }, host: { type: 'string' }, strictPort: { type: 'boolean' } }, strict: false });
const port = Number(values.port ?? process.env.PORT ?? 5173);
server.listen(port, String(values.host ?? process.env.HOST ?? '0.0.0.0'), () => console.log(`Abyssal web, API and multiplayer on http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  party.shutdown();
  server.close(() => { sql.close(); process.exit(0); });
  setTimeout(() => process.exit(0), 2500).unref();
});
