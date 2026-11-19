export function connectParty(change) {
  let ws;
  let reconnect;
  let nextId = 0;
  let delay = 450;
  let enabled = true;
  const pending = new Map();
  const failAll = () => {
    for (const action of pending.values()) {
      clearTimeout(action.timer);
      action.reject(new Error('Connection interrupted. Try again after reconnecting.'));
    }
    pending.clear();
  };
  function connect() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/party-socket');
    ws.addEventListener('open', () => { delay = 450; change('connection', true); });
    ws.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id !== undefined) {
        const action = pending.get(message.id);
        if (!action) return;
        pending.delete(message.id);
        clearTimeout(action.timer);
        if (message.payload.ok) action.resolve();
        else action.reject(new Error(message.payload.error));
      } else change(message.event, message.payload);
    });
    ws.addEventListener('close', () => {
      if (!enabled) return;
      change('connection', false);
      failAll();
      reconnect = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 5000);
    });
  }
  connect();
  return {
    async send(event, payload) {
      if (ws.readyState !== WebSocket.OPEN) throw new Error('Waiting for the party server.');
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('The room did not respond.')); }, 5000);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, event, payload }));
      });
    },
    close() {
      enabled = false;
      clearTimeout(reconnect);
      failAll();
      ws.close();
    },
  };
}
