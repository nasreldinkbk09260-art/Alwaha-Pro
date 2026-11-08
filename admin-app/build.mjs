import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url));
const dist=path.join(here,'dist'),svg=path.join(here,'icon.svg'),png=path.join(dist,'icon.png');
const adminSupabaseSdkSource=path.resolve(here,'..','assets','vendor','supabase','supabase.js');
const adminSupabaseSdkTarget=path.join(dist,'vendor','supabase','supabase.js');
const adminSupabaseSdkSha256='7709f9e012d7ff55faef5e66b6b50f04d290c6ce255aae4f97b4c4eed104cbf0';
if(!fs.existsSync(adminSupabaseSdkSource)||!fs.statSync(adminSupabaseSdkSource).isFile())throw new Error('Missing pinned local Supabase SDK source.');
const adminSupabaseSdkBytes=fs.readFileSync(adminSupabaseSdkSource);
const adminSupabaseSdkActual=crypto.createHash('sha256').update(adminSupabaseSdkBytes).digest('hex');
if(adminSupabaseSdkActual!==adminSupabaseSdkSha256)throw new Error('Local Supabase SDK SHA-256 mismatch; review and deliberately update the pinned asset.');
if(!fs.existsSync(svg))throw new Error('Missing admin-app/icon.svg');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
fs.copyFileSync(path.join(here,'index.html'),path.join(dist,'index.html'));
fs.mkdirSync(path.dirname(adminSupabaseSdkTarget),{recursive:true});
fs.copyFileSync(adminSupabaseSdkSource,adminSupabaseSdkTarget);
if(crypto.createHash('sha256').update(fs.readFileSync(adminSupabaseSdkTarget)).digest('hex')!==adminSupabaseSdkSha256)throw new Error('Copied Supabase SDK failed SHA-256 verification.');
let converted=false;
try{const {default:sharp}=await import('sharp');await sharp(fs.readFileSync(svg)).resize(1024,1024).png().toFile(png);converted=true}catch{console.log('sharp unavailable; trying ImageMagick fallback.')}
if(!converted){for(const c of [{cmd:'magick',args:[svg,'-resize','1024x1024',png]},{cmd:'convert',args:[svg,'-resize','1024x1024',png]}]){const r=spawnSync(c.cmd,c.args,{encoding:'utf8'});if(!r.error&&r.status===0&&fs.existsSync(png)){converted=true;break}}}
if(!converted||!fs.existsSync(png)||fs.statSync(png).size===0)throw new Error('Icon conversion failed. Check ImageMagick and SVG support.');
console.log(`Pinned local Supabase SDK copied and verified: ${adminSupabaseSdkSha256}`);
console.log('Alwaha Admin web build passed.');
