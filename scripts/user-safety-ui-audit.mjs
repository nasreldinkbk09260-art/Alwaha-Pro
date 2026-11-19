import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html'),kids=read('alwaha-kids-room.js'),api=read('supabase/functions/user-safety/index.ts'),adminApi=read('supabase/functions/admin-api/index.ts'),adminHtml=read('admin-app/index.html'),migration=read('supabase/migrations/20261114230000_user_safety_reports_and_blocks.sql'),childMigration=read('supabase/migrations/20261117170000_child_safety_urgent_reports.sql'),config=read('supabase/config.toml');
let checks=0,failed=0;
function check(name,ok){checks++;if(ok)console.log('PASS: '+name);else{failed++;console.error('FAIL: '+name)}}
check('user safety client uses authenticated Edge Function',html.includes("functions.invoke('user-safety'")&&html.includes('callAlwahaUserSafety'));
check('report flow accepts only user/post/reel/comment targets',html.includes("['user','post','reel','comment']")&&html.includes('submitAlwahaContentReport'));
check('public profile provides report, block and unblock controls',html.includes("reportAlwahaContent(\\'user\\'")&&html.includes('setAlwahaUserBlock')&&html.includes('blockedMe'));
check('blocked profiles hide friend, follow and direct-message controls',html.includes('interactionBlocked')&&html.includes('safeFriend')&&html.includes('safeFollow')&&html.includes('safeMessage'));
check('home post reports do not remove or replace the share action',html.includes("reportAlwahaContent(\\'post\\'")&&html.includes('shareTextContent('));
check('reels provide report action',html.includes("reportAlwahaContent(\\'reel\\'"));
check('comments provide report action for other users',html.includes("reportAlwahaContent(\\'comment\\'")&&html.includes('commentsViewer'));
check('safety Edge Function validates token server-side and uses fixed actions',api.includes('auth.getUser(tokenMatch[1].trim())')&&api.includes('report_content')&&api.includes('block_user')&&api.includes('unblock_user')&&config.includes('[functions.user-safety]'));
check('report service limits daily volume and duplicate open reports',api.includes('86400000')&&api.includes('>= 10')&&api.includes('duplicate'));
check('block service removes relationships but retains direct and marketplace messages',api.includes("from('friend_requests').delete()")&&api.includes("from('follows').delete()")&&!api.includes("from('messages').delete()")&&!api.includes("from('market_transactions').delete()"));
check('database safety tables have RLS and deny direct client table access',migration.includes('ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY')&&migration.includes('ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY')&&migration.includes('REVOKE ALL ON TABLE public.content_reports FROM PUBLIC,anon,authenticated'));
check('database block policies protect communication and content interaction',migration.includes('messages_insert_sender_accepted_friends')&&migration.includes('market_messages_insert_participant')&&migration.includes('friend_requests_insert_requester')&&migration.includes('can_interact_with_content'));
check('admin API restricts report queue and review to is_admin with audit',adminApi.includes('list_content_reports')&&adminApi.includes('review_content_report')&&adminApi.includes('if (!profile?.is_admin)')&&adminApi.includes('finishAudit'));
check('admin dashboard contains review queue and status filters',adminHtml.includes('reportsPane')&&adminHtml.includes('list_content_reports')&&adminHtml.includes('review_content_report')&&adminHtml.includes('reportStatus'));
check('admin dashboard never deletes report targets automatically',!adminHtml.includes("delete_content_report")&&!adminHtml.includes("deleteReportedContent"));
check('child safety report reason is accepted by the authenticated safety API',api.includes("'child_safety'")&&html.includes('child_safety'));
check('child safety reports receive urgent priority in database and admin queue',api.includes("priority:reason==='child_safety'?100:0")&&adminApi.includes(".order('priority', { ascending: false })")&&adminHtml.includes('أولوية عاجلة'));
check('child safety database migration allows dedicated reason and indexed priority',childMigration.includes("'child_safety'")&&childMigration.includes('priority DESC, created_at ASC'));
check('Kids Room retains parent emergency exit and requires decoded remote video before entry',kids.includes('kids-parent-exit')&&kids.includes("overlay.querySelector('#kids-parent-exit')")&&kids.includes('window.isAlwahaRemoteVideoReady()')&&kids.includes('وضع الأطفال متاح بعد اتصال الفيديو ووصول بث الطرف الآخر.')&&html.includes('function openVideoCallModeChooser()')&&html.includes('data-video-call-mode="normal"')&&html.includes('data-video-call-mode="kids"')&&html.includes('onclick="toggleAlwahaKidsMode()"')&&html.includes("currentState === 'connected' && isAlwahaRemoteVideoReady()")&&html.includes('video.readyState >= 2'));

check('public child safety policy is linked from official site',read('official-site/child-safety.html').includes('CSAM')&&read('official-site/index.html').includes('./child-safety.html'));
check('terms explicitly prohibit CSAE and CSAM and grooming',read('official-site/terms.html').includes('CSAE/CSAM')&&read('official-site/terms.html').includes('استدراج'));
check('child mode remains restricted until the remote video track is live and decoded',read('alwaha-kids-room.js').includes('window.isAlwahaRemoteVideoReady()')&&read('alwaha-kids-room.js').includes('وضع الأطفال متاح بعد اتصال الفيديو ووصول بث الطرف الآخر.'));
check('games, Kids Room and marketplace calls are exposed with correct account/call guards',!read('official-site/terms.html').includes('الألعاب مغلقة')&&read('official-site/terms.html').includes('الشطرنج وليدو وحرب الورق')&&html.includes("onclick=\"showSection('games-section', this)\"")&&html.includes('data-video-call-mode=\"kids\"')&&html.includes('aria-label=\"اتصال صوتي موثق بالبائع\"')&&!html.includes('اتصال صوتي بالبائع — قريبًا'));
check('public terms correctly label local network as discovery-only and not data transport',read('official-site/terms.html').includes('لا يتيح هذا الإصدار بعد اقترانًا موثوقًا')&&read('official-site/terms.html').includes('إرسال رسائل أو ملفات أو مكالمات عبر الشبكة المحلية'));

console.log('USER_SAFETY_UI_AUDIT='+(failed?'FAIL':'PASS')+' ('+checks+' checks)');
if(failed)process.exit(1);
