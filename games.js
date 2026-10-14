/* Alwaha-Pro 2.8.6: online chess, two-player Ludo, and War (playing cards). */
(() => {
  'use strict';

  const GAME_INFO = {
    chess: { title: 'الشطرنج', icon: '♟️', color: '#70d6ff', description: 'شطرنج بقواعد قانونية كاملة، بما فيها الكش والكش مات والتعادل.' },
    ludo: { title: 'ليدو', icon: '🎲', color: '#00e0a4', description: 'ليدو لشخصين: رمي النرد، إخراج القطع، أكل قطع الخصم والوصول إلى النهاية.' },
    war: { title: 'الكتشينة — حرب الورق', icon: '🂡', color: '#ffd166', description: 'ورق لعب قياسي؛ أعلى ورقة تفوز بالجولة، والتعادل يفعّل الحرب.' }
  };
  const SESSION = { room: null, user: null, timer: null, loading: false, lastRenderKey: '', selectedSquare: null, legalTargets: [], game: null, busy: false };
  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
  const toast = (message, type = 'info') => {
    if (typeof window.triggerToastNotification === 'function') window.triggerToastNotification(message, type);
    else console.info(message);
  };

  function addStyles() {
    if ($('alwaha-games-v283-style')) return;
    const style = document.createElement('style');
    style.id = 'alwaha-games-v283-style';
    style.textContent = `
      .mp-game-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin:12px 0 20px}
      .mp-game-card{border:1px solid #ffffff20;background:linear-gradient(145deg,#142033,#0c111d);border-radius:16px;padding:14px;min-width:0}
      .mp-game-icon{font-size:34px;margin-bottom:7px}.mp-game-title{font-size:16px;color:#fff;font-weight:900}.mp-game-desc{font-size:11px;line-height:1.8;color:#b7c1d1;min-height:43px;margin:7px 0 11px}
      .mp-action{border:0;border-radius:10px;padding:9px 12px;font-family:inherit;font-weight:800;font-size:11px;cursor:pointer;margin:3px;max-width:100%}
      .mp-create{background:#00e0a4;color:#001b15}.mp-join{background:#70d6ff;color:#07151c}.mp-muted{background:#ffffff12;color:#fff;border:1px solid #ffffff25}
      .mp-room-code{font-size:26px;letter-spacing:5px;font-weight:900;color:#ffd166;background:#0005;border:1px dashed #ffd16670;border-radius:12px;padding:9px;text-align:center;user-select:text}
      .mp-room-meta{font-size:11px;color:#d2d9e3;line-height:1.9;margin:8px 0}
      .mp-board-wrap{display:flex;justify-content:center;width:100%;overflow:auto;padding:4px 0 12px}.mp-chess-board{width:min(88vw,352px);aspect-ratio:1;display:grid;grid-template-columns:repeat(8,1fr);border:3px solid #b8c5d5;border-radius:5px;overflow:hidden;flex-shrink:0}
      .mp-chess-square{border:0;border-radius:0;font-size:clamp(22px,7vw,39px);display:flex;align-items:center;justify-content:center;line-height:1;cursor:pointer;position:relative;padding:0;color:#111}
      .mp-chess-light{background:#e8edf3}.mp-chess-dark{background:#5c7a8a}.mp-chess-square.mp-selected{box-shadow:inset 0 0 0 4px #ffd166}.mp-chess-square.mp-target:after{content:'';width:24%;height:24%;border-radius:50%;background:#14b88599;position:absolute}
      .mp-chess-piece-white{color:#fff;text-shadow:-1px -1px 1px #222,1px 1px 2px #222}.mp-chess-piece-black{color:#17202a;text-shadow:0 0 1px #fff}
      .mp-ludo-board{width:min(88vw,360px);height:min(88vw,360px);max-width:360px;max-height:360px;position:relative;margin:auto;border-radius:50%;background:radial-gradient(circle,#1c293c 0 23%,#172132 24% 52%,#0c1320 53%);border:2px solid #32465d;overflow:hidden}
      .mp-ludo-cell{position:absolute;width:5.1%;height:5.1%;border-radius:50%;background:#d7e3ef;border:1px solid #172438;transform:translate(-50%,-50%);padding:0;pointer-events:none}
      .mp-ludo-cell.safe{background:#ffd166}.mp-ludo-piece{position:absolute;transform:translate(-50%,-50%);width:8%;height:8%;min-width:17px;min-height:17px;border:2px solid #fff;border-radius:50%;font-size:10px;font-weight:900;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 5px #0009;padding:0}
      .mp-ludo-piece.p0{background:#ed4f60;color:#fff}.mp-ludo-piece.p1{background:#2788e8;color:#fff}.mp-ludo-piece:disabled{cursor:default;opacity:.85}.mp-ludo-yard{position:absolute;font-size:9px;color:#fff9;font-weight:800}.mp-ludo-center{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:24px;pointer-events:none}
      .mp-war-cards{display:flex;justify-content:center;gap:14px;margin:16px 0}.mp-playing-card{width:92px;height:130px;background:#f5f5ef;border-radius:12px;border:2px solid #d0d4da;color:#222;display:flex;flex-direction:column;justify-content:space-between;padding:8px;font-size:22px;font-weight:900;box-shadow:0 6px 14px #0005}.mp-playing-card .big{font-size:35px;text-align:center}.mp-playing-card.red{color:#c73546}.mp-playing-card.back{background:repeating-linear-gradient(45deg,#1e4e83,#1e4e83 7px,#e0e9f8 7px,#e0e9f8 9px);color:transparent}
      .mp-help{font-size:11px;line-height:1.8;color:#c6d0dc;text-align:center;margin:8px 0}.mp-status{background:#ffffff09;border:1px solid #ffffff16;border-radius:11px;padding:9px;font-size:11px;color:#e3eaf4;text-align:center;margin:8px 0}
      .mp-legacy{margin-top:18px;border-top:1px solid #ffffff18;padding-top:14px}.mp-legacy button{width:100%;text-align:right;background:#ffffff08;color:#fff;border:1px solid #ffffff14;border-radius:10px;padding:10px;font-family:inherit;margin:4px 0;font-size:11px}
      @media(max-width:380px){.mp-game-cards{grid-template-columns:1fr}.mp-playing-card{width:78px;height:112px}}
    `;
    document.head.appendChild(style);
  }

  function normalizeRoom(payload) {
    if (Array.isArray(payload)) return payload[0] || null;
    if (payload && typeof payload === 'object' && payload.room) return normalizeRoom(payload.room);
    return payload && typeof payload === 'object' ? payload : null;
  }
  async function requireUser() {
    if (typeof window.requireAuthenticatedUser === 'function') {
      const user = await window.requireAuthenticatedUser('سجّل الدخول أولاً لاستخدام الألعاب الجماعية.');
      if (user) return user;
      return null;
    }
    const user = typeof window.getCurrentAuthUser === 'function' ? await window.getCurrentAuthUser() : null;
    if (!user) toast('سجّل الدخول أولاً لاستخدام الألعاب الجماعية.', 'error');
    return user || null;
  }
  function initialState(gameId) {
    if (gameId === 'chess') return { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', lastMove: '', result: '' };
    if (gameId === 'ludo') return { pawns: [[-1,-1,-1,-1],[-1,-1,-1,-1]], dice: null, lastDice: null, message: 'يرمي اللاعب صاحب الدور النرد أولاً.' };
    const deck = [];
    for (let rank = 2; rank <= 14; rank++) for (let suit = 0; suit < 4; suit++) deck.push(rank);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    return { deck1: deck.slice(0, 26), deck2: deck.slice(26), lastCards: null, rounds: 0, message: 'ابدأ بسحب الورقتين للمقارنة.' };
  }
  function randomCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    if (window.crypto?.getRandomValues) crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  }
  function roomEndpoint(id) { return `game_rooms?select=*&id=eq.${encodeURIComponent(id)}&limit=1`; }
  async function createRoom(gameId) {
    const user = await requireUser(); if (!user) return;
    if (typeof window.supabaseFetch !== 'function') return toast('الاتصال بقاعدة البيانات غير متاح.', 'error');
    toast('جاري إنشاء الغرفة...', 'info');
    let created = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const code = randomCode();
      const rows = await window.supabaseFetch('game_rooms', {
        method: 'POST',
        body: JSON.stringify({ room_code: code, game_id: gameId, created_by: user.id, player1_id: user.id, current_turn: user.id, status: 'waiting', state: initialState(gameId), move_no: 0 }),
        prefer: 'return=representation'
      });
      if (Array.isArray(rows) && rows[0]) created = rows[0];
      else if (rows && rows.id) created = rows;
      else if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!created) return toast('لم يتم إنشاء الغرفة. تأكد من تطبيق ترحيل قاعدة البيانات وأن جلسة الدخول فعّالة.', 'error');
    SESSION.user = user;
    openRoom(created, user);
    toast('تم إنشاء الغرفة. أرسل الكود للاعب الآخر.', 'success');
  }
  async function joinRoom(gameId) {
    const user = await requireUser(); if (!user) return;
    const code = (window.prompt('أدخل كود الغرفة المكوّن من 6 أحرف أو أرقام:') || '').trim().toUpperCase();
    if (!code) return;
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) return toast('كود الغرفة غير صحيح.', 'error');
    const joined = normalizeRoom(await window.supabaseFetch('rpc/join_game_room', { method: 'POST', body: JSON.stringify({ p_room_code: code, p_expected_game_id: gameId }), prefer: 'return=representation' }));
    if (!joined || !joined.id) return toast('تعذر الانضمام. تحقق من الكود، وأن الغرفة تنتظر لاعباً، وأن ترحيل قاعدة البيانات مطبّق.', 'error');
    if (joined.game_id !== gameId) return toast(`هذا الكود مخصص للعبة ${GAME_INFO[joined.game_id]?.title || joined.game_id}. افتحها من قسم اللعبة الصحيح.`, 'error');
    SESSION.user = user;
    openRoom(joined, user);
  }
  function stopPolling() {
    if (SESSION.timer) clearInterval(SESSION.timer);
    SESSION.timer = null; SESSION.room = null; SESSION.lastRenderKey = ''; SESSION.selectedSquare = null; SESSION.legalTargets = []; SESSION.game = null; SESSION.busy = false;
  }
  function closeRoom() {
    stopPolling();
    const modal = $('alwaha-multiplayer-room'); if (modal) modal.remove();
    document.body.classList.remove('modal-active');
  }
  function openRoom(room, user) {
    stopPolling(); SESSION.room = room; SESSION.user = user;
    addStyles();
    let modal = $('alwaha-multiplayer-room');
    if (modal) modal.remove();
    modal = document.createElement('div'); modal.id = 'alwaha-multiplayer-room'; modal.className = 'game-modal-overlay';
    modal.innerHTML = `<div class="game-modal-card" style="width:min(96vw,480px);max-height:92vh"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h3 id="mp-room-title" style="color:#70d6ff;font-size:16px;margin:0">${esc(GAME_INFO[room.game_id]?.title || 'لعبة جماعية')}</h3><button class="mp-action mp-muted" id="mp-room-close">إغلاق ×</button></div><div id="mp-room-meta" class="mp-room-meta"></div><div id="mp-room-stage"><div class="mp-status">جاري تحميل الغرفة…</div></div><div class="mp-help">تتم مزامنة الغرفة عبر الإنترنت كل ثانيتين. يجب بقاء التطبيق مفتوحاً والاتصال بالإنترنت لدى اللاعبين.</div></div>`;
    document.body.appendChild(modal); document.body.classList.add('modal-active');
    $('mp-room-close').onclick = closeRoom;
    modal.addEventListener('click', ev => { if (ev.target === modal) closeRoom(); });
    renderRoom(room);
    SESSION.timer = setInterval(pollRoom, 1900);
  }
  async function pollRoom() {
    if (!SESSION.room || SESSION.loading || typeof window.supabaseFetch !== 'function') return;
    SESSION.loading = true;
    try {
      const rows = await window.supabaseFetch(roomEndpoint(SESSION.room.id), { method: 'GET', prefer: 'return=representation' });
      const fresh = Array.isArray(rows) ? rows[0] : null;
      if (!fresh || !SESSION.room) return;
      const key = `${fresh.move_no}|${fresh.status}|${fresh.player2_id || ''}|${fresh.current_turn || ''}|${fresh.updated_at || ''}`;
      SESSION.room = fresh;
      if (key !== SESSION.lastRenderKey) renderRoom(fresh);
    } finally { SESSION.loading = false; }
  }
  function mySeat(room = SESSION.room) { return room && room.player1_id === SESSION.user?.id ? 0 : 1; }
  function opponentId(room = SESSION.room) { return mySeat(room) === 0 ? room?.player2_id : room?.player1_id; }
  function isMyTurn(room = SESSION.room) { return !!room && room.status === 'playing' && room.current_turn === SESSION.user?.id; }
  function setRoomMeta(room) {
    const box = $('mp-room-meta'); if (!box) return;
    const seat = mySeat(room);
    const status = room.status === 'waiting' ? 'بانتظار اللاعب الثاني' : room.status === 'finished' ? 'انتهت المباراة' : (isMyTurn(room) ? 'دورك الآن' : 'دور الخصم');
    box.innerHTML = `<div>كود الغرفة</div><div class="mp-room-code">${esc(room.room_code)}</div><div style="text-align:center"><button id="mp-copy-code" class="mp-action mp-muted">نسخ/عرض الكود</button></div><div class="mp-status">${esc(status)}</div><div>أنت: اللاعب ${seat === 0 ? 'الأول' : 'الثاني'} · الخصم: ${room.player2_id ? 'انضم' : 'لم ينضم بعد'}</div><div>رقم الحركة: ${Number(room.move_no) || 0}</div>`;
    const copy = $('mp-copy-code'); if (copy) copy.onclick = async () => {
      try { await navigator.clipboard.writeText(room.room_code); toast('تم نسخ كود الغرفة.', 'success'); }
      catch (_) { window.prompt('انسخ كود الغرفة وشاركه مع خصمك:', room.room_code); }
    };
  }
  function renderRoom(room) {
    if (!$('mp-room-stage')) return;
    SESSION.lastRenderKey = `${room.move_no}|${room.status}|${room.player2_id || ''}|${room.current_turn || ''}|${room.updated_at || ''}`;
    setRoomMeta(room);
    if (room.status === 'waiting') {
      $('mp-room-stage').innerHTML = `<div class="mp-status">تم إنشاء الغرفة بنجاح. شارك الكود مع شخص آخر؛ ستبدأ اللعبة تلقائياً عند انضمامه.</div>`;
      return;
    }
    if (room.status === 'finished') {
      const winner = room.winner_id ? (room.winner_id === room.player1_id ? 'اللاعب الأول' : 'اللاعب الثاني') : 'تعادل';
      $('mp-room-stage').innerHTML = `<div class="mp-status" style="font-size:16px;color:#00e0a4">${winner === 'تعادل' ? 'انتهت المباراة بالتعادل.' : `الفائز: ${winner} 🎉`}</div><div class="mp-help">${esc(room.state?.result || room.state?.message || '')}</div>`;
      return;
    }
    if (!room.player2_id) { $('mp-room-stage').innerHTML = '<div class="mp-status">بانتظار اللاعب الثاني…</div>'; return; }
    if (room.game_id === 'chess') renderChess(room);
    else if (room.game_id === 'ludo') renderLudo(room);
    else if (room.game_id === 'war') renderWar(room);
    else $('mp-room-stage').innerHTML = '<div class="mp-status">نوع اللعبة غير معروف.</div>';
  }
  async function submitMove(nextState, nextTurn, status = 'playing', winnerId = null) {
    const room = SESSION.room;
    if (!room || SESSION.busy || !isMyTurn(room)) return toast('انتظر دورك أو اكتمال المزامنة.', 'info');
    SESSION.busy = true;
    try {
      const payload = await window.supabaseFetch('rpc/submit_game_move', {
        method: 'POST',
        body: JSON.stringify({ p_room_id: room.id, p_expected_move_no: room.move_no, p_next_state: nextState, p_next_turn: nextTurn, p_next_status: status, p_winner_id: winnerId }),
        prefer: 'return=representation'
      });
      const updated = normalizeRoom(payload);
      if (!updated || !updated.id) { toast('لم يتم حفظ الحركة. قد تكون حركة الخصم وصلت قبلك؛ ستتم إعادة المزامنة.', 'error'); await pollRoom(); return; }
      SESSION.room = updated; SESSION.selectedSquare = null; SESSION.legalTargets = []; SESSION.game = null;
      renderRoom(updated);
    } finally { SESSION.busy = false; }
  }
  function otherTurn(room = SESSION.room) { return room.current_turn === room.player1_id ? room.player2_id : room.player1_id; }

  // Chess uses the pinned chess.js 0.13.4 browser build, including legal-move and draw/checkmate validation.
  function createChess(state) {
    if (typeof window.Chess !== 'function') return null;
    try { return new window.Chess(state?.fen || undefined); } catch (_) { return null; }
  }
  function gameOver(game) { return !!(game && ((typeof game.isGameOver === 'function' && game.isGameOver()) || (typeof game.game_over === 'function' && game.game_over()))); }
  function checkmate(game) { return !!(game && ((typeof game.isCheckmate === 'function' && game.isCheckmate()) || (typeof game.in_checkmate === 'function' && game.in_checkmate()))); }
  function chessDraw(game) { return !!(game && ((typeof game.isDraw === 'function' && game.isDraw()) || (typeof game.in_draw === 'function' && game.in_draw()))); }
  function renderChess(room) {
    const game = createChess(room.state); SESSION.game = game;
    if (!game) { $('mp-room-stage').innerHTML = '<div class="mp-status">تعذّر تحميل مكتبة قواعد الشطرنج. أغلق التطبيق وافتحه مع اتصال بالإنترنت.</div>'; return; }
    const seat = mySeat(room), localColor = seat === 0 ? 'w' : 'b';
    const files = 'abcdefgh'; let board = '';
    for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
      let rank = 8 - row, file = files[col];
      if (seat === 1) { rank = row + 1; file = files[7 - col]; }
      const square = `${file}${rank}`; const piece = game.get(square);
      const selected = SESSION.selectedSquare === square;
      const target = SESSION.legalTargets.includes(square);
      const glyphs = { wp:'♙', wn:'♘', wb:'♗', wr:'♖', wq:'♕', wk:'♔', bp:'♟', bn:'♞', bb:'♝', br:'♜', bq:'♛', bk:'♚' };
      const glyph = piece ? glyphs[piece.color + piece.type] : '';
      board += `<button type="button" class="mp-chess-square ${(rank + files.indexOf(file)) % 2 ? 'mp-chess-dark' : 'mp-chess-light'}${selected ? ' mp-selected' : ''}${target ? ' mp-target' : ''}" data-chess-square="${square}" aria-label="${square}" ${!isMyTurn(room) || room.status !== 'playing' ? 'disabled' : ''}><span class="${piece?.color === 'w' ? 'mp-chess-piece-white' : 'mp-chess-piece-black'}">${glyph}</span></button>`;
    }
    const whose = isMyTurn(room) ? 'دورك — اختر قطعة ثم مربع الوجهة.' : `انتظر دور ${room.current_turn === room.player1_id ? 'الأبيض' : 'الأسود'}.`;
    const fenTurn = game.turn() === 'w' ? 'الأبيض' : 'الأسود';
    const checks = gameOver(game) ? 'انتهت المباراة.' : (typeof game.isCheck === 'function' ? (game.isCheck() ? 'كش!' : '') : (typeof game.in_check === 'function' && game.in_check() ? 'كش!' : ''));
    $('mp-room-stage').innerHTML = `<div class="mp-status">${esc(whose)} · الدور في الرقعة: ${fenTurn} ${checks}</div><div class="mp-board-wrap"><div class="mp-chess-board">${board}</div></div><div class="mp-help">أنت تلعب بالقطع ${localColor === 'w' ? 'البيضاء' : 'السوداء'}. الترقية التلقائية للبيدق إلى وزير.</div>${room.state?.lastMove ? `<div class="mp-status">آخر نقلة: ${esc(room.state.lastMove)}</div>` : ''}`;
    $('mp-room-stage').onclick = async (event) => {
      const button = event.target.closest('[data-chess-square]'); if (!button) return;
      const square = button.dataset.chessSquare;
      if (!isMyTurn(SESSION.room)) return toast('ليس دورك الآن.', 'info');
      const current = createChess(SESSION.room.state); if (!current) return;
      if (SESSION.selectedSquare) {
        try {
          const moved = current.move({ from: SESSION.selectedSquare, to: square, promotion: 'q' });
          if (moved) {
            const over = gameOver(current);
            const mate = checkmate(current);
            const winner = over && mate ? (current.turn() === 'w' ? SESSION.room.player2_id : SESSION.room.player1_id) : null;
            const state = { fen: current.fen(), lastMove: moved.san, result: over ? (mate ? 'كش مات' : 'تعادل') : '' };
            const nextTurn = over ? null : (current.turn() === 'w' ? SESSION.room.player1_id : SESSION.room.player2_id);
            await submitMove(state, nextTurn, over ? 'finished' : 'playing', winner); return;
          }
        } catch (_) { /* keep selection so the player can pick a legal destination */ }
      }
      const piece = current.get(square);
      if (piece && piece.color === localColor) {
        SESSION.selectedSquare = square;
        SESSION.legalTargets = current.moves({ square, verbose: true }).map(move => move.to);
        renderChess(SESSION.room);
      } else {
        SESSION.selectedSquare = null; SESSION.legalTargets = []; renderChess(SESSION.room);
      }
    };
  }

  // Two-player Ludo variant: 4 tokens each, roll six to enter, capture on non-safe squares, exact finish required.
  function ludoLegalPawns(room, die) {
    const pawns = room.state?.pawns?.[mySeat(room)] || [];
    return pawns.map((pos, index) => ({ pos, index })).filter(x => (x.pos === -1 && die === 6) || (x.pos >= 0 && x.pos + die <= 57)).map(x => x.index);
  }
  function ludoPoint(globalIndex) {
    const angle = (-90 + globalIndex * (360 / 52)) * Math.PI / 180;
    return { x: 50 + Math.cos(angle) * 39, y: 50 + Math.sin(angle) * 39 };
  }
  function ludoPawnPoint(position, seat, pawnIndex) {
    if (position === -1) {
      const coords = seat === 0 ? [[30,34],[38,34],[30,42],[38,42]] : [[62,58],[70,58],[62,66],[70,66]];
      return { x: coords[pawnIndex][0], y: coords[pawnIndex][1] };
    }
    if (position >= 57) return { x: 50, y: 50 };
    if (position >= 52) return { x: 50, y: 50 + (seat === 0 ? -1 : 1) * (57 - position) * 4.4 };
    return ludoPoint(((seat === 0 ? 0 : 26) + position) % 52);
  }
  function renderLudo(room) {
    const state = room.state || initialState('ludo');
    const legal = state.dice ? ludoLegalPawns(room, state.dice) : [];
    let cells = '';
    const safe = new Set([0,8,13,21,26,34,39,47]);
    for (let i = 0; i < 52; i++) { const p = ludoPoint(i); cells += `<span class="mp-ludo-cell ${safe.has(i) ? 'safe' : ''}" style="left:${p.x}%;top:${p.y}%"></span>`; }
    let pieces = '';
    (state.pawns || [[],[]]).forEach((array, seat) => array.forEach((pos, index) => {
      const p = ludoPawnPoint(Number(pos), seat, index); const clickable = seat === mySeat(room) && isMyTurn(room) && legal.includes(index) && !SESSION.busy;
      pieces += `<button class="mp-ludo-piece p${seat}" style="left:${p.x}%;top:${p.y}%" data-ludo-pawn="${index}" data-ludo-seat="${seat}" ${clickable ? '' : 'disabled'} title="القطعة ${index + 1}">${index + 1}</button>`;
    }));
    const diceHtml = state.dice ? `النرد: 🎲 ${state.dice} — اختر قطعة مضيئة.` : 'اضغط رمي النرد عند حلول دورك.';
    const btn = isMyTurn(room) && state.dice === null ? `<button class="mp-action mp-create" id="mp-ludo-roll">🎲 رمي النرد</button>` : '';
    const pass = isMyTurn(room) && state.dice !== null && legal.length === 0 ? `<button class="mp-action mp-join" id="mp-ludo-pass">لا توجد حركة — إنهاء الدور</button>` : '';
    $('mp-room-stage').innerHTML = `<div class="mp-status">${esc(isMyTurn(room) ? 'دورك.' : 'انتظر دور الخصم.')} ${esc(diceHtml)}</div><div class="mp-ludo-board">${cells}<span class="mp-ludo-center">🏁</span><span class="mp-ludo-yard" style="left:25%;top:24%">الأحمر</span><span class="mp-ludo-yard" style="left:62%;top:69%">الأزرق</span>${pieces}</div><div style="text-align:center;margin:10px">${btn}${pass}</div><div class="mp-help">تحتاج إلى 6 لإخراج القطعة. الحركة النهائية تتطلب رقماً دقيقاً. الأكل يعيد قطعة الخصم إلى قاعدتها.</div>`;
    const roll = $('mp-ludo-roll');
    if (roll) roll.onclick = async () => {
      if (!isMyTurn(room) || SESSION.busy || SESSION.room.state.dice !== null) return;
      const die = 1 + Math.floor(Math.random() * 6);
      const nextState = { ...SESSION.room.state, dice: die, lastDice: die, message: `نتيجة النرد ${die}.` };
      const valid = ludoLegalPawns(SESSION.room, die);
      let nextTurn = SESSION.user.id;
      if (!valid.length) {
        nextState.dice = null;
        if (die !== 6) nextTurn = otherTurn(SESSION.room);
      }
      await submitMove(nextState, nextTurn, 'playing', null);
    };
    const passBtn = $('mp-ludo-pass');
    if (passBtn) passBtn.onclick = async () => { const nextState = { ...SESSION.room.state, dice: null }; await submitMove(nextState, otherTurn(SESSION.room), 'playing', null); };
    $('mp-room-stage').onclick = async (event) => {
      const btn = event.target.closest('[data-ludo-pawn]'); if (!btn || SESSION.busy) return;
      const seat = Number(btn.dataset.ludoSeat), index = Number(btn.dataset.ludoPawn);
      const currentRoom = SESSION.room, currentState = currentRoom?.state;
      if (!currentRoom || seat !== mySeat(currentRoom) || !isMyTurn(currentRoom) || !currentState?.dice) return;
      const legalNow = ludoLegalPawns(currentRoom, currentState.dice); if (!legalNow.includes(index)) return;
      const pawns = currentState.pawns.map(arr => [...arr]);
      let target = pawns[seat][index] === -1 ? 0 : pawns[seat][index] + currentState.dice;
      pawns[seat][index] = target;
      const nextState = { ...currentState, pawns, dice: null, message: `تحركت القطعة ${index + 1}.` };
      const globalTarget = target <= 51 ? ((seat === 0 ? 0 : 26) + target) % 52 : null;
      // Safe-square and capture handling is recomputed without relying on UI input.
      const safeSet = new Set([0,8,13,21,26,34,39,47]);
      if (globalTarget !== null && !safeSet.has(globalTarget)) {
        const opponent = 1 - seat;
        pawns[opponent] = pawns[opponent].map(pos => pos >= 0 && pos <= 51 && ((opponent === 0 ? 0 : 26) + pos) % 52 === globalTarget ? -1 : pos);
        nextState.pawns = pawns;
      }
      const won = pawns[seat].every(pos => pos === 57);
      const nextTurn = won ? null : (currentState.dice === 6 || target === 57 ? SESSION.user.id : otherTurn(currentRoom));
      nextState.message = won ? 'وصلت جميع القطع إلى النهاية!' : nextState.message;
      await submitMove(nextState, nextTurn, won ? 'finished' : 'playing', won ? SESSION.user.id : null);
    };
  }

  // Card game: a 52-card War deck. A tie burns up to three cards, then compares again.
  function rankLabel(value) { return ({11:'J',12:'Q',13:'K',14:'A'})[Number(value)] || String(value); }
  function shuffledDeck() { const d=[]; for(let r=2;r<=14;r++) for(let s=0;s<4;s++) d.push(r); for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];} return d; }
  function renderWar(room) {
    const s = room.state || initialState('war'); const seat = mySeat(room);
    const cards = s.lastCards || [null,null];
    const card = (value, name) => value == null ? `<div class="mp-playing-card back"><span>?</span><span class="big">🂠</span><span>?</span></div>` : `<div class="mp-playing-card ${Number(value) < 11 ? 'red' : ''}"><span>${esc(rankLabel(value))}</span><span class="big">${esc(rankLabel(value))}</span><span style="text-align:right">${esc(name)}</span></div>`;
    const myDeck = seat === 0 ? s.deck1 : s.deck2, oppDeck = seat === 0 ? s.deck2 : s.deck1;
    $('mp-room-stage').innerHTML = `<div class="mp-status">${esc(isMyTurn(room) ? 'دورك: اسحب الورقتين.' : 'انتظر خصمك حتى يسحب الورقتين.')} · الجولة ${Number(s.rounds)||0}</div><div class="mp-war-cards"><div style="text-align:center"><div class="mp-help">أنت · ${myDeck.length} ورقة</div>${card(cards[seat], 'ورقتك')}</div><div style="text-align:center"><div class="mp-help">الخصم · ${oppDeck.length} ورقة</div>${card(cards[1-seat], 'ورقة الخصم')}</div></div><div class="mp-status">${esc(s.message || 'أعلى قيمة تفوز بالجولة. A أعلى ورقة.')}</div><div style="text-align:center">${isMyTurn(room) ? '<button class="mp-action mp-create" id="mp-war-draw">🂠 اسحب الورقتين</button>' : ''}</div><div class="mp-help">قيم الأوراق: 2 إلى 10 ثم J وQ وK وA. عند التعادل تحدث حرب تلقائية بثلاث أوراق مخفية ثم ورقة مقارنة.</div>`;
    const draw = $('mp-war-draw');
    if (draw) draw.onclick = async () => {
      if (!isMyTurn(room) || SESSION.busy) return;
      const d1 = [...SESSION.room.state.deck1], d2 = [...SESSION.room.state.deck2]; let pot=[]; let last=[null,null]; let winner=null; let battles=0;
      while (d1.length && d2.length && battles < 110) {
        const a=d1.shift(), b=d2.shift(); pot.push(a,b); last=[a,b]; battles++;
        if (a !== b) { winner = a > b ? 0 : 1; break; }
        // War: each side places up to three face-down cards, then the next card is compared.
        for (let i=0;i<3;i++) { if(d1.length) pot.push(d1.shift()); if(d2.length) pot.push(d2.shift()); }
        if (!d1.length || !d2.length) break;
      }
      if (winner === null) winner = d1.length > d2.length ? 0 : d2.length > d1.length ? 1 : null;
      if (winner === 0) d1.push(...pot); else if (winner === 1) d2.push(...pot);
      const done = !d1.length || !d2.length || battles >= 110;
      const state = { deck1:d1, deck2:d2, lastCards:last, rounds:(Number(SESSION.room.state.rounds)||0)+1, message: winner === null ? 'تعادل في الحرب.' : `الفائز بهذه الجولة: اللاعب ${winner===0?'الأول':'الثاني'} (${rankLabel(last[winner])}).` };
      if (done) state.result = d1.length === d2.length ? 'تعادل' : `فاز اللاعب ${d1.length > d2.length ? 'الأول' : 'الثاني'} بعد نفاد أوراق الخصم.`;
      const winnerId = done && d1.length !== d2.length ? (d1.length > d2.length ? SESSION.room.player1_id : SESSION.room.player2_id) : null;
      await submitMove(state, done ? null : otherTurn(SESSION.room), done ? 'finished' : 'playing', winnerId);
    };
  }

  function renderGamesSection() {
    addStyles();
    const container = $('games-list-container');
    if (!container) return;
    const cards = Object.entries(GAME_INFO).map(([id, game]) => `<article class="mp-game-card" style="border-color:${game.color}55"><div class="mp-game-icon">${game.icon}</div><div class="mp-game-title">${esc(game.title)}</div><div class="mp-game-desc">${esc(game.description)}</div><button type="button" class="mp-action mp-create" data-mp-create="${id}">إنشاء غرفة</button><button type="button" class="mp-action mp-join" data-mp-join="${id}">الانضمام بكود</button></article>`).join('');
    container.innerHTML = `<div class="mp-help" style="font-size:12px">الألعاب الجماعية أونلاين — أنشئ غرفة وشارك كودها مع صديق على جهاز آخر. يجب أن يكون اللاعبان مسجلين الدخول.</div><div class="mp-game-cards">${cards}</div><div class="mp-status">لا توجد غرف عامة معروضة؛ الانضمام يتم بكود الغرفة لمنع كشف الغرف الخاصة.</div>`;
    container.onclick = (event) => {
      const create = event.target.closest('[data-mp-create]');
      if (create) { createRoom(create.dataset.mpCreate); return; }
      const join = event.target.closest('[data-mp-join]');
      if (join) joinRoom(join.dataset.mpJoin);
    };
  }
  window.renderGamesSection = renderGamesSection;
  // Only multiplayer games are exposed in this release candidate.
  window.launchGameEngine = function(gameTitle) {
    const id = Object.keys(GAME_INFO).find(key => GAME_INFO[key].title === gameTitle);
    if (id) return createRoom(id);
    return toast('اختر لعبة جماعية من قسم الألعاب.', 'info');
  };
  window.closeAlwahaGameRoom = closeRoom;
  document.addEventListener('DOMContentLoaded', () => {
    const section = $('games-section');
    if (section && section.classList.contains('active-section')) renderGamesSection();
  });
})();
