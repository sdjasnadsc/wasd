export const TIERS = {
  Plankton: 10, 'Too Clever': 15, Schooler: 30, Rare: 60, 'Deep Cut': 85, 'One in a Krillion': 100,
} as const;
export type RarityTier = keyof typeof TIERS;
export const TIER_NAMES = Object.keys(TIERS) as RarityTier[];
export const TIER_ICONS = ['🟦', '🟩', '🟨', '🟧', '🟪', '🟥'];
export const ROUND_COUNT = 7;
export const ROUND_MS = 25_000;
export const MAX_SCORE = 700;
export const METERS_PER_POINT = 10;

export interface AcceptedAnswer {
  canonical: string;
  aliases: string[];
  tier: RarityTier;
  points: number;
}
export interface TriviaQuestion {
  id: string;
  prompt: string;
  category: string;
  acceptedAnswers: AcceptedAnswer[];
  difficulty: number;
  restrictions?: string[];
}
export type Mode = 'daily' | 'unlimited' | 'archive' | 'pack';
export interface ResponseResult {
  questionId: string;
  prompt: string;
  category: string;
  entered: string;
  canonical?: string;
  tier?: RarityTier;
  points: number;
}
export interface Dive {
  id: string;
  mode: Mode;
  key: string;
  label: string;
  current: number;
  prompt?: Pick<TriviaQuestion, 'id' | 'prompt' | 'category' | 'restrictions'>;
  status: 'answer' | 'reveal' | 'finished';
  deadline: number;
  now: number;
  score: number;
  responses: ResponseResult[];
}
export interface Run {
  id: string;
  mode: Mode;
  key: string;
  label: string;
  score: number;
  completedAt: number;
}
export const PACKS = {
  lexicon: { name: 'Words & Language', category: 'Language', description: 'From everyday words to vocabulary hiding in the deep.', color: 'violet' },
  movies: { name: 'At the Movies', category: 'Movies', description: 'Explore film history, memorable casts, and the people behind the camera.', color: 'rose' },
  sports: { name: 'Sports', category: 'Sports', description: 'Go beyond the scoreboard with teams, athletes, and sporting history.', color: 'gold' },
  geography: { name: 'Geography', category: 'Geography', description: 'Cross borders and oceans to find a less obvious answer.', color: 'mint' },
} as const;
export type Pack = keyof typeof PACKS;
export const AVATARS = [
  { id: 'sprat', name: 'Sprat', days: 0, color: '#73e3be' },
  { id: 'krill', name: 'Coral Krill', days: 1, color: '#ff9e78' },
  { id: 'squid', name: 'Moon Squid', days: 5, color: '#bfadf9' },
  { id: 'angler', name: 'Lantern Angler', days: 14, color: '#ffca87' },
  { id: 'ember', name: 'Ember Krill', days: 30, color: '#ef7789' },
  { id: 'fossil', name: 'Fossil Krill', days: 45, color: '#e2ddbb' },
  { id: 'mantis', name: 'Mantis Shrimp', days: 75, color: '#71e5c0' },
  { id: 'leviathan', name: 'Leviathan', days: 100, color: '#7caef6' },
  { id: 'ghost', name: 'Ghost Ray', days: 150, color: '#dbf4ff' },
] as const;
export type AvatarId = typeof AVATARS[number]['id'];
export const DEFAULT_SETTINGS = { sound: true, volume: 40, animations: true, reducedMotion: false, colorblind: false, largeText: false, shareAnswers: false };
export type Settings = typeof DEFAULT_SETTINGS;
export interface Profile {
  id: string; name: string; avatar: AvatarId; registered: boolean;
  settings: Settings; currentStreak: number; bestStreak: number; dailyCount: number;
  bestDaily: number; bestUnlimited: number; packChapters: number; total: number; average: number; best: number;
  rating: number; wins: number; matches: number; unlocked: AvatarId[]; history: Run[];
}
export interface PartySettings {
  name: string; private: boolean; capacity: number; startingHearts: number; maxHearts: number;
  heartPoints: number; fuseMin: number; fuseMax: number;
}
export const DEFAULT_PARTY: PartySettings = {
  name: '', private: false, capacity: 6, startingHearts: 2, maxHearts: 5, heartPoints: 600, fuseMin: 10, fuseMax: 30,
};
export interface PartyPlayer {
  id: string; name: string; avatar: AvatarId; hearts: number; progress: number;
  ready: boolean; connected: boolean; rating: number; ratingChange?: number;
}
export interface PartyState {
  id: string; code: string; settings: PartySettings; hostId: string; status: 'lobby' | 'playing' | 'finished';
  players: PartyPlayer[]; holderId?: string; winnerId?: string; prompt?: string; round: number;
  answers: { answer: string; name: string; points: number; tier: RarityTier }[];
  mood: 'calm' | 'tense' | 'critical'; now: number; turn: number; rated: boolean;
  event?: { kind: 'pass' | 'heart' | 'pop' | 'eliminated' | 'win'; text: string; id: number };
}
export interface PublicRoom { code: string; name: string; host: string; count: number; capacity: number; status: PartyState['status']; joinable: boolean }
export type Reply = (result: { ok: boolean; error?: string }) => void;
export interface PartyClientEvents {
  'room:create': (data: PartySettings, reply: Reply) => void;
  'room:join': (data: { code: string }, reply: Reply) => void;
  'room:leave': (reply: Reply) => void;
  'player:ready': (data: { ready: boolean }, reply: Reply) => void;
  'game:start': (reply: Reply) => void;
  'game:rematch': (reply: Reply) => void;
  'answer:submit': (data: { answer: string; turn: number }, reply: Reply) => void;
  'queue:join': (data: { size: '2' | '3' | '4-6' | '8-10'; rated: boolean }, reply: Reply) => void;
  'queue:cancel': (reply: Reply) => void;
}
export interface PartyServerEvents {
  'room:update': (state: PartyState | null) => void;
  'game:state': (state: PartyState) => void;
  'rooms:list': (rooms: PublicRoom[]) => void;
  'queue:update': (data: { size: string; rated: boolean; waiting: number } | null) => void;
  'answer:accepted': (info: { points: number; tier: RarityTier }) => void;
  'answer:rejected': (reason: string) => void;
  'puffer:pass': (state: PartyState['event']) => void;
  'puffer:pop': (state: PartyState['event']) => void;
  'player:eliminated': (state: PartyState['event']) => void;
  'game:finished': (state: PartyState) => void;
}

export function normalizeAnswer(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu, '')
    .replace(/\+/g, ' plus ').replace(/#/g, ' sharp ').replace(/[’‘'`]/g, '').replace(/[.](?=\p{L})/gu, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  rows[0] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}
const answerIndexes = new WeakMap<TriviaQuestion, Map<string, Set<AcceptedAnswer>>>();
export function validateAnswer(question: TriviaQuestion, input: string, used = new Set<string>()):
  { ok: true; answer: AcceptedAnswer } | { ok: false; reason: 'invalid' | 'ambiguous' | 'duplicate' } {
  if (input.length > 120) return { ok: false, reason: 'invalid' };
  const value = normalizeAnswer(input);
  if (!value) return { ok: false, reason: 'invalid' };
  let index = answerIndexes.get(question);
  if (!index) {
    index = new Map();
    for (const answer of question.acceptedAnswers) {
      for (const spelling of [answer.canonical, ...answer.aliases]) {
        const key = normalizeAnswer(spelling);
        if (!index.has(key)) index.set(key, new Set());
        index.get(key)!.add(answer);
      }
    }
    answerIndexes.set(question, index);
  }
  let candidates = index.get(value);
  if (!candidates && value.length >= 5) {
    candidates = new Set();
    let closest = value.length >= 11 ? 2 : 1;
    for (const [spelling, answers] of index) {
      if (spelling.length < 5 || Math.abs(spelling.length - value.length) > closest) continue;
      const distance = editDistance(value, spelling);
      if (distance > closest) continue;
      if (distance < closest) candidates.clear();
      closest = distance;
      for (const answer of answers) candidates.add(answer);
    }
  }
  if (!candidates?.size) return { ok: false, reason: 'invalid' };
  if (candidates.size > 1) return { ok: false, reason: 'ambiguous' };
  const answer = [...candidates][0];
  return used.has(normalizeAnswer(answer.canonical)) ? { ok: false, reason: 'duplicate' } : { ok: true, answer };
}

const nyDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
export function dateKey(time = Date.now()) {
  const parts = Object.fromEntries(nyDate.formatToParts(time).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join('-');
}
export const DAY_MS = 86_400_000;
export const offsetDay = (day: string, count: number) => new Date(Date.parse(day + 'T00:00:00Z') + count * DAY_MS).toISOString().slice(0, 10);
export function nextReset(now = Date.now()) {
  let low = now, high = now + 26 * 3_600_000;
  const today = dateKey(now);
  while (high - low > 1) {
    const middle = Math.floor((high + low) / 2);
    if (dateKey(middle) === today) low = middle;
    else high = middle;
  }
  return high;
}
export const EPOCH = '2024-01-01';
export const diveNumber = (day: string) => Math.round((Date.parse(day) - Date.parse(EPOCH)) / DAY_MS) + 1;
export function streaks(days: string[], today: string) {
  const sorted = [...new Set(days)].sort();
  let best = 0, count = 0, last = '';
  for (const day of sorted) {
    count = last && offsetDay(last, 1) === day ? count + 1 : 1;
    best = Math.max(best, count);
    last = day;
  }
  return { current: [today, offsetDay(today, -1)].includes(last) ? count : 0, best };
}
export function seededShuffle<T>(items: readonly T[], key: string): T[] {
  let seed = 2166136261;
  for (const letter of key) seed = Math.imul(seed ^ letter.charCodeAt(0), 16777619);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(seed / 4294967296 * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
