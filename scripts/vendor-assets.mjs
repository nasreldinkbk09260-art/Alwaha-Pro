import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const nodeModules=path.join(root,'node_modules');
const assets=path.join(root,'assets','vendor');
const ensure=(p)=>fs.mkdirSync(p,{recursive:true});
const copy=(source,target)=>{if(!fs.existsSync(source)||!fs.statSync(source).isFile())throw new Error(`Missing vendor source file: ${path.relative(root,source)}`);ensure(path.dirname(target));fs.copyFileSync(source,target);};
const copyDirMerge=(source,target)=>{if(!fs.existsSync(source)||!fs.statSync(source).isDirectory())throw new Error(`Missing vendor source directory: ${path.relative(root,source)}`);ensure(target);fs.cpSync(source,target,{recursive:true,force:true});};
const faRoot=path.join(nodeModules,'@fortawesome','fontawesome-free');
const cairoRoot=path.join(nodeModules,'@fontsource','cairo');
const supaRoot=path.join(nodeModules,'@supabase','supabase-js');
const supaCandidates=[path.join(supaRoot,'dist','umd','supabase.js'),path.join(supaRoot,'dist','umd','supabase.min.js'),path.join(supaRoot,'dist','umd','index.js')];
const supaSource=supaCandidates.find((p)=>fs.existsSync(p)&&fs.statSync(p).isFile());
const faCssOut=path.join(assets,'fontawesome','css','all.min.css');
const faFontsOut=path.join(assets,'fontawesome','webfonts');
const cairoOut=path.join(assets,'cairo');
const supaOut=path.join(assets,'supabase','supabase.js');
const precacheListPath=path.join(assets,'precache-list.json');
function verifyPrevendored(){
  const required=[faCssOut,path.join(faFontsOut,'fa-solid-900.woff2'),path.join(faFontsOut,'fa-regular-400.woff2'),path.join(faFontsOut,'fa-brands-400.woff2'),path.join(faFontsOut,'fa-v4compatibility.woff2'),...['300','400','600','700','900'].map((w)=>path.join(cairoOut,`${w}.css`)),path.join(cairoOut,'files','cairo-arabic-400-normal.woff2'),supaOut,precacheListPath];
  const missing=required.filter((p)=>!fs.existsSync(p)||!fs.statSync(p).isFile()||fs.statSync(p).size===0);
  if(missing.length)throw new Error(`Pre-vendored release assets are incomplete: ${missing.map((p)=>path.relative(root,p)).join(', ')}`);
  const list=JSON.parse(fs.readFileSync(precacheListPath,'utf8'));
  if(!Array.isArray(list)||list.length<10)throw new Error('Pre-vendored precache list is missing or too small.');
  const missingEntries=list.filter((entry)=>typeof entry!=='string'||!entry.startsWith('./assets/vendor/')||!fs.existsSync(path.join(root,entry.slice(2))));
  if(missingEntries.length)throw new Error(`Pre-vendored files missing from disk: ${missingEntries.join(', ')}`);
  for(const weight of ['300','400','600','700','900']){
    const css=fs.readFileSync(path.join(cairoOut,`${weight}.css`),'utf8');
    for(const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)){
      const u=m[1].trim();if(/^(data:|https?:|\/\/)/.test(u))continue;
      const f=path.resolve(cairoOut,u);
      if(!f.startsWith(path.resolve(cairoOut)+path.sep)||!fs.existsSync(f))throw new Error(`Cairo font dependency missing: ${u}`);
    }
  }
  const faCss=fs.readFileSync(faCssOut,'utf8');
  for(const m of faCss.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)){
    const u=m[1].trim();if(/^(data:|https?:|\/\/)/.test(u))continue;
    const f=path.resolve(path.dirname(faCssOut),u);
    if(!f.startsWith(path.resolve(assets)+path.sep)||!fs.existsSync(f))throw new Error(`Font Awesome font dependency missing: ${u}`);
  }
  console.log(`Using verified pre-vendored assets (${list.length} precached files); no npm vendor package copy required.`);
}
const modulesReady=fs.existsSync(path.join(faRoot,'css','all.min.css'))&&fs.existsSync(path.join(faRoot,'webfonts'))&&fs.existsSync(path.join(cairoRoot,'files'))&&['300','400','600','700','900'].every((w)=>fs.existsSync(path.join(cairoRoot,`${w}.css`)))&&Boolean(supaSource);
if(!modulesReady){verifyPrevendored();process.exit(0);}
copy(path.join(faRoot,'css','all.min.css'),faCssOut);
copyDirMerge(path.join(faRoot,'webfonts'),faFontsOut);
for(const weight of ['300','400','600','700','900'])copy(path.join(cairoRoot,`${weight}.css`),path.join(cairoOut,`${weight}.css`));
copyDirMerge(path.join(cairoRoot,'files'),path.join(cairoOut,'files'));
copy(supaSource,supaOut);
const vendorFiles=new Set(['./assets/vendor/fontawesome/css/all.min.css','./assets/vendor/supabase/supabase.js',...['300','400','600','700','900'].map((w)=>`./assets/vendor/cairo/${w}.css`)]);
function addCssDependencies(cssPath){const text=fs.readFileSync(cssPath,'utf8'),dir=path.dirname(cssPath);for(const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)){const raw=m[1].trim();if(!raw||/^(data:|https?:|\/\/)/.test(raw))continue;const local=path.resolve(dir,raw);if(local.startsWith(path.resolve(assets)+path.sep)&&fs.existsSync(local)&&fs.statSync(local).isFile())vendorFiles.add('./'+path.relative(root,local).split(path.sep).join('/'));}}
addCssDependencies(faCssOut);for(const w of ['300','400','600','700','900'])addCssDependencies(path.join(cairoOut,`${w}.css`));
ensure(path.dirname(precacheListPath));fs.writeFileSync(precacheListPath,JSON.stringify([...vendorFiles].sort(),null,2)+'\n');
console.log(`Vendor assets prepared (${vendorFiles.size} offline resources).`);
console.log(`Supabase classic bundle source: ${path.relative(root,supaSource)}`);
