import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const experience=fs.readFileSync('alwaha-experience.js','utf8');
let failures=0;
function check(name,condition){if(condition)console.log('PASS:',name);else{failures++;console.error('FAIL:',name);}}
function section(id,nextId){
  const start=html.indexOf('<section id="'+id+'"');
  const end=nextId?html.indexOf('<section id="'+nextId+'"',start):html.length;
  return start>=0?html.slice(start,end<0?html.length:end):'';
}
const home=section('home-section','market-section');
const requiredHandlers=[
 'shareAlwahaApp','toggleInternalNotificationCenter','promptAppInstallation',
 'previewHomePostImage','publishNewHomePost','clearHomePostImageDraft',
 'renderHomePostsFeed','togglePostLike','openCommentsModal','shareTextContent',
 'editOwnHomePost','deleteOwnHomePost','handleHomePostCardActivation',
 'handleHomePostCardKeydown','openHomePostDetails','closeHomePostDetails',
 'startHomePostEdit','saveEditedHomePost','deleteActiveHomePost',
 'openCommentsForActiveHomePost','closeCommentsModal','submitNewCommentFromModal',
 'loadCommentsForTarget'
];
const declarations=new Set([...html.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)].map(m=>m[1]));
for(const name of requiredHandlers)check('home action resolves to a declared function: '+name,declarations.has(name));

check('home composer provides a labelled text field',home.includes('label for="home-post-textarea"')&&home.includes('maxlength="20000"'));
check('home composer has accessible image picker and removal control',home.includes('aria-label="اختيار صورة للمنشور"')&&home.includes('onclick="clearHomePostImageDraft()"'));
check('home composer has a stable publish button',home.includes('id="home-post-publish-btn"'));
check('image preview is local before upload and validates MIME/type/size',html.includes('reader.readAsDataURL(compressed)')&&html.includes("startsWith('image/')")&&html.includes('compressed.size>8*1024*1024'));
check('image preview ignores stale asynchronous selections',html.includes('homePostImageSelectionId')&&html.includes('selectionId!==homePostImageSelectionId'));
check('removing an image clears the pending file, preview source and wrapper',/function clearHomePostImageDraft\(\)[\s\S]{0,1000}pendingHomePostFile = null;[\s\S]{0,500}preview.removeAttribute\('src'\)[\s\S]{0,250}wrap.style.display = 'none'/.test(html));
check('publish blocks duplicate requests and disables the action',html.includes('window.__alwahaHomePostInFlight=true')&&html.includes("publishButton.disabled=true"));
check('publish retains draft on failed upload or row creation',html.includes('بقيت المسودة الحالية')&&html.includes('if(!imageUrl)return;')&&html.includes('if(!result){'));
check('publish clears text and image only after successful insert',/if\(textEl\)textEl\.value='';[\s\S]{0,350}pendingHomePostFile=null/.test(html));

check('feed request has deadline and a single-flight guard',html.includes("alwahaUiDeadline(supabaseFetch('posts?select=*&order=created_at.desc&limit=100'), 9500, null)")&&html.includes('window.__alwahaHomeFeedInFlight'));
check('feed ignores stale responses and reports errors with retry',html.includes('requestId !== alwahaHomeFeedRequestId')&&html.includes('renderHomeFeedProblem(container)')&&html.includes('onclick="renderHomePostsFeed()"'));
check('post cards have keyboard accessibility',html.includes('tabindex="0" aria-label="منشور')&&html.includes('handleHomePostCardKeydown'));
check('post action taps do not open the post-detail card',html.includes("closest?.('button,a,input,textarea,select,label,[data-post-action]')"));

check('like action prevents duplicate taps per post',html.includes('__alwahaPostLikeLocks')&&html.includes('if(locks.has(postId))return'));
check('like action refuses to mutate when current state lookup fails',html.includes('if(!Array.isArray(existing))')&&html.includes('لم نرسل طلبًا جديدًا لتجنب التكرار'));
check('like action checks auth and reports success/failure',html.includes('requireAuthenticatedUser(\'سجل الدخول أولاً لإضافة إعجاب.\')')&&html.includes('تم تسجيل إعجابك.')&&html.includes('تعذر تحديث الإعجاب.'));

check('sharing uses native API and copies post text plus URL as fallback',html.includes("typeof navigator.share==='function'")&&html.includes("clipboard.writeText(shareText)")&&html.includes('تم نسخ نص المنشور ورابطه للمشاركة.'));
check('share cancellation is silent but real failures are reported',html.includes("error?.name==='AbortError'")&&html.includes('تعذرت المشاركة من هذا الجهاز.'));
check('comments target requests are race-protected',html.includes('commentsLoadRequestId')&&html.includes('requestId!==commentsLoadRequestId'));
check('comments differentiate empty and failed states with retry',html.includes('لا توجد تعليقات بعد. كن أول من يعلّق.')&&html.includes('تعذر تحميل التعليقات')&&html.includes('إعادة المحاولة'));
check('comment send has lock, length limit and loading state',html.includes('if(commentSendInFlight)return')&&html.includes('content.length>3000')&&html.includes("button.textContent='جارٍ الإرسال…'"));
check('comment text is retained after failed send',html.includes('بقي النص في الحقل حتى لا تفقده')&&html.includes("if(input.value.trim()===content)input.value=''"));
check('comments close handler is implemented and cancels stale load',html.includes('function closeCommentsModal()')&&html.includes('commentsLoadRequestId += 1;'));

check('post details ignore stale async lookups',html.includes('const requestId=++homePostDetailsRequestId')&&html.includes('requestId!==homePostDetailsRequestId'));
check('post edit requires the owner and prevents duplicate save',html.includes('homePostEditInFlight')&&html.includes('cached.author_id)!==String(user.id)')&&html.includes('author_id=eq.'));
check('post delete requires ownership, confirmation and duplicate guard',html.includes('homePostDeleteInFlight')&&html.includes('هل تتابع؟')&&html.includes('posts?id=eq.'));
check('notification count is updated from recipient-specific unread rows',html.includes("notifications?recipient_id=eq.")&&html.includes('is_read=eq.false')&&html.includes('refreshAlwahaNotificationBadge'));
check('notifications require a signed-in user before opening the panel',html.includes("const me=await requireAuthenticatedUser('سجّل الدخول أولاً لعرض التنبيهات.')")&&html.indexOf('const me=await requireAuthenticatedUser',html.indexOf('async function toggleInternalNotificationCenter'))<html.indexOf("center.classList.add('alwaha-notifications-open')",html.indexOf('async function toggleInternalNotificationCenter')));
check('closing notifications cancels any older in-flight render',html.includes('notificationRenderRequestId++')&&html.includes("center.style.display='none'"));
check('late notification results cannot reopen a closed panel',html.includes('requestId!==notificationRenderRequestId')&&html.includes("!center.classList.contains('alwaha-notifications-open')"));
check('failed unread-count refresh preserves the last known badge value',html.includes('retaining the last known count')&&html.includes('if(!Array.isArray(rows)){'));

check('install action is only exposed when beforeinstallprompt is available',html.includes("window.addEventListener('beforeinstallprompt'")&&html.includes("(!installed && deferredPrompt)?'inline-flex':'none'"));
check('share/install controls have native Android and web fallbacks',html.includes('window.alwahaAudioRoute?.shareApk')&&html.includes('navigator.share')&&html.includes('deferredPrompt.prompt()'));

if(failures){console.error(`HOME_SECTION_ACCEPTANCE=FAIL (${failures})`);process.exit(1);}
console.log('HOME_SECTION_ACCEPTANCE=PASS');
