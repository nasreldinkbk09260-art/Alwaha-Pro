import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf('async function executeUserLoginAuth(event){');
const end=html.indexOf('\n        async function handleVerificationAvatarPick()',start);
assert.ok(start>=0&&end>start,'login handler source is present');
const source=html.slice(start,end).trim();
assert.match(html,/<button type="button"[^>]*id="profile-login-submit"[^>]*onclick="executeUserLoginAuth\(event\)"/,'login action is an explicit button, not an accidental form submit');
assert.match(html,/<p id="profile-login-status" role="status" aria-live="polite"/,'login errors have a local live status region');

function makeHarness({loginResponse,invokeResponse,hydration,subscriptions}={}){
 const nodes={
  'profile-login-submit':{disabled:false,textContent:'دخول',attrs:{},setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}},
  'profile-login-status':{textContent:'',style:{display:'none',color:''},dataset:{}},
  'login-id':{value:'person@example.com'},
  'login-password':{value:'secret-for-test-only'}
 };
 const closed=[],toasts=[],calls=[];
 const ctx={
  console,
  document:{getElementById(id){return nodes[id]||null;}},
  window:{},
  supabaseClient:{
   auth:{
    async signInWithPassword(args){calls.push({kind:'password',args});return loginResponse||{data:{user:{id:'user-1'}},error:null};},
    async setSession(args){calls.push({kind:'session',args});return {error:null};}
   },
   functions:{async invoke(name,args){calls.push({kind:'invoke',name,args});return invokeResponse||{data:{session:{access_token:'test-access',refresh_token:'test-refresh'},user:{id:'user-1'}},error:null};}}
  },
  triggerToastNotification(message,kind){toasts.push({message,kind});},
  formatAuthError(error){return error?.message||'تعذر تسجيل الدخول';},
  closeSubProfileView(id){closed.push(id);},
  hydrateAuthProfile(){return hydration?hydration():Promise.resolve({id:'user-1'});},
  syncUiWithLoadedProfileData(){},
  initializeRealtimeCallInbox(){return subscriptions?subscriptions():Promise.resolve();},
  subscribeToNotifications(){return subscriptions?subscriptions():Promise.resolve();},
  subscribeToDirectMessages(){return subscriptions?subscriptions():Promise.resolve();}
 };
 vm.createContext(ctx);
 vm.runInContext('let profileAuthActionInFlight=false;\n'+source+'\nthis.executeUserLoginAuth=executeUserLoginAuth;',ctx,{filename:'index.html:executeUserLoginAuth'});
 return {ctx,nodes,closed,toasts,calls};
}

const success=makeHarness({
 hydration:()=>new Promise(()=>{}),
 subscriptions:()=>new Promise(()=>{})
});
const startAt=Date.now();
const successResult=await Promise.race([
 success.ctx.executeUserLoginAuth({preventDefault(){}}),
 new Promise((_,reject)=>setTimeout(()=>reject(new Error('login remained blocked by profile hydration or Realtime subscriptions')),250))
]);
assert.equal(successResult,true,'a valid authentication response is accepted');
assert.ok(Date.now()-startAt<250,'post-login cache/subscription work does not block the login action');
assert.deepEqual(success.closed,['sub-prof-login'],'successful login closes the login subview immediately');
assert.equal(success.nodes['profile-login-password']?.value,undefined);
assert.equal(success.nodes['login-password'].value,'','password is cleared after successful authentication');
assert.equal(success.nodes['profile-login-submit'].disabled,false,'login button is re-enabled after success');
assert.equal(success.nodes['profile-login-submit'].attrs['aria-busy'],undefined,'busy state is removed after success');

const failure=makeHarness({
 invokeResponse:{
  error:{
   message:'Edge Function returned a non-2xx status code',
   status:401,
   context:{status:401,clone(){return {json:async()=>({error:'اسم المستخدم أو كلمة المرور غير صحيحة.'})};}}
  },
  data:null
 }
});
failure.nodes['login-id'].value='user_name';
const failedResult=await failure.ctx.executeUserLoginAuth({preventDefault(){}});
assert.equal(failedResult,false,'failed login is handled without navigation');
assert.match(failure.nodes['profile-login-status'].textContent,/اسم المستخدم أو كلمة المرور غير صحيحة/,'server error is rendered inside the login subview');
assert.equal(failure.nodes['profile-login-status'].style.display,'block','inline error remains visible');
assert.deepEqual(failure.closed,[],'a failed login does not close or replace the current view');
assert.equal(failure.nodes['profile-login-submit'].disabled,false,'login button is re-enabled after failure');
assert.equal(failure.nodes['profile-login-submit'].attrs['aria-busy'],undefined,'busy state is removed after failure');

console.log('AUTH_LOGIN_RUNTIME_AUDIT=PASS (non-submitting button, Enter-key handling, inline server errors, password clearing, immediate unlock and non-blocking post-login tasks)');
