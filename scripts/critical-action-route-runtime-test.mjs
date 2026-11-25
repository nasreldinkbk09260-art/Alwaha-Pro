import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');

function extractFunction(name){
  const token='function '+name+'(';
  const found=html.indexOf(token);
  assert.ok(found>=0,'source function '+name+' must exist');
  const start=html.slice(Math.max(0,found-6),found)==='async ' ? found-6 : found;
  const next=/\n        (?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\(/g;
  next.lastIndex=found+token.length;
  const match=next.exec(html);
  assert.ok(match,'source boundary after '+name+' must be found');
  return html.slice(start,match.index).trim();
}

function install(name,context){
  const source=extractFunction(name);
  vm.runInContext(source+'\nthis.__testedFunction='+name+';',context,{filename:'index.html:'+name});
  context[name]=context.__testedFunction;
  delete context.__testedFunction;
}

function makeBase(){
  const toasts=[];
  const calls=[];
  const context={
    window:{},
    navigator:{onLine:true},
    console,
    Date,
    JSON,
    Math,
    Set,
    Map,
    Promise,
    encodeURIComponent,
    document:{
      getElementById(){return null;},
      querySelector(){return null;},
      querySelectorAll(){return [];}
    },
    triggerToastNotification:(message,kind)=>toasts.push({message,kind}),
    __toasts:toasts,
    __calls:calls
  };
  vm.createContext(context);
  return context;
}

async function notificationSingleRead(){
  const c=makeBase();
  let badgeRefreshes=0;
  const cards=[
    {dataset:{notificationId:'ci-note-1'},style:{background:'unread'}},
    {dataset:{notificationId:'ci-note-2'},style:{background:'unread'}}
  ];
  c.getCurrentAuthUser=async()=>({id:'ci-user'});
  c.supabaseFetch=async(url,options)=>{c.__calls.push({url,options});return [{id:'ci-note-1'}];};
  c.refreshAlwahaNotificationBadge=()=>{badgeRefreshes++;};
  c.document.querySelectorAll=selector=>selector==='[data-notification-id]'?cards:[];
  install('markSingleNotificationRead',c);
  await c.markSingleNotificationRead('ci-note-1');
  assert.equal(c.__calls.length,1,'one notification read must send exactly one database update');
  assert.match(c.__calls[0].url,/notifications\?id=eq\.ci-note-1&recipient_id=eq\.ci-user&is_read=eq\.false/);
  assert.equal(c.__calls[0].options.method,'PATCH');
  assert.deepEqual(JSON.parse(c.__calls[0].options.body),{is_read:true});
  assert.equal(cards[0].style.background,'transparent','only the selected notification card becomes read');
  assert.equal(cards[1].style.background,'unread','the other notification stays unread');
  assert.equal(badgeRefreshes,1,'the unread badge refreshes after the single read');
  console.log('PASS: reading one notification updates only its own row and visual state');
}

async function friendRequestResponse(){
  const c=makeBase();
  const buttons=[{disabled:false,textContent:'قبول'},{disabled:false,textContent:'رفض'}];
  const related={
    dataset:{friendRequestId:'ci-request-1',notificationId:'ci-note-request-1'},
    querySelectorAll:()=>buttons,
    removed:false,
    remove(){this.removed=true;}
  };
  const unrelated={
    dataset:{friendRequestId:'ci-request-2'},
    querySelectorAll:()=>[],
    removed:false,
    remove(){this.removed=true;}
  };
  let readIds=null,backgroundRefreshes=0,modalSyncs=0;
  c.requireAuthenticatedUser=async()=>({id:'ci-target'});
  c.supabaseFetch=async(url,options)=>{c.__calls.push({url,options});return [{id:'ci-request-1',status:'accepted'}];};
  c.markNotificationsReadSilently=ids=>{readIds=ids;};
  c.loadAllRegisteredUsersList=()=>{backgroundRefreshes++;return new Promise(()=>{});};
  c.window.AlwahaModalShell={sync(){modalSyncs++;}};
  c.document.querySelectorAll=selector=>selector==='[data-friend-request-id]'?[related,unrelated]:[];
  install('respondFriendRequest',c);
  await c.respondFriendRequest('ci-request-1','accepted');
  assert.equal(c.__calls.length,1,'friend response must issue one scoped update');
  assert.match(c.__calls[0].url,/friend_requests\?id=eq\.ci-request-1&target_id=eq\.ci-target&status=eq\.pending/);
  assert.equal(c.__calls[0].options.method,'PATCH');
  assert.deepEqual(JSON.parse(c.__calls[0].options.body),{status:'accepted'});
  assert.equal(related.removed,true,'the processed friend request row is removed immediately');
  assert.equal(unrelated.removed,false,'an unrelated friend request row stays visible');
  assert.deepEqual(readIds,['ci-note-request-1'],'only the corresponding request notification is marked read');
  assert.equal(backgroundRefreshes,1,'the user list refresh is kicked off without being awaited');
  assert.equal(modalSyncs,1,'modal state is synchronized after the row is removed');
  assert.equal(c.__toasts.at(-1).kind,'success');
  console.log('PASS: friend-request accept updates one request and leaves unrelated rows untouched');
}

function setupMarketMessageContext(){
  const c=makeBase();
  const input={value:'مرحباً بالبائع'};
  const button={disabled:false,textContent:'إرسال'};
  const modal={querySelector:()=>button};
  c.currentMarketConversationId='ci-market-conversation';
  c.currentMarketPeerId='ci-seller';
  c.currentMarketReplyTarget=null;
  c.marketReplySchemaAvailable=true;
  c.marketMessageSendInFlight=false;
  c.requireAuthenticatedUser=async()=>({id:'ci-buyer'});
  c.document.getElementById=id=>id==='market-chat-input'?input:id==='market-chat-modal'?modal:null;
  c.supabaseFetch=async(url,options)=>{c.__calls.push({url,options});return [{id:'ci-market-message'}];};
  c.renderMarketReplyPreview=()=>{};
  c.loadMarketMessages=async()=>{};
  c.renderMarketConversationsList=async()=>{};
  return {c,input,button};
}

async function marketMessageSuccessAndFailure(){
  const {c,input,button}=setupMarketMessageContext();
  let friendshipChecks=0;
  c.hasAcceptedAlwahaFriendship=async()=>{friendshipChecks++;return false;};
  install('sendMarketMessage',c);
  await c.sendMarketMessage();
  assert.equal(friendshipChecks,0,'market messaging must not depend on friend status');
  assert.equal(c.__calls.length,1);
  assert.equal(c.__calls[0].url,'market_messages');
  assert.equal(c.__calls[0].options.method,'POST');
  assert.deepEqual(JSON.parse(c.__calls[0].options.body),{
    conversation_id:'ci-market-conversation',
    sender_id:'ci-buyer',
    message:'مرحباً بالبائع'
  });
  assert.equal(input.value,'','successful market send clears only the sent text');
  assert.equal(button.disabled,false);
  assert.equal(button.textContent,'إرسال');
  assert.equal(c.marketMessageSendInFlight,false);
  assert.equal(c.__toasts.at(-1).kind,'success');
  const failed=setupMarketMessageContext();
  failed.c.supabaseFetch=async(url,options)=>{failed.c.__calls.push({url,options});failed.c.__alwahaLastApiError={status:0};return [];};
  install('sendMarketMessage',failed.c);
  await failed.c.sendMarketMessage();
  assert.equal(failed.input.value,'مرحباً بالبائع','failed market send preserves the unsent text');
  assert.equal(failed.button.disabled,false,'failed send releases the button');
  assert.equal(failed.c.marketMessageSendInFlight,false,'failed send releases the single-flight lock');
  assert.equal(failed.c.__toasts.at(-1).kind,'error');
  const empty=setupMarketMessageContext();
  empty.input.value='   ';
  install('sendMarketMessage',empty.c);
  await empty.c.sendMarketMessage();
  assert.equal(empty.c.__calls.length,0,'empty market message must not reach the API');
  assert.equal(empty.c.__toasts.at(-1).kind,'info');
  console.log('PASS: marketplace send success, failure preservation, empty-input guard and no-friendship rule');
}

function setupDirectMessageContext(){
  const c=makeBase();
  const input={value:'رسالة لصديق'};
  const button={
    disabled:false,
    innerHTML:'<i class="fa-solid fa-paper-plane"></i>',
    attributes:{},
    setAttribute(k,v){this.attributes[k]=v;},
    removeAttribute(k){delete this.attributes[k];}
  };
  c.currentChatUserId='ci-friend';
  c.currentDirectReplyTarget=null;
  c.directReplySchemaAvailable=true;
  c.directMessageSendInFlight=false;
  c.requireAuthenticatedUser=async()=>({id:'ci-user'});
  c.hasAcceptedAlwahaFriendship=async id=>{c.__friendshipPeer=id;return true;};
  c.document.getElementById=id=>id==='chat-message-input'?input:null;
  c.document.querySelector=selector=>selector==='#active-chat-box .alwaha-chat-composer button'?button:null;
  c.supabaseFetch=async(url,options)=>{c.__calls.push({url,options});return [{id:'ci-direct-message'}];};
  c.loadDirectMessages=async()=>{};
  c.renderDirectReplyPreview=()=>{};
  return {c,input,button};
}

async function directMessageSuccessAndGuards(){
  const {c,input,button}=setupDirectMessageContext();
  install('sendLiveChatMessageFromUI',c);
  await c.sendLiveChatMessageFromUI();
  assert.equal(c.__friendshipPeer,'ci-friend','friendship is checked for the active chat peer');
  assert.equal(c.__calls.length,1);
  assert.equal(c.__calls[0].url,'messages');
  assert.equal(c.__calls[0].options.method,'POST');
  assert.deepEqual(JSON.parse(c.__calls[0].options.body),{
    sender_id:'ci-user',
    receiver_id:'ci-friend',
    message:'رسالة لصديق'
  });
  assert.equal(input.value,'');
  assert.equal(button.disabled,false);
  assert.equal(button.attributes['aria-busy'],undefined);
  assert.match(button.innerHTML,/fa-paper-plane/,'original send icon is restored after completion');
  assert.equal(c.directMessageSendInFlight,false);
  const denied=setupDirectMessageContext();
  denied.c.hasAcceptedAlwahaFriendship=async()=>false;
  install('sendLiveChatMessageFromUI',denied.c);
  await denied.c.sendLiveChatMessageFromUI();
  assert.equal(denied.c.__calls.length,0,'unaccepted friendship must block direct message insertion');
  assert.equal(denied.input.value,'رسالة لصديق','blocked direct message preserves its text');
  assert.equal(denied.c.__toasts.at(-1).kind,'info');
  const failed=setupDirectMessageContext();
  failed.c.supabaseFetch=async(url,options)=>{failed.c.__calls.push({url,options});failed.c.__alwahaLastApiError={status:403};return null;};
  install('sendLiveChatMessageFromUI',failed.c);
  await failed.c.sendLiveChatMessageFromUI();
  assert.equal(failed.input.value,'رسالة لصديق','failed direct message preserves its text');
  assert.equal(failed.button.disabled,false);
  assert.equal(failed.c.directMessageSendInFlight,false);
  assert.equal(failed.c.__toasts.at(-1).kind,'error');
  console.log('PASS: direct chat send, friendship gate, failure preservation and UI reset');
}

function setupHomePostContext(){
  const c=makeBase();
  const text={value:'منشور تجريبي من فحص الأزرار'};
  const preview={style:{display:'block'},removeAttribute(){}};
  const wrap={style:{display:'block'}};
  const button={
    disabled:false,textContent:'نشر',
    dataset:{},
    setAttribute(k,v){this[k]=v;},
    removeAttribute(k){delete this[k];}
  };
  c.pendingHomePostFile=null;
  c.pendingHomePostDataUrl='';
  c.homePostImageSelectionId=0;
  c.window.__alwahaHomePostInFlight=false;
  c.requireAuthenticatedUser=async()=>({id:'ci-author',user_metadata:{first_name:'مستخدم'}});
  c.getCurrentProfile=async()=>({first_name:'مستخدم',last_name:'تجريبي'});
  c.document.getElementById=id=>({
    'home-post-textarea':text,
    'home-post-image-preview':preview,
    'home-post-image-preview-wrap':wrap,
    'home-post-publish-btn':button
  })[id]||null;
  c.supabaseFetch=async(url,options)=>{c.__calls.push({url,options});return [{id:'ci-post'}];};
  c.uploadFileToStorage=async()=>{throw new Error('image upload is not expected without an image');};
  c.renderHomePostsFeed=()=>{};
  return {c,text,preview,wrap,button};
}

async function homePostSuccessAndFailure(){
  const {c,text,preview,wrap,button}=setupHomePostContext();
  install('publishNewHomePost',c);
  await c.publishNewHomePost();
  assert.equal(c.__calls.length,1);
  assert.equal(c.__calls[0].url,'posts');
  assert.equal(c.__calls[0].options.method,'POST');
  const payload=JSON.parse(c.__calls[0].options.body);
  assert.equal(payload.author_id,'ci-author');
  assert.equal(payload.author_name,'مستخدم تجريبي');
  assert.equal(payload.content,'منشور تجريبي من فحص الأزرار');
  assert.equal(payload.image_url,null);
  assert.equal(text.value,'','successful publish clears the sent draft');
  assert.equal(preview.style.display,'none');
  assert.equal(wrap.style.display,'none');
  assert.equal(button.disabled,false);
  assert.equal(button['aria-busy'],undefined);
  assert.equal(c.window.__alwahaHomePostInFlight,false);
  assert.equal(c.__toasts.at(-1).kind,'success');
  const failed=setupHomePostContext();
  failed.c.supabaseFetch=async(url,options)=>{failed.c.__calls.push({url,options});return null;};
  install('publishNewHomePost',failed.c);
  await failed.c.publishNewHomePost();
  assert.equal(failed.text.value,'منشور تجريبي من فحص الأزرار','failed publishing preserves the draft');
  assert.equal(failed.button.disabled,false);
  assert.equal(failed.c.window.__alwahaHomePostInFlight,false);
  assert.equal(failed.c.__toasts.at(-1).kind,'error');
  const empty=setupHomePostContext();
  empty.text.value='  ';
  install('publishNewHomePost',empty.c);
  await empty.c.publishNewHomePost();
  assert.equal(empty.c.__calls.length,0,'empty post must not reach the API');
  assert.equal(empty.c.__toasts.at(-1).kind,'error');
  console.log('PASS: home post publish, failure draft preservation and empty-content guard');
}

await notificationSingleRead();
await friendRequestResponse();
await marketMessageSuccessAndFailure();
await directMessageSuccessAndGuards();
await homePostSuccessAndFailure();
console.log('CRITICAL_ACTION_ROUTES_RUNTIME=PASS');
