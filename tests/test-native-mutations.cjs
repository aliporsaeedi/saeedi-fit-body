const fs=require('node:fs'),assert=require('node:assert/strict'),{database}=require('./d1-fixture.cjs');
(async()=>{
 const {WRITE_METHODS:w,waterState}=await import('../cloudflare/native/mutations.mjs'),{isoToday}=await import('../cloudflare/native/data.mjs'),db=database(),day=isoToday(),at=new Date().toISOString();db.sql.exec(fs.readFileSync('cloudflare/native/schema.sql','utf8'));
 for(const user of ['own','other']){db.sql.prepare('INSERT INTO accounts(username_key,username,password_hash,role,source_batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').run(user,user,'fixture','user','fixture',at,at);db.sql.prepare('INSERT INTO profiles VALUES(?,?,?)').run(user,JSON.stringify({username:user,waterGoal:8,avatarUrl:'/private-own-avatar'}),at);}
 function c(id=crypto.randomUUID()){return{db,user:{username_key:'own',username:'own',role:'user',email:''},env:{},request:new Request('https://native.example/api/rpc',{headers:{'X-Request-ID':id}})};}
 const insert=db.sql.prepare('INSERT INTO records(record_id,kind,owner_key,date_key,body,source_batch,updated_at) VALUES(?,?,?,?,?,?,?)');
 insert.run('source:1:1','AppWaterLogs','own',day,JSON.stringify({Glasses:2}),'source',at);insert.run('source:1:2','AppWaterLogs','own',day,JSON.stringify({Glasses:5}),'source',at);insert.run('source:1:3','AppWaterLogs','other',day,JSON.stringify({Glasses:7}),'source',at);
 await Promise.all(Array.from({length:5},()=>w.addWater(c(),'cookie',1,day)));assert.equal((await waterState(c(),day)).glasses,10);
 await w.resetWater(c(),'cookie',day);assert.equal((await waterState(c(),day)).glasses,0);assert.equal(db.sql.prepare("SELECT count(*) n FROM records WHERE kind='AppWaterLogs' AND owner_key='own'").get().n,1);
 const same=c();await w.addWater(same,'cookie',2,day);await w.addWater(same,'cookie',2,day);assert.equal((await waterState(c(),day)).glasses,2);await assert.rejects(w.addWater(same,'cookie',3,day),e=>e.status===409);
 assert.equal(JSON.parse(db.sql.prepare("SELECT body FROM records WHERE owner_key='other'").get().body).Glasses,7);
 const check={sleepHours:'',sleep:4,energy:3,hunger:2,sore:1,note:'Actual check-in'};let r=await w.sfRefWellnessSave(c(),'cookie',check);assert.equal(r.wellness.sleepHours,null);await w.sfRefWellnessSave(c(),'cookie',{...check,energy:5});assert.equal(db.sql.prepare("SELECT count(*) n FROM records WHERE kind='WellnessLogs'").get().n,1);await assert.rejects(w.sfRefWellnessSave(c(),'cookie',{...check,sleepHours:25}));
 r=await w.saveReminders(c(),'cookie',[{type:'pill',time:'10:20',on:true,label:'Prescribed item'}]);assert.equal(r.reminders.items[0].label,'Prescribed item');assert.equal(r.reminders.configured,false);
 const p={name:'Own name',gender:'m',age:30,height:180,weight:80,goalWeight:78,activity:1.55,goal:'maintain',username:'other',avatarUrl:'https://attacker.example'};
 r=await w.saveProfile(c(),'cookie',p);assert.equal(r.profile.username,'own');assert.equal(r.profile.avatarUrl,'/private-own-avatar');assert.equal(r.profile.bmr,1780);assert.equal(r.profile.bmi,24.7);
 // Simulate a competing profile edit after read but before transaction commit.
 const original=db.batch.bind(db),race=c(),beforeHistory=db.sql.prepare("SELECT count(*) n FROM records WHERE kind='ProfileHistory'").get().n;let intercept=true;
 db.batch=async statements=>{if(intercept){intercept=false;db.sql.prepare('UPDATE profiles SET body=? WHERE username_key=?').run(JSON.stringify({username:'own',waterGoal:9,avatarUrl:'/concurrent'}),'own');}return original(statements);};
 await assert.rejects(w.saveProfile(race,'cookie',{...p,weight:81}),e=>e.status===409);assert.equal(db.sql.prepare("SELECT count(*) n FROM records WHERE kind='ProfileHistory'").get().n,beforeHistory);assert.equal(db.sql.prepare('SELECT count(*) n FROM request_results WHERE request_id=?').get(race.request.headers.get('X-Request-ID')).n,0);assert.equal(JSON.parse(db.sql.prepare("SELECT body FROM profiles WHERE username_key='own'").get().body).avatarUrl,'/concurrent');
 db.batch=original;
 console.log('PASS native writes with real SQLite: concurrent water increments, complete reset of legacy duplicates, retry idempotency/conflict, own-account scope, optional wellness, reminder labels, profile metrics and atomic conflict rollback. Fixtures only.');
})().catch(e=>{console.error(e);process.exitCode=1});
