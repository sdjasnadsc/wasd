CREATE TABLE users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE COLLATE NOCASE,
  password TEXT, avatar TEXT NOT NULL DEFAULT 'sprat', created_at INTEGER NOT NULL,
  CHECK((username IS NULL AND password IS NULL) OR (username IS NOT NULL AND password IS NOT NULL))
);
CREATE TABLE sessions (
  token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires);
CREATE TABLE settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, preferences TEXT NOT NULL
);
CREATE TABLE questions (
  id TEXT PRIMARY KEY, prompt TEXT NOT NULL, category TEXT NOT NULL, difficulty INTEGER NOT NULL,
  restrictions TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX questions_category ON questions(category);
CREATE TABLE accepted_answers (
  id INTEGER PRIMARY KEY, question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  canonical TEXT NOT NULL, tier TEXT NOT NULL, UNIQUE(question_id, canonical)
);
CREATE TABLE answer_aliases (
  answer_id INTEGER NOT NULL REFERENCES accepted_answers(id) ON DELETE CASCADE, alias TEXT NOT NULL,
  PRIMARY KEY(answer_id, alias)
);
CREATE TABLE question_sets (
  id TEXT PRIMARY KEY, question_ids TEXT NOT NULL, snapshot TEXT NOT NULL
);
CREATE TABLE daily_challenges (
  day TEXT PRIMARY KEY, set_id TEXT NOT NULL REFERENCES question_sets(id)
);
CREATE TABLE games (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('daily','unlimited','archive','pack')), target TEXT NOT NULL,
  label TEXT NOT NULL, set_id TEXT NOT NULL REFERENCES question_sets(id),
  state TEXT NOT NULL CHECK (state IN ('answer','reveal','finished')),
  round INTEGER NOT NULL DEFAULT 0, deadline INTEGER NOT NULL, created_at INTEGER NOT NULL,
  completed_at INTEGER, score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 700)
);
CREATE UNIQUE INDEX daily_user_once ON games(user_id,target) WHERE mode='daily';
CREATE INDEX games_user_history ON games(user_id,completed_at DESC);
CREATE INDEX games_scores ON games(mode,target,score) WHERE completed_at IS NOT NULL;
CREATE INDEX games_user_active ON games(user_id,mode,target) WHERE completed_at IS NULL;
CREATE TABLE responses (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE, round INTEGER NOT NULL,
  entered TEXT NOT NULL, canonical TEXT, tier TEXT, points INTEGER NOT NULL,
  PRIMARY KEY(game_id, round)
);
CREATE TABLE streak_days (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day TEXT NOT NULL,
  PRIMARY KEY(user_id,day)
);
CREATE TABLE characters (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, required_days INTEGER NOT NULL
);
CREATE TABLE achievements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(id), unlocked_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,character_id)
);
CREATE TABLE friend_invites (
  code TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE friendships (
  requester TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted')),
  PRIMARY KEY(requester,recipient), CHECK(requester <> recipient)
);
CREATE INDEX friends_recipient ON friendships(recipient);
CREATE TABLE blocks (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,blocked), CHECK(user_id <> blocked)
);
CREATE TABLE ratings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL DEFAULT 1000, wins INTEGER NOT NULL DEFAULT 0, matches INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE party_rooms (
  id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, created_at INTEGER NOT NULL, closed_at INTEGER
);
CREATE TABLE party_matches (
  id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES party_rooms(id),
  rated INTEGER NOT NULL, finished_at INTEGER NOT NULL
);
CREATE TABLE party_results (
  match_id TEXT NOT NULL REFERENCES party_matches(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner INTEGER NOT NULL, rating_change INTEGER NOT NULL, PRIMARY KEY(match_id,user_id)
);
CREATE INDEX party_results_user ON party_results(user_id);
CREATE TABLE feedback (
  id INTEGER PRIMARY KEY, user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  game_id TEXT REFERENCES games(id) ON DELETE SET NULL, kind TEXT NOT NULL,
  rating INTEGER, message TEXT NOT NULL, created_at INTEGER NOT NULL, reviewed INTEGER NOT NULL DEFAULT 0
);
