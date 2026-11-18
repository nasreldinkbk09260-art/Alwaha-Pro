import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const categories=new Set(['bug','account','performance','messaging','calls','marketplace','suggestion','other']);
const platforms=new Set(['android','ios','web','unknown']);
type Body=Record<string,unknown>;
const asBody=(v:unknown):Body=>v&&typeof v==='object'&&!Array.isArray(v)?v as Body:{};
function cleanText(value:unknown,max:number):string{
 return String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,' ')
 .replace(/<\/?[a-z][^>]*>/gi,' ')
 .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[بريد محذوف]')
 .replace(/\b(?:Bearer\s+)?(?:eyJ[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{16,}|sb_secret_[A-Za-z0-9_-]{12,})\b/gi,'[سر محذوف]')
 .replace(/\b(?:OTP|رمز(?:\s+التحقق)?|verification code)\s*[:=]?\s*\d{4,8}\b/gi,'[رمز تحقق محذوف]')
 .replace(/\b(?:password|كلمة المرور)\s*[:=]\s*\S+/gi,'[كلمة مرور محذوفة]')
 .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g,'[رقم محذوف]').replace(/\s+/g,' ').trim().slice(0,max);
}
// Deterministic triage only. It never modifies an account, message, listing or other application data.
function classify(category:string,subject:string,description:string){
 const value=subject+' '+description;
 let priority=category==='account'||category==='calls'?45:category==='bug'?35:category==='performance'?30:20;
 let label=category;
 if(/(توقف|ينهار|انهيار|crash|crashes|force close)/i.test(value)){priority=Math.max(priority,65);label='possible_crash'}
 else if(/(تسجيل الدخول|دخول|login|sign in|password)/i.test(value)){priority=Math.max(priority,55);label='account_access'}
 else if(/(بطيء|بطء|تأخير|slow|lag|timeout)/i.test(value)){label='performance'}
 return {priority:Math.min(priority,80),label};
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return json({error:'طريقة الطلب غير مسموحة.'},405);
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!service)return json({error:'خدمة الدعم غير مهيأة.'},503);
 const match=(req.headers.get('Authorization')||'').match(/^Bearer\s+(.+)$/i);
 if(!match)return json({error:'سجّل الدخول أولًا.'},401);
 let body:Body;
 try{if(Number(req.headers.get('content-length')||0)>9000)return json({error:'حجم الطلب أكبر من المسموح.'},413);body=asBody(await req.json())}
 catch{return json({error:'بيانات الطلب غير صالحة.'},400)}
 const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:authData,error:authError}=await auth.auth.getUser(match[1].trim()),user=authData?.user;
 if(authError||!user)return json({error:'الجلسة غير صالحة؛ سجّل الدخول مجددًا.'},401);
 const db=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 const action=String(body.action||'');
 try{
  if(action==='my_tickets'){
   const {data,error}=await db.from('support_tickets').select('id,category,subject,status,priority,triage_label,created_at,updated_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20);
   if(error)throw new Error('support_ticket_list_failed');
   return json({tickets:data||[]});
  }
  if(action!=='create_ticket')return json({error:'الإجراء غير مدعوم.'},400);
  const category=String(body.category||''),subject=cleanText(body.subject,120),description=cleanText(body.description,2400);
  const appVersion=/^[A-Za-z0-9.+_-]{1,32}$/.test(String(body.appVersion||''))?String(body.appVersion):'unknown';
  const rawPlatform=String(body.platform||'unknown'),platform=platforms.has(rawPlatform)?rawPlatform:'unknown';
  if(!categories.has(category)||subject.length<4||description.length<12)return json({error:'اختر نوع المشكلة واكتب عنوانًا ووصفًا واضحين.'},400);
  const since=new Date(Date.now()-86400000).toISOString();
  const {count,error:rateError}=await db.from('support_tickets').select('id',{count:'exact',head:true}).eq('user_id',user.id).gte('created_at',since);
  if(rateError)throw new Error('support_ticket_rate_check_failed');
  if((count||0)>=5)return json({error:'وصلت إلى الحد اليومي لبلاغات الدعم. حاول بعد 24 ساعة.'},429);
  const triage=classify(category,subject,description);
  const {data,error}=await db.from('support_tickets').insert({user_id:user.id,category,subject,description,app_version:appVersion,platform,status:'open',priority:triage.priority,triage_label:triage.label}).select('id,status,priority,created_at').single();
  if(error||!data)throw new Error('support_ticket_create_failed');
  return json({ok:true,ticket:data,message:'وصل بلاغك إلى فريق الدعم.'});
 }catch(error){
  console.error('support-tickets request failed:',error instanceof Error?error.message:'unknown');
  return json({error:'تعذر إرسال الطلب الآن. حاول مرة أخرى.'},503);
 }
});
