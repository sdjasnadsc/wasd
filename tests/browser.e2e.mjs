import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test, before, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as pause } from 'node:timers/promises';
import { BANK } from '../apps/server/src/bank.ts';

process.env.DATABASE_PATH = ':memory:';
const { dailySet } = await import('../apps/server/src/dive.ts');
const playwright = process.env.PLAYWRIGHT_PACKAGE ?? 'playwright';
const { chromium } = await import(playwright);
let port, base, browser, directory, server, log = '';

before(async () => {
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  base = 'http://127.0.0.1:' + port;
  directory = await mkdtemp(join(tmpdir(), 'abyssal-browser-'));
  server = spawn(process.execPath, ['apps/server/src/index.ts'], {
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATABASE_PATH: join(directory, 'test.sqlite'), NODE_ENV: 'production', ADMIN_TOKEN: 'test-only-key-exceeds-24-characters', COOKIE_SECURE: 'false' },
    stdio: ['ignore','pipe','pipe'],
  });
  server.stdout.on('data', value => { log += String(value); });
  server.stderr.on('data', value => { log += String(value); });
  for (let n = 0; n < 80; n++) {
    try { if ((await fetch(base + '/api/health')).ok) break; }
    catch { if (n === 79) throw new Error(log || 'Test server did not start.'); }
    await pause(50);
  }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--disable-dev-shm-usage'] });
});
after(async () => {
  await browser?.close();
  if (server && server.exitCode === null) {
    const stopped = once(server, 'exit');
    server.kill('SIGTERM');
    await stopped;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function visit(path, options = {}) {
  const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 960 }, reducedMotion: 'reduce', ...options });
  const page = await context.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(base + path);
  return { context, page, errors };
}
async function json(response) {
  const payload = await response.json();
  assert.ok(response.ok(), JSON.stringify(payload));
  return payload;
}
async function assertVisible(locator) {
  await locator.waitFor({ state: 'visible' });
  assert.equal(await locator.isVisible(), true);
}

test('two browser contexts join by invitation, get ready, and receive the same real answer update', { timeout: 25_000 }, async t => {
  const host = await visit('/party');
  const guest = await visit('/');
  t.after(() => Promise.all([host.context.close(), guest.context.close()]));
  await assertVisible(host.page.getByText('Connected', { exact: true }));
  await host.page.getByRole('button', { name: 'Room settings' }).click();
  await host.page.getByLabel('Room name').fill('Two-context test');
  await host.page.getByLabel('Player capacity').fill('2');
  await host.page.getByLabel('Shortest fuse').fill('25');
  await host.page.getByLabel('Longest fuse').fill('25');
  await host.page.getByRole('button', { name: 'Create room' }).click();
  await assertVisible(host.page.getByRole('heading', { name: 'Two-context test' }));
  const code = (await host.page.locator('.room-title .tag').first().textContent()).trim();
  assert.match(code, /^[A-Z]{4}$/);
  await guest.page.goto(base + '/party?room=' + code);
  await guest.page.getByRole('button', { name: 'I’m ready' }).click();
  await host.page.getByRole('button', { name: 'Start game' }).click();
  await assertVisible(host.page.getByText('You hold the puffer!', { exact: true }));
  await assertVisible(guest.page.getByRole('heading', { name: /animal that lives in the ocean/i }));
  await host.page.getByLabel('Your answer').fill('Chair');
  await host.page.getByRole('button', { name: 'Pass puffer' }).click();
  await assertVisible(host.page.getByRole('alert').getByText(/isn’t in this category/));
  await host.page.getByLabel('Your answer').fill('Shark');
  await host.page.getByRole('button', { name: 'Pass puffer' }).click();
  await assertVisible(host.page.locator('.used-answers').getByText('Shark', { exact: true }));
  await assertVisible(guest.page.locator('.used-answers').getByText('Shark', { exact: true }));
  await assertVisible(guest.page.getByText('You hold the puffer!', { exact: true }));
  await guest.page.reload();
  await assertVisible(guest.page.getByText('You hold the puffer!', { exact: true }));
  assert.deepEqual([...host.errors, ...guest.errors], []);
});

test('Daily Dive completes in a browser, survives refresh, and exposes results, packs, settings and archive', { timeout: 25_000 }, async t => {
  const { context, page, errors } = await visit('/');
  t.after(() => context.close());
  const begin = page.getByRole('button', { name: 'Begin descent' });
  await assertVisible(begin);
  await assertVisible(page.locator('[data-reset]').filter({ hasText: /^\d{2}:\d{2}:\d{2}$/ }));
  if (process.env.QA_CAPTURE_DIR) await page.screenshot({ path: join(process.env.QA_CAPTURE_DIR, 'abyssal-desktop.png'), fullPage: true });
  const boot = await json(await context.request.get('/api/bootstrap'));
  const bank = [...BANK].sort((a,b) => a.id < b.id ? -1 : Number(a.id > b.id));
  const expected = dailySet(boot.daily.today, bank);
  await begin.click();
  await assertVisible(page.getByRole('heading', { name: expected[0].prompt, exact: true }));
  const id = new URL(page.url()).pathname.split('/').at(-1);
  const started = await json(await context.request.get('/api/dives/' + id));
  await page.reload();
  await assertVisible(page.getByRole('heading', { name: expected[0].prompt, exact: true }));
  assert.equal((await json(await context.request.get('/api/dives/' + id))).deadline, started.deadline);
  for (const [i, prompt] of expected.entries()) {
    await assertVisible(page.getByRole('heading', { name: prompt.prompt, exact: true }));
    await page.getByLabel('Your answer').fill(prompt.acceptedAnswers.at(-1).canonical);
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    if (i < 6) await page.getByRole('button', { name: 'Next question' }).click();
  }
  await assertVisible(page.getByRole('heading', { name: 'Dive complete' }));
  assert.equal(await page.locator('.responses li').count(), 7);
  assert.match(await page.locator('.result-depth').textContent(), /7,000/);
  await page.getByRole('link', { name: 'Return home' }).click();
  await assertVisible(page.getByRole('link', { name: 'Review results' }));
  await page.getByRole('navigation').getByRole('link', { name: 'Archive', exact: true }).click();
  await assertVisible(page.getByRole('button', { name: 'Play archived dive' }));
  await page.getByRole('navigation').getByRole('link', { name: 'Themed Packs' }).click();
  await page.getByRole('link', { name: /Words & Language/ }).click();
  assert.equal(await page.getByRole('button', { name: /^Play chapter / }).count(), 30);
  await page.getByRole('button', { name: 'Play chapter 30', exact: true }).click();
  await assertVisible(page.getByText('Words & Language · Chapter 30', { exact: true }));
  await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click();
  const setting = page.getByRole('switch', { name: /colorblind/i });
  const saved = page.waitForResponse(response => response.url().endsWith('/api/settings') && response.request().method() === 'PATCH');
  await setting.check();
  await saved;
  await page.reload();
  await assertVisible(setting);
  assert.equal(await setting.isChecked(), true);
  assert.deepEqual(errors, []);
});

test('guest friend scores stay private until both players finish and answer sharing is opt-in', { timeout: 20_000 }, async t => {
  const a = await visit('/friends');
  const b = await visit('/friends');
  t.after(() => Promise.all([a.context.close(), b.context.close()]));
  await assertVisible(a.page.getByRole('heading', { name: 'Friends', exact: true }));
  await assertVisible(b.page.getByRole('heading', { name: 'Friends', exact: true }));
  const reqA = a.context.request;
  const reqB = b.context.request;
  const aProfile = await json(await reqA.get('/api/profile'));
  const aFriends = await json(await reqA.get('/api/friends'));
  await json(await reqB.post('/api/friends/request', { data: { code: aFriends.invite } }));
  const pending = await json(await reqA.get('/api/friends'));
  const bId = pending.people[0].id;
  await json(await reqA.post('/api/friends/action', { data: { id: bId, action: 'accept' } }));
  const boot = await json(await reqA.get('/api/bootstrap'));
  const sequence = dailySet(boot.daily.today, [...BANK].sort((a,b) => a.id < b.id ? -1 : Number(a.id > b.id)));
  async function play(req) {
    let dive = await json(await req.post('/api/dives', { data: { mode: 'daily' } }));
    for (const [i, question] of sequence.entries()) {
      const url = '/api/dives/' + dive.id;
      ({ dive } = await json(await req.post(url + '/answer', { data: { round: i + 1, answer: question.acceptedAnswers[0].canonical } })));
      if (i < 6) dive = await json(await req.post(url + '/next', { data: { round: i + 1 } }));
    }
    assert.equal(dive.status, 'finished');
  }
  await play(reqA);
  let read = await json(await reqB.get('/api/friends'));
  assert.equal(read.people.find(p => p.id === aProfile.id).score, undefined);
  await play(reqB);
  read = await json(await reqB.get('/api/friends'));
  assert.equal(read.people[0].score, 70);
  assert.equal(read.people[0].answers, undefined);
  await json(await reqA.patch('/api/settings', { data: { shareAnswers: true } }));
  read = await json(await reqB.get('/api/friends'));
  assert.equal(read.people[0].answers.length, 7);
  assert.equal((await reqB.get('/api/admin')).status(), 403);
  await json(await reqB.post('/api/friends/action', { data: { id: aProfile.id, action: 'block' } }));
  assert.equal((await json(await reqA.get('/api/friends'))).people.length, 0);
});

test('mobile navigation opens without horizontal overflow', { timeout: 12_000 }, async t => {
  const { context, page, errors } = await visit('/', { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  t.after(() => context.close());
  await assertVisible(page.getByRole('button', { name: 'Begin descent' }));
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  if (process.env.QA_CAPTURE_DIR) await page.screenshot({ path: join(process.env.QA_CAPTURE_DIR, 'abyssal-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Navigation menu' }).click();
  await page.getByRole('navigation').getByRole('link', { name: 'Puffer Party' }).click();
  await assertVisible(page.getByRole('heading', { name: 'Puffer Party', exact: true }));
  assert.equal(await page.getByRole('button', { name: 'Navigation menu' }).getAttribute('aria-expanded'), 'false');
  assert.deepEqual(errors, []);
});

test('accounts retain guest saves, synchronize between browsers, and protect admin data', { timeout: 20_000 }, async t => {
  const a = await visit('/settings');
  const b = await visit('/');
  t.after(() => Promise.all([a.context.close(), b.context.close()]));
  await assertVisible(a.page.getByRole('heading', { name: 'Settings', exact: true }));
  await assertVisible(b.page.getByRole('button', { name: 'Begin descent' }));
  const guest = await json(await a.context.request.get('/api/profile'));
  await a.page.getByLabel('Username').fill('test-diver');
  await a.page.getByLabel('Password', { exact: true }).fill('test-only-no-production-credential');
  await a.page.getByRole('button', { name: 'Create account', exact: true }).last().click();
  await assertVisible(a.page.getByRole('button', { name: 'Sign out' }));
  const account = await json(await a.context.request.get('/api/profile'));
  assert.equal(account.id, guest.id);
  const spare = await json(await b.context.request.get('/api/profile'));
  const unfinished = await json(await b.context.request.post('/api/dives', { data: { mode: 'unlimited' } }));
  const signedIn = await json(await b.context.request.post('/api/account/login', { data: { username: 'test-diver', password: 'test-only-no-production-credential', importGuest: true } }));
  assert.notEqual(signedIn.id, spare.id);
  assert.equal(signedIn.id, account.id);
  assert.equal((await json(await b.context.request.get('/api/dives/' + unfinished.id))).deadline, unfinished.deadline);
  await json(await b.context.request.post('/api/feedback', { data: { kind: 'multiplayer', message: 'Test private suggestion' } }));
  const denied = await b.context.request.get('/api/admin');
  assert.equal(denied.status(), 403);
  const headers = { Authorization: 'Bearer test-only-key-exceeds-24-characters' };
  const admin = await json(await a.context.request.get('/api/admin', { headers }));
  const item = admin.feedback.find(item => item.message === 'Test private suggestion');
  assert.ok(item);
  assert.equal(item.reviewed, 0);
  await json(await a.context.request.post('/api/admin/feedback/' + item.id, { headers }));
  const reviewed = await json(await a.context.request.get('/api/admin', { headers }));
  assert.equal(reviewed.feedback.find(value => value.id === item.id).reviewed, 1);
  assert.deepEqual(JSON.parse(await (await b.context.request.get('/api/export')).text()).profile.id, account.id);
  assert.equal((await b.context.request.delete('/api/account', { data: { password: 'incorrect' } })).status(), 401);
  const afterDelete = await json(await b.context.request.delete('/api/account', { data: { password: 'test-only-no-production-credential' } }));
  assert.notEqual(afterDelete.profile.id, account.id);
  assert.equal((await a.context.request.get('/api/profile')).status(), 401);
});
