import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from './http.ts';
import { AVATARS, DEFAULT_SETTINGS, dateKey, streaks, type AvatarId, type Profile, type Settings } from '@abyssal/shared';
import { all, atomic, get, run } from './db.ts';
import { ApiError, history } from './dive.ts';

export interface User { id: string; name: string; avatar: AvatarId; username: string | null; password: string | null }
const SESSION_AGE = 120 * 86_400_000;
const COOKIE = 'abyssalSession';
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
export function sessionToken(cookie = '') {
  return cookie.split(';').map(part => part.trim()).find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
}
export function sessionUser(cookie?: string) {
  const token = sessionToken(cookie);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
  return get<User>('SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE token=? AND expires>?', tokenHash(token), Date.now());
}
function establish(userId: string, res: Response, old?: string) {
  const token = randomBytes(32).toString('base64url');
  if (old) run('DELETE FROM sessions WHERE token=?', tokenHash(old));
  run('INSERT INTO sessions VALUES(?,?,?)', tokenHash(token), userId, Date.now() + SESSION_AGE);
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', maxAge: SESSION_AGE, path: '/' });
}
export function createGuest(res: Response): User {
  const id = randomUUID();
  atomic(() => {
    run('INSERT INTO users (id,name,created_at) VALUES(?,?,?)', id, 'Diver ' + id.slice(0, 4).toUpperCase(), Date.now());
    establish(id, res);
  });
  return get<User>('SELECT * FROM users WHERE id=?', id)!;
}
export function viewer(req: Request, res: Response) {
  return sessionUser(req.headers.cookie) ?? createGuest(res);
}
function passwordHash(password: string, salt = randomBytes(16).toString('hex')) {
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function correctPassword(password: string, record?: string | null) {
  const fallback = '0'.repeat(32) + ':' + '0'.repeat(128);
  const hash = record ?? fallback;
  return timingSafeEqual(Buffer.from(passwordHash(password, hash.split(':')[0])), Buffer.from(hash)) && !!record;
}
export const getSettings = (id: string): Settings => ({
  ...DEFAULT_SETTINGS, ...JSON.parse(get<{ preferences: string }>('SELECT preferences FROM settings WHERE user_id=?', id)?.preferences ?? '{}'),
});
export function saveSettings(id: string, updates: Partial<Settings>) {
  const merged = { ...getSettings(id), ...updates };
  run('INSERT INTO settings VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences', id, JSON.stringify(merged));
  return merged;
}
export function rating(id: string) {
  return get<{ rating: number; wins: number; matches: number }>('SELECT rating,wins,matches FROM ratings WHERE user_id=?', id) ?? { rating: 1000, wins: 0, matches: 0 };
}
export function profile(id: string): Profile {
  const user = get<User>('SELECT * FROM users WHERE id=?', id);
  if (!user) throw new ApiError(404, 'Player not found.');
  const dates = all<{ day: string }>('SELECT day FROM streak_days WHERE user_id=?', id).map(row => row.day);
  const { current, best } = streaks(dates, dateKey());
  const stats = get<{ total: number; average: number; best: number; bestDaily: number; bestUnlimited: number; packChapters: number }>(`
    SELECT COUNT(*) AS total, COALESCE(ROUND(AVG(score)),0) AS average, COALESCE(MAX(score),0) AS best,
    COALESCE(MAX(CASE WHEN mode='daily' THEN score END),0) AS bestDaily,
    COALESCE(MAX(CASE WHEN mode='unlimited' THEN score END),0) AS bestUnlimited,
    COUNT(DISTINCT CASE WHEN mode='pack' THEN target END) AS packChapters
    FROM games WHERE user_id=? AND completed_at IS NOT NULL`, id)!;
  const unlocked = AVATARS.filter(avatar => avatar.days <= best).map(avatar => avatar.id);
  for (const character of unlocked) run('INSERT OR IGNORE INTO achievements VALUES (?,?,?)', id, character, Date.now());
  return { ...stats, id, name: user.name, avatar: user.avatar, registered: !!user.username, settings: getSettings(id), currentStreak: current,
    bestStreak: best, dailyCount: dates.length, ...rating(id), unlocked, history: history(id) };
}
function transferGuest(guest: string, account: string) {
  run(`DELETE FROM games WHERE user_id=? AND mode='daily' AND completed_at IS NULL AND target IN
    (SELECT target FROM games WHERE user_id=? AND mode='daily' AND completed_at IS NOT NULL)`, account, guest);
  run(`DELETE FROM games WHERE user_id=? AND mode='daily' AND target IN
    (SELECT target FROM games WHERE user_id=? AND mode='daily')`, guest, account);
  run('UPDATE games SET user_id=? WHERE user_id=?', account, guest);
  run('INSERT OR IGNORE INTO streak_days SELECT ?,day FROM streak_days WHERE user_id=?', account, guest);
  run('INSERT OR IGNORE INTO achievements SELECT ?,character_id,unlocked_at FROM achievements WHERE user_id=?', account, guest);
  run('UPDATE feedback SET user_id=? WHERE user_id=?', account, guest);
  run('UPDATE OR IGNORE party_results SET user_id=? WHERE user_id=?', account, guest);
  const guestRating = rating(guest), accountRating = rating(account);
  run(`INSERT INTO ratings VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET rating=excluded.rating,wins=excluded.wins,matches=excluded.matches`,
    account, accountRating.matches ? accountRating.rating : guestRating.rating,
    accountRating.wins + guestRating.wins, accountRating.matches + guestRating.matches);
  run('INSERT OR IGNORE INTO settings SELECT ?,preferences FROM settings WHERE user_id=?', account, guest);
  run('DELETE FROM users WHERE id=?', guest);
}
export function register(user: User, req: Request, res: Response, username: string, password: string) {
  if (user.username) throw new ApiError(409, 'This session already belongs to an account.');
  if (get('SELECT 1 FROM users WHERE username=?', username)) throw new ApiError(409, 'That username is already registered.');
  atomic(() => {
    run('UPDATE users SET username=?,password=?,name=? WHERE id=?', username, passwordHash(password), username, user.id);
    establish(user.id, res, sessionToken(req.headers.cookie));
  });
  return profile(user.id);
}
export function login(user: User, req: Request, res: Response, username: string, password: string, importGuest: boolean) {
  const account = get<User>('SELECT * FROM users WHERE username=?', username);
  if (!correctPassword(password, account?.password) || !account) throw new ApiError(401, 'Username or password is incorrect.');
  atomic(() => {
    if (!user.username && importGuest) transferGuest(user.id, account.id);
    establish(account.id, res, sessionToken(req.headers.cookie));
  });
  return profile(account.id);
}
export function logout(req: Request, res: Response) {
  const token = sessionToken(req.headers.cookie);
  if (token) run('DELETE FROM sessions WHERE token=?', tokenHash(token));
  return createGuest(res);
}
export function deleteAccount(user: User, password: string, res: Response) {
  if (user.username && !correctPassword(password, user.password)) throw new ApiError(401, 'Confirm your password to delete your account.');
  atomic(() => {
    run('DELETE FROM feedback WHERE user_id=?', user.id);
    run('DELETE FROM users WHERE id=?', user.id);
  });
  return createGuest(res);
}
export function exportUser(user: User) {
  return {
    profile: profile(user.id), username: user.username,
    games: all('SELECT id,mode,target,label,state,created_at,completed_at,score FROM games WHERE user_id=?', user.id),
    responses: all('SELECT r.* FROM responses r JOIN games g ON g.id=r.game_id WHERE g.user_id=?', user.id),
    streakDays: all('SELECT day FROM streak_days WHERE user_id=?', user.id),
    achievements: all('SELECT character_id, unlocked_at FROM achievements WHERE user_id=?', user.id),
    friends: all('SELECT requester,recipient,status FROM friendships WHERE requester=? OR recipient=?', user.id, user.id),
    party: all('SELECT r.*,m.finished_at,m.rated FROM party_results r JOIN party_matches m ON m.id=r.match_id WHERE r.user_id=?', user.id),
    feedback: all('SELECT id,kind,rating,message,created_at FROM feedback WHERE user_id=?', user.id),
  };
}
