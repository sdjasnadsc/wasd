import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { AVATARS, PACKS, ROUND_MS, TIERS, dateKey, nextReset, normalizeAnswer, streaks, validateAnswer, type TriviaQuestion } from '@abyssal/shared';
import { BANK } from '../apps/server/src/bank.ts';
process.env.DATABASE_PATH = ':memory:';
const { all, get, run, questions } = await import('../apps/server/src/db.ts');
const { dailySet, startDive, readDive, submitAnswer, nextRound, statistics } = await import('../apps/server/src/dive.ts');
const { profile } = await import('../apps/server/src/identity.ts');
const now = Date.parse('2026-11-19T13:00:00Z');
const makeUser = (id: string) => run('INSERT INTO users (id,name,created_at) VALUES (?,?,?)', id, 'Test ' + id, now);
before(() => { makeUser('test-core-a'); makeUser('test-core-b'); });

test('curated bank has at least 150 unique prompts with deterministic canonical and alias matching', () => {
  assert.ok(BANK.length >= 150);
  assert.equal(new Set(BANK.map(q => q.id)).size, BANK.length);
  assert.equal(questions().length, BANK.length);
  for (const question of BANK) {
    assert.ok(question.acceptedAnswers.length >= 3, question.id);
    for (const answer of question.acceptedAnswers) {
      assert.equal(answer.points, TIERS[answer.tier]);
      for (const alias of [answer.canonical, ...answer.aliases]) {
        const result = validateAnswer(question, alias);
        assert.ok(result.ok, question.id + ': ' + alias);
        assert.equal(result.answer.canonical, answer.canonical);
      }
    }
  }
});
test('matching normalizes case, diacritics, spacing and punctuation and rejects wrong answers', () => {
  const europe = questions().find(q => q.id === 'geography-1')!;
  assert.deepEqual(validateAnswer(europe, '  the    Netherlands!  '), { ok: true, answer: europe.acceptedAnswers[2] });
  const desserts = questions().find(q => q.id === 'food-7')!;
  assert.equal(validateAnswer(desserts, 'SÔMEN').ok, true);
  assert.equal(validateAnswer(europe, 'frnace').ok, true);
  assert.deepEqual(validateAnswer(europe, 'south france'), { ok: false, reason: 'invalid' });
  assert.deepEqual(validateAnswer(europe, 'the Netherlands', new Set([normalizeAnswer('Netherlands')])), { ok: false, reason: 'duplicate' });
  assert.notEqual(normalizeAnswer('C++'), normalizeAnswer('C'));
});
test('fuzzy matching rejects ties and very short misspellings', () => {
  const sample: TriviaQuestion = {id: 't', category: 'X', prompt: 'Test', difficulty: 1, acceptedAnswers: [
    { canonical: 'plated', aliases: [], tier: 'Plankton', points: 10 },
    { canonical: 'planed', aliases: [], tier: 'Rare', points: 60 },
  ] };
  assert.deepEqual(validateAnswer(sample, 'placed'), { ok: false, reason: 'ambiguous' });
  assert.deepEqual(validateAnswer(sample, 'plan'), { ok: false, reason: 'invalid' });
});
test('Eastern calendar dates and resets handle spring-forward and fall-back', () => {
  const cases = [
    ['2026-03-08T04:59:59Z', '2026-03-07', '2026-03-08T05:00:00Z'],
    ['2026-03-08T05:00:00Z', '2026-03-08', '2026-03-09T04:00:00Z'],
    ['2026-11-01T03:59:59Z', '2026-10-31', '2026-11-01T04:00:00Z'],
    ['2026-11-01T04:00:00Z', '2026-11-01', '2026-11-02T05:00:00Z'],
  ];
  for (const [at, day, reset] of cases) {
    assert.equal(dateKey(Date.parse(at)), day);
    assert.equal(nextReset(Date.parse(at)), Date.parse(reset));
  }
});
test('streaks deduplicate dates, maintain a best, and expire after one missed day', () => {
  const days = ['2026-03-07', '2026-03-08', '2026-03-08', '2026-03-09', '2026-03-12', '2026-03-13'];
  assert.deepEqual(streaks(days, '2026-03-14'), { current: 2, best: 3 });
  assert.deepEqual(streaks(days, '2026-03-15'), { current: 0, best: 3 });
});
test('daily users get the same seven prompts, durable deadlines, rarity scores, a timeout, and one record', () => {
  const day = dateKey(now);
  const sequence = dailySet(day);
  assert.equal(sequence.length, 7);
  let a = startDive('test-core-a', 'daily', '', now);
  let b = startDive('test-core-b', 'daily', '', now);
  assert.equal(a.prompt?.id, b.prompt?.id);
  assert.equal(a.deadline, now + ROUND_MS);
  assert.equal(readDive('test-core-a', a.id, now + 8000).deadline, a.deadline);
  assert.equal(startDive('test-core-a', 'daily', '', now + 9000).id, a.id);
  const unknown = submitAnswer('test-core-a', a.id, 1, 'not a valid answer', now + 10000);
  assert.ok(unknown.error);
  assert.equal(unknown.dive.deadline, a.deadline);
  const expired = submitAnswer('test-core-a', a.id, 1, sequence[0].acceptedAnswers[0].canonical, a.deadline);
  assert.equal(expired.dive.status, 'reveal');
  assert.equal(expired.dive.responses[0].points, 0);
  assert.equal(expired.dive.responses[0].entered, '');
  a = nextRound('test-core-a', a.id, 1, a.deadline + 850);
  assert.equal(nextRound('test-core-a', a.id, 1, a.deadline - 200).current, 2);

  const answer = (owner: string, run: typeof a) => {
    let current = run;
    while (current.status !== 'finished') {
      const time = current.deadline - 450;
      const q = sequence[current.current - 1];
      assert.equal(current.prompt?.id, q.id);
      const rare = q.acceptedAnswers.at(-1)!;
      const result = submitAnswer(owner, current.id, current.current, rare.canonical, time);
      assert.equal(result.error, undefined);
      assert.equal(result.dive.responses.at(-1)?.tier, 'One in a Krillion');
      current = result.dive.status === 'reveal' ? nextRound(owner, current.id, current.current, time + 40) : result.dive;
    }
    return current;
  };
  a = answer('test-core-a', a);
  b = answer('test-core-b', b);
  assert.equal(a.score, 600);
  assert.equal(b.score, 700);
  assert.equal(a.responses.length, 7);
  assert.equal(startDive('test-core-a', 'daily', '', now + 900_000).id, a.id);
  assert.throws(() => readDive('test-core-b', a.id, now), /not found/i);
  assert.equal(statistics('test-core-a', a.id).percentile, 0);
  assert.equal(statistics('test-core-b', b.id).percentile, 100);
  assert.ok(profile('test-core-a').unlocked.includes(AVATARS[1].id));
  assert.equal(profile('test-core-a').dailyCount, 1);
  assert.notEqual(startDive('test-core-a', 'daily', '', Date.parse('2026-11-20T05:00:00Z')).id, a.id);
});
test('archive reuses a date snapshot and never changes official streak days', () => {
  const user = 'test-core-a';
  const previous = '2026-11-18';
  const play = (start: number) => {
    let dive = startDive(user, 'archive', previous, start);
    const initial = dive.prompt?.id;
    for (let r = 1; r <= 7; r++) {
      const deadline = dive.deadline;
      const expired = readDive(user, dive.id, deadline);
      dive = expired.status === 'finished' ? expired : nextRound(user, dive.id, r, deadline + 1);
    }
    return { dive, initial };
  };
  const first = play(now);
  const second = play(now + 800_000);
  assert.equal(first.dive.responses.length, 7);
  assert.equal(first.initial, second.initial);
  assert.notEqual(first.dive.id, second.dive.id);
  assert.equal(profile(user).dailyCount, 1);
  assert.throws(() => startDive(user, 'archive', '2026-11-31', now), /earlier date/i);
});
test('all themed chapters contain seven distinct category prompts and Unlimited avoids recent questions', () => {
  const user = 'test-core-a';
  for (const [key, settings] of Object.entries(PACKS)) {
    for (let chapter = 1; chapter <= 30; chapter++) {
      const dive = startDive(user, 'pack', key + ':' + chapter, now);
      const row = get<{ snapshot: string }>('SELECT s.snapshot FROM games g JOIN question_sets s ON s.id=g.set_id WHERE g.id=?', dive.id)!;
      const set: TriviaQuestion[] = JSON.parse(row.snapshot);
      assert.equal(new Set(set.map(q => q.id)).size, 7);
      assert.ok(set.every(q => q.category === settings.category));
    }
  }
  let dive = startDive(user, 'unlimited', '', now + 2_000_000);
  const firstId = dive.id;
  for (let r = 1; r <= 7; r++) {
    const deadline = dive.deadline;
    const expired = readDive(user, dive.id, deadline);
    dive = expired.status === 'finished' ? expired : nextRound(user, dive.id, r, deadline + 1);
  }
  const second = startDive(user, 'unlimited', '', now + 3_000_000);
  const sets = all<{ question_ids: string }>('SELECT s.question_ids FROM games g JOIN question_sets s ON s.id=g.set_id WHERE g.id IN (?,?)', firstId, second.id)
    .map(r => JSON.parse(r.question_ids) as string[]);
  assert.equal(new Set([...sets[0], ...sets[1]]).size, 14);
  assert.equal(second.label, 'Unlimited #2');
});
test('an unfinished official dive closes at midnight and cannot earn retroactive streak credit', () => {
  const user = 'test-core-b';
  const beforeMidnight = Date.parse('2026-11-21T04:59:58Z');
  const active = startDive(user, 'daily', '', beforeMidnight);
  assert.equal(readDive(user, active.id, beforeMidnight + 500).deadline, active.deadline);
  assert.throws(() => readDive(user, active.id, beforeMidnight + 3000), /closed at midnight/);
  assert.notEqual(startDive(user, 'daily', '', beforeMidnight + 3000).id, active.id);
  assert.equal(profile(user).dailyCount, 1);
});
