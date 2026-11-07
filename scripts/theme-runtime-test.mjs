import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync('index.html','utf8');
const themeCss=fs.readFileSync('alwaha-theme-system.css','utf8');
const sw=fs.readFileSync('sw.js','utf8');
const match=html.match(/^        function changeAppTheme\(themeName, showToast = true\) \{[\s\S]*?^        \}/m);
if(!match)throw new Error('Could not locate the actual application theme function.');

const stored=new Map();
const classes=new Set();
const themeButtons=['default','spring','summer','autumn','winter'].map(id=>({
  dataset:{themeChoice:id},attrs:{},state:{textContent:'اضغط للتفعيل'},
  setAttribute(k,v){this.attrs[k]=v;},
  querySelector(sel){return sel==='.theme-choice-state'?this.state:null;}
}));
const meta={content:'#000',setAttribute(k,v){if(k==='content')this.content=v;}};
let backdrop=null;
const body={dataset:{},classList:{remove(...xs){xs.forEach(x=>classes.delete(x));},add(x){classes.add(x);}},firstChild:null,insertBefore(node){backdrop=node;}};
const document={
 body,
 getElementById(id){return id==='alwaha-theme-backdrop'?backdrop:null;},
 createElement(tag){return {tagName:tag.toUpperCase(),dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};},
 querySelector(selector){return selector==='meta[name="theme-color"]'?meta:null;},
 querySelectorAll(selector){return selector==='[data-theme-choice]'?themeButtons:[];}
};
const events=[];
class FakeCustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
const context={document,window:{dispatchEvent(event){events.push(event);}},localStorage:{setItem(k,v){stored.set(k,String(v));},getItem(k){return stored.get(k)||null;}},CustomEvent:FakeCustomEvent,console,Set,String};
vm.createContext(context);
vm.runInContext(match[0]+'\nthis.changeAppTheme=changeAppTheme;',context);

const expected={spring:'#18333a',summer:'#073344',autumn:'#291b19',winter:'#102940'};
for(const id of Object.keys(expected)){
 const cssMarker=`body[data-alwaha-theme="${id}"]{--alwaha-theme-image:url('./assets/backgrounds/bg-${id}.webp')`;
 if(!themeCss.includes(cssMarker))throw new Error(`Missing seasonal CSS palette/background for ${id}.`);
 if(!sw.includes(`'./assets/backgrounds/bg-${id}.webp'`))throw new Error(`Seasonal image is not precached: ${id}.`);
 if(!fs.existsSync(`assets/backgrounds/bg-${id}.webp`))throw new Error(`Seasonal image is not included in source: ${id}.`);
}

const modalShell=fs.readFileSync('alwaha-modal-shell.js','utf8');
const whitespaceSplit=String.raw`split(/\s+/)`;
if(!modalShell.includes(whitespaceSplit)||!modalShell.includes("document.body.className||'').split(/\\s+/)"))throw new Error('Observer must split both before/after body class lists on whitespace.');
if(!html.includes('href="./alwaha-theme-system.css"')||html.includes('alwaha-theme-system.css?v='))throw new Error('Theme stylesheet must use the exact offline-precache path.');
if(!sw.includes("'./alwaha-theme-system.css'"))throw new Error('Theme stylesheet is not precached for offline startup.');
if(!modalShell.includes('bodyModalStateChanged(record)')||!modalShell.includes("active.getAttribute('aria-modal')!=='true'")||!modalShell.includes('attributeOldValue:true'))throw new Error('Theme changes must not retrigger modal sync or rewrite stable modal attributes.');
if(!modalShell.includes("['modal-active','alwaha-nav-over-modal']"))throw new Error('Body observer must ignore theme-only body class mutations.');

const results=[];
const defaultValue=context.changeAppTheme('default',false);
if(defaultValue!=='default'||Object.prototype.hasOwnProperty.call(body.dataset,'alwahaTheme')||stored.get('alwaha_theme')!=='default')throw new Error('The default theme must restore the original unthemed appearance.');
if(themeCss.includes('body[data-alwaha-theme="default"]'))throw new Error('Default theme must not override original theme styles.');
for(const theme of Object.keys(expected)){
 const actual=context.changeAppTheme(theme,false);
 if(actual!==theme)throw new Error(`Theme ${theme} normalized to ${actual}`);
 if(body.dataset.alwahaTheme!==theme||stored.get('alwaha_theme')!==theme)throw new Error(`Theme ${theme} was not persisted and applied.`);
 if(meta.content!==expected[theme])throw new Error(`Wrong system chrome colour for ${theme}: ${meta.content}`);
 if(!backdrop||backdrop.dataset.theme!==theme)throw new Error(`Backdrop missing for ${theme}`);
 if(theme==='default'&&classes.has('theme-default'))throw new Error('Default theme must preserve original body class appearance.');
 if(theme!=='default'&&!classes.has(`theme-${theme}`))throw new Error(`Theme body class missing for ${theme}`);
 if(themeButtons.filter(b=>b.attrs['aria-pressed']==='true').length!==1)throw new Error(`Exactly one theme must be selected for ${theme}`);
 if(themeButtons.find(b=>b.dataset.themeChoice===theme).state.textContent!=='المظهر النشط')throw new Error(`Active label missing for ${theme}`);
 results.push(theme);
}
for(const [legacy,wanted] of [['nature','spring'],['tech','summer'],['soft','winter']]){
 const actual=context.changeAppTheme(legacy,false);
 if(actual!==wanted||stored.get('alwaha_theme')!==wanted)throw new Error(`Legacy ${legacy} was not migrated to ${wanted}`);
}
const invalid=context.changeAppTheme('unsupported-theme',false);
if(invalid!=='default'||stored.get('alwaha_theme')!=='default')throw new Error('Invalid themes must fall back to the unchanged default.');
if(events.length!==9)throw new Error(`Expected 9 theme-change events; got ${events.length}`);
console.log(`THEME_RUNTIME_AUDIT=PASS (${results.length} complete themes, 3 legacy migrations, invalid fallback, local persistence, backdrop and system chrome)`);
