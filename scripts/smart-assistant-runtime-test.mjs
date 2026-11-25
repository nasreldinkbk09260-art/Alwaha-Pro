import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('alwaha-smart-assistant.js','utf8');
const sandbox={
  window:{addEventListener(){}},
  document:{readyState:'loading',addEventListener(){}},
  navigator:{onLine:true},
  localStorage:{getItem(){return ''}}
};
vm.runInNewContext(source,sandbox,{filename:'alwaha-smart-assistant.js'});
const choose=sandbox.window.AlwahaSmartAssistant?.chooseSuggestion;
let failed=0;
function check(name,condition){if(condition)console.log('PASS:',name);else{failed++;console.error('FAIL:',name);}}
check('context suggestion selector is available without browser services',typeof choose==='function');
if(typeof choose==='function'){
  const offline=choose({online:false,hasDraft:true,unreadCount:9});
  check('offline state takes priority and offers saved-feed action',offline.key==='offline'&&offline.action==='feed');
  const draft=choose({online:true,hasDraft:true,unreadCount:9});
  check('unsaved draft takes priority over unread notifications',draft.key==='draft'&&draft.action==='draft');
  const notices=choose({online:true,hasDraft:false,unreadCount:3,profileComplete:true});
  check('unread notifications produce an action to open the notification center',notices.key==='notifications'&&notices.action==='notifications');
  const profile=choose({online:true,hasDraft:false,unreadCount:0,profileComplete:false});
  check('incomplete local profile produces a profile action',profile.key==='profile'&&profile.action==='profile');
  const discover=choose({online:true,hasDraft:false,unreadCount:0,profileComplete:true});
  check('normal state offers a real market navigation action',discover.key==='discover'&&discover.action==='market');
}
check('assistant source does not call network APIs or Supabase',!source.includes('fetch(')&&!source.includes('SUPABASE')&&!source.includes('functions.invoke'));
check('assistant explicitly operates from local UI state and device connectivity',source.includes('navigator.onLine')&&source.includes('home-post-textarea')&&source.includes('notification-badge-home'));

const routedNodes={
  'alwaha-smart-assistant':{dataset:{},querySelector(){return routedTitle;}},
  'alwaha-smart-assistant-message':{textContent:''},
  'alwaha-smart-assistant-action':{
    dataset:{action:'market'},textContent:'',
    addEventListener(type,handler){if(type==='click')routedClick=handler;}
  },
  'home-post-textarea':{
    value:'',addEventListener(){},
    closest(){return routedComposer;},
    scrollIntoView(){routedTrace.push('draft-scroll');},
    focus(){routedTrace.push('draft-focus');}
  },
  'home-post-image-preview':{style:{display:'none'},getAttribute(){return null;}},
  'home-posts-feed-container':{scrollIntoView(){routedTrace.push('feed-scroll');}},
  'notification-badge-home':{textContent:'0'}
};
const routedTrace=[];
const routedTitle={textContent:''};
let routedClick=null,profileClicks=0,marketClicks=0,notificationOpens=0,feedRefreshes=0;
const routedSandbox={
  window:{
    addEventListener(){},
    renderHomePostsFeed(){feedRefreshes++;},
    toggleInternalNotificationCenter(){notificationOpens++;}
  },
  document:{
    readyState:'complete',body:{},
    getElementById(id){return routedNodes[id]||null;},
    querySelector(selector){
      if(selector==='.nav-item.profile-me')return {click(){profileClicks++;}};
      if(selector==='.nav-item.market-center')return {click(){marketClicks++;}};
      return null;
    }
  },
  navigator:{onLine:true},
  localStorage:{getItem(){return '';}}
};
vm.runInNewContext(source,routedSandbox,{filename:'alwaha-smart-assistant.js:action-routing'});
check('assistant initializes an actual click listener for its main action',typeof routedClick==='function');
if(typeof routedClick==='function'){
  const action=routedNodes['alwaha-smart-assistant-action'];
  action.dataset.action='market';routedClick();
  check('assistant market action opens the market navigation item',marketClicks===1);
  action.dataset.action='profile';routedClick();
  check('assistant profile action opens the profile navigation item',profileClicks===1);
  action.dataset.action='notifications';routedClick();
  check('assistant notifications action opens the notification center',notificationOpens===1);
  action.dataset.action='feed';routedClick();
  check('assistant saved-feed action scrolls to the feed and triggers refresh',feedRefreshes===1&&routedTrace.includes('feed-scroll'));
  action.dataset.action='draft';routedClick();
  check('assistant draft action scrolls to and focuses the composer',routedTrace.includes('draft-composer-scroll')&&routedTrace.includes('draft-focus'));
}

if(failed){console.error(`SMART_ASSISTANT_RUNTIME=FAIL (${failed})`);process.exit(1);}
console.log('SMART_ASSISTANT_RUNTIME=PASS');
