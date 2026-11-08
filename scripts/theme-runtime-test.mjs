import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8'),themeCss=fs.readFileSync('alwaha-theme-system.css','utf8'),sw=fs.readFileSync('sw.js','utf8'),experience=fs.readFileSync('alwaha-experience.js','utf8');
const match=html.match(/^        function changeAppTheme\(themeName, showToast = true\) \{[\s\S]*?^        \}/m);
if(!match)throw new Error('Could not locate the actual application theme function.');
const stored=new Map(),classes=new Set();let classMutations=0;
const themeButtons=['oasis','abyss','default'].map(id=>({dataset:{themeChoice:id},attrs:{'aria-pressed':'false'},state:{textContent:'اضغط للتفعيل'},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]||null;},querySelector(sel){return sel==='.theme-choice-state'?this.state:null;}}));
const meta={content:'#000',setAttribute(k,v){if(k==='content')this.content=v;}};let backdrop=null;
const body={dataset:{},classList:{remove(...xs){classMutations++;xs.forEach(x=>classes.delete(x));},add(x){classMutations++;classes.add(x);},contains(x){return classes.has(x);}},firstChild:null,insertBefore(node){backdrop=node;}};
const document={body,getElementById(id){return id==='alwaha-theme-backdrop'?backdrop:null;},createElement(tag){return {tagName:tag.toUpperCase(),dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;}};},querySelector(s){return s==='meta[name="theme-color"]'?meta:null;},querySelectorAll(s){return s==='[data-theme-choice]'?themeButtons:[];}};
const events=[];class FakeCustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail;}}
const context={document,window:{dispatchEvent(event){events.push(event);}},localStorage:{setItem(k,v){stored.set(k,String(v));},getItem(k){return stored.get(k)||null;}},CustomEvent:FakeCustomEvent,console,Set,String,Object};
vm.createContext(context);vm.runInContext(match[0]+'\nthis.changeAppTheme=changeAppTheme;',context);
const expected={oasis:'#143a43',abyss:'#062b45'};
for(const [id,color] of Object.entries({oasis:'#143a43',abyss:'#062b45'})){const marker=`body[data-alwaha-theme="${id}"] #alwaha-theme-backdrop{background-image:radial-gradient`;if(!themeCss.includes(marker))throw Error('Missing premium CSS atmosphere '+id);if(themeCss.includes(`url('./assets/backgrounds/bg-${id==='oasis'?'aurora':'underwater'}.webp')`))throw Error('Theme still depends on a decorative image '+id);}
if(!themeCss.includes('linear-gradient(145deg,#061a23')||!themeCss.includes('linear-gradient(145deg,#041323'))throw Error('Premium layered theme backgrounds missing');
for(const old of ['bg-spring.webp','bg-summer.webp','bg-autumn.webp','bg-winter.webp'])if(sw.includes(old))throw Error('Unused seasonal image remains cached: '+old);
if(!themeCss.includes('z-index:0!important')||!themeCss.includes('pointer-events:none!important'))throw Error('Backdrop may intercept app interactions');
if(!html.includes('body>*:not(#alwaha-touch-atmosphere){position:relative;z-index:1}'))throw Error('UI layer above backdrop is missing');
const choices=[...html.matchAll(/data-theme-choice="([^"]+)"/g)].map(x=>x[1]);if(choices.length!==3||new Set(choices).size!==3||!['oasis','abyss','default'].every(x=>choices.includes(x)))throw Error('Expected exactly three unique themes');
if(experience.includes('خمسة مظاهر كاملة')||/THEMES\.map\(t=>/.test(experience))throw Error('Duplicate dynamic theme picker still present');
if(!html.includes('id="alwaha-ui-sounds-enabled"')||!experience.includes('function setSoundEnabled')||!experience.includes('bindGlobalFeedbackSound'))throw Error('UI sound toggle not wired');
const soundFn=experience.match(/function sound\(freq=480\)\{[\s\S]*?\}\n function setSoundEnabled/);if(!soundFn||soundFn[0].includes('motionAllowed()'))throw Error('Sound is incorrectly disabled by motion/data saver settings');
const modalShell=fs.readFileSync('alwaha-modal-shell.js','utf8'),ws='split(/'+String.fromCharCode(92)+'s+/)';
if(!modalShell.includes(ws)||!modalShell.includes("document.body.className||'')."+ws))throw Error('MutationObserver whitespace guard missing');
if(!html.includes('href="./alwaha-theme-system.css"')||html.includes('alwaha-theme-system.css?v='))throw Error('Theme CSS path mismatch');
if(!sw.includes("'./alwaha-theme-system.css'"))throw Error('Theme CSS not precached');
const first=context.changeAppTheme('default',false);if(first!=='default'||Object.prototype.hasOwnProperty.call(body.dataset,'alwahaTheme')||stored.get('alwaha_theme')!=='default')throw Error('Default theme did not restore');
for(const id of Object.keys(expected)){const v=context.changeAppTheme(id,false);if(v!==id||body.dataset.alwahaTheme!==id||stored.get('alwaha_theme')!==id)throw Error('Failed apply/persist '+id);if(meta.content!==expected[id])throw Error('Wrong chrome colour '+id);if(backdrop?.dataset.theme!==id||!classes.has('theme-'+id))throw Error('Missing backdrop/class '+id);if(themeButtons.filter(b=>b.attrs['aria-pressed']==='true').length!==1)throw Error('Theme selection state inconsistent');if(themeButtons.find(b=>b.dataset.themeChoice===id).state.textContent!=='المظهر النشط')throw Error('Active theme label missing');}
const ev=events.length,mut=classMutations;context.changeAppTheme('abyss',false);if(events.length!==ev||classMutations!==mut)throw Error('No-op theme selection mutated state');
for(const [legacy,wanted] of [['nature','oasis'],['spring','oasis'],['summer','oasis'],['autumn','oasis'],['tech','abyss'],['winter','abyss'],['soft','default']])if(context.changeAppTheme(legacy,false)!==wanted||stored.get('alwaha_theme')!==wanted)throw Error('Legacy migration failed: '+legacy);
if(context.changeAppTheme('bad-name',false)!=='default'||stored.get('alwaha_theme')!=='default'||Object.prototype.hasOwnProperty.call(body.dataset,'alwahaTheme'))throw Error('Invalid theme fallback failed');
console.log('THEME_RUNTIME_AUDIT=PASS (3 themes, legacy migration, single chooser, local precache, persistence, backdrop layering, sound control)');
