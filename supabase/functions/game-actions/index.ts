import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { randomCode, initialState, computeMove } from '../_shared/game-rules.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: corsHeaders });
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