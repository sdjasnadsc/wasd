import { PACKS, ROUND_MS } from '/shared.js';
import { NAV, avatar, btn, href, icon, esc, error, box, loading } from './ui.js';
import { home, unlimited, archive, packs, faq, about, notFound } from './pages.js';
import { diveView, shareResult } from './dive-view.js';
import { adminView, friendsView, profileView, settingsView } from './profile-view.js';
import { partyView } from './party-view.js';
import { connectParty } from './party-client.js';

const root = document.querySelector('#root');
const state = {
  boot: null, route: 'home', bootError: '', error: '', menu: false, records: null,
  accountTab: 'register', queueSize: '2', rooms: [], stats: null,
};
let generation = 0;
let party;
let synced = null;
let syncing = null;
let resetRequested = false;
let toastTimer;
let audio;
let lastPartyEvent = 0;
let sidebarKey = '';

async function api(path, { method = 'GET', body, token } = {}) {
  const headers = body === undefined ? {} : { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch('/api' + path, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The server did not respond.');
  return data;
}
const send = (path, body, method = 'POST') => api(path, { method, body });
function setBootstrap(boot) {
  state.boot = boot;
  state.clock = { server: boot.now, client: performance.now() };
  applyPreferences();
}
function applyPreferences() {
  const settings = state.boot?.profile.settings;
  if (!settings) return;
  document.documentElement.classList.toggle('less-motion', settings.reducedMotion || !settings.animations);
  document.documentElement.classList.toggle('colorblind', settings.colorblind);
  document.documentElement.classList.toggle('large-text', settings.largeText);
  renderHeader();
}
function renderHeader() {
  const p = state.boot?.profile;
  const header = document.querySelector('#header');
  if (!header) return;
  const sound = p?.settings.sound ?? true;
  header.innerHTML = '<div class="topbar-wrap"><div class="brand-group">' +
    btn('menu', 'Menu', 'icon-button menu-toggle', state.menu ? 'close' : 'menu', 'aria-label="Navigation menu" aria-expanded="' + state.menu + '" aria-controls="sidebar"') +
    '<a href="/" class="brand" aria-label="Abyssal home"><img src="/public/mark.svg" alt="" width="42" height="42" /><span>ABYSSAL<small>UNDERWATER TRIVIA ARCADE</small></span></a></div>' +
    '<div class="header-right">' + btn('sound', sound ? 'Mute sound' : 'Enable sound', 'icon-button sound-toggle', sound ? 'volume' : 'mute',
      'aria-label="' + (sound ? 'Mute sound' : 'Enable sound') + '" title="' + (sound ? 'Mute sound' : 'Enable sound') + '"' + (p ? '' : ' disabled')) +
    '<a href="/account" class="player-chip" aria-label="My Profile">' + avatar(p?.avatar) + '<span>' + esc(p?.registered ? p.name : 'Guest diver') + '</span>' + icon('down', 14) + '</a></div></div>';
}
function currentNav() {
  const current = location.pathname;
  if (state.route === 'pack') return '/packs';
  if (state.route === 'dive' && state.dive) {
    return { daily: '/', unlimited: '/unlimited/classic', archive: '/archive', pack: '/packs' }[state.dive.mode];
  }
  if (state.route === 'unlimited') return '/unlimited/classic';
  return current;
}
function renderSidebar() {
  const current = currentNav();
  const streak = state.boot?.profile.currentStreak ?? 0;
  document.body.classList.toggle('menu-open', state.menu);
  const key = current + ':' + streak;
  if (sidebarKey === key) return;
  sidebarKey = key;
  document.querySelector('#sidebar').innerHTML =
    '<nav aria-label="Main navigation">' + NAV.map(([group, list]) =>
      '<section class="nav-group"><h2>' + group + '</h2><ul>' + list.map(([url, text, glyph]) =>
        '<li><a href="' + url + '"' + (current === url ? ' class="active" aria-current="page"' : '') + '>' + icon(glyph, 19) + '<span>' + text + '</span>' +
        (current === url ? '<i aria-hidden="true"></i>' : '') + '</a></li>').join('') + '</ul></section>').join('') +
    '</nav><a href="/account" class="side-streak"><span>' + icon('flame', 21) + '</span><div><strong>' + streak + '-day streak</strong><small>' + (streak ? 'View your dive log' : 'Dive to start a streak') + '</small></div></a>';
}
const views = { home, unlimited, archive, packs, pack: packs, dive: diveView, party: partyView, account: profileView,
  settings: settingsView, friends: friendsView, faq, about, admin: adminView, missing: notFound };

function draw({ focus = '', preserve = true } = {}) {
  const main = document.querySelector('#main');
  const controls = new Map();
  if (preserve) for (const field of main.querySelectorAll('[data-preserve][name]')) {
    const id = field.closest('form')?.dataset.form + '/' + field.name + '/' + (field.closest('form')?.dataset.turn ?? '');
    controls.set(id, { value: field.value, checked: field.checked, focused: document.activeElement === field, start: field.selectionStart, end: field.selectionEnd });
  }
  const oldDetails = new Set(preserve ? [...main.querySelectorAll('details[open]')].map(item => item.querySelector('summary')?.textContent) : []);
  const markup = state.bootError ? box(error(state.bootError) + btn('reload', 'Retry connection', 'primary', 'refresh')) :
    !state.boot && state.route !== 'home' ? loading() : views[state.route](state);
  main.innerHTML = markup;
  for (const details of main.querySelectorAll('details')) if (oldDetails.has(details.querySelector('summary')?.textContent)) details.open = true;
  for (const field of main.querySelectorAll('[data-preserve][name]')) {
    const id = field.closest('form')?.dataset.form + '/' + field.name + '/' + (field.closest('form')?.dataset.turn ?? '');
    const saved = controls.get(id);
    if (!saved) continue;
    field.value = saved.value;
    if (field.type === 'checkbox') field.checked = saved.checked;
    if (saved.focused) {
      field.focus({ preventScroll: true });
      if (Number.isInteger(saved.start) && typeof field.setSelectionRange === 'function') field.setSelectionRange(saved.start, saved.end);
    }
  }
  if (focus) main.querySelector(focus)?.focus({ preventScroll: true });
  renderSidebar();
  tick();
}
function identifyRoute(path) {
  if (path === '/') return 'home';
  if (/^\/dive\/[\w-]+$/.test(path)) return 'dive';
  if (path === '/unlimited' || path === '/unlimited/classic') return 'unlimited';
  if (Object.hasOwn(PACKS, path.slice(1))) return 'pack';
  const name = path.slice(1);
  return Object.hasOwn(views, name) && !['home', 'dive', 'pack', 'missing'].includes(name) ? name : 'missing';
}
function go(path, replace = false) {
  if (replace) history.replaceState({}, '', path);
  else history.pushState({}, '', path);
  void route(true);
}
async function route(scroll = false) {
  const token = ++generation;
  const path = location.pathname.replace(/\/$/, '') || '/';
  const view = identifyRoute(path);
  if (party) { party.close(); party = null; }
  Object.assign(state, { route: view, error: '', menu: false, records: null, clearDelete: false, confirmDelete: false, inviteAttempted: false,
    friends: null, room: null, rooms: [], queue: null, online: false, hostForm: false, dive: null, unlocks: [], stats: null, admin: null, adminToken: '', adminQuestion: null });
  synced = null;
  syncing = null;
  renderHeader();
  if (view === 'pack') state.pack = path.slice(1);
  if (view === 'friends') state.friendInvite = new URLSearchParams(location.search).get('invite');
  if (view === 'party') state.inviteCode = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
  draw({ preserve: false });
  if (scroll) {
    window.scrollTo(0, 0);
    document.querySelector('#main').focus({ preventScroll: true });
  }
  if (!state.boot) return;
  try {
    if (view === 'dive') {
      const dive = await api('/dives/' + path.slice(6));
      if (token !== generation) return;
      setDive(dive, true);
      return;
    }
    if (view === 'archive' || view === 'unlimited' || view === 'pack') {
      const records = await api('/records?mode=' + view);
      if (token !== generation) return;
      state.records = records;
    }
    if (view === 'friends') {
      const result = await api('/friends');
      if (token !== generation) return;
      state.friends = result;
    }
    if (view === 'account' || view === 'settings') {
      const profile = await api('/profile');
      if (token !== generation) return;
      state.boot.profile = profile;
      applyPreferences();
    }
    if (view === 'party') connection(token);
    draw();
  } catch (err) {
    if (token === generation) { state.error = err.message; draw(); toast(err.message, true); }
  }
}
async function init() {
  try { setBootstrap(await api('/bootstrap')); state.bootError = ''; }
  catch (err) { state.bootError = 'Couldn’t connect to Abyssal. ' + err.message; }
  await route();
}
function setDive(dive, focus = false) {
  const previous = state.dive;
  state.dive = dive;
  state.descentFrom = previous && previous.score < dive.score && dive.status === 'reveal' ? previous.score : null;
  synced = { server: dive.now, client: performance.now() };
  const changed = previous && (previous.current !== dive.current || previous.status !== dive.status);
  const selector = dive.status === 'answer' ? '#dive-answer' : dive.status === 'reveal' ? '[data-action="next"]' : '';
  draw({ focus: focus ? selector : '', preserve: !changed });
  if (dive.status === 'finished' && (!previous || previous.status !== 'finished')) void finishDive(dive);
}
async function finishDive(dive) {
  const token = generation;
  const old = state.boot.profile.unlocked;
  try {
    const [boot, stats] = await Promise.all([api('/bootstrap'), api('/dives/' + dive.id + '/statistics')]);
    if (token !== generation) return;
    setBootstrap(boot);
    state.stats = stats;
    state.unlocks = boot.profile.unlocked.filter(id => !old.includes(id));
    draw();
    if (state.unlocks.length) { audioEffect('heart'); toast('New companion unlocked!'); }
  } catch (err) {
    if (token === generation) toast(err.message, true);
  }
}
function tick() {
  const reset = document.querySelector('[data-reset]');
  if (reset && state.boot) {
    const now = state.clock.server + performance.now() - state.clock.client;
    const sec = Math.max(0, Math.ceil((state.boot.resetAt - now) / 1000));
    reset.textContent = [Math.floor(sec / 3600), Math.floor(sec % 3600 / 60), sec % 60].map(n => String(n).padStart(2, '0')).join(':');
    if (sec === 0 && !resetRequested) {
      resetRequested = true;
      api('/bootstrap').then(boot => { setBootstrap(boot); draw(); }).catch(() => {}).finally(() => setTimeout(() => { resetRequested = false; }, 2000));
    }
  }
  const live = document.querySelector('[data-timer]');
  if (state.route !== 'dive' || !live || !synced || !state.dive) return;
  const remaining = Math.max(0, state.dive.deadline - synced.server - (performance.now() - synced.client));
  live.textContent = Math.ceil(remaining / 1000);
  document.querySelector('[data-timer-bar]').style.width = Math.min(100, remaining / ROUND_MS * 100) + '%';
  live.closest('.round-countdown').classList.toggle('urgent', remaining < 6000);
  if (remaining > 0 || syncing) return;
  const id = state.dive.id;
  const token = generation;
  syncing = api('/dives/' + id).then(dive => {
    if (token !== generation) return;
    state.error = '';
    setDive(dive, true);
  }).catch(err => { if (token === generation) setInline(document.querySelector('[data-form="dive-answer"]'), err.message); })
    .finally(() => { if (token === generation) setTimeout(() => { if (token === generation) syncing = null; }, 500); });
}
function connection(token) {
  party = connectParty((event, value) => {
    if (token !== generation) return;
    if (event === 'connection') {
      state.online = value;
      if (value && !state.inviteAttempted && /^[A-Z]{4}$/.test(state.inviteCode)) {
        state.inviteAttempted = true;
        void party.send('room:join', { code: state.inviteCode }).catch(err => { state.error = err.message; draw(); });
      }
    } else if (event === 'rooms:list') state.rooms = value;
    else if (event === 'queue:update') {
      if (JSON.stringify(state.queue) === JSON.stringify(value)) return;
      state.queue = value;
    } else if (event === 'room:update') {
      const previous = state.room;
      if (previous?.turn !== value?.turn) state.error = '';
      state.room = value;
      if (value?.event && lastPartyEvent !== value.event.id) {
        lastPartyEvent = value.event.id;
        audioEffect(value.event.kind);
      }
      if (value?.status === 'finished' && previous?.status !== 'finished') {
        api('/profile').then(profile => { if (token === generation) state.boot.profile = profile; }).catch(() => {});
      }
      const becameHolder = value?.holderId === state.boot.profile.id && previous?.turn !== value.turn;
      draw({ focus: becameHolder ? '#party-answer' : '' });
      return;
    } else return;
    draw();
  });
}

function toast(message, failure = false) {
  const element = document.querySelector('#toast');
  element.textContent = message;
  element.className = failure ? 'toast bad' : 'toast';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast hidden'; }, failure ? 6200 : 2700);
}
function setInline(form, message) {
  const element = form?.querySelector('[data-error]');
  if (!element) { toast(message, true); return; }
  element.textContent = message;
  element.hidden = false;
}
async function copy(value, label = 'Copied to clipboard') {
  try { await navigator.clipboard.writeText(value); }
  catch {
    const element = document.createElement('textarea');
    element.value = value;
    element.style.cssText = 'position:fixed;opacity:0;left:0;top:0';
    document.body.append(element);
    element.select();
    const copied = document.execCommand('copy');
    element.remove();
    if (!copied) throw new Error('Clipboard access is unavailable.');
  }
  toast(label);
}
function unlockAudio() {
  if (!state.boot?.profile.settings.sound) return;
  try { audio ??= new AudioContext(); if (audio.state === 'suspended') void audio.resume().catch(() => {}); } catch {}
}
function audioEffect(kind) {
  const s = state.boot?.profile.settings;
  if (!audio || audio.state !== 'running' || !s?.sound || !s.volume) return;
  const tones = ['pop', 'eliminated'].includes(kind) ? [180, 115] : ['win', 'heart'].includes(kind) ? [420, 550, 680] : [420, 530];
  tones.forEach((tone, i) => {
    const osc = audio.createOscillator(), gain = audio.createGain();
    const time = audio.currentTime + i * .084;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(tone, time);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(.12 * s.volume / 100, time + .018);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .16);
    osc.connect(gain).connect(audio.destination);
    osc.start(time);
    osc.stop(time + .18);
  });
}
async function savePrefs(update, redraw = true) {
  state.boot.profile.settings = await send('/settings', update, 'PATCH');
  applyPreferences();
  if (redraw) draw();
}
function resetInviteQuery() { history.replaceState({}, '', location.pathname); }
async function updateProfile(update, message) {
  state.boot.profile = await send('/profile', update, 'PATCH');
  renderHeader();
  draw({ preserve: false });
  toast(message);
}
const partySend = (event, value) => party?.send(event, value) ?? Promise.reject(new Error('The party server is connecting.'));
const roomInvite = () => location.origin + '/party?room=' + state.room.code;
const friendInvite = () => location.origin + '/friends?invite=' + encodeURIComponent(state.friends.invite);
async function friendAction(path, body) {
  state.friends = await send('/friends/' + path, body);
  draw();
}
function monthMove(direction) {
  const date = new Date((state.month || state.boot.daily.today.slice(0, 7)) + '-01T12:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + direction);
  state.month = date.toISOString().slice(0, 7);
  draw();
}

const actions = {
  menu: () => { state.menu = !state.menu; renderHeader(); renderSidebar(); },
  reload: () => init(),
  sound: () => savePrefs({ sound: !state.boot.profile.settings.sound }),
  begin: async el => { const dive = await send('/dives', { mode: el.dataset.mode, target: el.dataset.key }); go('/dive/' + dive.id); },
  next: async () => { state.error = ''; setDive(await send('/dives/' + state.dive.id + '/next', { round: state.dive.current }), true); },
  'copy-result': () => copy(shareResult(state.dive), 'Results copied'),
  'share-result': async () => {
    const text = shareResult(state.dive);
    if (!navigator.share) return copy(text, 'Results copied to share');
    try { await navigator.share({ title: 'Abyssal dive results', text }); }
    catch (err) { if (err.name !== 'AbortError') return copy(text, 'Results copied to share'); }
  },
  'month-prev': () => monthMove(-1),
  'month-next': () => monthMove(1),
  'archive-date': el => { state.day = el.dataset.day; draw({ focus: '[data-day="' + state.day + '"]' }); },
  avatar: el => updateProfile({ avatar: el.dataset.id }, 'Companion selected'),
  'account-tab': el => { state.accountTab = el.dataset.tab; draw(); },
  'delete-open': () => { state.confirmDelete = !state.confirmDelete; draw(); },
  logout: async () => { setBootstrap(await send('/account/logout', {})); state.confirmDelete = false; draw({ preserve: false }); toast('Signed out'); },
  'friends-reload': () => route(),
  'friend-copy': () => copy(friendInvite(), 'Friend invitation copied'),
  'friend-regenerate': async () => { await friendAction('invite', {}); toast('New invitation created'); },
  'friend-invite-accept': async () => {
    await friendAction('request', { code: state.friendInvite });
    state.friendInvite = ''; resetInviteQuery(); draw(); toast('Friend request sent');
  },
  'friend-action': el => friendAction('action', { id: el.dataset.id, action: el.dataset.kind }),
  'queue-size': el => { state.queueSize = el.dataset.size; draw({ focus: '[data-size="' + state.queueSize + '"]' }); },
  'queue-quick': () => partySend('queue:join', { size: state.queueSize, rated: false }),
  'queue-rated': () => partySend('queue:join', { size: state.queueSize, rated: true }),
  'queue-cancel': () => partySend('queue:cancel'),
  'host-form': () => { state.hostForm = !state.hostForm; draw({ focus: state.hostForm ? '[data-form="host"] input' : '[data-action="host-form"]' }); },
  'join-listed': el => partySend('room:join', { code: el.dataset.code }),
  'party-invite': () => copy(roomInvite(), 'Room invitation copied'),
  ready: el => partySend('player:ready', { ready: el.dataset.ready === 'true' }),
  'game-start': () => partySend('game:start'),
  rematch: () => partySend('game:rematch'),
  leave: async () => { await partySend('room:leave'); state.inviteCode = ''; resetInviteQuery(); draw({ preserve: false }); },
  'admin-review': async el => {
    await api('/admin/feedback/' + el.dataset.id, { method: 'POST', token: state.adminToken });
    state.admin = await api('/admin', { token: state.adminToken });
    draw();
  },
};
const forms = {
  'dive-answer': async data => {
    const id = state.dive.id;
    const result = await send('/dives/' + id + '/answer', { round: state.dive.current, answer: data.get('answer') });
    if (state.dive?.id !== id) return;
    state.error = result.error ?? '';
    if (!result.error) audioEffect('pass');
    setDive(result.dive, true);
  },
  'profile-name': data => updateProfile({ name: data.get('name') }, 'Display name saved'),
  'party-name': data => updateProfile({ name: data.get('name') }, 'Display name saved'),
  account: async data => {
    await send('/account/' + state.accountTab, { username: data.get('username'), password: data.get('password'), importGuest: data.has('importGuest') });
    setBootstrap(await api('/bootstrap'));
    draw({ preserve: false });
    toast('Account ready');
  },
  delete: async data => {
    setBootstrap(await send('/account', { password: data.get('password') ?? '' }, 'DELETE'));
    state.confirmDelete = false;
    draw({ preserve: false });
    toast('Player progress cleared');
  },
  'friend-request': async data => { await friendAction('request', { username: data.get('username') }); toast('Friend request sent'); },
  host: async data => {
    const values = Object.fromEntries(data);
    const settings = { name: values.name, private: data.has('private') };
    for (const key of ['capacity','startingHearts','maxHearts','heartPoints','fuseMin','fuseMax']) settings[key] = Number(values[key]);
    await partySend('room:create', settings);
    state.hostForm = false;
  },
  join: data => partySend('room:join', { code: data.get('code') }),
  'party-answer': (data, form) => partySend('answer:submit', { answer: data.get('answer'), turn: Number(form.dataset.turn) }),
  feedback: async (data, form) => {
    await send('/feedback', { gameId: form.dataset.id || undefined, kind: data.get('kind'), rating: data.get('rating') ? Number(data.get('rating')) : undefined, message: data.get('message') });
    form.reset();
    form.closest('details').open = false;
    toast('Feedback sent');
  },
  'admin-login': async data => {
    const token = data.get('token');
    state.admin = await api('/admin', { token });
    state.adminToken = token;
    draw();
  },
  'admin-save': async data => {
    let value;
    try { value = JSON.parse(data.get('json')); } catch { throw new Error('Enter valid JSON for the question.'); }
    const id = data.get('id');
    await api('/admin/question/' + encodeURIComponent(id), { method: 'PUT', body: value, token: state.adminToken });
    state.admin = await api('/admin', { token: state.adminToken });
    state.adminQuestion = state.admin.questions.find(q => q.id === id);
    draw();
    toast('Question saved');
  },
};

root.innerHTML = '<a href="#main" class="skip-link">Skip to content</a><header class="topbar" id="header"></header>' +
  '<div class="layout"><button type="button" class="drawer-shade" data-action="menu" aria-label="Close navigation"></button>' +
  '<aside class="sidebar" id="sidebar"></aside><main id="main" tabindex="-1"></main></div>' +
  '<footer><span>Abyssal</span><a href="/about">About & Privacy</a></footer><div class="toast hidden" id="toast" role="status" aria-live="polite"></div>';
root.addEventListener('click', async event => {
  const el = event.target.closest('[data-action]');
  const link = event.target.closest('a');
  unlockAudio();
  if (!el && link && !link.hasAttribute('download') && link.origin === location.origin && !link.hash && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
    event.preventDefault();
    go(link.pathname + link.search);
    return;
  }
  if (!el || el.disabled || !actions[el.dataset.action]) return;
  el.disabled = true;
  try { await actions[el.dataset.action](el); } catch (err) { toast(err.message, true); }
  finally { if (el.isConnected) el.disabled = false; }
});
root.addEventListener('submit', async event => {
  const form = event.target;
  if (!form.dataset.form || !forms[form.dataset.form]) return;
  event.preventDefault();
  unlockAudio();
  const button = form.querySelector('button[type=submit]');
  const fieldError = form.querySelector('[data-error]');
  if (fieldError) fieldError.hidden = true;
  if (button) button.disabled = true;
  try { await forms[form.dataset.form](new FormData(form), form); }
  catch (err) { setInline(form, err.message); }
  finally { if (button?.isConnected) button.disabled = false; }
});
root.addEventListener('input', event => {
  if (event.target.dataset.setting === 'volume') document.querySelector('[data-volume]').textContent = event.target.value + '%';
});
root.addEventListener('change', async ({ target }) => {
  if (target.hasAttribute('data-admin-question')) {
    state.adminQuestion = state.admin.questions.find(q => q.id === target.value);
    draw();
  }
  if (!target.dataset.setting) return;
  const value = target.type === 'checkbox' ? target.checked : Number(target.value);
  try { await savePrefs({ [target.dataset.setting]: value }, false); toast('Preference saved'); }
  catch (err) { draw(); toast(err.message, true); }
});
window.addEventListener('popstate', () => void route(true));
window.addEventListener('keydown', event => {
  if (state.menu && event.key === 'Escape') {
    state.menu = false;
    renderHeader();
    renderSidebar();
    document.querySelector('.menu-toggle')?.focus();
  }
});
window.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
setInterval(tick, 120);
renderHeader();
draw();
void init();
