const fs=require('node:fs'),assert=require('node:assert/strict'),{database}=require('./d1-fixture.cjs');
(async()=>{
  const {default:worker}=await import('../cloudflare/native/worker.mjs'),{isoToday}=await import('../cloudflare/native/data.mjs'),{makePassword}=await import('../cloudflare/native/auth.mjs');
  const db=database();db.sql.exec(fs.readFileSync('cloudflare/native/schema.sql','utf8'));
  const env={DB:db,RELEASE:'test',PREVIEW:'true',ASSETS:{fetch:async()=>new Response('<body>fixture</body>',{headers:{'Content-Type':'text/html'}})}};
  const stamp=new Date().toISOString(),day=isoToday(),password=await makePassword('fixture-password');
  for(const user of ['own','other']){db.sql.prepare('INSERT INTO accounts(username_key,username,password_hash,role,source_batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(user,user,password,'user','fixture',stamp,stamp);db.sql.prepare('INSERT INTO profiles VALUES(?,?,?)').run(user,JSON.stringify({username:user,name:user,waterGoal:8}),stamp);}
  function record(id,kind,owner,value,date=''){db.sql.prepare('INSERT INTO records(record_id,kind,owner_key,date_key,body,updated_at) VALUES(?,?,?,?,?,?)').run(id,kind,owner,date,JSON.stringify(value),stamp);}
  record('source:meal:1','MealLogs','own',{Title:'Own meal',Kcal:100,Protein:10,CreatedAt:'own-meal-id'},day);record('source:meal:2','MealLogs','other',{Title:'Private other meal',Kcal:900,CreatedAt:'other-meal-id'},day);
  record('source:water:1','AppWaterLogs','own',{Glasses:3},day);record('source:log:1','AppLogs','own',{DateISO:day,WeightKg:70},day);record('source:done:1','WorkoutDone','own',{Key:'own-done'},day);
  record('source:message:1','Messages','own',{Sender:'coach',Text:'Own message',CreatedAt:stamp});record('source:message:2','Messages','other',{Sender:'coach',Text:'Private other message',CreatedAt:stamp});
  const program={name:'Exact assigned name',days:[{title:'D1',exercises:[{name:'Exact press',training:{exerciseId:'e1',size:1}}]}]};
  db.sql.prepare('INSERT INTO programs(program_id,owner_key,kind,name,active,body,source_batch,updated_at) VALUES(?,?,?,?,?,?,?,?)').run('p1','own','workout',program.name,1,JSON.stringify(program),'fixture',stamp);
  db.sql.prepare('INSERT INTO exercises VALUES(?,?,?,?,?)').run('e1','Exact press','exactpress',JSON.stringify({PersianName:'Exact press',Instructions:'Exact instruction',Tips:'Exact tip',legacy:{gif:['not-entitled'],frames:[]}}),1);
  let network=0;const oldFetch=global.fetch;global.fetch=async()=>{network++;throw Error('No Google fallback allowed')};
  function request(fn,args=[],cookie='',origin='https://native.example'){return new Request('https://native.example/api/rpc',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:cookie},body:JSON.stringify({fn,args})});}
  try{
    let r=await worker.fetch(request('login',['own','fixture-password']),env);assert.equal(r.status,503);
    db.sql.prepare('INSERT INTO native_imports VALUES(?,?,?,?)').run('fixture',stamp,'fixture','{}');
    r=await worker.fetch(request('login',['own','fixture-password']),env);assert.equal(r.status,200);const cookie=r.headers.get('Set-Cookie').split(';')[0];assert.equal((await r.json()).data.token,'cookie');
    r=await worker.fetch(request('getBootstrap',['other-forged-token',day,'other'],cookie),env);assert.equal(r.status,200);const boot=(await r.json()).data;assert.equal(boot.user.username,'own');assert.equal(boot.meals.today.length,1);assert.equal(boot.meals.today[0].kcal,100);assert.equal(boot.water.glasses,3);assert.equal(boot.workouts[0].name,program.name);assert.equal(boot.doneToday[0],'own-done');assert.equal(boot.logs[0].weight,70);assert.equal(boot.activity[day].w,1);assert(!JSON.stringify(boot).includes('Private other'));
    r=await worker.fetch(request('getBootstrap',['cookie',day]),env);assert.equal(r.status,401);
    r=await worker.fetch(request('getMessages',['cookie','other'],cookie),env);assert.equal(r.status,403);
    r=await worker.fetch(request('getMessages',['cookie',''],cookie),env);assert.equal((await r.json()).data[0].text,'Own message');
    r=await worker.fetch(request('sfAthleteExerciseGuide',['cookie',program.name,0,0],cookie),env);const guide=(await r.json()).data;assert.equal(guide.parts[0].instructions,'Exact instruction');assert.equal(guide.parts[0].gif.length,0);
    r=await worker.fetch(request('sfAthleteExerciseGuide',['cookie','Not assigned',0,0],cookie),env);assert.equal(r.status,400);
    r=await worker.fetch(request('getBootstrap',['cookie'],cookie,'https://attacker.example'),env);assert.equal(r.status,403);
    r=await worker.fetch(request('unportedFunction',['cookie'],cookie),env);assert.equal(r.status,501);assert.equal(network,0);
    r=await worker.fetch(new Request('https://native.example/'),env);assert.match(await r.text(),/نسخهٔ آزمایشی مستقل/);
    r=await worker.fetch(request('logout',['cookie'],cookie),env);assert.match(r.headers.get('Set-Cookie'),/Max-Age=0/);r=await worker.fetch(request('getBootstrap',['cookie'],cookie),env);assert.equal(r.status,401);
    console.log('PASS native Worker end-to-end with real SQLite: import gate, cookie login, own bootstrap/guide/messages, foreign-account denial, no Google requests, explicit unported feature, preview notice and logout. Fixtures only.');
  }finally{global.fetch=oldFetch;}
})().catch(e=>{console.error(e);process.exitCode=1});
