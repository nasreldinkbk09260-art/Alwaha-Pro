import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { Chess } from 'npm:chess.js@1.4.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: corsHeaders });
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 256) throw new Error('Invalid random range');
  const limit = Math.floor(256 / max) * max;
  const byte = new Uint8Array(1);
  do { crypto.getRandomValues(byte); } while (byte[0] >= limit);
  return byte[0] % max;
}
function randomCode(): string {
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}
function shuffledDeck(): number[] {
  const deck: number[] = [];
  for (let rank = 2; rank <= 14; rank++) for (let suit = 0; suit < 4; suit++) deck.push(rank);
  for (let i = deck.length - 1; i > 0; i--) { const j = randomInt(i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}
function initialState(gameId: string): Record<string, unknown> {
  if (gameId === 'chess') return { fen: new Chess().fen(), lastMove: '', result: '' };
  if (gameId === 'ludo') return { pawns: [[-1,-1,-1,-1],[-1,-1,-1,-1]], dice: null, lastDice: null, message: 'يرمي اللاعب صاحب الدور النرد أولاً.' };
  const deck = shuffledDeck();
  return { deck1: deck.slice(0,26), deck2: deck.slice(26), lastCards: null, rounds: 0, message: 'ابدأ بسحب الورقتين للمقارنة.' };
}
function seatFor(room: any, userId: string): 0 | 1 {
  if (room.player1_id === userId) return 0;
  if (room.player2_id === userId) return 1;
  throw new Error('هذا الحساب ليس لاعباً في الغرفة.');
}
function opponent(room: any, userId: string): string {
  return room.player1_id === userId ? room.player2_id : room.player1_id;
}
function legalLudoPawns(room: any, seat: 0 | 1, die: number): number[] {
  const pawns = room.state?.pawns?.[seat];
  if (!Array.isArray(pawns) || pawns.length !== 4) throw new Error('حالة لعبة ليدو غير صالحة.');
  return pawns.map((pos: number, index: number) => ({ pos, index })).filter((x: any) => Number.isInteger(x.pos) && ((x.pos === -1 && die === 6) || (x.pos >= 0 && x.pos < 57 && x.pos + die <= 57))).map((x: any) => x.index);
}
function computeMove(room: any, actorId: string, action: any) {
  const seat = seatFor(room, actorId);
  if (!action || typeof action.type !== 'string') throw new Error('نوع الحركة غير صالح.');
  if (room.game_id === 'chess') {
    if (action.type !== 'chess_move' || !/^[a-h][1-8]$/.test(String(action.from||'')) || !/^[a-h][1-8]$/.test(String(action.to||''))) throw new Error('حركة الشطرنج غير صالحة.');
    let chess: Chess;
    try { chess = new Chess(String(room.state?.fen || '')); } catch { throw new Error('تعذر تحميل وضع الشطرنج الحالي.'); }
    const expectedColor = seat === 0 ? 'w' : 'b';
    if (chess.turn() !== expectedColor) throw new Error('حالة دور الشطرنج لا تطابق اللاعب الحالي.');
    let move: any;
    try { move = chess.move({ from: action.from, to: action.to, promotion: 'q' }); } catch { move = null; }
    if (!move) throw new Error('هذه النقلة غير قانونية.');
    const finished = chess.isGameOver();
    const mate = chess.isCheckmate();
    const nextTurn = finished ? null : (chess.turn() === 'w' ? room.player1_id : room.player2_id);
    return { state: { fen: chess.fen(), lastMove: move.san, result: finished ? (mate ? 'كش مات' : 'تعادل') : '' }, nextTurn, status: finished ? 'finished' : 'playing', winnerId: mate ? actorId : null };
  }
  if (room.game_id === 'ludo') {
    const state = room.state || {};
    const pawns = state.pawns;
    if (!Array.isArray(pawns) || pawns.length !== 2 || pawns.some((a: any) => !Array.isArray(a) || a.length !== 4 || a.some((p: any) => !Number.isInteger(p) || p < -1 || p > 57))) throw new Error('حالة قطع ليدو غير صالحة.');
    if (action.type === 'ludo_roll') {
      if (state.dice !== null && state.dice !== undefined) throw new Error('لقد رميت النرد بالفعل.');
      const die = randomInt(6) + 1;
      const valid = legalLudoPawns(room, seat, die);
      const next = { ...state, dice: valid.length ? die : null, lastDice: die, message: 'نتيجة النرد ' + die + '.' };
      const nextTurn = valid.length || die === 6 ? actorId : opponent(room, actorId);
      return { state: next, nextTurn, status: 'playing', winnerId: null };
    }
    if (action.type === 'ludo_pass') {
      const die = Number(state.dice);
      if (!Number.isInteger(die) || die < 1 || die > 6 || legalLudoPawns(room, seat, die).length !== 0) throw new Error('لا يمكن إنهاء الدور مع وجود حركة قانونية.');
      const nextTurn = Number(state.lastDice) === 6 ? actorId : opponent(room, actorId);
      return { state: { ...state, dice: null, message: 'لا توجد حركة قانونية.' }, nextTurn, status: 'playing', winnerId: null };
    }
    if (action.type === 'ludo_move') {
      const die = Number(state.dice), index = Number(action.pawn_index);
      if (!Number.isInteger(die) || die < 1 || die > 6 || !Number.isInteger(index) || index < 0 || index > 3) throw new Error('اختر حركة صحيحة بعد رمي النرد.');
      if (!legalLudoPawns(room, seat, die).includes(index)) throw new Error('هذه القطعة لا تملك حركة قانونية.');
      const nextPawns = pawns.map((row: number[]) => [...row]);
      const target = nextPawns[seat][index] === -1 ? 0 : nextPawns[seat][index] + die;
      if (target > 57) throw new Error('تحتاج إلى رقم دقيق للوصول إلى النهاية.');
      nextPawns[seat][index] = target;
      const globalTarget = target <= 51 ? ((seat === 0 ? 0 : 26) + target) % 52 : null;
      if (globalTarget !== null && !new Set([0,8,13,21,26,34,39,47]).has(globalTarget)) {
        const otherSeat = (1 - seat) as 0 | 1;
        nextPawns[otherSeat] = nextPawns[otherSeat].map((pos: number) => pos >= 0 && pos <= 51 && ((otherSeat === 0 ? 0 : 26) + pos) % 52 === globalTarget ? -1 : pos);
      }
      const won = nextPawns[seat].every((pos: number) => pos === 57);
      const nextTurn = won ? null : (die === 6 || target === 57 ? actorId : opponent(room, actorId));
      return { state: { ...state, pawns: nextPawns, dice: null, message: won ? 'وصلت جميع القطع إلى النهاية!' : 'تحركت القطعة ' + (index + 1) + '.' }, nextTurn, status: won ? 'finished' : 'playing', winnerId: won ? actorId : null };
    }
    throw new Error('إجراء ليدو غير مدعوم.');
  }
  if (room.game_id === 'war') {
    if (action.type !== 'war_draw') throw new Error('إجراء حرب الورق غير مدعوم.');
    const d1 = [...(room.state?.deck1 || [])], d2 = [...(room.state?.deck2 || [])];
    if (d1.length + d2.length !== 52 || [...d1,...d2].some((v: number) => !Number.isInteger(v) || v < 2 || v > 14)) throw new Error('حالة أوراق اللعبة غير صالحة.');
    const pot: number[] = []; let last: number[] = [0,0], winner: number | null = null, battles = 0;
    while (d1.length && d2.length && battles < 110) {
      const a = d1.shift()!, b = d2.shift()!; pot.push(a,b); last = [a,b]; battles++;
      if (a !== b) { winner = a > b ? 0 : 1; break; }
      for (let i=0;i<3;i++) { if (d1.length) pot.push(d1.shift()!); if (d2.length) pot.push(d2.shift()!); }
      if (!d1.length || !d2.length) break;
    }
    if (winner === null) winner = d1.length > d2.length ? 0 : d2.length > d1.length ? 1 : null;
    if (winner === 0) d1.push(...pot); else if (winner === 1) d2.push(...pot);
    const done = !d1.length || !d2.length || battles >= 110;
    const next = { deck1:d1, deck2:d2, lastCards:last, rounds:(Number(room.state?.rounds)||0)+1, message:winner===null?'تعادل في الحرب.':'الفائز بهذه الجولة: اللاعب '+(winner===0?'الأول':'الثاني')+' ('+last[winner] +').' };
    if (done) (next as any).result = d1.length === d2.length ? 'تعادل' : 'فاز اللاعب ' + (d1.length > d2.length ? 'الأول' : 'الثاني') + ' بعد نفاد أوراق الخصم.';
    const winnerId = done && d1.length !== d2.length ? (d1.length > d2.length ? room.player1_id : room.player2_id) : null;
    return { state:next, nextTurn:done?null:opponent(room,actorId), status:done?'finished':'playing', winnerId };
  }
  throw new Error('نوع اللعبة غير مدعوم.');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers:corsHeaders });
  if (req.method !== 'POST') return json({ error:'طريقة الطلب غير مدعومة.' },405);
  try {
    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > 12000) return json({error:'حجم الطلب أكبر من المسموح.'},413);
    const authHeader = req.headers.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return json({error:'سجّل الدخول أولاً.'},401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL'), anonKey = Deno.env.get('SUPABASE_ANON_KEY'), serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return json({error:'خدمة الألعاب غير مهيأة على الخادم.'},503);
    const auth = createClient(supabaseUrl,anonKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:authData,error:authError} = await auth.auth.getUser(match[1].trim());
    if (authError || !authData.user) return json({error:'جلسة الدخول غير صالحة.'},401);
    const actor = authData.user.id;
    const server = createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const body = await req.json();
    if (body?.action === 'create_room') {
      const gameId = String(body.game_id || '');
      if (!['chess','ludo','war'].includes(gameId)) return json({error:'نوع اللعبة غير صالح.'},400);
      for (let attempt=0;attempt<5;attempt++) {
        const {data:room,error} = await server.from('game_rooms').insert({room_code:randomCode(),game_id:gameId,created_by:actor,player1_id:actor,current_turn:actor,status:'waiting',state:initialState(gameId),move_no:0}).select('*').single();
        if (!error && room) return json({room});
        if (error?.code !== '23505') return json({error:'تعذر إنشاء الغرفة. تحقق من ترحيلات قاعدة البيانات وحالة الاتصال.'},409);
      }
      return json({error:'تعذر توليد كود غرفة فريد. حاول مرة أخرى.'},503);
    }
    if (body?.action !== 'move') return json({error:'الإجراء غير معروف.'},400);
    const roomId = String(body.room_id || '');
    const expected = Number(body.expected_move_no);
    if (!/^[0-9a-f-]{36}$/i.test(roomId) || !Number.isSafeInteger(expected) || expected < 0) return json({error:'بيانات الغرفة أو رقم الحركة غير صالح.'},400);
    const {data:room,error:roomError} = await server.from('game_rooms').select('*').eq('id',roomId).maybeSingle();
    if (roomError || !room) return json({error:'الغرفة غير موجودة.'},404);
    if (room.move_no !== expected) return json({error:'سبقك لاعب بحركة؛ تتم مزامنة الغرفة الآن.'},409);
    if (room.status !== 'playing' || !room.player2_id || room.current_turn !== actor) return json({error:'ليس دورك أو أن المباراة غير نشطة.'},403);
    if (actor !== room.player1_id && actor !== room.player2_id) return json({error:'هذا الحساب ليس لاعباً في الغرفة.'},403);
    let next;
    try { next = computeMove(room,actor,body.move); } catch (error) { return json({error:error instanceof Error ? error.message : 'الحركة غير قانونية.'},422); }
    const {data:updated,error:updateError} = await server.rpc('apply_game_action_result',{p_room_id:room.id,p_expected_move_no:expected,p_actor_user_id:actor,p_next_state:next.state,p_next_turn:next.nextTurn,p_next_status:next.status,p_winner_id:next.winnerId});
    if (updateError) {
      const conflict = updateError.code === '40001';
      return json({error:conflict?'سبقك لاعب بحركة؛ حدّث الغرفة.':'تعذر حفظ الحركة المعتمدة على الخادم.'},conflict?409:403);
    }
    return json({room:updated});
  } catch (error) {
    console.error('[game-actions] request failed:',error instanceof Error ? error.message : 'unknown');
    return json({error:'تعذر تنفيذ الحركة الآن. حاول بعد تحديث الغرفة.'},500);
  }
});