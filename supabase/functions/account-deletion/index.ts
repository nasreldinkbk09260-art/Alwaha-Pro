import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders});
const BUCKETS=['media','avatars','posts','products'] as const, PAGE_SIZE=500, MAX_ROWS=20000, MAX_OBJECTS=20000;
function asObject(v:unknown):Record<string,unknown>{return v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};}
function retainRef(v:unknown,uid:string,base:string,keep:Set<string>):void{
 if(Array.isArray(v)){for(const x of v)retainRef(x,uid,base,keep);return;}
 if(v&&typeof v==='object'){for(const x of Object.values(v as Record<string,unknown>))retainRef(x,uid,base,keep);return;}
 if(typeof v!=='string'||!v.trim())return;
 try{const u=new URL(v,base),mark='/storage/v1/object/',i=u.pathname.indexOf(mark);if(i<0)return;
 const p=u.pathname.slice(i+mark.length).split('/'),access=p.shift(),bucket=p.shift();
 if(!['public','sign','authenticated'].includes(String(access))||!BUCKETS.includes(bucket as typeof BUCKETS[number]))return;
 const objectPath=decodeURIComponent(p.join('/'));if(objectPath.startsWith(uid+'/'))keep.add(bucket+':'+objectPath);
 }catch(_){}
}
async function rows(db:ReturnType<typeof createClient>,table:string,cols:string,filter:(q:any)=>any){
 const out:Record<string,unknown>[]=[];
 for(let offset=0;;offset+=PAGE_SIZE){const {data,error}=await filter(db.from(table).select(cols)).range(offset,offset+PAGE_SIZE-1);if(error)throw new Error('account_deletion_database_read_failed');const page=(data||[]) as Record<string,unknown>[];out.push(...page);if(out.length>MAX_ROWS)throw new Error('account_deletion_row_limit_exceeded');if(page.length<PAGE_SIZE)return out;}
}
async function listOwned(db:ReturnType<typeof createClient>,bucket:string,prefix:string,out:string[],depth=0):Promise<void>{
 if(depth>6)throw new Error('account_deletion_storage_depth_exceeded');let offset=0;
 for(;;){const {data,error}=await db.storage.from(bucket).list(prefix,{limit:1000,offset});if(error)throw new Error('account_deletion_storage_list_failed');const entries=data||[];
 for(const e of entries){const p=prefix+'/'+e.name;if(e.id||e.metadata){out.push(p);if(out.length>MAX_OBJECTS)throw new Error('account_deletion_storage_limit_exceeded');}else await listOwned(db,bucket,p,out,depth+1);}
 if(entries.length<1000)return;offset+=entries.length;}
}
async function cleanStorage(db:ReturnType<typeof createClient>,uid:string,keep:Set<string>):Promise<number>{
 let removed=0;for(const bucket of BUCKETS){const out:string[]=[];await listOwned(db,bucket,uid,out);const del=out.filter(p=>!keep.has(bucket+':'+p));for(let i=0;i<del.length;i+=1000){const {data,error}=await db.storage.from(bucket).remove(del.slice(i,i+1000));if(error)throw new Error('account_deletion_storage_remove_failed');removed+=(data||[]).length;}}return removed;
}
async function clearTargetComments(db:ReturnType<typeof createClient>,type:string,ids:string[]):Promise<void>{
 for(let i=0;i<ids.length;i+=100){const {error}=await db.from('comments').delete().eq('target_type',type).in('target_id',ids.slice(i,i+100));if(error)throw new Error('account_deletion_comments_cleanup_failed');}
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders});
 if(req.method!=='POST')return json({error:'طريقة الطلب غير مسموحة.'},405);
 const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
 if(!url||!anon||!service)return json({error:'خدمة حذف الحساب غير مهيأة.'},503);
 const match=(req.headers.get('Authorization')||'').match(/^Bearer\s+(.+)$/i);if(!match)return json({error:'سجّل الدخول أولًا.'},401);
 let body:Record<string,unknown>;try{const raw=await req.text();if(raw.length>12000)return json({error:'حجم الطلب أكبر من المسموح.'},413);body=asObject(JSON.parse(raw));}catch(_){return json({error:'بيانات الطلب غير صالحة.'},400);}
 const password=String(body.password||'');if(password.length<8||password.length>128)return json({error:'أدخل كلمة المرور الحالية لإثبات ملكية الحساب.'},400);
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),token=match[1].trim();
 const {data:authData,error:authError}=await auth.auth.getUser(token),user=authData?.user;
 if(authError||!user||!user.email)return json({error:'الجلسة أو البريد المرتبط بالحساب غير صالحين.'},401);
 const {data:reauth,error:reauthError}=await auth.auth.signInWithPassword({email:user.email,password});
 if(reauthError||reauth.user?.id!==user.id)return json({error:'كلمة المرور غير صحيحة أو البريد غير مؤكد.'},401);
 const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:profile,error:profileError}=await admin.from('users').select('id,is_admin').eq('id',user.id).maybeSingle();
 if(profileError||!profile)return json({error:'تعذر التحقق من ملكية الحساب.'},503);
 if(profile.is_admin===true)return json({error:'لا يمكن حذف حساب الإدارة من مسار المستخدمين.'},403);
 try{
  const keep=new Set<string>();
  const products=await rows(admin,'products','image_url,image_urls',q=>q.eq('seller_id',user.id));
  for(const p of products){retainRef(p.image_url,user.id,url,keep);retainRef(p.image_urls,user.id,url,keep);}
  const conversations=await rows(admin,'market_conversations','listing_snapshot',q=>q.or('buyer_id.eq.'+user.id+',seller_id.eq.'+user.id));
  for(const c of conversations)retainRef(c.listing_snapshot,user.id,url,keep);
  const transactions=await rows(admin,'market_transactions','listing_snapshot',q=>q.or('buyer_id.eq.'+user.id+',seller_id.eq.'+user.id));
  for(const t of transactions)retainRef(t.listing_snapshot,user.id,url,keep);
  const posts=await rows(admin,'posts','id',q=>q.eq('author_id',user.id)),reels=await rows(admin,'reels','id',q=>q.eq('author_id',user.id));
  const postIds=posts.map(x=>String(x.id)),reelIds=reels.map(x=>String(x.id));
  const {error:commentError}=await admin.from('comments').delete().eq('user_id',user.id);if(commentError)throw new Error('account_deletion_comments_cleanup_failed');
  await clearTargetComments(admin,'post',postIds);await clearTargetComments(admin,'reel',reelIds);
  const {error:postError}=await admin.from('posts').delete().eq('author_id',user.id);if(postError)throw new Error('account_deletion_posts_cleanup_failed');
  const {error:reelError}=await admin.from('reels').delete().eq('author_id',user.id);if(reelError)throw new Error('account_deletion_reels_cleanup_failed');
  const removedObjects=await cleanStorage(admin,user.id,keep);
  const {error:deleteError}=await admin.auth.admin.deleteUser(user.id);if(deleteError)throw new Error('account_deletion_auth_remove_failed');
  return json({ok:true,removedObjects,retainedMarketplaceRecords:true});
 }catch(error){console.error('account-deletion failed:',String(error));return json({error:'تعذر إكمال الحذف بأمان. لم يتم تأكيد حذف الحساب؛ قد يكون حُذف بعض المحتوى الاجتماعي، ويمكنك إعادة المحاولة.'},503);}
});
