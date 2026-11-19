import { ROUND_COUNT, TIER_ICONS, TIER_NAMES, METERS_PER_POINT } from '/shared.js';
import { btn, href, icon, box, esc, n, tag, title, error, badge, loading, diveAttrs, submit } from './ui.js';

const backHome = dive => ({ daily: ['/', 'Daily Dive'], archive: ['/archive', 'Archive'], unlimited: ['/unlimited/classic', 'Unlimited'], pack: ['/' + dive.key.split(':')[0], 'Chapters'] }[dive.mode]);
export function diveView(state) {
  const dive = state.dive;
  if (!dive) return state.error ? box(error(state.error) + '<div class="button-row">' + href('/', 'Return home', 'button secondary', 'waves') + href('/archive', 'Browse archive', 'button secondary', 'archive') + '</div>') : loading();
  if (dive.status === 'finished') return result(state);
  const [url, text] = backHome(dive);
  const reveal = dive.status === 'reveal' ? dive.responses.at(-1) : null;
  const depth = dive.score * METERS_PER_POINT;
  return href(url, text, 'back-link', 'left') + '<div class="dive-header"><div>' + tag(dive.label, 'mint') + '<h1>' + (dive.mode === 'daily' ? 'Daily Dive' : dive.mode === 'archive' ? 'Archived Dive' : dive.mode === 'unlimited' ? 'Endless Dive' : 'Themed Dive') +
    '</h1></div><aside><span>' + icon('depth') + ' Depth</span><strong>' + n(depth) + ' <small>m</small></strong></aside></div>' +
    '<div class="playfield" style="--depth:' + Math.min(.82, dive.score / 820) + ';--from-depth:' + Math.min(.82, (state.descentFrom ?? dive.score) / 820) + '"><div class="water-scene"></div>' +
    '<div class="dive-sub' + (state.descentFrom !== null ? ' descending' : '') + '" aria-hidden="true"><img src="/public/sub.svg" alt="" /><div class="depth-badge">' + n(depth) + ' m</div></div>' +
    '<div class="question-panel"><div class="round-meta"><span>QUESTION ' + dive.current + ' OF 7</span>' + tag(dive.prompt.category) + '</div>' +
    '<div class="round-dots" aria-label="Question ' + dive.current + ' of 7">' + Array.from({ length: 7 }, (_, i) => '<i class="' + (i + 1 <= dive.current ? 'filled' : '') + (i + 1 === dive.current ? ' current' : '') + '"></i>').join('') +
    '</div><h2>' + esc(dive.prompt.prompt) + '</h2>' +
    (dive.prompt.restrictions?.length ? '<ul class="restrictions">' + dive.prompt.restrictions.map(value => '<li>' + esc(value) + '</li>').join('') + '</ul>' : '') +
    (reveal ? '<div class="round-reveal">' + badge(reveal.tier) + '<strong>' + (reveal.canonical ? esc(reveal.canonical) : 'Time ran out') +
      '</strong><p>' + (reveal.points ? '+' + n(reveal.points) + ' pts · ' + n(reveal.points * 10) + ' meters deeper' : '0 points this round') +
      '</p>' + btn('next', 'Next question', 'primary', 'play') + '</div>' :
      '<div class="round-countdown"><div class="timer-track"><div data-timer-bar></div></div><span>' + icon('timer', 18) + '<b data-timer>25</b>s</span></div>' +
      '<form data-form="dive-answer"><label for="dive-answer">Your answer</label><div class="input-row"><input id="dive-answer" name="answer" autocomplete="off" maxlength="120" required placeholder="Type your answer…" data-preserve spellcheck="false" />' +
      submit('Submit', 'primary') + '</div>' + error(state.error) + '</form>') + '</div></div>' +
    '<div class="playfoot"><span>' + icon('waves', 18) + ' Each rarity point takes you 10 meters deeper.</span><span><b>' + n(dive.score) + '</b> / 700 pts</span></div>';
}
export function shareResult(dive) {
  const tiles = dive.responses.map(row => row.tier ? TIER_ICONS[TIER_NAMES.indexOf(row.tier)] : '⬛').join('');
  return 'Abyssal · ' + dive.label + '\n' + n(dive.score) + '/700 · ' + n(dive.score * 10) + ' m\n' + tiles;
}
function result(state) {
  const dive = state.dive;
  const details = state.stats;
  const profile = state.boot?.profile;
  const [url, label] = backHome(dive);
  const best = details?.previousBest;
  const previous = best == null ? 'First completed run' : dive.score > best ? 'New personal best · +' + (dive.score - best) + ' pts' : dive.score === best ? 'Matched your personal best' : 'Personal best · ' + best + ' pts';
  const max = Math.max(...(details?.distribution ?? []).map(bucket => bucket.count), 1);
  return href(url, label, 'back-link', 'left') +
    '<section class="result-hero"><div class="result-decoration"></div><div class="result-main">' + tag(dive.label, 'mint') + '<h1>Dive complete</h1>' +
    '<div class="result-depth">' + n(dive.score * 10) + '<small> m</small></div><p><strong>' + dive.score + '</strong> / 700 points · ' + esc(details ? previous : 'Checking personal best…') +
    '</p><div class="tile-row" aria-label="Rarity by question">' + dive.responses.map(row => '<i class="' + (row.tier ? 'tile-' + TIER_NAMES.indexOf(row.tier) : 'tile-empty') + '" title="' + esc(row.tier ?? 'Timed out') + '"></i>').join('') +
    '</div></div><img src="/public/sub.svg" alt="" /></section>' +
    '<div class="result-toolbar">' + btn('copy-result', 'Copy results', 'secondary', 'copy') + btn('share-result', 'Share results', 'secondary', 'share') +
    (dive.mode === 'daily' ? href('/', 'Return home', 'button primary', 'waves') : btn('begin', 'Play again', 'primary', 'play', diveAttrs(dive.mode, dive.key))) + '</div>' +
    '<div class="result-grid">' + box('<h2>Answer log</h2><ol class="responses">' + dive.responses.map((row, index) =>
      '<li><span class="response-number">' + (index + 1) + '</span><div><strong>' + esc(row.prompt) + '</strong><p>' + esc(row.entered || 'No answer entered') + '</p>' + badge(row.tier) + '</div><b>+' + row.points + '</b></li>').join('') + '</ol>') +
    '<div class="stack">' + box('<h2>Round performance</h2><div class="round-chart">' + dive.responses.map((row, index) =>
      '<div title="Question ' + (index + 1) + ', ' + row.points + ' points"><span>' + row.points + '</span><div><i class="tile-' + (row.tier ? TIER_NAMES.indexOf(row.tier) : 'empty') + '" style="height:' + Math.max(3,row.points) + '%"></i></div><small>Q' + (index + 1) + '</small></div>').join('') + '</div>') +
    box('<h2>Dive streak</h2><div class="streak-pair"><div>' + icon('flame') + '<strong>' + n(profile?.currentStreak) + '</strong><span>Current</span></div><div>' + icon('trophy') + '<strong>' + n(profile?.bestStreak) +
      '</strong><span>Best</span></div></div>' + (state.unlocks?.length ? '<p class="success">' + icon('spark', 17) + ' New companion unlocked! ' + href('/account', 'Visit your profile', 'inline-link') + '</p>' : '')) +
    (dive.mode === 'daily' ? box('<h2>Score distribution</h2>' + (details?.sample >= 2 ?
      '<p>' + details.percentile + 'th percentile across ' + n(details.sample) + ' completed dives.</p><div class="distribution">' + details.distribution.map(bucket => '<div><span>' + bucket.score + '</span><i style="width:' + (bucket.count / max * 80) + '%"></i><small>' + bucket.count + '</small></div>').join('') + '</div>' :
      '<p>Comparison appears once at least two players finish this dive.</p>')) : '') + '</div></div>' +
    box('<details class="feedback"><summary>Send game feedback ' + icon('down', 16) + '</summary>' + feedbackForm('game', dive.id) + '</details>');
}
export function feedbackForm(kind, gameId = '') {
  return '<form data-form="feedback" data-id="' + esc(gameId) + '" class="form-stack">' + (kind === 'game' ?
    '<div class="fields"><label>Feedback type<select name="kind" data-preserve><option value="game">Game feedback</option><option value="incorrect">Report an incorrect answer</option><option value="missing">Suggest a missing answer</option></select></label>' +
    '<label>Rating<select name="rating" data-preserve><option value="">Optional</option><option value="5">5 / 5</option><option value="4">4 / 5</option><option value="3">3 / 5</option><option value="2">2 / 5</option><option value="1">1 / 5</option></select></label></div>' :
    '<input type="hidden" name="kind" value="multiplayer" />') +
    '<label>Message<textarea data-preserve name="message" maxlength="1800" rows="3" placeholder="Add details for the game administrator"></textarea></label>' + error() +
    '<div class="button-row">' + submit('Send feedback', 'secondary') + '</div></form>';
}
