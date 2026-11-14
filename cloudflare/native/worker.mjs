import {AppError,login,logout,requireSession} from './auth.mjs';
import {READ_METHODS} from './rpc.mjs';
import {WRITE_METHODS} from './mutations.mjs';
import {MEDIA_METHODS,serveMedia} from './media.mjs';
import {cleanupMediaBuffers} from './storage.mjs';
const METHODS={...READ_METHODS,...WRITE_METHODS,...MEDIA_METHODS};
const security={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(self), microphone=(), geolocation=()','X-Robots-Tag':'noindex, nofollow'};
function json(value,status=200,cookie){return Response.json(value,{status,headers:{...security,...(cookie?{'Set-Cookie':cookie}:{})}});}
async function ready(db){try{return !!await db.prepare('SELECT batch_id FROM native_imports LIMIT 1').first();}catch{return false;}}
export default{
  async scheduled(_event,env,ctx){ctx.waitUntil(cleanupMediaBuffers(env));},
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/health')return json({ok:true,release:env.RELEASE,backend:'cloudflare-worker',database:'d1',preview:true,ready:await ready(env.DB),migrationComplete:false});
    if(url.pathname.startsWith('/api/media/')){
      if(!['GET','HEAD'].includes(request.method))return json({ok:false,error:'Method not allowed'},405);
      try{return await serveMedia(request,env,url.pathname.slice('/api/media/'.length));}catch(error){return json({ok:false,error:error instanceof AppError?error.message:'دریافت فایل انجام نشد.'},error instanceof AppError?error.status:500);}
    }
    if(url.pathname==='/api/rpc'){
      if(request.method!=='POST')return json({ok:false,error:'Method not allowed'},405);
      if(request.headers.get('Origin')!==url.origin)return json({ok:false,error:'Origin not allowed'},403);
      if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json'))return json({ok:false,error:'JSON required'},415);
      if(Number(request.headers.get('Content-Length')||0)>18*1024*1024)return json({ok:false,error:'Request too large'},413);
      try{
        const raw=await request.text();if(raw.length>18*1024*1024)return json({ok:false,error:'Request too large'},413);
        const input=JSON.parse(raw);if(!input||!Array.isArray(input.args)||input.args.length>20||typeof input.fn!=='string')return json({ok:false,error:'Invalid request'},400);
        if(!await ready(env.DB))return json({ok:false,error:'نسخهٔ آزمایشی در حال آماده‌سازی داده‌هاست.'},503);
        if(input.fn==='login'){const result=await login(env.DB,request,...input.args);return json({ok:true,data:result.data},200,result.cookie);}
        if(input.fn==='logout'){const result=await logout(env.DB,request);return json({ok:true,data:result.data},200,result.cookie);}
        const user=await requireSession(env.DB,request),handler=Object.hasOwn(METHODS,input.fn)?METHODS[input.fn]:null;
        if(!handler)return json({ok:false,error:'این بخش در نسخهٔ آزمایشی انتقال هنوز فعال نشده است.'},501);
        const data=await handler({db:env.DB,user,request,env},...input.args);return json({ok:true,data});
      }catch(error){if(error instanceof AppError)return json({ok:false,error:error.message},error.status);if(error instanceof SyntaxError)return json({ok:false,error:'Invalid request'},400);return json({ok:false,error:'پردازش درخواست انجام نشد. اطلاعات قبلی شما محفوظ است.'},500);}
    }
    if(url.pathname.startsWith('/api/'))return json({ok:false,error:'Not found'},404);
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers:security});
    const target=new URL(url);
    if(url.pathname==='/')target.pathname='/index.html';
    if(url.pathname==='/admin'||url.pathname.startsWith('/admin/'))target.pathname='/admin.html';
    const asset=await env.ASSETS.fetch(new Request(target,request)),headers=new Headers(asset.headers);for(const[k,v]of Object.entries(security))headers.set(k,v);
    if(asset.headers.get('Content-Type')?.includes('text/html')&&env.PREVIEW==='true'){
      const html=(await asset.text()).replace('<body>','<body><aside role="status" style="position:relative;z-index:9999;text-align:center;background:#e4ff59;color:#12160d;padding:8px;font:12px sans-serif">نسخهٔ آزمایشی مستقل • ثبت‌های این نسخه وارد حساب اصلی نمی‌شوند</aside>');
      headers.delete('Content-Length');return new Response(request.method==='HEAD'?null:html,{status:asset.status,headers});
    }
    return new Response(asset.body,{status:asset.status,headers});
  }
};
