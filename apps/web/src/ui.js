import { AVATARS, TIERS, TIER_NAMES, offsetDay } from '/shared.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const paths = {
  waves: '<path d="M2 12c3 0 3-3 6-3s3 3 6 3 3-3 6-3m-18 9c3 0 3-3 6-3s3 3 6 3 3-3 6-3M9 5a3 3 0 0 1 6 0"/>',
  daily: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  infinity: '<path d="M12 12c-2.2-3.1-3.6-4.5-5.6-4.5a4.5 4.5 0 0 0 0 9c2.2 0 3.8-1.9 5.6-4.5 2.1-2.9 3.7-4.5 5.6-4.5a4.5 4.5 0 0 1 0 9c-2.1 0-3.8-1.8-5.6-4.5Z"/>',
  party: '<path d="M20 12c0 4.5-3.5 7.4-8 7.4S4 16.5 4 12s3.5-7.5 8-7.5 8 3 8 7.5Z"/><path d="m12 2-1 2.5m7 .2-1.5 1.4M3 6l2.5 2M2 13l2 .5m3 7 1.1-1.9m7.9.1.7 2.2M22 13l-2 .3m-.4 5.8-1.5-1.3M9 11h.01m5.99 0h.01M10 15q2 1.8 4 0"/>',
  archive: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 4h2m4 0h2m-8 3h2"/>',
  packs: '<path d="m12 3 9 4.5-9 4.5L3 7.5 12 3Z"/><path d="m3 12 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"/>',
  profile: '<circle cx="12" cy="8" r="3.5"/><path d="M4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2"/>',
  friends: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="m9 3 .6 2.1 2 .8 2-.9L15 3l2.5 1.5-.3 2.5 1.2 1.5 2.6.3.8 2.8-2 1.4-.4 2 1.3 2.1-1.7 2.3-2.5-.5-1.8.9-.5 2.2h-2.9l-.9-2.2-1.7-.8-2.5.5-1.8-2.3 1.3-2.2-.4-2-2-1.4.8-2.7 2.6-.3 1.2-1.4-.3-2.5Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 1 1 4.8 2.4c-1.3 1-1.9 1.4-1.9 2.6m0 3h.01"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>',
  volume: '<path d="M3 9h4l5-4v14l-5-4H3Zm12.5-.5a5 5 0 0 1 0 7m2.6-9.6a8.5 8.5 0 0 1 0 12.2"/>',
  mute: '<path d="M3 9h4l5-4v14l-5-4H3Zm13 1 5 5m0-5-5 5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m15 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6m4 4 1-1"/>',
  depth: '<path d="M12 3v17m-5-5 5 5 5-5M5 4H2m3 6H2m3 6H2"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  play: '<path d="M8 5.5a.8.8 0 0 1 1.2-.7l10 6.5a.8.8 0 0 1 0 1.4l-10 6.5a.8.8 0 0 1-1.2-.7Z" fill="currentColor" stroke="none"/>',
  spark: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>',
  flame: '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6.2-3-6.2.1 2-1 3.3-1 3.3 0-6.1-4.5-9.1-4.5-9.1 0 5-5.5 6.1-5.5 12a7 7 0 0 0 7 7Z"/><path d="M12 22c2.2 0 3-1.4 3-3 0-2-1.5-3-2.5-4.4 0 2-3.5 2.2-3.5 4.4a3 3 0 0 0 3 3Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',
  trophy: '<path d="M8 20h8m-4-4v4M7 4h10v6a5 5 0 1 1-10 0zm0 2H3v2a4 4 0 0 0 4 4m10-6h4v2a4 4 0 0 1-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4m-4 4v2"/>',
  heart: '<path d="M20.8 8.6c0 4.5-8.8 9.7-8.8 9.7S3.2 13.1 3.2 8.6a4.5 4.5 0 0 1 8.8-1.4 4.5 4.5 0 0 1 8.8 1.4Z" fill="currentColor" stroke="none"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  share: '<path d="M12 15V3m-4 4 4-4 4 4M7 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m-4 6h4m10-6h4m-4 6h4"/>',
  book: '<path d="M12 6c-3-2.5-6-2.5-9-2v14c3-.6 6-.4 9 2 3-2.4 6-2.6 9-2V4c-3-.5-6-.5-9 2Zm0 0v14"/>',
  music: '<path d="M9 17V6l10-2v11M9 16a3 2 0 1 1-6 0 3 2 0 1 1 6 0zm10-2a3 2 0 1 1-6 0 3 2 0 1 1 6 0z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  exit: '<path d="M9 5H5v14h4m4-7h8m-3-3 3 3-3 3"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5m-4.4-1.3a7.5 7.5 0 0 1 12-4.4L20 12M4 12l3.4 5.4a7.5 7.5 0 0 0 12-4.2"/>',
  userPlus: '<circle cx="9" cy="7" r="3"/><path d="M2 20v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3m3-11v6m-3-3h6"/>',
};
export const icon = (id, size = 20) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[id] || paths.spark) + '</svg>';
export const n = value => Number(value || 0).toLocaleString('en-US');
export const longDate = day => day ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z')) : '';
export const shortDate = day => day ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z')) : '';
export const href = (url, text, cls = '', glyph = '') => '<a class="' + cls + '" href="' + url + '">' + (glyph ? icon(glyph) : '') + '<span>' + text + '</span></a>';
export const btn = (act, label, cls = 'secondary', glyph = '', attrs = '') =>
  '<button type="button" class="button ' + cls + '" data-action="' + act + '" ' + attrs + '>' + (glyph ? icon(glyph) : '') + '<span>' + label + '</span></button>';
export const submit = (label, cls = 'primary', glyph = '', attrs = '') =>
  '<button type="submit" class="button ' + cls + '" ' + attrs + '>' + (glyph ? icon(glyph) : '') + '<span>' + label + '</span></button>';
export const title = (name, description, glyph) => '<section class="page-heading">' + (glyph ? '<span class="page-icon">' + icon(glyph, 24) + '</span>' : '') + '<h1>' + name + '</h1><p>' + description + '</p></section>';
export const box = (body, css = '') => '<section class="panel ' + css + '">' + body + '</section>';
export const empty = (headline, copy, glyph = 'waves') =>
  '<div class="empty">' + icon(glyph, 27) + '<strong>' + headline + '</strong><p>' + copy + '</p></div>';
export const error = message => '<p class="form-error" role="alert" data-error' + (message ? '' : ' hidden') + '>' + esc(message) + '</p>';
export const tag = (text, css = '') => '<span class="tag ' + css + '">' + esc(text) + '</span>';
export const loading = () => '<div class="empty loading" role="status"><span class="spinner"></span><strong>Loading…</strong></div>';
const rarityLabels = ['Tidepool', 'Sandbar', 'Reef', 'Shelf', 'Slope', 'Trench'];
export const rarityName = tier => rarityLabels[TIER_NAMES.indexOf(tier)] ?? 'Timed out';
export const badge = tier => tier ? '<span class="rarity rarity-' + TIER_NAMES.indexOf(tier) + '"><i></i>' + rarityName(tier) + '</span>' : '<span class="rarity zero"><i></i>Timed out</span>';
export const diveAttrs = (mode, key = '') => 'data-mode="' + mode + '" data-key="' + esc(key) + '"';
export const puffer = (classes = '') => '<svg class="puffer-art ' + classes + '" viewBox="0 0 140 120" role="img" aria-label="Pufferfish">' +
  '<path d="M30 55 11 48l5 14-5 16 22-9m70-12 21-8-5 15 4 14-23-8" fill="#c67666" stroke="#502f3a" stroke-width="3"/>' +
  '<path d="m47 30 2-19 13 13 11-19 10 20 14-13 2 20 17-5-4 18 16 6-11 12 11 14-17 6 1 17-17-5-5 17-15-8-14 10-9-14-18 5-1-16-17-5 9-14-10-12 16-9-1-15Z" fill="#f3b97e" stroke="#925757" stroke-width="3" stroke-linejoin="round"/>' +
  '<ellipse cx="72" cy="66" rx="42" ry="37" fill="#f0a472" stroke="#a2675e" stroke-width="2"/><path d="M38 72c6 26 22 29 36 29 17 0 31-10 37-27-14-12-53-17-73-2Z" fill="#ffce93"/><path d="M44 48c5-10 17-15 27-16" stroke="#ffe4a6" stroke-width="3" stroke-linecap="round" fill="none"/>' +
  '<circle cx="54" cy="62" r="5" fill="#242832"/><circle cx="91" cy="62" r="5" fill="#242832"/><circle cx="53" cy="60" r="1.5" fill="#fff4cf"/><circle cx="90" cy="60" r="1.5" fill="#fff4cf"/><ellipse cx="72" cy="77" rx="6" ry="4" fill="#a54f52"/><circle cx="45" cy="74" r="4" fill="#e98172"/><circle cx="100" cy="74" r="4" fill="#e98172"/>' +
  '<path d="m62 45 3-3m12 1 3 3m-26 42 3 2m31-1 3-2" stroke="#d58b6e" stroke-width="2" stroke-linecap="round"/></svg>';

export function avatar(id, cls = '') {
  const item = AVATARS.find(avatar => avatar.id === id) ?? AVATARS[0];
  const eyes = '<circle cx="38" cy="25" r="2.7" fill="#102333"/><circle cx="39" cy="24.2" r=".8" fill="#e8fff2"/>';
  let body;
  switch (item.id) {
    case 'squid': body = '<path d="M18 28C14 17 26 9 34 4c8 6 15 16 12 24-5 12-23 13-28 0Z" fill="currentColor"/><path d="M21 34c2 9-7 16-9 12m16-9c0 12-3 17-8 16m14-16c0 12 4 17 8 16m-2-18c1 9 6 15 12 11" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>' + eyes + '<circle cx="28" cy="25" r="2.5" fill="#102333"/>'; break;
    case 'angler': body = '<path d="M15 30 7 23l1 17 10-5c9 13 34 10 36-8-3-14-30-16-39 3Z" fill="currentColor"/><path d="M36 19q0-17 14-10" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="51" cy="10" r="3" fill="#fff0a7"/>' + eyes + '<path d="m40 34 11-2-5 6Z" fill="#6c4549"/>'; break;
    case 'leviathan': body = '<path d="M5 30c9 0 6-10 16-10s11 13 18 6l-1-6 7-5 10 7-4 10-8 5c-10 9-22-6-29-2-5 3-5 9-9 12-2-5 0-11 0-17Z" fill="currentColor"/><path d="m20 21 4-6 4 7 4-4 3 8" fill="currentColor"/><circle cx="48" cy="24" r="2" fill="#132635"/>'; break;
    case 'ghost': body = '<path d="M28 33C15 32 9 22 4 16c10-1 20 3 29 0 9 3 17-1 27 0-6 8-14 16-24 17-2 11-9 16-13 18 4-4 6-10 5-18Z" fill="currentColor"/><circle cx="29" cy="22" r="1.7" fill="#102333"/><circle cx="37" cy="22" r="1.7" fill="#102333"/>'; break;
    case 'sprat': body = '<path d="M18 25 7 17l2 13-2 13 12-9c14 10 28 5 36-5-8-12-23-15-37-4Z" fill="currentColor"/><path d="m26 21 5-8 8 7m-13 17 7 6 5-5" fill="currentColor"/><circle cx="44" cy="26" r="2.8" fill="#14383a"/><path d="M36 23q-6 6 0 12" stroke="#429f8b" fill="none" stroke-width="2"/>'; break;
    default: body = '<path d="M18 25C21 13 39 12 49 21c9 9 2 19-9 21-9 2-14-3-23-5l-9 4 3-9-5-8 12 2Z" fill="currentColor"/><path d="M23 22q7 8 2 15m6-17q6 9 2 18m5-19q5 9 2 17" fill="none" stroke="#102333" opacity=".25" stroke-width="2"/><path d="M39 18q5-10 16-8m-13 11q7-6 16-4m-26 21 3 7m-11-9 1 8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="46" cy="24" r="2.6" fill="#102333"/>'; break;
  }
  return '<span class="avatar ' + cls + '" style="--avatar:' + item.color + '"><svg width="56" height="51" viewBox="0 0 64 55" aria-hidden="true">' + body + '</svg></span>';
}

export const NAV = [
  ['PLAY', [['/', 'Daily Descent', 'daily'], ['/unlimited/classic', 'Unlimited', 'infinity'], ['/party', 'Puffer Relay', 'party'], ['/archive', 'Archive', 'archive'], ['/packs', 'Themed Packs', 'packs']]],
  ['DIVER LOG', [['/account', 'My Profile', 'profile'], ['/friends', 'Friends', 'friends'], ['/settings', 'Settings', 'settings']]],
  ['SUPPORT', [['/faq', 'How to Play', 'help'], ['/about', 'About & Privacy', 'about']]],
];
export const calendarDays = month => {
  const first = month + '-01';
  const weekday = new Date(first + 'T12:00:00Z').getUTCDay();
  return Array.from({ length: 42 }, (_, i) => offsetDay(first, i - weekday));
};
export const rarityGuide = () => '<div class="rarity-guide">' + Object.entries(TIERS).map(([tier, points]) => '<div>' + badge(tier) + '<strong>' + points + ' pts</strong></div>').join('') + '</div>';
export function historyTable(runs, limit = 15) {
  return runs.length ? '<ul class="history">' + runs.slice(0, limit).map(run => '<li><a href="/dive/' + run.id + '"><span><strong>' + esc(run.label) + '</strong><small>' + esc(run.mode[0].toUpperCase() + run.mode.slice(1)) + ' · ' + new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }).format(run.completedAt) + '</small></span><b>' + n(run.score) + '<small> pts</small></b>' + icon('right', 15) + '</a></li>').join('') + '</ul>' : empty('No dives logged yet', 'Finish a dive and it will appear here.', 'list');
}
