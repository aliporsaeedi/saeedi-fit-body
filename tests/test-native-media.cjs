const fs=require('node:fs'),assert=require('node:assert/strict'),{database}=require('./d1-fixture.cjs'),{createCanvas}=require('@napi-rs/canvas');
(async()=>{
 const {MEDIA_METHODS:m,serveMedia,decodeImage}=await import('../cloudflare/native/media.mjs'),auth=await import('../cloudflare/native/auth.mjs'),db=database();db.sql.exec(fs.readFileSync('cloudflare/native/schema.sql','utf8'));
 const at=new Date().toISOString(),password=await auth.makePassword('fixture-password');
 for(const[u,role,coach]of [['own','user','coach'],['other','user','different'],['coach','coach',''],['admin','admin','']]){db.sql.prepare('INSERT INTO accounts(username_key,username,password_hash,role,coach_key,source_batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').run(u,u,password,role,coach,'fixture',at,at);db.sql.prepare('INSERT INTO profiles VALUES(?,?,?)').run(u,JSON.stringify({username:u,waterGoal:8,avatarUrl:'/old-avatar'}),at);}
 const objects=new Map();let puts=0;const bucket={async put(k,v){puts++;objects.set(k,new Uint8Array(v));return{key:k}},async delete(k){objects.delete(k)},async get(k){return objects.has(k)?{body:objects.get(k)}:null}};
 const env={DB:db,MEDIA:bucket},cookies={};
 function request(user,id=crypto.randomUUID()){return new Request('https://native.example/api/rpc',{headers:{Cookie:cookies[user]||'','X-Request-ID':id}});}
 async function context(user,id){return{db,env,user:await auth.requireSession(db,request(user)),request:request(user,id)}}
 for(const user of ['own','other','coach','admin'])cookies[user]=(await auth.login(db,request(user),user,'fixture-password')).cookie.split(';')[0];
 const canvas=createCanvas(20,20);canvas.getContext('2d').fillRect(0,0,20,20);const bytes=canvas.toBuffer('image/png'),base64=bytes.toString('base64');
 assert.throws(()=>decodeImage(Buffer.from('<svg/>').toString('base64'),'image/svg+xml',100));assert.throws(()=>decodeImage(Buffer.from('<html>').toString('base64'),'image/png',100));
 const missing=await context('own');missing.env={DB:db};await assert.rejects(m.uploadProfileAvatar(missing,'cookie',base64,'image/png'),e=>e.status===503);assert.equal(objects.size,0);
 const own=await context('own'),r=await m.uploadProfileAvatar(own,'cookie',base64,'image/png');assert.match(r.url,/^\/api\/media\//);assert.equal(r.profile.avatarUrl,r.url);assert.equal(objects.size,1);assert.equal(puts,1);await m.uploadProfileAvatar(own,'cookie',base64,'image/png');assert.equal(puts,1,'Duplicate upload must reuse committed operation');
 const id=r.fileId;let response=await serveMedia(request('own'),env,id);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Content-Type'),'image/png');assert(Buffer.from(await response.arrayBuffer()).equals(bytes));
 await assert.rejects(serveMedia(request('other'),env,id),e=>e.status===403);await assert.rejects(serveMedia(new Request('https://native.example'),env,id),e=>e.status===401);assert.equal((await serveMedia(request('coach'),env,id)).status,200);assert.equal((await serveMedia(request('admin'),env,id)).status,200);
 db.sql.prepare('UPDATE media_objects SET kind=? WHERE media_id=?').run('receipt',id);await assert.rejects(serveMedia(request('coach'),env,id),e=>e.status===403);assert.equal((await serveMedia(request('admin'),env,id)).status,200);
 const original=db.batch;db.batch=async()=>{throw Error('Forced fixture database failure')};await assert.rejects(m.uploadProgressPhoto(await context('own'),'cookie',base64,'image/png','fixture'));assert.equal(objects.size,1,'Failed metadata write must clean only the new orphan');db.batch=original;
 assert.equal(JSON.parse(db.sql.prepare("SELECT body FROM profiles WHERE username_key='other'").get().body).avatarUrl,'/old-avatar');
 console.log('PASS private media: checked formats, missing storage never replaces photo, duplicate upload protection, byte-preserving storage, own/assigned-coach/admin access, protected financial receipts, no-store responses and orphan cleanup. Mock bucket and real SQLite only.');
})().catch(e=>{console.error(e);process.exitCode=1});
