const assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),fs=require('node:fs');
(async()=>{
 const {programRequestRoute:route,sign,syncProgramRequests,validateRequest}=await import('../cloudflare/program-requests.mjs');
 assert.equal(validateRequest({name:'Fixture',phone:'+98 912 000 0000',goal:'gain',service:'training',consent:true}).phone,'09120000000');
 assert.throws(()=>validateRequest({name:'Fixture',phone:'09120000000',goal:'gain',service:'training',consent:false}));
 const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('cloudflare/program-requests-schema.sql','utf8'));
 const db={prepare(q){const stmt=sql.prepare(q);let args=[];const bound={bind(...v){args=v;return bound;},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){const r=stmt.run(...args);return {meta:{changes:Number(r.changes)}};}};return bound;}};
 const env={REQUESTS_DB:db,PROGRAM_REQUEST_SIGNING_KEY:'synthetic-test-key',GAS_URL:'https://fixture.invalid'},pending=[],ctx={waitUntil:p=>pending.push(p)};
 const input={name:'Synthetic fixture',phone:'09120000000',goal:'gain',service:'training',consent:true,note:'Fixture only'},origin='https://fixture.invalid';
 const request=(path,data,method='POST',auth)=>new Request(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(auth?{Authorization:'Bearer '+auth}:{})},body:method==='GET'?undefined:JSON.stringify(data)});
 const oldFetch=global.fetch;let calls=0;global.fetch=async(url,options)=>{const p=JSON.parse(options.body);calls++;if(p.a==='call')return Response.json({ok:true,data:{role:p.args[0]==='admin-fixture'?'admin':'user'}});const row=JSON.parse(p.payload);assert.equal(p.sig,await sign(env.PROGRAM_REQUEST_SIGNING_KEY,'mirror\n'+p.stamp+'\n'+p.nonce+'\n'+p.payload));return Response.json({ok:true,id:row.id,revision:row.revision,notification:'sent'});};
 try {
  let r=await route(new Request(origin+'/api/program-request',{method:'POST'}),env,ctx);assert.equal(r.status,403);
  r=await route(request('/api/program-request/challenge',{}),env,ctx);assert.equal(r.status,200);const challenge=(await r.json()).challenge;
  challenge.stamp=String(Date.now()-2000);const ipHash=await sign(env.PROGRAM_REQUEST_SIGNING_KEY,'ip\n192.0.2.1');challenge.sig=await sign(env.PROGRAM_REQUEST_SIGNING_KEY,'challenge\n'+challenge.stamp+'\n'+challenge.nonce+'\n'+ipHash);
  r=await route(request('/api/program-request',{...input,challenge}),env,ctx);assert.equal(r.status,201);const receipt=await r.json();await Promise.all(pending.splice(0));
  r=await route(request('/api/program-request',{...input,challenge}),env,ctx);assert.equal((await r.json()).id,receipt.id);assert.equal(sql.prepare('SELECT COUNT(*) n FROM program_requests').get().n,1);assert.equal(calls,1,'A retry must not repeat the Telegram mirror');
  r=await route(request('/api/program-request',{...input,note:'changed',challenge}),env,ctx);assert.equal(r.status,409);
  r=await route(request('/api/admin/program-requests',null,'GET','user-fixture'),env,ctx);assert.equal(r.status,403);
  r=await route(request('/api/admin/program-requests',null,'GET','admin-fixture'),env,ctx);const list=await r.json();assert.equal(list.items.length,1);assert.equal(list.items[0].notification_state,'sent');
  r=await route(request('/api/admin/program-requests',{id:receipt.id,revision:1,status:'contacted',note:'Contacted'},'POST','admin-fixture'),env,ctx);assert.equal(r.status,200);await Promise.all(pending.splice(0));
  r=await route(request('/api/admin/program-requests',{id:receipt.id,revision:1,status:'closed',note:''},'POST','admin-fixture'),env,ctx);assert.equal(r.status,409);
  global.fetch=async()=>{throw Error('network')};sql.prepare('UPDATE program_requests SET revision=revision+1').run();await syncProgramRequests(env);const deferred=sql.prepare('SELECT * FROM program_requests').get();assert.equal(deferred.last_error,'sheet_sync_pending');assert(deferred.synced_revision<deferred.revision);assert(deferred.next_attempt_at>Date.now());
  console.log('PASS intake: normalized phone/consent, signed challenge, committed receipt, duplicate suppression, admin role isolation, CAS tracking and durable mirror retry. No live Telegram sent.');
 }finally{global.fetch=oldFetch;sql.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
