import {METHODS} from './methods.mjs';

const headers = {
  'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'strict-origin-when-cross-origin',
  'X-Frame-Options':'DENY', 'Permissions-Policy':'camera=(self), microphone=(), geolocation=()',
};
function json(body,status=200){return Response.json(body,{status,headers:{...headers,'Cache-Control':'no-store'}});}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const adminHost=url.hostname==='admin.saeedifitbody.ir';
    if(url.hostname==='www.saeedifitbody.ir'){url.hostname='saeedifitbody.ir';return Response.redirect(url.href,302);}
    if(url.searchParams.get('page')==='admin')return Response.redirect(url.origin+'/admin',302);
    if(url.pathname==='/api/health') return json({ok:true,release:env.RELEASE,frontend:'cloudflare',backend:'apps-script',database:'google-sheets',migrationComplete:false});
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
    const response=new Response(result.body,result);
    for(const[k,v]of Object.entries(headers))response.headers.set(k,v);
    if(adminHost||url.pathname==='/admin'||url.pathname.startsWith('/admin/')||url.pathname==='/admin.html') {
      response.headers.set('Cache-Control','no-store');response.headers.set('X-Robots-Tag','noindex, nofollow');
    }
    return response;
  }
};
