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
if(failed){console.error(`SMART_ASSISTANT_RUNTIME=FAIL (${failed})`);process.exit(1);}
console.log('SMART_ASSISTANT_RUNTIME=PASS');
