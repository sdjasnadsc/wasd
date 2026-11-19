import { MAX_SCORE, ROUND_COUNT, TIER_ICONS, TIER_NAMES, METERS_PER_POINT } from '/shared.js';
import { btn, href, icon, box, esc, n, tag, error, badge, rarityName, loading, diveAttrs, submit } from './ui.js';

const backHome = dive => ({ daily: ['/', 'Daily Descent'], archive: ['/archive', 'Archive'], unlimited: ['/unlimited/classic', 'Unlimited'], pack: ['/' + dive.key.split(':')[0], 'Chapters'] }[dive.mode]);
const modeName = { daily: 'Daily Descent', archive: 'Archived Dive', unlimited: 'Endless Dive', pack: 'Themed Dive' };
const tile = row => 'tile-' + (row?.tier ? TIER_NAMES.indexOf(row.tier) : 'empty');

export function diveView(state) {
  const dive = state.dive;
  if (!dive) return state.error ? box(error(state.error) + '<div class="button-row">' + href('/', 'Return home', 'button secondary', 'waves') + href('/archive', 'Browse archive', 'button secondary', 'archive') + '</div>') : loading();
  if (dive.status === 'finished' && !state.finalReveal) return result(state);
  const [url, text] = backHome(dive);
  const reveal = dive.status === 'reveal' || state.finalReveal ? dive.responses.at(-1) : null;
  const prompt = dive.prompt ?? reveal;
  const depth = dive.score * METERS_PER_POINT;
  const before = (state.descentFrom ?? dive.score) / MAX_SCORE;
  const after = dive.score / MAX_SCORE;
  const progress = Array.from({ length: ROUND_COUNT }, (_, index) => {
    const row = dive.responses[index];
    const active = index + 1 === dive.current;
    const label = 'Round ' + (index + 1) + (row ? ' � ' + row.points + ' points' : active ? ' � current' : ' � upcoming');
    return '<li class="' + tile(row) + (row ? ' recorded' : '') + (active ? ' at-round' : '') + '" title="' + label + '" aria-label="' + label + '">' + (index + 1) + '</li>';
  }).join('');
  return '<div class="dive-navigation">' + href(url, text, 'back-link', 'left') +
    btn('auto-advance', state.autoAdvance ? 'Auto-next on' : 'Auto-next off', 'text-button auto-next', 'refresh', 'aria-pressed="' + state.autoAdvance + '"') + '</div>' +
    '<header class="dive-heading"><div><p>' + esc(dive.label) + '</p><h1>' + modeName[dive.mode] + '</h1></div>' +
    '<ol class="dive-steps" aria-label="Round progress">' + progress + '</ol></header>' +
    '<section class="descent-stage' + (reveal ? ' descending' : '') + '" style="--waterline:' + (after * 74) + '%;--score-start:' + (before * 100) + '%;--score-end:' + (after * 100) + '%">' +
    '<div class="descent-water" aria-hidden="true"></div><div class="descent-contours" aria-hidden="true"></div>' +
    '<div class="descent-cable" aria-hidden="true"><span></span></div>' +
    '<div class="descent-readout"><span>' + icon('depth', 16) + ' Depth</span><strong>' + n(depth) + '<small> m</small></strong><span>' + n(dive.score) + ' / ' + MAX_SCORE + ' pts</span></div>' +
    '<div class="descent-scale" aria-hidden="true"><span>0</span><i></i><span>7,000 m</span></div>' +
    '<div class="descent-question' + (state.promptEntering ? ' prompt-entering' : '') + '"><div class="round-meta"><span>Round ' + dive.current + ' of ' + ROUND_COUNT + '</span>' +
    tag(prompt.category) + '</div><h2>' + esc(prompt.prompt) + '</h2>' +
    (prompt.restrictions?.length ? '<ul class="restrictions">' + prompt.restrictions.map(value => '<li>' + esc(value) + '</li>').join('') + '</ul>' : '') + '</div>' +
    (reveal ? roundReveal(reveal, state) : answerConsole(state.error)) + '</section>';
}

function answerConsole(message) {
  return '<div class="descent-console"><div class="round-countdown"><div class="timer-track"><div data-timer-bar></div></div><span>' +
    icon('timer', 18) + '<b data-timer>25</b>s</span></div>' +
    '<form data-form="dive-answer"><label for="dive-answer">Your answer</label><div class="input-row">' +
    '<input id="dive-answer" name="answer" autocomplete="off" autocapitalize="off" maxlength="120" required placeholder="Type an answer" data-preserve spellcheck="false" />' +
    submit('Submit', 'primary') + '</div>' + error(message) + '</form></div>';
}

function roundReveal(row, state) {
  return '<div class="descent-console reveal-console ' + tile(row) + '"><div class="reveal-signal" role="status">' +
    '<div>' + badge(row.tier) + '<strong>' + esc(row.canonical ?? 'No answer locked in') + '</strong></div>' +
    '<div class="reveal-gain"><b>+' + n(row.points) + '</b><span>' + n(row.points * METERS_PER_POINT) + ' m deeper</span></div></div>' +
    '<div class="reveal-controls"><span class="reveal-sweep" aria-hidden="true"' + (state.autoAdvance ? '' : ' hidden') + '><i></i></span>' +
    btn('next', state.finalReveal ? 'See results' : 'Next question', 'secondary small', 'right') + '</div></div>';
}

export function shareResult(dive) {
  const tiles = dive.responses.map(row => row.tier ? TIER_ICONS[TIER_NAMES.indexOf(row.tier)] : '?').join('');
  return 'Reef Relay � ' + dive.label + '\n' + n(dive.score) + '/' + MAX_SCORE + ' � ' + n(dive.score * METERS_PER_POINT) + ' m\n' + tiles;
}

function result(state) {
  const dive = state.dive;
  const details = state.stats;
  const profile = state.boot?.profile;
  const [url, label] = backHome(dive);
  const best = details?.previousBest;
  const previous = best == null ? 'First completed run' : dive.score > best ? 'New personal best � +' + (dive.score - best) + ' pts' : dive.score === best ? 'Matched your personal best' : 'Personal best � ' + best + ' pts';
  return href(url, label, 'back-link', 'left') +
    '<section class="result-hero"><div class="result-decoration"></div><div class="result-main">' + tag(dive.label, 'mint') + '<h1 id="dive-complete" tabindex="-1">Dive complete</h1>' +
    '<div class="result-depth">' + n(dive.score * METERS_PER_POINT) + '<small> m</small></div><p><strong>' + dive.score + '</strong> / ' + MAX_SCORE + ' points � ' + esc(details ? previous : 'Checking personal best.') +
    '</p><div class="tile-row" aria-label="Rarity by question">' + dive.responses.map(row => '<i class="' + tile(row) + '" title="' + rarityName(row.tier) + '"></i>').join('') +
    '</div></div><img src="/public/sub.svg" alt="" /></section>' +
    '<div class="result-toolbar">' + btn('copy-result', 'Copy results', 'primary', 'copy') + btn('share-result', 'Share', 'secondary', 'share') +
    (dive.mode === 'daily' ? href('/unlimited/classic', 'Keep diving', 'button secondary', 'infinity') + href('/', 'Return home', 'button text-button', 'waves') :
      btn('begin', 'Play again', 'secondary', 'play', diveAttrs(dive.mode, dive.key))) + '</div>' +
    '<div class="result-grid">' + box('<h2>Answer log</h2><ol class="responses">' + dive.responses.map((row, index) =>
      '<li><span class="response-number">' + (index + 1) + '</span><div><strong>' + esc(row.prompt) + '</strong><p>' + esc(row.entered || 'No answer entered') + '</p>' + badge(row.tier) + '</div><b>+' + row.points + '</b></li>').join('') + '</ol>') +
    '<div class="stack">' + depthLog(dive) + (dive.mode === 'daily' ? scoreDistribution(dive.score, details) : '') +
    box('<h2>Dive streak</h2><div class="streak-pair"><div>' + icon('flame') + '<strong>' + n(profile?.currentStreak) + '</strong><span>Current</span></div><div>' + icon('trophy') + '<strong>' + n(profile?.bestStreak) +
      '</strong><span>Best</span></div></div>' + (state.unlocks?.length ? '<p class="success">' + icon('spark', 17) + ' New companion unlocked! ' + href('/account', 'Visit your profile', 'inline-link') + '</p>' : '')) + '</div></div>' +
    box('<details class="feedback"><summary>Send game feedback ' + icon('down', 16) + '</summary>' + feedbackForm('game', dive.id) + '</details>');
}

function depthLog(dive) {
  const markers = dive.responses.map((row, index) =>
    '<li class="' + tile(row) + '" style="--stop:' + row.points + '%" aria-label="Round ' + (index + 1) + ', ' + row.points + ' points">' +
    '<div><i></i><b>' + row.points + '</b></div><span>' + (index + 1) + '</span></li>');
  return box('<h2>Round depths</h2><p>Points earned on each question.</p><ol class="depth-log">' + markers.join('') + '</ol>');
}

function scoreDistribution(score, details) {
  const title = '<h2>Today's scores</h2>';
  if (!details) return box(title + '<p>Loading completed dives.</p>');
  if (details.sample < 2) return box(title + '<p>Comparison opens after two players finish.</p>');
  const binCount = 14;
  const binSize = MAX_SCORE / binCount;
  const bins = Array(binCount).fill(0);
  for (const bucket of details.distribution) bins[Math.min(binCount - 1, Math.floor(bucket.score / binSize))] += bucket.count;
  const peak = Math.max(...bins, 1);
  const bars = bins.map((count, index) => '<i style="height:' + (100 * count / peak) + '%" title="' + (index * binSize) + '-' +
    ((index + 1) * binSize - (index === binCount - 1 ? 0 : 1)) + ' points � ' + n(count) + ' dives"></i>').join('');
  return box(title + '<p>Percentile <strong>' + details.percentile + '</strong> across ' + n(details.sample) + ' dives.</p>' +
    '<div class="score-histogram" aria-label="Score distribution, your score ' + score + '" role="img">' + bars +
    '<span class="score-pin" style="--you:' + (100 * score / MAX_SCORE) + '%"></span></div><div class="histogram-axis"><span>0</span><span>You � ' +
    score + '</span><span>' + MAX_SCORE + '</span></div>');
}
export function feedbackForm(kind, gameId = '') {
  return '<form data-form="feedback" data-id="' + esc(gameId) + '" class="form-stack">' + (kind === 'game' ?
    '<div class="fields"><label>Feedback type<select name="kind" data-preserve><option value="game">Game feedback</option><option value="incorrect">Report an incorrect answer</option><option value="missing">Suggest a missing answer</option></select></label>' +
    '<label>Rating<select name="rating" data-preserve><option value="">Optional</option><option value="5">5 / 5</option><option value="4">4 / 5</option><option value="3">3 / 5</option><option value="2">2 / 5</option><option value="1">1 / 5</option></select></label></div>' :
    '<input type="hidden" name="kind" value="multiplayer" />') +
    '<label>Message<textarea data-preserve name="message" maxlength="1800" rows="3" placeholder="Add details for the game administrator"></textarea></label>' + error() +
    '<div class="button-row">' + submit('Send feedback', 'secondary') + '</div></form>';
}
