import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVATARS, TIERS, normalizeAnswer, type RarityTier, type TriviaQuestion } from '@abyssal/shared';
import { BANK } from './bank.ts';

const appDir = fileURLToPath(new URL('../', import.meta.url));
export const dbPath = process.env.DATABASE_PATH ?? join(appDir, '../../data/abyssal.sqlite');
if (dbPath !== ':memory:') mkdirSync(dirname(resolve(dbPath)), { recursive: true });
export const sql = new DatabaseSync(dbPath);
sql.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 4000;');
export const all = <T>(query: string, ...args: SQLInputValue[]) => sql.prepare(query).all(...args) as T[];
export const get = <T>(query: string, ...args: SQLInputValue[]) => sql.prepare(query).get(...args) as T | undefined;
export const run = (query: string, ...args: SQLInputValue[]) => sql.prepare(query).run(...args);
export function atomic<T>(action: () => T): T {
  sql.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    sql.exec('COMMIT');
    return result;
  } catch (error) {
    sql.exec('ROLLBACK');
    throw error;
  }
}
sql.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY)');
for (const name of readdirSync(join(appDir, 'migrations')).filter(name => name.endsWith('.sql')).sort()) {
  if (get('SELECT 1 FROM migrations WHERE name=?', name)) continue;
  atomic(() => {
    sql.exec(readFileSync(join(appDir, 'migrations', name), 'utf8'));
    run('INSERT INTO migrations VALUES (?)', name);
  });
}

// A question edit affects future sets. Existing rounds use their saved snapshots.
export function putQuestion(question: TriviaQuestion) {
  const tokens = new Map<string, string>();
  for (const answer of question.acceptedAnswers) {
    const canonical = normalizeAnswer(answer.canonical);
    for (const spelling of [answer.canonical, ...answer.aliases]) {
      const token = normalizeAnswer(spelling);
      if (!token || (tokens.has(token) && tokens.get(token) !== canonical)) throw new Error('Answer spellings must identify one canonical answer.');
      tokens.set(token, canonical);
    }
  }
  run(`INSERT INTO questions VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
    prompt=excluded.prompt,category=excluded.category,difficulty=excluded.difficulty,restrictions=excluded.restrictions`,
    question.id, question.prompt, question.category, question.difficulty, JSON.stringify(question.restrictions ?? []));
  run('DELETE FROM accepted_answers WHERE question_id=?', question.id);
  for (const answer of question.acceptedAnswers) {
    const record = run('INSERT INTO accepted_answers (question_id,canonical,tier) VALUES (?,?,?)', question.id, answer.canonical, answer.tier);
    for (const alias of new Set(answer.aliases)) run('INSERT INTO answer_aliases VALUES (?,?)', record.lastInsertRowid, alias);
  }
}
atomic(() => {
  for (const avatar of AVATARS) run('INSERT OR IGNORE INTO characters VALUES (?,?,?)', avatar.id, avatar.name, avatar.days);
  const existing = new Set(all<{ id: string }>('SELECT id FROM questions').map(question => question.id));
  for (const question of BANK) if (!existing.has(question.id)) putQuestion(question);
  run('DELETE FROM sessions WHERE expires < ?', Date.now());
  run('UPDATE party_rooms SET closed_at=? WHERE closed_at IS NULL', Date.now());
});

function loadBank(): TriviaQuestion[] {
  const rows = all<Omit<TriviaQuestion, 'acceptedAnswers' | 'restrictions'> & { restrictions: string }>('SELECT * FROM questions ORDER BY id');
  const answers = all<{ id: number; questionId: string; canonical: string; tier: RarityTier }>('SELECT id, question_id AS questionId, canonical, tier FROM accepted_answers ORDER BY id');
  const aliases = all<{ answerId: number; alias: string }>('SELECT answer_id AS answerId, alias FROM answer_aliases');
  return rows.map(question => ({
    ...question, restrictions: JSON.parse(question.restrictions),
    acceptedAnswers: answers.filter(answer => answer.questionId === question.id).map(answer => {
      const tier = answer.tier as RarityTier;
      return { canonical: answer.canonical, tier, points: TIERS[tier], aliases: aliases.filter(alias => alias.answerId === answer.id).map(alias => alias.alias) };
    }),
  }));
}
let cachedBank: TriviaQuestion[] | undefined;
export const questions = () => cachedBank ??= loadBank();
export function editQuestion(question: TriviaQuestion) {
  atomic(() => putQuestion(question));
  cachedBank = undefined;
}
