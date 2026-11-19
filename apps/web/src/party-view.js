import { AVATARS, DEFAULT_PARTY, TIER_NAMES } from '/shared.js';
import { icon, btn, href, box, empty, error, tag, puffer, avatar, n, esc, submit, badge, rarityName } from './ui.js';
import { feedbackForm } from './dive-view.js';

export function partyView(state) {
  if (!state.boot) return '';
  if (state.room) return roomView(state);
  const profile = state.boot.profile;
  const connection = state.online ? tag('Connected', 'mint') : tag('Connecting.');
  return '<header class="relay-heading"><div><h1>Puffer Relay</h1><p>Pass the puffer with an unused answer. When it pops, the holder loses a heart.</p>' +
    href('/faq', 'How to play', 'inline-link', 'help') + '</div><div class="relay-buoy" aria-hidden="true">' + puffer('party-intro-fish') + '</div></header>' +
    '<div class="columns party-grid">' + box('<div class="section-head compact"><h2>Your diver</h2>' + connection + '</div>' +
    '<div class="party-identity">' + avatar(profile.avatar) + '<div><strong>' + esc(profile.name) + '</strong><p>' + (profile.registered ? 'Account diver' : 'Guest diver') + ' � ' + n(profile.rating) + ' rating</p></div></div>' +
    '<form data-form="party-name"><label for="party-name">Display name</label><div class="input-row"><input id="party-name" name="name" value="' + esc(profile.name) + '" minlength="3" maxlength="24" required data-preserve />' +
    submit('Save', 'secondary') + '</div>' + error() + '</form>' + companionPicker(profile)) +
    box('<h2>Matchmaking</h2><p>Choose a table size. Rated games match you with players near your rating.</p><div class="segment" role="group" aria-label="Table size">' +
      [['2', '1v1'],['3','3 players'],['4-6','4-6 players'],['8-10','8-10 players']].map(([key, label]) => btn('queue-size', label, state.queueSize === key ? 'selected' : '', '', 'data-size="' + key + '" aria-pressed="' + (state.queueSize === key) + '"')).join('') +
      '</div>' + (state.queue ? '<div class="queue-status"><span class="spinner"></span><div><strong>Finding ' + (state.queue.rated ? 'a rated' : 'a quick') + ' match</strong><p>' + state.queue.waiting + ' in this queue</p></div>' + btn('queue-cancel', 'Cancel', 'secondary small') + '</div>' :
      '<div class="button-row">' + btn('queue-quick', 'Quick Play', 'primary', 'play', state.online ? '' : 'disabled') +
      btn('queue-rated', 'Rated', 'secondary', 'trophy', state.online ? '' : 'disabled') + '</div>')) + '</div>' +
    '<div class="columns party-grid">' + box('<h2>Host a room</h2><p>Set the rules and invite friends to play.</p>' +
    (state.hostForm ? hostForm(state) : btn('host-form', 'Room settings', 'secondary', 'plus'))) +
    box('<h2>Join a room</h2><p>Use the four-letter code or an invitation link.</p><form data-form="join"><label for="code">Room code</label><div class="input-row">' +
    '<input id="code" class="room-code-input" name="code" required autocomplete="off" placeholder="ABCD" maxlength="4" minlength="4" pattern="[a-zA-Z]{4}" value="' + esc(state.inviteCode ?? '') + '" data-preserve />' + submit('Join room', 'primary', '', state.online ? '' : 'disabled') +
    '</div>' + error(state.error) + '</form>') + '</div>' +
    box('<div class="section-head compact"><div><h2>Public rooms</h2><p>Open lobbies update live.</p></div>' + tag((state.rooms?.length ?? 0) + ' rooms') + '</div>' +
    (state.rooms?.length ? '<div class="table-scroll"><table class="room-table"><thead><tr><th>Room</th><th>Code</th><th>Host</th><th>Players</th><th>Status</th><th></th></tr></thead><tbody>' +
    state.rooms.map(room => '<tr><td><strong>' + esc(room.name) + '</strong></td><td class="mono">' + esc(room.code) + '</td><td>' + esc(room.host) + '</td><td>' + room.count + ' / ' + room.capacity +
      '</td><td>' + tag(room.status === 'lobby' ? room.joinable ? 'Lobby' : 'Full' : room.status === 'playing' ? 'Playing' : 'Finished', room.joinable ? 'mint' : '') +
      '</td><td>' + btn('join-listed', 'Join', 'secondary small', '', 'data-code="' + esc(room.code) + '"' + (room.joinable ? '' : ' disabled')) + '</td></tr>').join('') + '</tbody></table></div>' :
    empty(state.online ? 'No public rooms yet' : 'Looking for rooms.', state.online ? 'Open a room or share a code with a friend.' : 'Room listings appear when you connect.', 'party')), 'rooms-panel');
}
function companionPicker(profile) {
  const buttons = AVATARS.filter(item => profile.unlocked.includes(item.id)).map(item =>
    '<button type="button" data-action="avatar" data-id="' + item.id + '" class="relay-companion" aria-pressed="' +
    (profile.avatar === item.id) + '" aria-label="' + esc(item.name) + '" title="' + esc(item.name) + '">' + avatar(item.id) + '</button>');
  return '<div class="relay-companions"><span>Companion</span><div role="group" aria-label="Unlocked companions">' + buttons.join('') +
    '</div>' + href('/account', 'See unlocks', 'inline-link', 'profile') + '</div>';
}
function hostForm(state) {
  const number = (name, label, min, max) => '<label>' + label + '<input type="number" name="' + name + '" min="' + min + '" max="' + max + '" value="' + DEFAULT_PARTY[name] + '" required data-preserve /></label>';
  return '<form data-form="host" class="form-stack"><label>Room name<input name="name" maxlength="42" placeholder="Your dive crew" data-preserve /></label><div class="fields">' +
    number('capacity','Player capacity',2,16) + number('startingHearts','Starting hearts',1,10) + number('maxHearts','Maximum hearts',1,10) + number('heartPoints','Points per heart',10,5000) +
    number('fuseMin','Shortest fuse (s)',1,90) + number('fuseMax','Longest fuse (s)',1,120) +
    '</div><label class="check-label"><input type="checkbox" name="private" data-preserve /> Private room</label>' + error() +
    '<div class="button-row">' + submit('Create room', 'primary', 'plus', state.online ? '' : 'disabled') + btn('host-form', 'Cancel', 'secondary') + '</div></form>';
}
function roomView(state) {
  const room = state.room;
  const me = room.players.find(player => player.id === state.boot.profile.id);
  const holder = room.players.find(player => player.id === room.holderId);
  const host = room.hostId === me?.id;
  const mine = holder?.id === me?.id && Boolean(me);
  const winner = room.players.find(player => player.id === room.winnerId);
  const inMatch = room.status === 'playing';
  return '<div class="room-top"><div class="room-title">' + tag(room.code, 'mint') + (room.rated ? tag('Rated', 'gold') : '') + '<h1>' + esc(room.settings.name) + '</h1></div><div class="button-row">' +
    btn('party-invite', 'Copy invitation', 'secondary', 'copy') + btn('leave', 'Leave room', 'secondary', 'exit') + '</div></div>' +
    (!state.online ? '<p class="notice" role="status">Connection interrupted. Reconnecting to your room.</p>' : '') +
    (inMatch ? relayArena(room, state, me, holder, mine) :
    '<div class="columns room-grid">' +
    (
    room.status === 'finished' ?
      box(puffer() + tag('MATCH COMPLETE', 'gold') + '<h2>' + esc(winner?.name ?? 'The last diver') + ' wins!</h2><p>' + (room.rated && me?.ratingChange != null ?
        'Rating ' + (me.ratingChange >= 0 ? '+' : '') + me.ratingChange + ' � Now ' + n(me.rating) : 'The last diver with a heart takes the match.') + '</p><div class="button-row">' +
        (host && !room.rated ? btn('rematch', 'Play again', 'primary', 'refresh') : '') + btn('leave', 'Return to lobby', 'secondary', 'exit') + '</div>', 'winner-panel') :
      box(puffer() + tag('WAITING ROOM', 'gold') + '<h2>Get ready to pass</h2><p>Share code <strong class="mono">' + esc(room.code) + '</strong> with your crew. ' +
        (host ? 'Everyone else must be ready before you start.' : 'Mark yourself ready and wait for the host.') + '</p><div class="button-row">' +
        (host ? btn('game-start', 'Start game', 'primary', 'play', room.players.length > 1 && room.players.every(player => player.connected && (player.ready || player.id === room.hostId)) ? '' : 'disabled') :
          btn('ready', me?.ready ? 'Set as not ready' : 'I'm ready', me?.ready ? 'secondary' : 'primary', 'check', 'data-ready="' + !me?.ready + '"')) + '</div>' +
        '<p class="subtle">' + room.settings.startingHearts + ' starting hearts � ' + n(room.settings.heartPoints) + ' pts per extra heart</p>' + error(state.error), 'waiting-panel')) +
    box('<div class="section-head compact"><h2>Players</h2>' + tag(room.players.length + ' / ' + room.settings.capacity) + '</div><div class="roster">' +
      room.players.map(player => rosterCard(player, room, me?.id)).join('') + '</div>') + '</div>') +
    (inMatch ? box('<h2>Used answers</h2>' + (room.answers.length ? '<ul class="used-answers">' + room.answers.slice().reverse().map(answer => '<li><div><strong>' + esc(answer.answer) +
      '</strong><small>' + esc(answer.name) + '</small></div>' + badge(answer.tier) + '<b>+' + answer.points + '</b></li>').join('') + '</ul>' :
      empty('No answers yet', 'Accepted answers appear here until the next category.', 'list'))) : '') +
    box('<details class="feedback"><summary>Report a multiplayer issue ' + icon('down', 16) + '</summary>' + feedbackForm('multiplayer') + '</details>');
}

function relayArena(room, state, me, holder, mine) {
  const ring = room.players.length <= 8;
  const points = room.players.map((_, index) => seatPoint(index, room.players.length));
  const positionFor = userId => {
    const point = points[room.players.findIndex(player => player.id === userId)];
    return point && ring ? point.map(coordinate => 50 + (coordinate - 50) * .45) : [50, 50];
  };
  const latest = new Map(room.answers.map(answer => [answer.playerId, answer]));
  const [fromX, fromY] = positionFor(state.partyMotion?.from);
  const [toX, toY] = positionFor(room.holderId);
  const pop = ['pop', 'eliminated'].includes(state.partyMotion?.event);
  const movement = state.partyMotion ? pop ? ' did-pop' : ' handoff' : '';
  const fishStyle = '--from-x:' + fromX + '%;--from-y:' + fromY + '%;--to-x:' + toX + '%;--to-y:' + toY + '%';
  const status = mine ? 'You hold the puffer!' : (holder?.name ?? 'Another diver') + ' holds the puffer';

  return '<section class="relay-arena ' + room.mood + '"><div class="relay-category">' +
    '<div><span>Category ' + room.round + '</span><h2>' + esc(room.prompt) + '</h2></div>' + tag('Hidden fuse', 'gold') + '</div>' +
    '<div class="relay-water' + (ring ? '' : ' packed') + '"><div class="relay-ring" aria-hidden="true"></div>' +
    '<div class="relay-fish' + movement + '" style="' + fishStyle + '" aria-hidden="true"><i></i>' + puffer() + '</div>' +
    '<ol class="relay-seats" aria-label="Turn order">' + room.players.map((player, index) =>
      relaySeat(player, room, me?.id, latest.get(player.id), points[index])).join('') + '</ol></div>' +
    '<div class="relay-console"><div class="relay-status"><strong>' + esc(status) + '</strong><p role="status">' +
    esc(room.event?.text ?? (mine ? 'Enter an unused answer to pass it.' : 'Wait for the puffer to reach you.')) + '</p></div>' +
    (mine ? '<form data-form="party-answer" data-turn="' + room.turn + '"><label for="party-answer">Your answer</label>' +
      '<div class="input-row"><input id="party-answer" name="answer" maxlength="120" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type an answer" data-preserve />' +
      submit('Pass puffer', 'primary', 'party', state.online ? '' : 'disabled') + '</div>' + error(state.error) + '</form>' : '') +
    '</div></section>';
}

function seatPoint(index, count) {
  if (count === 2) return [index === 0 ? 19 : 81, 50];
  const angle = index / count * Math.PI * 2 - Math.PI / 2;
  return [50 + 36 * Math.cos(angle), 50 + 34 * Math.sin(angle)];
}

function relaySeat(player, room, ownId, answer, [x, y]) {
  const active = player.id === room.holderId;
  const lastAnswer = answer ? '<span class="relay-answer rarity-' + TIER_NAMES.indexOf(answer.tier) + '" title="' + esc(rarityName(answer.tier) + ' � ' + answer.answer) + '">' +
    esc(answer.answer) + '</span>' : '';
  const maxPips = Math.max(room.settings.startingHearts, player.hearts);
  const hearts = Array.from({ length: maxPips }, (_, index) =>
    '<i class="' + (index < player.hearts ? 'full' : '') + '">' + icon('heart', 13) + '</i>').join('');
  return '<li class="relay-seat' + (active ? ' holding' : '') + (player.hearts ? '' : ' out') + '" style="--seat-x:' + x + '%;--seat-y:' + y + '%" ' +
    (active ? 'aria-current="true"' : '') + '>' + lastAnswer + '<div class="seat-badge">' + avatar(player.avatar) + '</div>' +
    '<strong title="' + esc(player.name) + '">' + esc(player.name) + (player.id === ownId ? '<small> � You</small>' : '') + '</strong>' +
    '<span class="relay-hearts" role="img" aria-label="' + player.hearts + ' hearts">' + hearts + '</span>' +
    '<span class="relay-charge" role="meter" aria-label="Progress toward an extra heart" aria-valuemin="0" aria-valuemax="' + room.settings.heartPoints +
    '" aria-valuenow="' + Math.min(player.progress, room.settings.heartPoints) + '"><i style="width:' +
    Math.min(100, 100 * player.progress / room.settings.heartPoints) + '%"></i></span>' +
    (!player.connected ? '<small>Reconnecting</small>' : '') + '</li>';
}

function rosterCard(player, room, ownId) {
  const holder = player.id === room.holderId;
  return '<div class="roster-player' + (holder ? ' has-puffer' : '') + (player.hearts === 0 ? ' eliminated' : '') + '">' + avatar(player.avatar) +
    '<div class="player-details"><strong>' + esc(player.name) + (player.id === ownId ? ' <small>YOU</small>' : '') + '</strong><span>' +
    (!player.connected ? 'Disconnected' : player.hearts === 0 ? 'Eliminated' : holder ? 'Holding the puffer' : room.status === 'lobby' ? player.id === room.hostId ? 'Host' : player.ready ? 'Ready' : 'Waiting' : 'In play') + '</span>' + '</div>' +
    '<div class="player-hearts" aria-label="' + player.hearts + ' hearts">' + icon('heart', 16) + '<b>' + player.hearts + '</b></div></div>';
}
