import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');
const stripRaw=(source)=>source.replace(/<!--([\\s\\S]*?)-->/g,' ').replace(/<(script|style)\\b[^>]*>[\\s\\S]*?<\\/\\1>/gi,' ');
const markup=stripRaw(html);
const tokens=/<\\/?[a-z][^>]*>/gi;
const stack=[];
const controls=[];
let token;
while((token=tokens.exec(markup))){
  const raw=token[0];
  const closing=/^<\\//.test(raw);
  const tag=(raw.match(/^<\\/?([a-z0-9-]+)/i)||[])[1]?.toLowerCase();
  if(!tag)continue;
  if(closing){
    for(let i=stack.length-1;i>=0;i--){const item=stack.pop();if(item.tag===tag)break;}
    continue;
  }
  const attrs={};
  for(const match of raw.matchAll(/([a-z_:][-a-z0-9_:.]*)\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))/gi))attrs[match[1].toLowerCase()]=match[2]??match[3]??match[4]??'';
  const section=tag==='section'&&attrs.id?attrs.id:(stack.at(-1)?.section||'document');
  const isControl=['button','a'].includes(tag)||(tag==='input'&&['button','submit','reset'].includes((attrs.type||'').toLowerCase()))||attrs.role==='button';
  if(isControl){
    const close=markup.toLowerCase().indexOf('</'+tag+'>',tokens.lastIndex);
    const inner=close>=0?markup.slice(tokens.lastIndex,close):'';
    const label=(attrs['aria-label']||attrs.title||attrs.value||inner.replace(/<[^>]*>/g,' ').replace(/\\s+/g,' ').trim()).normalize('NFKC').toLowerCase();
    const action=(attrs.onclick||attrs['data-action']||attrs['data-testid']||'').replace(/\\s+/g,' ').trim();
    const calls=[...action.matchAll(/([a-z_$][\\w$]*)\\s*\\(/gi)].map(x=>x[1]).filter(x=>!['if','function'].includes(x));
    controls.push({tag,id:attrs.id||'',section,label,action,calls,disabled:Object.hasOwn(attrs,'disabled')});
  }
  if(!['input','img','br','hr','meta','link','area','source','wbr','path'].includes(tag))stack.push({tag,section});
}
const groupBy=(items,keyFn)=>{const map=new Map();for(const item of items){const key=keyFn(item);if(!key)continue;const list=map.get(key)||[];list.push(item);map.set(key,list);}return [...map.entries()].filter(([,list])=>list.length>1).map(([key,list])=>({key,count:list.length,items:list}));};
const duplicateActions=groupBy(controls.filter(x=>x.action),(x)=>x.section+' :: '+x.action);
const duplicateLabels=groupBy(controls.filter(x=>x.label),(x)=>x.section+' :: '+x.label);
const duplicateIds=groupBy(controls.filter(x=>x.id),(x)=>x.id);
const dynamicFiles=['production-polish.js','compatibility.js','alwaha-experience.js','alwaha-modal-shell.js','alwaha-runtime-guard.js','alwaha-kids-room.js','alwaha-local-vault.js','alwaha-local-mesh.js','alwaha-profile-editor.js','games.js'];
const dynamic=dynamicFiles.map(file=>{const source=read(file);return {file,createElementButton:(source.match(/createElement\\(\\s*['"]button['"]\\s*\\)/g)||[]).length,buttonTemplates:(source.match(/<button\\b/gi)||[]).length,clickListeners:(source.match(/addEventListener\\(\\s*['"]click['"]/g)||[]).length,inlineClickAttrs:(source.match(/\\bonclick\\s*=/gi)||[]).length};});
const report={format:'alwaha-ui-action-inventory-v1',staticControlCount:controls.length,duplicateActionGroups:duplicateActions,duplicateLabelGroups:duplicateLabels,duplicateIdGroups:duplicateIds,dynamicControlSources:dynamic,notes:['Static HTML scan only; dynamic controls are counted by source pattern but not fully rendered.','Same action in different screens can be legitimate; review scope and modal ownership before removal.','Different function names may be aliases; resolve their call graph and runtime effects before treating them as unique.','This inventory is diagnostic and does not delete or modify controls.']};
fs.mkdirSync(path.join(root,'artifacts'),{recursive:true});
fs.writeFileSync(path.join(root,'artifacts/ui-action-inventory.json'),JSON.stringify(report,null,2)+'\\n');
console.log('UI_ACTION_INVENTORY='+JSON.stringify({staticControlCount:controls.length,duplicateActionGroups:duplicateActions.length,duplicateLabelGroups:duplicateLabels.length,duplicateIdGroups:duplicateIds.length,dynamicSources:dynamic.length}));
for(const group of duplicateActions)console.log('DUPLICATE_ACTION_CANDIDATE',JSON.stringify(group));
for(const group of duplicateLabels)console.log('DUPLICATE_LABEL_CANDIDATE',JSON.stringify(group));
for(const group of duplicateIds)console.log('DUPLICATE_ID',JSON.stringify(group));
console.log('Report: artifacts/ui-action-inventory.json');
