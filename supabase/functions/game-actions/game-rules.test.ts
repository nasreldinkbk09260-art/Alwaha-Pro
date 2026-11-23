import assert from 'node:assert/strict';
import { computeMove, initialState, randomCode } from '../_shared/game-rules.ts';

function roomFor(game_id: string, state: any = initialState(game_id)) {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    game_id,
    player1_id: 'player-1',
    player2_id: 'player-2',
    current_turn: 'player-1',
    status: 'playing',
    move_no: 0,
    state
  };
}

Deno.test('room codes use the six-character invite alphabet', () => {
  for (let i = 0; i < 64; i++) assert.match(randomCode(), /^[A-HJ-NP-Z2-9]{6}$/);
});

Deno.test('all three games create valid server-owned initial states', () => {
  const chess = initialState('chess') as any;
  assert.match(chess.fen, /^rnbqkbnr\/pppppppp\/8\/8\/8\/8\/PPPPPPPP\/RNBQKBNR/);
  assert.equal(chess.result, '');

  const ludo = initialState('ludo') as any;
  assert.deepEqual(ludo.pawns, [[-1,-1,-1,-1],[-1,-1,-1,-1]]);
  assert.equal(ludo.dice, null);

  const war = initialState('war') as any;
  const deck = [...war.deck1, ...war.deck2];
  assert.equal(deck.length, 52);
  for (let rank = 2; rank <= 14; rank++) assert.equal(deck.filter((card: number) => card === rank).length, 4);
});

Deno.test('chess accepts legal alternating moves and rejects illegal or out-of-turn moves', () => {
  const room = roomFor('chess');
  const apply = (actor: string, from: string, to: string) => {
    const result = computeMove(room, actor, { type: 'chess_move', from, to });
    room.state = result.state;
    room.current_turn = result.nextTurn;
    room.status = result.status;
    return result;
  };

  const first = apply('player-1', 'e2', 'e4');
  assert.equal(first.nextTurn, 'player-2');
  assert.equal(first.status, 'playing');
  assert.throws(() => computeMove(room, 'player-1', { type: 'chess_move', from: 'd2', to: 'd4' }));
  assert.throws(() => computeMove(room, 'player-2', { type: 'chess_move', from: 'e7', to: 'e4' }));
  const second = apply('player-2', 'e7', 'e5');
  assert.equal(second.nextTurn, 'player-1');
});

Deno.test('chess checkmate closes the game and records the winner', () => {
  const room = roomFor('chess');
  const moves: Array<[string,string,string]> = [
    ['player-1','e2','e4'], ['player-2','e7','e5'],
    ['player-1','f1','c4'], ['player-2','b8','c6'],
    ['player-1','d1','h5'], ['player-2','g8','f6']
  ];
  for (const [actor,from,to] of moves) {
    const result = computeMove(room, actor, { type: 'chess_move', from, to });
    room.state = result.state;
  }
  const mate = computeMove(room, 'player-1', { type: 'chess_move', from: 'h5', to: 'f7' });
  assert.equal(mate.status, 'finished');
  assert.equal(mate.nextTurn, null);
  assert.equal(mate.winnerId, 'player-1');
  assert.match((mate.state as any).result, /كش مات/);
});

Deno.test('Ludo requires a legal pawn move, handles a pass, and detects a winner', () => {
  const room = roomFor('ludo');
  room.state.pawns[0][0] = -1;
  room.state.dice = 6;
  room.state.lastDice = 6;
  const entry = computeMove(room, 'player-1', { type: 'ludo_move', pawn_index: 0 });
  assert.equal((entry.state as any).pawns[0][0], 0);
  assert.equal(entry.nextTurn, 'player-1');

  const blocked = roomFor('ludo', {
    pawns: [[-1,-1,-1,-1],[-1,-1,-1,-1]], dice: 2, lastDice: 2
  });
  assert.throws(() => computeMove(blocked, 'player-1', { type: 'ludo_move', pawn_index: 0 }));
  const pass = computeMove(blocked, 'player-1', { type: 'ludo_pass' });
  assert.equal(pass.nextTurn, 'player-2');
  assert.equal((pass.state as any).dice, null);

  const nearWin = roomFor('ludo', {
    pawns: [[56,57,57,57],[-1,-1,-1,-1]], dice: 1, lastDice: 1
  });
  const win = computeMove(nearWin, 'player-1', { type: 'ludo_move', pawn_index: 0 });
  assert.equal(win.status, 'finished');
  assert.equal(win.nextTurn, null);
  assert.equal(win.winnerId, 'player-1');
  assert.equal((win.state as any).pawns[0][0], 57);
});

Deno.test('War draw conserves all 52 cards and alternates the next turn', () => {
  const room = roomFor('war', {
    deck1: [14, ...Array(25).fill(2)],
    deck2: [3, ...Array(25).fill(4)],
    lastCards: null, rounds: 0
  });
  const result = computeMove(room, 'player-1', { type: 'war_draw' });
  const state = result.state as any;
  assert.equal(state.deck1.length + state.deck2.length, 52);
  assert.equal(state.rounds, 1);
  assert.equal(result.nextTurn, 'player-2');
  assert.equal(result.status, 'playing');
});

Deno.test('War tie performs a bounded war sequence without losing cards', () => {
  const room = roomFor('war', {
    deck1: [10,2,3,4,14, ...Array(21).fill(2)],
    deck2: [10,3,4,5,2, ...Array(21).fill(3)],
    lastCards: null, rounds: 0
  });
  const result = computeMove(room, 'player-1', { type: 'war_draw' });
  const state = result.state as any;
  assert.equal(state.deck1.length + state.deck2.length, 52);
  assert.deepEqual(state.lastCards, [14,2]);
  assert.equal(result.nextTurn, 'player-2');
});

Deno.test('invalid game actors and malformed War decks are rejected', () => {
  const chess = roomFor('chess');
  assert.throws(() => computeMove(chess, 'not-a-player', { type: 'chess_move', from: 'e2', to: 'e4' }));
  const invalidWar = roomFor('war', { deck1: [14], deck2: [2], rounds: 0 });
  assert.throws(() => computeMove(invalidWar, 'player-1', { type: 'war_draw' }));
});
