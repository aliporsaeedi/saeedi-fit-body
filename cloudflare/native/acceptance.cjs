// Owner-run acceptance on the isolated native preview. Temporary test records
// only: no real athlete writes, payment decisions, messages, or AI calls.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const directory=path.resolve(process.argv[2]||''),root=path.resolve(__dirname,'../..');
if(!process.argv[2]||directory===root||directory.startsWith(root+path.sep))throw Error('Private state directory outside repository required');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'wrangler.jsonc'),'utf8'));
const databaseUrl='https://api.cloudflare.com/client/v4/accounts/'+config.account_id+'/d1/database/'+config.d1_databases[0].database_id+'/query';
const base='https://saeedi-fit-body-native.aliisaeedi7116.workers.dev';
async function query(batch){const token=fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];const r=await fetch(databaseUrl,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({batch}),signal:AbortSignal.timeout(60000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Acceptance database request failed: '+r.status);return j.result;}
async function rpc(fn,args=[],cookie='',requestId=crypto.randomUUID(),origin=base){const response=await fetch(base+'/api/rpc',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'X-Request-ID':requestId},body:JSON.stringify({fn,args}),signal:AbortSignal.timeout(60000)});return{status:response.status,cookie:response.headers.get('Set-Cookie'),body:await response.json()};}
(async()=>{
 const {makePassword,sha256}=await import('./auth.mjs');
 const user='__qa_migration_'+crypto.randomBytes(8).toString('hex'),password=crypto.randomBytes(24).toString('hex'),stamp=new Date().toISOString(),programId='qa_'+crypto.randomUUID();
 const stateFile=path.join(directory,'native-acceptance-state.json');fs.writeFileSync(stateFile,JSON.stringify({user,programId,createdAt:stamp}));
 const initial=(await query([{sql:'SELECT count(*) n FROM accounts',params:[]}]))[0].results[0].n;
 try{
  await query([
   {sql:'INSERT INTO accounts(username_key,username,password_hash,role,source_batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',params:[user,user,await makePassword(password),'user','qa',stamp,stamp]},
   {sql:'INSERT INTO profiles VALUES(?,?,?)',params:[user,JSON.stringify({username:user,name:'Migration test fixture',waterGoal:8}),stamp]},
   {sql:'INSERT INTO programs(program_id,owner_key,kind,name,active,body,source_batch,updated_at) VALUES(?,?,?,?,?,?,?,?)',params:[programId,user,'workout','Migration fixture plan',1,JSON.stringify({name:'Migration fixture plan',days:[{title:'Fixture day',exercises:[]}]}),'qa',stamp]},
  ]);
  let r=await rpc('login',[user,password]);assert.equal(r.status,200,'Native login failed');assert.match(r.cookie,/HttpOnly; Secure; SameSite=Lax/);const cookie=r.cookie.split(';')[0];console.log('PASS live native login and private cookie');
  r=await rpc('getBootstrap',['cookie'],cookie);assert.equal(r.status,200);assert.equal(r.body.data.user.username,user);assert.equal(r.body.data.workouts.length,1);assert.equal(r.body.data.workouts[0].name,'Migration fixture plan');console.log('PASS live native own plans and bootstrap');
  const id=crypto.randomUUID();r=await rpc('addWater',['cookie',1],cookie,id);assert.equal(r.status,200);assert.equal(r.body.data.water.glasses,1);r=await rpc('addWater',['cookie',1],cookie,id);assert.equal(r.body.data.water.glasses,1);console.log('PASS live native write and duplicate request protection');
  r=await rpc('getMessages',['cookie','different-athlete'],cookie);assert.equal(r.status,403);r=await rpc('getBootstrap',['cookie'],cookie,crypto.randomUUID(),'https://attacker.example');assert.equal(r.status,403);console.log('PASS live account and origin isolation');
  const png=require('@napi-rs/canvas').createCanvas(10,10).toBuffer('image/png');r=await rpc('uploadProgressPhoto',['cookie',png.toString('base64'),'image/png','Migration test fixture'],cookie);assert.equal(r.status,200,'Private image upload failed');assert.equal(r.body.data.photos.length,1);const photoUrl=r.body.data.url;
  let photo=await fetch(base+photoUrl,{headers:{Cookie:cookie}});assert.equal(photo.status,200);assert.equal(photo.headers.get('Cache-Control'),'no-store');assert(Buffer.from(await photo.arrayBuffer()).equals(png));photo=await fetch(base+photoUrl);assert.equal(photo.status,401);console.log('PASS live private photo upload, exact bytes and anonymous access denial');
  r=await rpc('logout',['cookie'],cookie);assert.equal(r.status,200);r=await rpc('getBootstrap',['cookie'],cookie);assert.equal(r.status,401);console.log('PASS live native logout and session invalidation');
 }finally{
  if(!/^__qa_migration_[a-f0-9]{16}$/.test(user))throw Error('Invalid cleanup namespace');
  const media=(await query([{sql:'SELECT object_key FROM media_objects WHERE owner_key=?',params:[user]}]))[0].results;
  for(const file of media){if(!file.object_key.startsWith('private/'+await sha256(user)+'/'))throw Error('Unexpected fixture media key');const token=fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];const deleted=await fetch('https://api.cloudflare.com/client/v4/accounts/'+config.account_id+'/storage/kv/namespaces/'+config.kv_namespaces[0].id+'/values/'+encodeURIComponent(file.object_key),{method:'DELETE',headers:{Authorization:'Bearer '+token}});if(!deleted.ok&&deleted.status!==404)throw Error('Fixture private file cleanup failed');}
  await query([
   {sql:'DELETE FROM media_write_buffer WHERE media_id IN (SELECT media_id FROM media_objects WHERE owner_key=?)',params:[user]},
   {sql:'DELETE FROM media_objects WHERE owner_key=?',params:[user]},
   {sql:'DELETE FROM auth_sessions WHERE username_key=?',params:[user]},
   {sql:'DELETE FROM request_results WHERE owner_key=?',params:[user]},
   {sql:'DELETE FROM records WHERE owner_key=?',params:[user]},
   {sql:"DELETE FROM programs WHERE owner_key=? AND source_batch='qa'",params:[user]},
   {sql:'DELETE FROM profiles WHERE username_key=?',params:[user]},
   {sql:"DELETE FROM accounts WHERE username_key=? AND source_batch='qa'",params:[user]},
   {sql:'DELETE FROM auth_attempts WHERE bucket=?',params:['account:'+await sha256(user)]},
  ]);
  const count=(await query([{sql:'SELECT count(*) n FROM accounts',params:[]}]))[0].results[0].n;assert.equal(count,initial,'Fixture cleanup count mismatch');
  fs.writeFileSync(stateFile,JSON.stringify({cleaned:true,verifiedAt:new Date().toISOString()}));console.log('PASS temporary fixture cleanup; real account count unchanged');
 }
})().catch(e=>{console.error(e.message);process.exitCode=1});
