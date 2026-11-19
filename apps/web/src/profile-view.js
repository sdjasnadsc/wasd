import { AVATARS } from '/shared.js';
import { avatar, btn, href, icon, box, title, tag, n, esc, submit, error, empty, historyTable, loading } from './ui.js';

const statsCell = (glyph, value, label) => '<div class="profile-stat"><span>' + icon(glyph) + '</span><strong>' + n(value) + '</strong><small>' + label + '</small></div>';
function nameForm(profile) {
  return '<form data-form="profile-name" class="name-form"><label for="profile-name">Display name</label><div class="input-row"><input id="profile-name" name="name" value="' + esc(profile.name) + '" minlength="3" maxlength="24" required />' +
    submit('Save name', 'secondary') + '</div>' + error() + '</form>';
}
export function profileView(state) {
  const p = state.boot?.profile;
  if (!p) return loading();
  return title('My Profile', 'Your companions, dive records, and party stats.', 'profile') +
    '<div class="profile-banner">' + avatar(p.avatar, 'profile-avatar') + '<div>' + tag(p.registered ? 'ACCOUNT DIVER' : 'GUEST DIVER', 'mint') + '<h2>' + esc(p.name) +
    '</h2><p>' + n(p.rating) + ' party rating · ' + p.wins + ' ' + (p.wins === 1 ? 'win' : 'wins') + '</p></div></div>' +
    '<div class="profile-stats">' + statsCell('flame', p.currentStreak, 'Current streak') + statsCell('trophy', p.bestStreak, 'Best streak') + statsCell('daily', p.dailyCount, 'Daily Dives') + statsCell('depth', p.bestDaily, 'Best daily score') + '</div>' +
    '<div class="columns equal">' + box('<h2>Diver identity</h2>' + nameForm(p) + href('/settings', 'Manage account and data', 'inline-link', 'settings')) +
    box('<h2>Performance</h2><dl class="metrics"><dt>Total dives</dt><dd>' + p.total + '</dd><dt>Average score</dt><dd>' + p.average + ' pts</dd><dt>Highest overall</dt><dd>' +
    p.best + ' pts</dd><dt>Unlimited best</dt><dd>' + p.bestUnlimited + ' pts</dd><dt>Pack chapters</dt><dd>' + p.packChapters + '</dd><dt>Party wins / matches</dt><dd>' + p.wins + ' / ' + p.matches + '</dd></dl>') +
    '</div>' + companionPanel(p) + '<div class="section-head"><h2>Dive history</h2></div>' + box(historyTable(p.history, 60));
}
function companionPanel(p) {
  return box('<div class="section-head compact"><div><h2>Companions</h2><p>Build your longest Daily Dive streak to unlock new companions.</p></div>' +
    tag(p.unlocked.length + ' / ' + AVATARS.length) + '</div><div class="companion-grid">' +
    AVATARS.map(item => {
      const unlocked = p.unlocked.includes(item.id);
      return '<button type="button" class="companion ' + (p.avatar === item.id ? 'chosen' : '') + '" data-action="avatar" data-id="' + item.id + '" aria-pressed="' + (p.avatar === item.id) + '"' +
        (!unlocked ? ' disabled' : '') + '>' + avatar(item.id) + '<strong>' + item.name + '</strong><small>' + (p.avatar === item.id ? icon('check', 13) + ' Selected' : unlocked ? 'Unlocked' : icon('lock', 13) + ' ' + item.days + ' day streak') + '</small></button>';
    }).join('') + '</div>');
}
const toggle = (name, text, copy, checked) =>
  '<label class="toggle"><span><strong>' + text + '</strong><small>' + copy + '</small></span><input type="checkbox" role="switch" data-setting="' + name + '"' + (checked ? ' checked' : '') + ' /><i aria-hidden="true"></i></label>';
export function settingsView(state) {
  const p = state.boot?.profile;
  if (!p) return loading();
  const s = p.settings;
  return title('Settings', 'Adjust how you play and manage your data.', 'settings') +
    '<div class="columns equal">' + box('<h2>Sound & motion</h2>' +
    toggle('sound', 'Sound effects', 'Play sounds for accepted answers and party events.', s.sound) +
    '<label class="range-label"><span>Audio volume <output data-volume>' + n(s.volume) + '%</output></span><input type="range" data-setting="volume" min="0" max="100" value="' + s.volume + '" /></label>' +
    toggle('animations', 'Animations', 'Show underwater movement and game transitions.', s.animations) +
    toggle('reducedMotion', 'Reduced motion', 'Keep scenes still and simplify transitions.', s.reducedMotion)) +
    box('<h2>Accessibility & privacy</h2>' + toggle('colorblind', 'Colorblind-friendly rarity', 'Use high-contrast colors and distinct symbols.', s.colorblind) +
    toggle('largeText', 'Larger text', 'Increase the interface text size.', s.largeText) +
    toggle('shareAnswers', 'Share answers with friends', 'Only available once both players finish their daily dive.', s.shareAnswers) +
    href('/faq', 'Read the gameplay instructions', 'inline-link', 'help')) + '</div>' +
    companionPanel(p) + box('<h2>Account & data</h2>' +
    (p.registered ? '<p>Signed in as <strong>' + esc(p.name) + '</strong>.</p><div class="button-row">' + btn('logout', 'Sign out', 'secondary', 'exit') + '</div>' :
    '<p>Guest progress is saved in this browser. Create an account to keep your dives across browsers.</p><div class="segment account-switch">' +
      btn('account-tab', 'Create account', state.accountTab === 'register' ? 'selected' : '', '', 'data-tab="register"') + btn('account-tab', 'Sign in', state.accountTab === 'login' ? 'selected' : '', '', 'data-tab="login"') +
    '</div><form data-form="account" class="form-stack"><div class="fields"><label>Username<input name="username" required minlength="3" maxlength="24" autocomplete="username" /></label>' +
    '<label>Password<input type="password" name="password" required minlength="8" maxlength="128" autocomplete="' + (state.accountTab === 'login' ? 'current-password' : 'new-password') + '" /></label></div>' +
    (state.accountTab === 'login' ? '<label class="check-label"><input type="checkbox" name="importGuest" checked /> Import my guest dives</label>' : '') + error() +
    '<div class="button-row">' + submit(state.accountTab === 'login' ? 'Sign in' : 'Create account', 'primary') + '</div></form>') +
    '<div class="data-actions"><a href="/api/export" class="button secondary" download>' + icon('share', 17) + 'Export data</a>' +
    btn('delete-open', p.registered ? 'Delete account' : 'Clear guest progress', 'secondary destructive') + '</div>' +
    (state.confirmDelete ? '<form data-form="delete" class="notice form-stack"><strong>' + (p.registered ? 'Permanently delete this account and its progress?' : 'Permanently clear progress for this guest?') +
    '</strong>' + (p.registered ? '<label>Confirm password<input type="password" name="password" autocomplete="current-password" required /></label>' : '') + error() +
    '<div class="button-row">' + submit(p.registered ? 'Delete account' : 'Clear progress', 'danger') + btn('delete-open', 'Cancel', 'secondary') + '</div></form>' : ''));
}
export function friendsView(state) {
  const data = state.friends;
  if (!data) return title('Friends', 'Invite a friend and compare today’s dives.', 'friends') + (state.error ? box(error(state.error) + btn('friends-reload','Retry')) : loading());
  const people = data.people;
  const accepted = people.filter(person => person.status === 'accepted');
  const pending = people.filter(person => person.status === 'pending');
  const ranks = accepted.filter(person => person.score !== undefined);
  if (data.completed) ranks.push({ id: state.boot.profile.id, name: state.boot.profile.name, avatar: state.boot.profile.avatar, score: data.ownScore });
  ranks.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const invite = location.origin + '/friends?invite=' + encodeURIComponent(data.invite);
  return title('Friends', 'Invite a friend and compare today’s dives.', 'friends') +
    (state.friendInvite ? box('<h2>You received a friend invitation</h2><p>Send a request to the diver who shared this link.</p>' + btn('friend-invite-accept', 'Send request', 'primary', 'userPlus') + error(state.error), 'glow-panel') : '') +
    '<div class="columns equal">' + box('<h2>Invite a friend</h2><label for="friend-link">Your invitation link</label><div class="input-row"><input id="friend-link" value="' +
    esc(invite) + '" readonly />' + btn('friend-copy', 'Copy', 'secondary', 'copy') + '</div><div class="button-row">' + btn('friend-regenerate', 'Regenerate link', 'secondary small', 'refresh') + '</div>') +
    box('<h2>Add by username</h2><p>Search by a friend’s registered username.</p><form data-form="friend-request" class="form-stack"><label>Username<input name="username" minlength="3" maxlength="24" required placeholder="Enter their username" /></label>' +
    error() + submit('Send request', 'primary', 'userPlus') + '</form>') + '</div>' +
    box('<div class="section-head compact"><div><h2>Daily leaderboard</h2><p>' + (data.completed ? 'Scores from divers who finished today.' : 'Complete today’s Daily Dive to see your friends’ scores.') + '</p></div>' +
    tag(data.today, 'mint') + '</div>' + (ranks.length ? '<ol class="leaderboard">' + ranks.map((p, i) => '<li><span class="mono">' + (i + 1) + '</span>' + avatar(p.avatar) +
    '<div><strong>' + esc(p.name) + (state.boot.profile.id === p.id ? ' (you)' : '') + '</strong>' + (p.answers?.length ? '<details><summary>Shared answers</summary><ul>' +
    p.answers.map(a => '<li>' + esc(a.entered || 'Timed out') + ' · ' + a.points + ' pts</li>').join('') + '</ul></details>' : '') + '</div><b>' + n(p.score) + ' pts</b></li>').join('') + '</ol>' :
    empty(data.completed ? 'No scores yet' : 'Leaderboard locked', data.completed ? 'Friends’ scores appear after they finish.' : 'Head to Daily Dive to play today’s challenge.', data.completed ? 'trophy' : 'lock'))) +
    box('<h2>Friend requests</h2>' + (pending.length ? pending.map(p => friendRow(p, 'pending')).join('') : empty('No pending requests', 'Incoming invitations will appear here.', 'userPlus'))) +
    box('<h2>Your friends</h2>' + (accepted.length ? accepted.map(p => friendRow(p, 'friend')).join('') : empty('No friends yet', 'Copy your invitation link to add a diver.', 'friends'))) +
    (data.blocked.length ? box('<h2>Blocked divers</h2>' + data.blocked.map(p => friendRow(p, 'blocked')).join('')) : '');
}
function friendRow(p, context) {
  const action = (name, label) => btn('friend-action', label, 'secondary small', '', 'data-id="' + esc(p.id) + '" data-kind="' + name + '"');
  const buttons = context === 'blocked' ? action('unblock', 'Unblock') : context === 'pending' ?
    (p.incoming ? action('accept', 'Accept') + action('reject', 'Reject') : action('remove', 'Cancel')) : action('remove', 'Remove') + action('block', 'Block');
  return '<div class="friend-row">' + avatar(p.avatar) + '<div><strong>' + esc(p.name) + '</strong>' + (context === 'pending' ?
    '<small>' + (p.incoming ? 'Incoming request' : 'Request sent') + '</small>' : '') + '</div><div class="button-row">' + buttons + '</div></div>';
}
export function adminView(state) {
  const data = state.admin;
  return title('Administration', 'Review private feedback and curate the question bank.', 'settings') +
    (!data ? box('<h2>Admin token</h2><form class="form-stack" data-form="admin-login"><label>Token<input name="token" type="password" required autocomplete="off" /></label>' +
      error() + submit('Open admin', 'primary') + '</form>') :
    box('<h2>Feedback</h2>' + (data.feedback.length ? data.feedback.map(item => '<div class="admin-feedback"><div>' + tag(item.kind) + '<p>' + esc(item.message) +
      '</p><small>' + (item.rating ? item.rating + '/5 · ' : '') + esc(new Date(item.created_at).toLocaleString()) + '</small></div>' +
      (item.reviewed ? tag('Reviewed', 'mint') : btn('admin-review', 'Mark reviewed', 'secondary small', 'check', 'data-id="' + item.id + '"')) + '</div>').join('') :
      empty('No feedback yet', 'Submitted feedback will appear here.'))) +
    box('<h2>Question bank</h2><p>Choose a question to edit or use a new stable ID to add one. Saved dives retain their original question set.</p>' +
    '<label>Question<select data-admin-question><option value="">New question</option>' + data.questions.map(q => '<option value="' + esc(q.id) + '"' + (state.adminQuestion?.id === q.id ? ' selected' : '') + '>' +
      esc(q.category + ' · ' + q.prompt) + '</option>').join('') + '</select></label>' +
    '<form class="form-stack" data-form="admin-save"><label>Question ID<input name="id" value="' + esc(state.adminQuestion?.id) + '" required /></label>' +
    '<label>Question data (JSON)<textarea name="json" rows="17" required spellcheck="false">' +
    esc(JSON.stringify(state.adminQuestion ?? { prompt: '', category: '', difficulty: 1, restrictions: [], acceptedAnswers: [{ canonical: '', aliases: [], tier: 'Plankton' }] }, null, 2)) +
    '</textarea></label>' + error() + submit('Save question', 'primary') + '</form>'));
}
