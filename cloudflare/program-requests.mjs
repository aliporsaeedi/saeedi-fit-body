// Public intake and owner-only queue. No automatic entitlement or paid-plan delivery.
const enc=new TextEncoder(),STATUS=['new','contacted','awaiting_info','ready','delivered','closed'];
const response=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
export async function sign(key,value){const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,enc.encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
function equal(a,b){if(typeof a!=='string'||a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;}
const digits=s=>String(s||'').replace(/[۰-۹٠-٩]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.includes(c)?'۰۱۲۳۴۵۶۷۸۹'.indexOf(c):'٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
export function validateRequest(input){
 const clean=(v,n)=>typeof v==='string'?v.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,n+1):'';
 const name=clean(input.name,80),note=clean(input.note||'',700);let phone=digits(input.phone).replace(/[\s()-]/g,'').replace(/^(?:\+98|0098|98)/,'0');
 if(name.length<2||name.length>80||!/^09\d{9}$/.test(phone)||note.length>700||input.consent!==true||input.website)throw Error('نام، شماره موبایل و موافقت با ثبت درخواست را بررسی کنید.');
 if(!['lose','gain','maintain','strength','recomp','posture'].includes(input.goal)||!['training','nutrition','combined','home'].includes(input.service))throw Error('هدف و نوع برنامه را انتخاب کنید.');
 return {name,phone,goal:input.goal,service:input.service,note,consentVersion:'program-request-v1'};
}
async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('JSON');const raw=await request.text();if(raw.length>7000)throw Error('Size');return JSON.parse(raw);}
async function owner(request,env){const token=request.headers.get('Authorization')?.match(/^Bearer (.{8,500})$/)?.[1];if(!token)return false;try{const r=await fetch(env.GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:'call',fn:'sfLeadAdminAccess',args:[token]}),signal:AbortSignal.timeout(20000)});const j=await r.json();return j.ok===true&&j.data?.role==='admin';}catch{return false;}}
export async function syncProgramRequests(env,limit=5){
 if(!env.REQUESTS_DB||!env.PROGRAM_REQUEST_SIGNING_KEY)return;
 const now=Date.now(),rows=await env.REQUESTS_DB.prepare('SELECT * FROM program_requests WHERE synced_revision<revision AND lease_until<? AND next_attempt_at<=? ORDER BY created_at LIMIT ?').bind(now,now,limit).all();
 for(const row of rows.results){
  const lease=now+90000,claim=await env.REQUESTS_DB.prepare('UPDATE program_requests SET lease_until=? WHERE id=? AND lease_until<? AND revision=?').bind(lease,row.id,now,row.revision).run();if(!claim.meta.changes)continue;
  try{
   const payload=JSON.stringify({id:row.id,name:row.name,phone:row.phone,goal:row.goal,service:row.service,note:row.note,consentVersion:row.consent_version,status:row.status,adminNote:row.admin_note,revision:row.revision,createdAt:new Date(row.created_at).toISOString(),updatedAt:new Date(row.updated_at).toISOString()}),stamp=String(Date.now()),nonce=crypto.randomUUID(),sig=await sign(env.PROGRAM_REQUEST_SIGNING_KEY,'mirror\n'+stamp+'\n'+nonce+'\n'+payload);
   const r=await fetch(env.GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:'program-request-mirror',stamp,nonce,payload,sig}),signal:AbortSignal.timeout(45000)});const j=await r.json();
   if(!r.ok||j.ok!==true||j.id!==row.id||Number(j.revision)<row.revision)throw Error('mirror');
   await env.REQUESTS_DB.prepare('UPDATE program_requests SET synced_revision=?,notification_state=?,lease_until=0,attempts=0,next_attempt_at=0,last_error=\'\' WHERE id=? AND lease_until=?').bind(row.revision,['sent','not_configured','rejected','unknown','pending'].includes(j.notification)?j.notification:'unknown',row.id,lease).run();
  }catch{
   const wait=Math.min(3600000,60000*2**Math.min(row.attempts,6));
   await env.REQUESTS_DB.prepare('UPDATE program_requests SET lease_until=0,attempts=attempts+1,next_attempt_at=?,last_error=? WHERE id=? AND lease_until=?').bind(Date.now()+wait,'sheet_sync_pending',row.id,lease).run();
  }
 }
}
export async function programRequestRoute(request,env,ctx){
 const url=new URL(request.url),admin=url.pathname==='/api/admin/program-requests';
 if(!env.REQUESTS_DB||!env.PROGRAM_REQUEST_SIGNING_KEY)return response({ok:false,error:'ثبت درخواست در حال آماده‌سازی است.'},503);
 const sameOrigin=request.headers.get('Origin')===url.origin||(request.method==='GET'&&request.headers.get('Sec-Fetch-Site')==='same-origin'&&request.headers.get('Referer')?.startsWith(url.origin+'/'));
 if(!sameOrigin)return response({ok:false,error:'درخواست مجاز نیست.'},403);
 if(admin){
  if(!await owner(request,env))return response({ok:false,error:'دسترسی مدیر لازم است.'},403);
  if(request.method==='GET'){
   const status=url.searchParams.get('status')||'all',offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));if(status!=='all'&&!STATUS.includes(status))return response({ok:false,error:'وضعیت نامعتبر است.'},400);
   const where=status==='all'?'':' WHERE status=?',args=status==='all'?[]:[status];const rows=await env.REQUESTS_DB.prepare('SELECT id,name,phone,goal,service,note,status,admin_note,revision,created_at,updated_at,notification_state,synced_revision,last_error FROM program_requests'+where+' ORDER BY created_at DESC LIMIT 50 OFFSET ?').bind(...args,Math.floor(offset)).all();const counts=await env.REQUESTS_DB.prepare('SELECT status,COUNT(*) AS count FROM program_requests GROUP BY status').all();return response({ok:true,items:rows.results,counts:counts.results,offset:Math.floor(offset)});
  }
  if(request.method==='POST'){
   let input;try{input=await body(request);}catch{return response({ok:false,error:'درخواست معتبر نیست.'},400);}
   if(!/^REQ-[a-f0-9]{24}$/.test(input.id)||!STATUS.includes(input.status)||!Number.isInteger(input.revision)||typeof input.note!=='string'||input.note.length>1500)return response({ok:false,error:'اطلاعات معتبر نیست.'},400);
   const r=await env.REQUESTS_DB.prepare('UPDATE program_requests SET status=?,admin_note=?,revision=revision+1,updated_at=?,next_attempt_at=0 WHERE id=? AND revision=?').bind(input.status,input.note,Date.now(),input.id,input.revision).run();if(!r.meta.changes)return response({ok:false,error:'درخواست هم‌زمان تغییر کرده؛ دوباره دریافت کنید.'},409);ctx.waitUntil(syncProgramRequests(env));return response({ok:true,revision:input.revision+1});
  }
  return response({ok:false,error:'Method not allowed'},405);
 }
 if(request.method!=='POST')return response({ok:false,error:'Method not allowed'},405);
 const ip=request.headers.get('CF-Connecting-IP')||'local',ipHash=await sign(env.PROGRAM_REQUEST_SIGNING_KEY,'ip\n'+ip);
 if(url.pathname==='/api/program-request/challenge'){
  const stamp=String(Date.now()),nonce=crypto.randomUUID(),sig=await sign(env.PROGRAM_REQUEST_SIGNING_KEY,'challenge\n'+stamp+'\n'+nonce+'\n'+ipHash);return response({ok:true,challenge:{stamp,nonce,sig}});
 }
 let input,record;try{input=await body(request);record=validateRequest(input);}catch(e){return response({ok:false,error:e.message==='JSON'||e.message==='Size'?'اطلاعات معتبر نیست.':e.message},400);}
 const c=input.challenge,age=Date.now()-Number(c?.stamp);if(!c||!/^\d{13}$/.test(c.stamp)||!/^[a-f0-9-]{36}$/.test(c.nonce)||!Number.isFinite(age)||age<1500||age>1200000||!equal(c.sig,await sign(env.PROGRAM_REQUEST_SIGNING_KEY,'challenge\n'+c.stamp+'\n'+c.nonce+'\n'+ipHash)))return response({ok:false,error:'فرم منقضی شده است؛ دوباره تلاش کنید.'},400);
 const hash=await sign(env.PROGRAM_REQUEST_SIGNING_KEY,JSON.stringify(record)),old=await env.REQUESTS_DB.prepare('SELECT id,body_hash FROM program_requests WHERE nonce=?').bind(c.nonce).first();if(old)return equal(old.body_hash,hash)?response({ok:true,id:old.id,status:'registered',replayed:true}):response({ok:false,error:'این فرم قبلاً ثبت شده؛ فرم تازه باز کنید.'},409);
 const id='REQ-'+crypto.randomUUID().replaceAll('-','').slice(0,24),now=Date.now();
 const result=await env.REQUESTS_DB.prepare('INSERT INTO program_requests(id,nonce,body_hash,name,phone,goal,service,note,consent_version,ip_hash,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM program_requests WHERE ip_hash=? AND created_at>?)<5 AND (SELECT COUNT(*) FROM program_requests WHERE phone=? AND created_at>?)<3 ON CONFLICT(nonce) DO NOTHING').bind(id,c.nonce,hash,record.name,record.phone,record.goal,record.service,record.note,record.consentVersion,ipHash,now,now,ipHash,now-3600000,record.phone,now-86400000).run();
 if(!result.meta.changes){const replay=await env.REQUESTS_DB.prepare('SELECT id,body_hash FROM program_requests WHERE nonce=?').bind(c.nonce).first();if(replay&&equal(replay.body_hash,hash))return response({ok:true,id:replay.id,status:'registered',replayed:true});return response({ok:false,error:'تعداد درخواست‌ها زیاد است؛ بعداً دوباره تلاش کنید.'},429);}
 ctx.waitUntil(syncProgramRequests(env));return response({ok:true,id,status:'registered'},201);
}
