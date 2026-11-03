(() => {
 'use strict';
 const SELECTORS=['#exit-modal-confirmation','#alwaha-privacy-notice','#market-conversations-page','#market-chat-modal','#market-product-detail-modal','#internal-notification-center','#home-post-details-modal','#comments-modal-box','.comments-modal-box','#pro-camera-modal','.pro-camera-modal','#voice-call-modal','#active-chat-box','.sub-profile-view-box','#alwaha-public-profile-modal','#floating-options-menu','#floating-add-menu','.modal-overlay','.game-modal-overlay','[role="dialog"]'];
 const previousInert=new Map();let active=null,focusBefore=null;
 const visible=el=>!!el&&el.isConnected&&!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getClientRects().length>0;
 function candidates(){const found=new Set();for(const selector of SELECTORS)document.querySelectorAll(selector).forEach(el=>{if(visible(el))found.add(el);});return [...found].sort((a,b)=>(Number(getComputedStyle(a).zIndex)||0)-(Number(getComputedStyle(b).zIndex)||0));}
 function setIsolated(el,on){if(!el||el.id==='alwaha-nav-reveal-handle')return;if(on){if(!previousInert.has(el))previousInert.set(el,!!el.inert);el.inert=true;}else if(previousInert.has(el)){el.inert=previousInert.get(el);previousInert.delete(el);}}
 function sync(){const layers=candidates(),top=layers.length?layers[layers.length-1]:null;let changed=false;if(top!==active){if(!active&&top)focusBefore=document.activeElement;active=top;changed=true;}
  const desired=new Set();if(active){let branch=active;while(branch&&branch!==document.body){const parent=branch.parentElement;if(!parent)break;[...parent.children].forEach(sibling=>{if(sibling!==branch&&sibling.id!=='alwaha-nav-reveal-handle'&&!(sibling.classList?.contains('bottom-nav-bar')&&document.body.classList.contains('alwaha-nav-over-modal')))desired.add(sibling);});branch=parent;}}
  for(const el of [...previousInert.keys()])if(!desired.has(el))setIsolated(el,false);for(const el of desired)setIsolated(el,true);
  if(active){document.body.classList.add('modal-active');active.setAttribute('aria-modal','true');if(!active.hasAttribute('tabindex'))active.setAttribute('tabindex','-1');if(changed){const target=focusables()[0]||active;requestAnimationFrame(()=>{if(active===top&&target.isConnected){try{target.focus({preventScroll:true});}catch{}}});}}
  else{document.body.classList.remove('modal-active');if(focusBefore?.isConnected&&typeof focusBefore.focus==='function'){try{focusBefore.focus({preventScroll:true});}catch{}}focusBefore=null;}
  window.AlwahaExperience?.syncDock?.();
 }
 function focusables(){return active?[...active.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(visible):[];}
 document.addEventListener('focusin',event=>{if(!active||active.contains(event.target))return;const navAllowed=document.body.classList.contains('alwaha-nav-over-modal')&&(event.target.id==='alwaha-nav-reveal-handle'||!!event.target.closest('.bottom-nav-bar.alwaha-nav-over-modal'));if(navAllowed)return;const first=focusables()[0];(first||active).focus?.({preventScroll:true});},true);
 document.addEventListener('keydown',event=>{if(!active)return;if(event.key==='Escape'){event.preventDefault();event.stopPropagation();if(typeof window.navigateBack==='function')window.navigateBack();return;}if(event.key!=='Tab')return;const items=focusables();if(!items.length){event.preventDefault();active.focus();return;}const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}},true);
 let started=false;
 const observer=new MutationObserver(()=>{try{sync();}catch(error){console.error('[Alwaha Modal Shell] sync failed:',error);}});
 function start(){if(started||!document.body)return;started=true;observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class','hidden','aria-hidden']});try{sync();}catch(error){console.error('[Alwaha Modal Shell] initial sync failed:',error);}}
 window.AlwahaModalShell={sync,start,getActive:()=>active};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
