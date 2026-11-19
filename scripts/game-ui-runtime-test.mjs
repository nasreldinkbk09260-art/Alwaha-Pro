import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('games.js', 'utf8');
function extract(start, end) {
  const a = source.indexOf(start);
  if (a < 0) throw new Error('Missing source function: ' + start);
  const b = source.indexOf(end, a + start.length);
  if (b <= a) throw new Error('Missing end marker for: ' + start);
  return source.slice(a, b).trim();
}

const definitions = [
  extract('function normalizeRoom(payload)', 'async function requireUser()'),
  extract('function roomEndpoint(id)', 'function getLastRoomId()'),
  extract('async function createRoom(', 'function parseGameQrPayload('),
  extract('function parseGameQrPayload(', 'function showJoinCodeForm('),
  extract('async function joinRoom(', 'function stopPolling()'),
  extract('async function resumeLastRoom(', 'function beginRoomAction(')
];

const user = { id: 'user-one' };
const opened = [];
const toasts = [];
const edgeCalls = [];
const restCalls = [];
let currentUser = user;
let lastRoomId = '11111111-1111-4111-8111-111111111111';
let activeActions = 0;
let releasedActions = 0;
const window = {};
const context = vm.createContext({
  console,
  GAME_INFO: {
    chess: { title: 'الشطرنج' },
    ludo: { title: 'ليدو' },
    war: { title: 'حرب الورق' }
  },
  SESSION: { roomActionBusy: false, room: null, user: null },
  window,
  currentUser,
  toast: (message, kind) => toasts.push({ message: String(message), kind: kind || '' }),
  requireUser: async () => currentUser,
  beginRoomAction: () => {
    activeActions++;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      activeActions--;
      releasedActions++;
    };
  },
  openRoom: (room, account) => opened.push({ room, user: account }),
  closeJoinCodeForm: () => {},
  getLastRoomId: () => lastRoomId,
  clearLastRoom: () => { lastRoomId = ''; },
  updateResumeRoomControl: () => {}
});

vm.runInContext(
  definitions.join('\n\n') +
  '\n;globalThis.__gameUi = { normalizeRoom, roomEndpoint, createRoom, parseGameQrPayload, joinRoom, resumeLastRoom };',
  context,
  { timeout: 5000 }
);
const api = context.__gameUi;
let assertions = 0;
function check(condition, label) {
  assertions++;
  assert.ok(condition, label);
  console.log('PASS: ' + label);
}
function equal(actual, expected, label) {
  assertions++;
  assert.equal(actual, expected, label);
  console.log('PASS: ' + label);
}
function jsonEqual(actual, expected, label) {
  assertions++;
  assert.equal(JSON.stringify(actual), JSON.stringify(expected), label);
  console.log('PASS: ' + label);
}

jsonEqual(api.parseGameQrPayload('ALWAHA-GAME|1|ludo|A2BCDE'), { gameId: 'ludo', code: 'A2BCDE' }, 'valid Ludo QR payload routes to the matching game and room code');
equal(api.parseGameQrPayload('ALWAHA-GAME|1|chess|A0BCDE'), null, 'QR payload rejects ambiguous or unsupported room-code characters');
equal(api.parseGameQrPayload('ALWAHA-GAME|2|chess|A2BCDE'), null, 'QR payload rejects unsupported protocol versions');
check(api.normalizeRoom([{ id: 'room-array' }]).id === 'room-array', 'room normalizer accepts a one-row REST response');
check(api.normalizeRoom({ room: { id: 'room-wrapper' } }).id === 'room-wrapper', 'room normalizer accepts the Edge Function response wrapper');
equal(api.roomEndpoint('room id'), 'game_rooms?select=*&id=eq.room%20id&limit=1', 'room restoration uses an encoded exact room identifier');

for (const gameId of ['chess', 'ludo', 'war']) {
  window.alwahaInvokeEdgeFunction = async (name, payload) => {
    edgeCalls.push({ name, payload });
    return { room: { id: 'created-' + gameId, game_id: gameId, player1_id: user.id } };
  };
  const before = opened.length;
  await api.createRoom(gameId, null);
  equal(opened.length, before + 1, gameId + ' create opens the server-confirmed room');
  equal(edgeCalls.at(-1).name, 'game-actions', gameId + ' create uses the authenticated game Edge Function');
  equal(edgeCalls.at(-1).payload.action, 'create_room', gameId + ' create requests a server-generated room');
  equal(edgeCalls.at(-1).payload.game_id, gameId, gameId + ' create preserves the selected game identifier');
}

const openedBeforeInvalidCreate = opened.length;
window.alwahaInvokeEdgeFunction = async () => ({ room: { id: 'wrong-room', game_id: 'war', player1_id: 'other-user' } });
await api.createRoom('chess', null);
equal(opened.length, openedBeforeInvalidCreate, 'create refuses a room whose game or owner does not match the signed-in user');
check(toasts.some(item => item.kind === 'error'), 'rejected create response is surfaced as an error');

const beforeInvalidJoinCalls = restCalls.length;
window.supabaseFetch = async (...args) => { restCalls.push(args); return null; };
await api.joinRoom('chess', null, 'bad');
equal(restCalls.length, beforeInvalidJoinCalls, 'invalid manual room code is rejected before any server request');

for (const gameId of ['chess', 'ludo', 'war']) {
  window.supabaseFetch = async (path, options) => {
    restCalls.push({ path, options });
    return { id: 'joined-' + gameId, game_id: gameId, player1_id: 'host-user', player2_id: user.id };
  };
  const before = opened.length;
  await api.joinRoom(gameId, null, ' a2bcde ');
  equal(opened.length, before + 1, gameId + ' manual join opens only the server-confirmed room');
  const request = restCalls.at(-1);
  equal(request.path, 'rpc/join_game_room', gameId + ' join uses the authenticated join RPC');
  const body = JSON.parse(request.options.body);
  equal(body.p_room_code, 'A2BCDE', gameId + ' join normalizes lowercase and whitespace in the room code');
  equal(body.p_expected_game_id, gameId, gameId + ' join binds the invite to the selected game');
}

const openedBeforeWrongJoin = opened.length;
window.supabaseFetch = async () => ({ id: 'wrong-game', game_id: 'ludo', player1_id: 'host-user', player2_id: user.id });
await api.joinRoom('chess', null, 'A2BCDE');
equal(opened.length, openedBeforeWrongJoin, 'join refuses a room whose server game does not match the selected game');

window.supabaseFetch = async () => ({ id: 'outsider-room', game_id: 'chess', player1_id: 'host-user', player2_id: 'third-user' });
await api.joinRoom('chess', null, 'A2BCDE');
equal(opened.length, openedBeforeWrongJoin, 'join refuses a room when the signed-in user is not a participant');

lastRoomId = '11111111-1111-4111-8111-111111111111';
window.supabaseFetch = async (path) => {
  restCalls.push({ path, restore: true });
  return [{ id: lastRoomId, game_id: 'war', player1_id: 'host-user', player2_id: user.id }];
};
const beforeResume = opened.length;
await api.resumeLastRoom(null);
equal(opened.length, beforeResume + 1, 'restore re-fetches and opens a saved room for its authenticated participant');
check(restCalls.at(-1).restore === true, 'restore reads the saved room from the server instead of trusting local state');

lastRoomId = '22222222-2222-4222-8222-222222222222';
window.supabaseFetch = async () => [{ id: lastRoomId, game_id: 'chess', player1_id: 'other-user', player2_id: 'third-user' }];
const beforeUnauthorizedRestore = opened.length;
await api.resumeLastRoom(null);
equal(opened.length, beforeUnauthorizedRestore, 'restore refuses a saved room belonging to another account');
equal(lastRoomId, '', 'restore clears a stale local reference when the signed-in user is not a participant');

lastRoomId = '33333333-3333-4333-8333-333333333333';
window.supabaseFetch = async () => [];
const beforeMissingRestore = opened.length;
await api.resumeLastRoom(null);
equal(opened.length, beforeMissingRestore, 'restore does not open a room that no longer exists');
equal(lastRoomId, '', 'restore clears a reference to a room that no longer exists');

equal(activeActions, 0, 'all started create, join and restore actions release their single-flight lock');
check(releasedActions >= 10, 'success and rejected server responses release action controls in finally');
console.log('GAME_UI_RUNTIME_PASS: create, manual join, QR payload, restore and participant guards (' + assertions + ' assertions)');
