import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync('alwaha-experience.js','utf8');
const html=fs.readFileSync('index.html','utf8');
let failures=0;
function check(name,condition){if(condition)console.log('PASS:',name);else{failures++;console.error('FAIL:',name);}}

const storage=new Map([
  ['alwaha_nav_position_v1','right'],
  ['alwaha_nav_free_position_v1',JSON.stringify({x:125,y:310,orientation:'right'})],
]);
const classes=new Set(['alwaha-nav-free-position','alwaha-nav-pos-right']);
const classList={
 add(name){classes.add(name);},
 remove(name){classes.delete(name);},
 contains(name){return classes.has(name);},
 toggle(name,force){const value=force===undefined?!classes.has(name):Boolean(force);if(value)classes.add(name);else classes.delete(name);return value;}
};
const properties=new Map();
const nav={
 classList,
 style:{setProperty(k,v){properties.set(k,v);},removeProperty(k){properties.delete(k);}},
 getBoundingClientRect(){return {left:158,top:360,width:344,height:60};}
};
const bodyClasses=new Set();
const sandbox={
 console,
 localStorage:{
  getItem(k){return storage.has(k)?storage.get(k):null;},
  setItem(k,v){storage.set(k,String(v));},
  removeItem(k){storage.delete(k);}
 },
 window:{innerWidth:360,innerHeight:800,addEventListener(){},dispatchEvent(){},AudioContext:null},
 document:{
  readyState:'loading',
  body:{dataset:{},classList:{add(k){bodyClasses.add(k);},remove(k){bodyClasses.delete(k);},contains(k){return bodyClasses.has(k);}}},
  querySelector(sel){return sel==='.bottom-nav-bar'?nav:null;},
  getElementById(){return null;}
 },
 matchMedia(){return {matches:false};},
 setTimeout,clearTimeout,requestAnimationFrame(fn){return setTimeout(fn,0);},cancelAnimationFrame:clearTimeout,
};
vm.runInNewContext(source,sandbox,{filename:'alwaha-experience.js'});
const api=sandbox.window.AlwahaExperience;
check('navigation experience exports migration and edge snap controls',!!api&&typeof api.migrateDockLayout==='function'&&typeof api.nearestDockOrientation==='function');
api.migrateDockLayout();
check('legacy right-side midpoint migrates to bottom dock',storage.get('alwaha_nav_position_v1')==='bottom');
check('legacy arbitrary free-position coordinates are cleared',!storage.has('alwaha_nav_free_position_v1')&&!classes.has('alwaha-nav-free-position'));
check('dock layout migration is versioned',storage.get('alwaha_nav_layout_v2')==='1');
storage.set('alwaha_nav_position_v1','top');
api.migrateDockLayout();
check('migration is idempotent and preserves an intentional top dock',storage.get('alwaha_nav_position_v1')==='top');
check('drag near top snaps to top edge',api.nearestDockOrientation(8,14,344,60)==='top');
check('drag near bottom snaps to bottom edge',api.nearestDockOrientation(8,726,344,60)==='bottom');
check('middle tie snaps predictably to bottom, not a free middle point',api.nearestDockOrientation(8,370,344,60)==='bottom');
api.showPosition('bottom',true);
check('bottom selection clears free coordinates and stores bottom',classes.has('alwaha-nav-pos-bottom')&&!classes.has('alwaha-nav-free-position')&&storage.get('alwaha_nav_position_v1')==='bottom'&&properties.size===0);
api.showPosition('top',true);
check('top selection is anchored to top class',classes.has('alwaha-nav-pos-top')&&!classes.has('alwaha-nav-pos-bottom')&&storage.get('alwaha_nav_position_v1')==='top');

const labels=['الرئيسية','السوق','محادثة','ريلز','الألعاب','حسابي','تنبيهات'];
const navMarkup=html.match(/<nav class="bottom-nav-bar"[\s\S]*?<\/nav>/)?.[0]||'';
check('all seven main navigation actions retain visible Arabic names',labels.every(label=>navMarkup.includes('<span>'+label+'</span>')));
check('navigation labels are not hidden by injected CSS',source.includes('.nav-item>span:not(#notification-badge-nav){display:block!important')&&!source.includes('.nav-item>span:not(#notification-badge-nav){display:none!important'));
check('navigation dock has a translucent glass background',source.includes('background:rgba(8,18,34,.27)!important')&&source.includes('backdrop-filter:blur(18px)'));
check('dock has visible focus and active states',source.includes('.nav-item:focus-visible')&&source.includes('.nav-item:active'));
check('bottom and top anchors respect Android safe-area insets',source.includes('bottom:calc(7px + env(safe-area-inset-bottom))')&&source.includes('top:calc(7px + env(safe-area-inset-top))'));
check('drag release snaps and clears temporary free-position mode',source.includes('showPosition(orientation,true);nav.classList.remove(\'alwaha-nav-group-dragging\')'));
check('reset navigation returns to bottom rather than screen center',source.includes("showPosition('bottom',true);"));
check('position selector defaults to the bottom option',source.includes("host.querySelector('#alwaha-nav-position-select').value=safeGet(POSITION_KEY)||'bottom'"));
if(failures){console.error(`NAVIGATION_DOCK_TEST=FAIL (${failures})`);process.exit(1);}
console.log('NAVIGATION_DOCK_TEST=PASS');
