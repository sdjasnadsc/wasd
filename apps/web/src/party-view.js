import { DEFAULT_PARTY } from '/shared.js';
import { icon, btn, href, title, box, empty, error, tag, puffer, avatar, n, esc, submit, badge } from './ui.js';
import { feedbackForm } from './dive-view.js';

export function partyView(state) {
  if (!state.boot) return '';
  if (state.room) return roomView(state);
  const profile = state.boot.profile;
  const connection = state.online ? tag('Connected', 'mint') : tag('Connecting…');
  return '<div class="party-heading">' + title('Puffer Party', 'Find an answer, pass the puffer, and be the last diver with a heart.', 'party') + puffer('party-intro-fish') + '</div>' +
    '<div class="columns party-grid">' + box('<div class="section-head compact"><h2>Your diver</h2>' + connection + '</div>' +
    '<div class="party-identity">' + avatar(profile.avatar) + '<div><strong>' + esc(profile.name) + '</strong><p>' + (profile.registered ? 'Account diver' : 'Guest diver') + ' · ' + n(profile.rating) + ' rating</p></div></div>' +
    '<form data-form="party-name"><label for="party-name">Display name</label><div class="input-row"><input id="party-name" name="name" value="' + esc(profile.name) + '" minlength="3" maxlength="24" required data-preserve />' +
    submit('Save', 'secondary') + '</div>' + error() + '</form>' + href('/account', 'Choose your companion', 'inline-link', 'profile')) +
    box('<h2>Matchmaking</h2><p>Choose a table size. Rated games match you with players near your rating.</p><div class="segment" role="group" aria-label="Table size">' +
      [['2', '1v1'],['3','3 players'],['4-6','4–6 players'],['8-10','8–10 players']].map(([key, label]) => btn('queue-size', label, state.queueSize === key ? 'selected' : '', '', 'data-size="' + key + '" aria-pressed="' + (state.queueSize === key) + '"')).join('') +
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
    empty(state.online ? 'No public rooms yet' : 'Looking for rooms…', state.online ? 'Open a room or share a code with a friend.' : 'Room listings appear when you connect.', 'party')), 'rooms-panel');
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
    (!state.online ? '<p class="notice" role="status">Connection interrupted. Reconnecting to your room…</p>' : '') +
    '<div class="columns room-grid">' +
    (inMatch ? '<section class="panel puffer-stage ' + esc(room.mood) + '">' + tag('CATEGORY ' + room.round, 'gold') + puffer('active-puffer') +
      '<h2>' + esc(room.prompt) + '</h2><p class="holder-label">' + (mine ? '<strong>You hold the puffer!</strong>' : esc(holder?.name ?? 'Another diver') + ' holds the puffer') + '</p>' +
      '<div class="party-event ' + (room.event ? esc(room.event.kind) : '') + '" role="status">' + esc(room.event?.text ?? (mine ? 'Find an unused answer to pass it.' : 'Wait for the puffer to reach you.')) + '</div>' +
      (mine ? '<form data-form="party-answer" data-turn="' + room.turn + '"><label for="party-answer">Your answer</label><div class="input-row"><input id="party-answer" name="answer" maxlength="120" required autocomplete="off" spellcheck="false" placeholder="Type an answer…" data-preserve />' +
        submit('Pass puffer', 'primary', 'party', state.online ? '' : 'disabled') + '</div>' + error(state.error) + '</form>' : '') + '</section>' :
    room.status === 'finished' ?
      box(puffer() + tag('MATCH COMPLETE', 'gold') + '<h2>' + esc(winner?.name ?? 'The last diver') + ' wins!</h2><p>' + (room.rated && me?.ratingChange != null ?
        'Rating ' + (me.ratingChange >= 0 ? '+' : '') + me.ratingChange + ' · Now ' + n(me.rating) : 'The last diver with a heart takes the match.') + '</p><div class="button-row">' +
        (host && !room.rated ? btn('rematch', 'Play again', 'primary', 'refresh') : '') + btn('leave', 'Return to lobby', 'secondary', 'exit') + '</div>', 'winner-panel') :
      box(puffer() + tag('WAITING ROOM', 'gold') + '<h2>Get ready to pass</h2><p>Share code <strong class="mono">' + esc(room.code) + '</strong> with your crew. ' +
        (host ? 'Everyone else must be ready before you start.' : 'Mark yourself ready and wait for the host.') + '</p><div class="button-row">' +
        (host ? btn('game-start', 'Start game', 'primary', 'play', room.players.length > 1 && room.players.every(player => player.connected && (player.ready || player.id === room.hostId)) ? '' : 'disabled') :
          btn('ready', me?.ready ? 'Set as not ready' : 'I’m ready', me?.ready ? 'secondary' : 'primary', 'check', 'data-ready="' + !me?.ready + '"')) + '</div>' +
        '<p class="subtle">' + room.settings.startingHearts + ' starting hearts · ' + n(room.settings.heartPoints) + ' pts per extra heart</p>' + error(state.error), 'waiting-panel')) +
    box('<div class="section-head compact"><h2>Players</h2>' + tag(room.players.length + ' / ' + room.settings.capacity) + '</div><div class="roster">' +
      room.players.map(player => rosterCard(player, room, me?.id)).join('') + '</div>') + '</div>' +
    (inMatch ? box('<h2>Used answers</h2>' + (room.answers.length ? '<ul class="used-answers">' + room.answers.slice().reverse().map(answer => '<li><div><strong>' + esc(answer.answer) +
      '</strong><small>' + esc(answer.name) + '</small></div>' + badge(answer.tier) + '<b>+' + answer.points + '</b></li>').join('') + '</ul>' :
      empty('No answers yet', 'Accepted answers appear here until the next category.', 'list'))) : '') +
    box('<details class="feedback"><summary>Report a multiplayer issue ' + icon('down', 16) + '</summary>' + feedbackForm('multiplayer') + '</details>');
}
function rosterCard(player, room, ownId) {
  const holder = player.id === room.holderId;
  return '<div class="roster-player' + (holder ? ' has-puffer' : '') + (player.hearts === 0 ? ' eliminated' : '') + '">' + avatar(player.avatar) +
    '<div class="player-details"><strong>' + esc(player.name) + (player.id === ownId ? ' <small>YOU</small>' : '') + '</strong><span>' +
    (!player.connected ? 'Disconnected' : player.hearts === 0 ? 'Eliminated' : holder ? 'Holding the puffer' : room.status === 'lobby' ? player.id === room.hostId ? 'Host' : player.ready ? 'Ready' : 'Waiting' : 'In play') + '</span>' + '</div>' +
    '<div class="player-hearts" aria-label="' + player.hearts + ' hearts">' + icon('heart', 16) + '<b>' + player.hearts + '</b></div>' +
    (room.status !== 'lobby' ? '<div class="heart-progress" aria-label="' + player.progress + ' of ' + room.settings.heartPoints + ' points toward next heart"><i style="width:' + Math.min(100, 100 * player.progress / room.settings.heartPoints) + '%"></i></div>' : '') + '</div>';
}
