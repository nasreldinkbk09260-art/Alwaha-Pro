import fs from 'node:fs';
const fail=m=>{console.error('FAIL: '+m);process.exitCode=1;};
const pass=m=>console.log('PASS: '+m);
const html=fs.readFileSync('index.html','utf8'),games=fs.readFileSync('games.js','utf8'),
  edge=fs.readFileSync('supabase/functions/game-actions/index.ts','utf8'),
  migration=fs.readFileSync('supabase/migrations/20261108100000_server_authoritative_game_actions.sql','utf8'),
  sqlTest=fs.readFileSync('supabase/tests/20261108100000_game_actions_security.sql','utf8'),
  config=fs.readFileSync('supabase/config.toml','utf8'),ci=fs.readFileSync('scripts/ci-validate-supabase-sql.sh','utf8');
const checks=[
 ['game creation moves to a server-generated room and deck',games.includes("alwahaInvokeEdgeFunction('game-actions',{action:'create_room'")&&edge.includes('function shuffledDeck()')&&edge.includes("gameId === 'war'")],
 ['client no longer calls the direct state mutation RPC',!games.includes("rpc/submit_game_move")&&!games.includes('async function submitMove(')],
 ['chess move is validated by server chess.js rules',edge.includes("new Chess(String(room.state?.fen || ''))")&&edge.includes('chess.move({ from: action.from, to: action.to, promotion: \'q\' })')],
 ['ludo dice are generated on the server and legal moves are recomputed',edge.includes("action.type === 'ludo_roll'")&&edge.includes('crypto.getRandomValues(byte)')&&edge.includes('legalLudoPawns(room, seat, die)')],
 ['war draw uses the server-held deck and bounded battle loop',edge.includes("action.type !== 'war_draw'")&&edge.includes('battles < 110')],
 ['edge function verifies the caller JWT and uses service-role server writes',edge.includes('auth.auth.getUser')&&edge.includes('SUPABASE_SERVICE_ROLE_KEY')&&edge.includes("rpc('apply_game_action_result'")],
 ['atomic state RPC locks the room and checks participant, turn and move version',migration.includes('FOR UPDATE')&&migration.includes('p_expected_move_no')&&migration.includes('p_actor_user_id')],
 ['direct authenticated state mutation is revoked; service-only result RPC is granted',migration.includes('REVOKE EXECUTE ON FUNCTION public.submit_game_move')&&migration.includes('TO service_role')],
 ['edge function is JWT protected in Supabase config',/\[functions\.game-actions\]\s*verify_jwt\s*=\s*true/.test(config)],
 ['PostgreSQL CI runs the new game migration and privilege regression test',ci.includes('20261108100000_server_authoritative_game_actions.sql')&&ci.includes('20261108100000_game_actions_security.sql')&&sqlTest.includes('GAME_ACTIONS_SECURITY=PASS')]
];
for(const [name,ok] of checks) ok?pass(name):fail(name);
if(!process.exitCode)console.log('SERVER_AUTHORITATIVE_GAMES_AUDIT=PASS');