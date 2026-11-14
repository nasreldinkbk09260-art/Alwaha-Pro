import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('index.html','utf8');
const fail=message=>{throw new Error(message)};
const pass=message=>console.log('PASS:',message);

function extract(startText,endText){
  const start=html.indexOf(startText);
  if(start<0)fail('Missing source block: '+startText);
  const end=html.indexOf(endText,start);
  if(end<0)fail('Missing source end: '+endText);
  return html.slice(start,end+endText.length);
}

const navCode=extract('function navigateBack() {','window.navigateBack = navigateBack;');
const dispatchCode=extract('let lastAlwahaBackAt = 0;','window.dispatchAlwahaBack = dispatchAlwahaBack;');
const popStart=html.indexOf('function handlePopState() {');
const popEnd=html.indexOf('\n        }\n        function syncUiWithLoadedProfileData',popStart);
if(popStart<0||popEnd<0)fail('Could not isolate the complete popstate handler.');
const popCode=html.slice(popStart,popEnd+'\\n        }'.length);

function makeHarness({exitVisible=false,layers=[]}={}){
  let lockSyncs=0,modalSyncs=0,closedExit=0,backDispatches=0;
  const exit={visible:exitVisible,style:{display:exitVisible?'flex':'none'},setAttribute(){}};
  const empty={visible:false,style:{display:'none'},setAttribute(){},classList:{remove(){}}};
  const document={
    body:{classList:{remove(){},add(){},toggle(){}}},
    getElementById(id){
      if(id==='exit-modal-confirmation')return exit;
      return null;
    },
    querySelectorAll(selector){
      if(selector==='.sub-profile-view-box'||selector==='.chat-tab-content')return [];
      if(selector.includes('#internal-notification-center')&&selector.includes('.game-modal-overlay'))return layers;
      return [];
    },
    querySelector(){return null;}
  };
  const window={alwahaSectionHistory:[],AlwahaModalShell:{sync(){modalSyncs++;}}};
  const context={
    window,document,
    history:{state:{},pushState(state){this.state=state;},replaceState(state){this.state=state;}},
    location:{href:'https://alwaha.test/'},
    getComputedStyle(el){return {zIndex:String(el.zIndex||0)};},
    alwahaIsVisible(el){return !!el&&!!el.visible;},
    closeExitConfirmationModal(){closedExit++;exit.visible=false;},
    closeMarketActionForm(){},
    closeSubProfileView(){},
    closeHomePostDetails(){},
    closeCommentsModal(){},
    closeProfessionalCameraView(){},
    terminateVoiceCall(){},
    closeMarketConversationChat(){},
    closeMarketConversationsPage(){},
    syncAlwahaModalBodyLock(){lockSyncs++;},
    showExitConfirmationModal(){},
    console
  };
  vm.createContext(context);
  vm.runInContext(navCode,context);
  context.dispatchAlwahaBack=()=>{backDispatches++;};
  return {context,exit,layers,counts:()=>({lockSyncs,modalSyncs,closedExit,backDispatches})};
}

// A second Android Back press must never dismiss the Exit/Cancel prompt.
{
  const h=makeHarness({exitVisible:true});
  h.context.window.navigateBack();
  if(!h.exit.visible)fail('Exit dialog disappeared after an additional Back press.');
  if(h.counts().closedExit!==0)fail('Back press called closeExitConfirmationModal while the exit prompt was open.');
  pass('Exit confirmation remains visible until Exit or Cancel is explicitly selected');
}

// Browser/gesture back must also retain the prompt and restore its history guard.
{
  const h=makeHarness({exitVisible:true});
  vm.runInContext(popCode,h.context);
  h.context.handlePopState();
  if(!h.exit.visible)fail('popstate dismissed the exit prompt.');
  if(h.context.history.state?.alwahaExitGuard!==true)fail('popstate did not restore the exit history guard.');
  if(h.context.exitModalHistoryGuarded!==true)fail('exit history flag was cleared while prompt remained open.');
  if(h.counts().backDispatches!==0)fail('popstate dispatched a second navigation action while exit prompt was open.');
  pass('Browser/system history keeps the exit prompt stable');
}

// A hidden first modal must not mask a later visible full-screen overlay.
{
  const hidden={visible:false,zIndex:2147482500,style:{display:'none'},setAttribute(){},classList:{remove(){}}};
  const visible={visible:true,zIndex:2147483200,style:{display:'flex'},attrs:{},setAttribute(k,v){this.attrs[k]=v;},classList:{remove(){this.removed=true;}}};
  const h=makeHarness({layers:[hidden,visible]});
  h.context.window.navigateBack();
  if(visible.style.display!=='none')fail('Top visible full-screen layer was not closed.');
  if(hidden.style.display!=='none')fail('Hidden lower layer should remain unchanged.');
  if(visible.attrs['aria-hidden']!=='true')fail('Closed layer did not receive aria-hidden=true.');
  if(h.counts().lockSyncs!==1||h.counts().modalSyncs!==1)fail('Modal body lock/inert state was not resynchronized after close.');
  pass('Back closes the top visible full-screen layer and restores modal interaction');
}

if(!html.includes("dispatchAlwahaBack('browser-popstate')"))fail('Browser Back is not routed through the shared dispatcher.');
if(!html.includes("dispatchAlwahaBack('system-back')"))fail('System Back is not routed through the shared dispatcher.');
console.log('BACK_NAVIGATION_RUNTIME_AUDIT=PASS (3 behavioral scenarios + shared back dispatcher)');
