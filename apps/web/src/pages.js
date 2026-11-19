import { EPOCH, PACKS, diveNumber, offsetDay } from '/shared.js';
import { icon, btn, href, title, box, empty, tag, loading, longDate, shortDate, n, esc, diveAttrs, calendarDays, rarityGuide, historyTable, puffer } from './ui.js';

const info = (glyph, top, bottom) => '<div class="hero-stat"><span>' + icon(glyph, 21) + '</span><div><strong>' + top + '</strong><small>' + bottom + '</small></div></div>';
const bubbles = Array.from({ length: 13 }, (_, index) => '<i style="--x:' + (39 + index * 4.7) + '%;--y:' + (25 + index * 11 % 53) + '%;--size:' + (3 + index * 3 % 12) + 'px;--delay:' + (-index * .9) + 's"></i>').join('');

export function home(state) {
  const day = state.boot?.daily;
  const status = day?.completed ? 'Review results' : day?.active ? 'Resume descent' : 'Begin descent';
  return '<div class="home">' +
    '<section class="hero" aria-labelledby="daily-title"><div class="underwater"></div><div class="hero-shade"></div>' +
    '<div class="bubble-field" aria-hidden="true">' + bubbles + '</div><img class="submarine" src="/public/sub.svg" alt="" />' +
    '<div class="depth-mark" aria-hidden="true"><i></i><b>0 m</b><i></i><i></i><i></i><i></i><i></i><b>1,000 m</b></div>' +
    '<div class="hero-content"><div class="hero-date"><span></span>' + (day ? 'DIVE ' + String(day.number).padStart(3, '0') + ' <i></i> ' + esc(longDate(day.today)) : 'DAILY DIVE') + '</div>' +
    '<h1 id="daily-title">Daily <em>Dive</em></h1><p>Find the rarest answers.<br />See how deep you can go.</p>' +
    '<div class="hero-actions">' + (day?.active ? href('/dive/' + day.active, status, 'button primary hero-button', day.completed ? 'list' : 'play') : btn('begin', status, 'primary hero-button', 'play', diveAttrs('daily') + (day ? '' : ' disabled'))) +
    href('/faq', 'How to play', 'button text-button', 'help') + '</div></div></section>' +
    '<section class="hero-stats" aria-label="Daily Dive rules">' + info('list', '7 questions', 'One dive per day') + info('timer', '25 seconds', 'Per question') + info('depth', '7,000 meters', 'Maximum depth') +
    '<div class="hero-stat reset-stat"><span>' + icon('clock', 20) + '</span><div><strong data-reset>—</strong><small>Until the next dive</small></div></div></section>' +
    '<div class="section-head"><div><h2>More ways to play</h2><p>Keep diving or bring your friends.</p></div></div>' +
    '<section class="mode-grid" aria-label="More game modes">' +
    modeCard('/unlimited/classic', 'Unlimited', 'Seven questions, as often as you like.', 'infinity', 'mint') +
    modeCard('/party', 'Puffer Party', 'Pass the puffer before it pops.', 'party', 'gold') +
    modeCard('/packs', 'Themed Packs', 'Explore 30 chapters in each theme.', 'packs', 'violet') + '</section>' +
    '<div class="bottom-link">' + href('/archive', 'Browse past Daily Dives', 'inline-link', 'archive') + '</div></div>';
}
function modeCard(url, name, description, glyph, tone) {
  return '<a href="' + url + '" class="mode-card tone-' + tone + '"><div class="card-top"><span class="mode-icon">' + icon(glyph, 23) + '</span>' +
    '<div class="mode-graphic" aria-hidden="true">' + (glyph === 'party' ? puffer() : icon(glyph, 101)) + '</div></div><h3>' + name + '</h3><p>' + description + '</p></a>';
}
export function unlimited(state) {
  return title('Unlimited', 'Seven questions per run. Take as many dives as you like and chase your personal best.', 'infinity') +
    '<div class="columns equal">' + box('<h2>Endless Dive</h2><p>Questions rotate to keep repeat dives fresh. Each valid answer earns rarity points and takes you deeper.</p>' +
    '<div class="button-row">' + btn('begin', 'Start or resume dive', 'primary', 'play', diveAttrs('unlimited')) + '</div>', 'glow-panel') +
    box('<h2>Personal best</h2><div class="large-number">' + n(state.boot?.profile.bestUnlimited) + '<small> / 700 pts</small></div><p>Unlimited runs leave your Daily Dive streak untouched.</p>') +
    '</div><div class="section-head"><h2>Completed runs</h2></div>' + box(state.records ? historyTable(state.records, 100) : loading());
}
export function archive(state) {
  const today = state.boot?.daily.today;
  if (!today) return loading();
  const month = state.month || today.slice(0, 7);
  const selected = state.day || offsetDay(today, -1);
  const previous = state.records?.filter(run => run.key === selected) ?? [];
  const replays = previous.filter(run => run.mode === 'archive');
  const completed = new Map();
  for (const run of state.records ?? []) completed.set(run.key, Math.max(run.score, completed.get(run.key) ?? 0));
  return title('Daily Dive Archive', 'Choose a past dive and replay its original seven questions.', 'archive') +
    '<div class="columns archive-grid">' + box('<div class="calendar-head">' + btn('month-prev', 'Previous month', 'icon-button', 'left', 'aria-label="Previous month"' + (month <= EPOCH.slice(0, 7) ? ' disabled' : '')) +
    '<h2>' + esc(new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(month + '-01T12:00:00Z'))) + '</h2>' +
    btn('month-next', 'Next month', 'icon-button', 'right', 'aria-label="Next month"' + (month >= today.slice(0, 7) ? ' disabled' : '')) +
    '</div><div class="calendar">' + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day => '<span class="weekday">' + day + '</span>').join('') +
    calendarDays(month).map(day => '<button type="button" class="' + (day.startsWith(month) ? '' : 'overflow ') + (day === selected ? 'day-selected ' : '') + (completed.has(day) ? 'day-complete' : '') +
      '" data-action="archive-date" data-day="' + day + '" aria-label="' + esc(longDate(day) + (completed.has(day) ? ', best ' + completed.get(day) + ' points' : '')) +
      '" aria-pressed="' + (day === selected) + '"' + (day >= today || day < EPOCH ? ' disabled' : '') + '><span>' + Number(day.slice(-2)) + '</span>' +
      (completed.has(day) ? '<small>' + completed.get(day) + ' pts</small>' : '') + '</button>').join('') + '</div>') +
    box(tag('DIVE #' + diveNumber(selected), 'mint') + '<h2>' + esc(longDate(selected)) + '</h2><p>Best replay · <strong>' + (replays.length ? n(Math.max(...replays.map(run => run.score))) + ' pts' : 'No replays yet') +
    '</strong></p><div class="button-row">' + btn('begin', replays.length ? 'Replay dive' : 'Play archived dive', 'primary', 'play', diveAttrs('archive', selected)) + '</div>' +
    (previous.length ? '<h3>Previous attempts</h3>' + historyTable(previous) : '<p class="subtle">Replays keep your Daily Dive streak and official results intact.</p>') + '') + '</div>';
}

const packIcons = { lexicon: 'book', movies: 'film', sports: 'trophy', geography: 'globe' };
export function packs(state) {
  const pack = PACKS[state.pack];
  if (!pack) {
    return title('Themed Packs', 'Pick a subject and dive into 30 playable chapters.', 'packs') + '<div class="pack-grid">' +
      Object.entries(PACKS).map(([key, value]) => modeCard('/' + key, value.name, value.description, packIcons[key], value.color)).join('') +
      '<div class="mode-card tone-violet disabled-card"><span class="mode-icon">' + icon('music', 23) + '</span>' + tag('Coming soon') + '<h3>Music</h3><p>Instruments, musicians, and recordings.</p></div></div>';
  }
  const records = new Map();
  for (const run of state.records ?? []) if (run.key.startsWith(state.pack + ':')) {
    const value = records.get(run.key);
    if (!value || run.score > value.score) records.set(run.key, run);
  }
  return href('/packs', 'All themed packs', 'back-link', 'left') +
    title(pack.name, pack.description, packIcons[state.pack]) +
    box('<div class="section-head compact"><h2>Choose a chapter</h2>' + tag(records.size + ' / 30 complete', 'mint') + '</div><div class="chapters">' +
      Array.from({ length: 30 }, (_, i) => {
        const key = state.pack + ':' + (i + 1);
        const run = records.get(key);
        return '<div class="chapter' + (run ? ' complete' : '') + '"><div class="chapter-head"><strong>' + String(i + 1).padStart(2, '0') + '</strong>' + (run ? icon('check', 17) : '') + '</div>' +
          (run ? href('/dive/' + run.id, 'Best ' + n(run.score) + ' pts', 'subtle') : '<span class="subtle">7 prompts</span>') +
          btn('begin', run ? 'Replay' : 'Play', 'secondary small', 'play', diveAttrs('pack', key) + ' aria-label="' + (run ? 'Replay chapter ' : 'Play chapter ') + (i + 1) + '"') + '</div>';
      }).join('') + '</div>');
}
const faqItems = [
  ['How do I play Daily Dive?', 'Every player gets the same seven prompts each day. You have 25 seconds to enter one accepted answer for each prompt. You can retry rejected answers until time runs out. An expired round earns zero points.'],
  ['How does rarity scoring work?', 'Answer tiers are curated in the question bank. The most obvious answers score fewer points. Each point takes your submersible 10 meters deeper. The highest possible score is 700 points or 7,000 meters.'],
  ['When do the daily questions reset?', 'A new dive becomes available at midnight in America/New_York. The reset follows Eastern daylight saving time. You can resume an interrupted official dive until the reset. Past prompts are available in the Archive.'],
  ['What changes in Unlimited?', 'Unlimited uses the same seven-round rules with randomly selected prompts. Recent questions are deprioritized. Unlimited has its own records and personal best.'],
  ['How does Puffer Party work?', 'Two to sixteen players take turns holding a pufferfish. Enter a valid, unused answer to pass it along. When it pops, its holder loses one heart and the next player starts a new category. The last player with hearts wins.'],
  ['How does the hidden fuse work?', 'The default fuse is randomly set between 10 and 30 seconds. It keeps burning when the puffer is passed. A successful pass raises the remaining fuse to eight seconds if it was lower. Watch the puffer’s reactions for a rough idea of how urgent your turn is.'],
  ['How do I earn hearts?', 'Every accepted answer adds its rarity points to your heart meter. By default, 600 points earns an extra heart, up to five hearts. Custom hosts may change the thresholds and starting hearts.'],
  ['How do I start a room?', 'Choose Host a room and share its code or invitation link. Guests can enter the code, follow the link, or use the public list. Everyone except the host must mark themselves ready, then the host starts the game.'],
  ['How are ratings calculated?', 'Players start at 1,000. After a rated game, your placement is compared with each opponent using Elo expected scores. The pairwise adjustments are averaged and rounded with a K-factor of 24. Ratings have a floor of 100.'],
  ['How do streaks and companions work?', 'Finish Daily Dives on consecutive New York calendar days to build your streak. Your longest streak determines companion unlocks. Select an unlocked companion in My Profile.'],
  ['What can I replay?', 'Play earlier Daily Dives in the Archive and replay any themed chapter. Best replay scores and past answers appear in your records.'],
  ['Who can see my score?', 'Accepted friends see your Daily Dive score only after completing their own dive that day. You can allow friends to see your submitted answers after both players have finished.'],
];
export function faq() {
  return title('How to Play', 'Learn the rules for diving, earning rarity points, and playing with friends.', 'help') +
    box('<h2>Rarity tiers</h2>' + rarityGuide()) + '<div class="section-head"><h2>Frequently asked questions</h2></div>' +
    '<div class="faq-list">' + faqItems.map(([question, answer]) => '<details><summary>' + esc(question) + icon('down', 17) + '</summary><p>' + esc(answer) + '</p></details>').join('') + '</div>';
}
export function about() {
  return title('About & Privacy', 'Abyssal is an independent, unofficial underwater trivia arcade inspired by Krillion.io.', 'about') +
    box('<h2>Your information</h2><p>This installation stores a session cookie, your game history, preferences, and any optional account credentials. Passwords are stored as salted hashes. A guest session remembers your progress in the current browser.</p>' +
    '<h2>Multiplayer and friends</h2><p>Your display name, companion, rating, and answers in a party room are visible to other players in that room. Friends can see today’s score after finishing their own dive. Answer sharing is optional. Feedback is visible to the administrator.</p>' +
    '<h2>Control your data</h2><p>Export your records, change sharing, or delete your progress and account in Settings.</p>' + href('/settings', 'Open settings', 'button secondary', 'settings'));
}
export function notFound() {
  return box(empty('Lost at sea', 'We couldn’t find that page.', 'daily') + href('/', 'Return home', 'button primary', 'waves'));
}
