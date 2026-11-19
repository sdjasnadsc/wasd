import { randomUUID } from 'node:crypto';
import {
  ROUND_COUNT, ROUND_MS, PACKS, EPOCH, dateKey, diveNumber, offsetDay, seededShuffle, validateAnswer,
  type Dive, type Mode, type Pack, type RarityTier, type ResponseResult, type Run, type TriviaQuestion,
} from '@abyssal/shared';
import { all, atomic, get, questions, run } from './db.ts';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
interface GameRow {
  id: string; user_id: string; mode: Mode; target: string; label: string; set_id: string;
  state: Dive['status']; round: number; deadline: number; score: number; completed_at: number | null;
}
interface AnswerRow { round: number; entered: string; canonical: string | null; tier: RarityTier | null; points: number }

export function dailySet(day: string, bank = questions()) {
  const categories = seededShuffle([...new Set(bank.map(q => q.category))], day + '/categories');
  return categories.slice(0, ROUND_COUNT).map(category => seededShuffle(bank.filter(q => q.category === category), day + '/' + category)[0]);
}
function saveSet(id: string, set: TriviaQuestion[]) {
  if (set.length !== ROUND_COUNT) throw new ApiError(503, 'This question pool needs seven prompts.');
  run('INSERT OR IGNORE INTO question_sets VALUES(?,?,?)', id, JSON.stringify(set.map(q => q.id)), JSON.stringify(set));
}
function dailySetId(day: string) {
  const id = 'daily/' + day;
  if (!get('SELECT 1 FROM daily_challenges WHERE day=?', day)) {
    saveSet(id, dailySet(day));
    run('INSERT INTO daily_challenges VALUES (?,?)', day, id);
  }
  return id;
}
let preparedThrough = '';
export function prepareCalendar(today = dateKey()) {
  if (preparedThrough >= today) return;
  atomic(() => {
    const existing = new Set(all<{ day: string }>('SELECT day FROM daily_challenges WHERE day<=?', today).map(row => row.day));
    for (let day = preparedThrough ? offsetDay(preparedThrough, 1) : EPOCH; day <= today; day = offsetDay(day, 1)) {
      if (!existing.has(day)) dailySetId(day);
    }
  });
  preparedThrough = today;
}
function findGame(userId: string, id: string) {
  const game = get<GameRow>('SELECT * FROM games WHERE id=? AND user_id=?', id, userId);
  if (!game) throw new ApiError(404, 'Dive not found.');
  return game;
}
function loadSet(setId: string): TriviaQuestion[] {
  return JSON.parse(get<{ snapshot: string }>('SELECT snapshot FROM question_sets WHERE id=?', setId)!.snapshot);
}
function reveal(game: GameRow, response: Pick<AnswerRow, 'entered' | 'canonical' | 'tier' | 'points'>, now: number) {
  run('INSERT INTO responses VALUES (?,?,?,?,?,?)', game.id, game.round, response.entered, response.canonical, response.tier, response.points);
  if (game.round === ROUND_COUNT - 1) {
    run("UPDATE games SET state='finished', deadline=0, score=score+?, completed_at=? WHERE id=?", response.points, now, game.id);
    if (game.mode === 'daily') run('INSERT OR IGNORE INTO streak_days VALUES(?,?)', game.user_id, game.target);
  } else {
    run("UPDATE games SET state='reveal', deadline=0, score=score+? WHERE id=?", response.points, game.id);
  }
  return findGame(game.user_id, game.id);
}
function expire(game: GameRow, now: number) {
  if (game.mode === 'daily' && game.state !== 'finished' && game.target < dateKey(now)) {
    throw new ApiError(410, 'This official dive closed at midnight. You can replay the same prompts in the Archive.');
  }
  return game.state === 'answer' && now >= game.deadline
    ? reveal(game, { entered: '', canonical: null, tier: null, points: 0 }, now) : game;
}
function state(game: GameRow, now: number): Dive {
  const set = loadSet(game.set_id);
  const current = set[game.round];
  const responses: ResponseResult[] = all<AnswerRow>('SELECT * FROM responses WHERE game_id=? ORDER BY round', game.id)
    .map(row => ({ questionId: set[row.round].id, prompt: set[row.round].prompt, category: set[row.round].category,
      entered: row.entered, canonical: row.canonical ?? undefined, tier: row.tier ?? undefined, points: row.points }));
  return {
    id: game.id, mode: game.mode, key: game.target, label: game.label, current: game.round + 1,
    prompt: game.state === 'finished' ? undefined : { id: current.id, prompt: current.prompt, category: current.category, restrictions: current.restrictions },
    status: game.state, deadline: game.deadline, now, score: game.score, responses,
  };
}
export function readDive(userId: string, id: string, now = Date.now()) {
  return atomic(() => state(expire(findGame(userId, id), now), now));
}
export function startDive(userId: string, mode: Mode, target = '', now = Date.now()) {
  return atomic(() => {
    const today = dateKey(now);
    let targetKey = target;
    if (mode === 'daily') targetKey = today;
    if (mode === 'archive' && (!/^\d{4}-\d{2}-\d{2}$/.test(target) || !Number.isFinite(Date.parse(target)) || offsetDay(target, 0) !== target || target < EPOCH || target >= today)) {
      throw new ApiError(400, 'Choose an earlier date in the archive.');
    }
    const current = mode === 'unlimited' ?
      get<GameRow>("SELECT * FROM games WHERE user_id=? AND mode='unlimited' AND completed_at IS NULL ORDER BY created_at DESC LIMIT 1", userId) :
      get<GameRow>("SELECT * FROM games WHERE user_id=? AND mode=? AND target=? AND (mode='daily' OR completed_at IS NULL) ORDER BY created_at DESC LIMIT 1", userId, mode, targetKey);
    if (current) return state(expire(current, now), now);
    const id = randomUUID();
    let label = '';
    let setId = '';
    if (mode === 'daily' || mode === 'archive') {
      setId = dailySetId(targetKey);
      label = `Dive #${diveNumber(targetKey)}`;
    }
    if (mode === 'unlimited') {
      const count = get<{ n: number }>("SELECT count(*) AS n FROM games WHERE mode='unlimited' AND user_id=?", userId)!.n;
      const recent = new Set(all<{ question_ids: string }>(
        'SELECT s.question_ids FROM games g JOIN question_sets s ON s.id=g.set_id WHERE g.user_id=? ORDER BY g.created_at DESC LIMIT 8', userId)
        .flatMap(row => JSON.parse(row.question_ids) as string[]));
      const shuffled = seededShuffle(questions(), id);
      const set = [...shuffled.filter(q => !recent.has(q.id)), ...shuffled.filter(q => recent.has(q.id))].slice(0, ROUND_COUNT);
      setId = 'unlimited/' + id;
      targetKey = String(count + 1);
      label = 'Unlimited #' + targetKey;
      saveSet(setId, set);
    }
    if (mode === 'pack') {
      const [pack, chapter] = targetKey.split(':');
      if (!Object.hasOwn(PACKS, pack) || !/^(?:[1-9]|[12][0-9]|30)$/.test(chapter ?? '') || targetKey !== pack + ':' + chapter) {
        throw new ApiError(400, 'Choose a chapter from 1 to 30.');
      }
      const details = PACKS[pack as Pack];
      label = details.name + ' · Chapter ' + chapter;
      setId = 'pack/' + targetKey;
      if (!get('SELECT 1 FROM question_sets WHERE id=?', setId)) {
        const pool = questions().filter(q => q.category === details.category);
        saveSet(setId, seededShuffle(pool, setId).slice(0, ROUND_COUNT));
      }
    }
    run("INSERT INTO games (id,user_id,mode,target,label,set_id,state,deadline,created_at) VALUES(?,?,?,?,?,?,'answer',?,?)",
      id, userId, mode, targetKey, label, setId, now + ROUND_MS, now);
    return state(findGame(userId, id), now);
  });
}
export function submitAnswer(userId: string, id: string, round: number, answer: string, now = Date.now()) {
  return atomic(() => {
    const game = expire(findGame(userId, id), now);
    if (game.state !== 'answer' || game.round + 1 !== round) return { dive: state(game, now), error: 'This round has already ended.' };
    const parsed = validateAnswer(loadSet(game.set_id)[game.round], answer);
    if (!parsed.ok) return { dive: state(game, now), error: parsed.reason === 'ambiguous' ?
      'That could mean more than one answer. Try a more specific spelling.' : 'That answer isn’t in this question’s bank. Try again.' };
    return { dive: state(reveal(game, { entered: answer, ...parsed.answer }, now), now) };
  });
}
export function nextRound(userId: string, id: string, round: number, now = Date.now()) {
  return atomic(() => {
    const game = expire(findGame(userId, id), now);
    if (game.state === 'reveal' && game.round + 1 === round) run("UPDATE games SET round=round+1, state='answer', deadline=? WHERE id=?", now + ROUND_MS, id);
    return state(findGame(userId, id), now);
  });
}
export const history = (userId: string, limit = 60) => all<Run>(`
  SELECT id,mode,target AS key,label,score,completed_at AS completedAt FROM games
  WHERE user_id=? AND completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT ?`, userId, limit);
export function dailyInfo(userId: string, now = Date.now()) {
  const today = dateKey(now);
  const game = get<GameRow>("SELECT * FROM games WHERE user_id=? AND mode='daily' AND target=?", userId, today);
  return { today, number: diveNumber(today), active: game?.id, completed: !!game?.completed_at, score: game?.score };
}
export function statistics(userId: string, id: string) {
  const game = findGame(userId, id);
  if (!game.completed_at) throw new ApiError(409, 'Finish the dive to view breakdowns.');
  const previousBest = get<{ best: number | null }>(`
    SELECT MAX(score) AS best FROM games WHERE completed_at IS NOT NULL AND id<>? AND user_id=? AND mode=?
    AND (? IN ('daily','unlimited') OR target=?)`, id, userId, game.mode, game.mode, game.target)!.best;
  const distribution = game.mode === 'daily' ? all<{ score: number; count: number }>(
    "SELECT score, COUNT(*) as count FROM games WHERE mode='daily' AND target=? AND completed_at IS NOT NULL GROUP BY score ORDER BY score", game.target) : [];
  const sample = distribution.reduce((total, bucket) => total + bucket.count, 0);
  const below = distribution.reduce((total, bucket) => total + (bucket.score < game.score ? bucket.count : 0), 0);
  const tied = distribution.find(bucket => bucket.score === game.score)?.count ?? 0;
  return { previousBest, distribution, sample, percentile: sample >= 2 ? Math.round(100 * (below + (tied - 1) / 2) / (sample - 1)) : null };
}
