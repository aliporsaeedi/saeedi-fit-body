const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
  const {default:worker}=await import(pathToFileURL(path.join(__dirname,'../cloudflare/worker.mjs')));
  const env={RELEASE:'test',GAS_URL:'https://script.google.com/test',ASSETS:{fetch:async req=>new Response(new URL(req.url).pathname)}};
  const original=global.fetch;let calls=[];
  global.fetch=async(url,init)=>{calls.push(JSON.parse(init.body));return Response.json({ok:false,error:'جلسه ورود منقضی شده است.'})};
  function req(body,origin='https://example.com'){return new Request('https://example.com/api/rpc',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});}
  try{
    let r=await worker.fetch(req({fn:'getBootstrap',args:['own-token']},'https://attacker.example'),env);assert.equal(r.status,403);assert.equal(calls.length,0);
    r=await worker.fetch(req({fn:'getSS_',args:[]}),env);assert.equal(r.status,400);assert.equal(calls.length,0);
    r=await worker.fetch(req({fn:'sfGetAppJs',args:[]}),env);assert.equal(r.status,400);
    r=await worker.fetch(req({fn:'getBootstrap',args:['own-token']}),env);assert.equal(r.status,400);assert.equal((await r.json()).ok,false);assert.deepEqual(calls,[{a:'call',fn:'getBootstrap',args:['own-token']}]);assert.equal(r.headers.get('Cache-Control'),'no-store');
    global.fetch=async()=>{throw Error('ambiguous save timeout')};
    r=await worker.fetch(req({fn:'logExerciseSet',args:['token',{}]}),env);assert.equal(r.status,502);assert.match((await r.json()).error,/پیش از تکرار ثبت/);
    r=await worker.fetch(new Request('https://example.com/admin'),env);assert.equal(await r.text(),'/admin.html');assert.equal(r.headers.get('Cache-Control'),'no-store');assert.match(r.headers.get('X-Robots-Tag'),/noindex/);
    r=await worker.fetch(new Request('https://example.com/?page=admin'),env);assert.equal(r.headers.get('Location'),'https://example.com/admin');
    r=await worker.fetch(new Request('https://example.com/api/health'),env);const h=await r.json();assert.equal(h.migrationComplete,false);assert.equal(h.database,'google-sheets');
    console.log('PASS Cloudflare API boundary: same origin, explicit methods, private no-store responses, expired sessions preserved, mutation timeout is not retried, separate admin and truthful migration status.');
  }finally{global.fetch=original;}
})().catch(e=>{console.error(e);process.exitCode=1});
