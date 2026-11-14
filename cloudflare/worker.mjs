import {METHODS} from './methods.mjs';
import {programRequestRoute,syncProgramRequests} from './program-requests.mjs';

const headers = {
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'DENY', 'Permissions-Policy':'camera=(self), microphone=(), geolocation=()',
  'Strict-Transport-Security':'max-age=31536000',
};
function json(body,status=200){return Response.json(body,{status,headers:{...headers,'Cache-Control':'no-store'}});}
export default {
  async fetch(request,env,ctx) {
    const url=new URL(request.url);
    if(url.protocol==='http:'){url.protocol='https:';return Response.redirect(url.href,308);}
    const adminHost=url.hostname==='admin.saeedifitbody.ir';
    if(url.hostname==='www.saeedifitbody.ir'){url.hostname='saeedifitbody.ir';return Response.redirect(url.href,308);}
    if(url.searchParams.get('page')==='admin')return Response.redirect(url.origin+'/admin',302);
    if(url.pathname==='/api/health') return json({ok:true,release:env.RELEASE,frontend:'cloudflare',backend:'apps-script',database:'google-sheets',migrationComplete:false});
    if(['/api/program-request','/api/program-request/challenge','/api/admin/program-requests'].includes(url.pathname)) {
      try {return await programRequestRoute(request,env,ctx);} catch {return json({ok:false,error:'ثبت یا دریافت درخواست انجام نشد؛ دوباره بررسی کنید.'},503);}
    }
    if(url.pathname==='/api/rpc') {
      if(request.method!=='POST') return json({ok:false,error:'Method not allowed'},405);
      const origin=request.headers.get('Origin');
      if(origin!==url.origin) return json({ok:false,error:'Origin not allowed'},403);
      if(!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) return json({ok:false,error:'JSON required'},415);
      if(Number(request.headers.get('Content-Length')||0)>18*1024*1024) return json({ok:false,error:'Request too large'},413);
      let input;
      try {const raw=await request.text();if(raw.length>18*1024*1024)return json({ok:false,error:'Request too large'},413);input=JSON.parse(raw);}catch{return json({ok:false,error:'Invalid request'},400);}
      if(!METHODS.includes(input?.fn)||!Array.isArray(input?.args)||input.args.length>20) return json({ok:false,error:'Unknown method'},400);
      try {
        const upstream=await fetch(env.GAS_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:'call',fn:input.fn,args:input.args}),redirect:'follow',signal:AbortSignal.timeout(55000)});
        // No automatic retries: a timed-out save can already have committed.
        if(!upstream.ok) return json({ok:false,error:'پاسخ سرور دریافت نشد. پیش از تکرار ثبت، وضعیت اطلاعات را بررسی کنید.'},502);
        const output=await upstream.json();
        if(typeof output?.ok!=='boolean') throw Error('Invalid upstream envelope');
        return json(output,output.ok?200:400);
      }catch{return json({ok:false,error:'پاسخ سرور دریافت نشد. پیش از تکرار ثبت، وضعیت اطلاعات را بررسی کنید.'},502);}
    }
    if(url.pathname.startsWith('/api/'))return json({ok:false,error:'Not found'},404);
    if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers});
    const target=new URL(request.url);
    if(url.pathname==='/')target.pathname='/index.html';
    if(adminHost||url.pathname==='/admin'||url.pathname.startsWith('/admin/'))target.pathname='/admin.html';
    const result=await env.ASSETS.fetch(new Request(target,request));
    let response=new Response(result.body,result);
    if(env.DESIGN_PREVIEW==='true' && result.headers.get('Content-Type')?.includes('text/html')) {
      const html=await result.text();
      response=new Response(html.replace('<body>','<body><aside style="position:relative;z-index:50;background:#172116;color:#e2f2d5;text-align:center;padding:10px 14px;font:12px/1.8 sans-serif" role="note">پیش‌نمایش طراحی • متصل به حساب واقعی؛ ثبت اطلاعات، حساب اصلی شما را تغییر می‌دهد.</aside>'),result);
      response.headers.set('X-Robots-Tag','noindex, nofollow');response.headers.set('Cache-Control','no-store');
    }
    for(const[k,v]of Object.entries(headers))response.headers.set(k,v);
    if(adminHost||url.pathname==='/admin'||url.pathname.startsWith('/admin/')||url.pathname==='/admin.html') {
      response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex, nofollow');
    }
    return response;
  },
  async scheduled(event,env,ctx) {ctx.waitUntil(syncProgramRequests(env));}
};
