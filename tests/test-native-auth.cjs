const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{database}=require('./d1-fixture.cjs');
(async()=>{
  const a=await import('../cloudflare/native/auth.mjs'),db=database();db.sql.exec(fs.readFileSync('cloudflare/native/schema.sql','utf8'));
  const legacy='fixture-salt$'+crypto.createHash('sha256').update('fixture-salt::fixture-password').digest('hex');
  const ins=db.sql.prepare('INSERT INTO accounts(username_key,username,password_hash,role,email,coach_key,source_batch,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
  for(const[u,role,coach]of [['own','user','coach'],['other','user','different'],['coach','coach',''],['admin','admin','']])ins.run(u,u,legacy,role,'',coach,'fixture','date','date');
  function request(cookie='',ip='192.0.2.1'){return new Request('https://native.example/api/rpc',{method:'POST',headers:{Cookie:cookie,'CF-Connecting-IP':ip}});}
  assert(await a.passwordMatches(' fixture-password ',legacy));assert(!await a.passwordMatches('wrong',legacy));
  const signed=await a.login(db,request(),'Own','fixture-password');assert.equal(signed.data.token,'cookie');assert.equal(signed.data.user.username,'own');assert.match(signed.cookie,/HttpOnly; Secure; SameSite=Lax/);
  const cookie=signed.cookie.split(';')[0],session=await a.requireSession(db,request(cookie));assert.equal(session.username_key,'own');
  const stored=db.sql.prepare('SELECT * FROM accounts WHERE username_key=?').get('own');assert.match(stored.password_hash,/^pbkdf2-sha256\$100000\$/);assert(await a.passwordMatches('fixture-password',stored.password_hash));
  const row=db.sql.prepare('SELECT * FROM auth_sessions').get();assert.notEqual(row.token_hash,cookie.split('=')[1]);
  await assert.rejects(a.requireSession(db,request()),/جلسه/);
  await assert.rejects(a.authorizeAthlete(db,session,'other'),e=>e.status===403);
  const coach={username_key:'coach',role:'coach'};assert.equal(await a.authorizeAthlete(db,coach,'own'),'own');await assert.rejects(a.authorizeAthlete(db,coach,'other'),e=>e.status===403);assert.equal(await a.authorizeAthlete(db,{username_key:'admin',role:'admin'},'other'),'other');assert.throws(()=>a.requireAdmin(coach),e=>e.status===403);
  db.sql.prepare('UPDATE accounts SET role=? WHERE username_key=?').run('coach','own');assert.equal((await a.requireSession(db,request(cookie))).role,'coach');
  db.sql.prepare('UPDATE accounts SET auth_version=auth_version+1 WHERE username_key=?').run('own');await assert.rejects(a.requireSession(db,request(cookie)),/جلسه/);
  const again=await a.login(db,request(),'own','fixture-password');const cookie2=again.cookie.split(';')[0];await a.logout(db,request(cookie2));await assert.rejects(a.requireSession(db,request(cookie2)),/جلسه/);
  const parallel=await Promise.allSettled(Array.from({length:12},()=>a.login(db,request('','192.0.2.2'),'other','wrong')));assert.equal(parallel.filter(r=>r.reason?.status===429).length,4);assert.equal(parallel.filter(r=>r.reason?.status===401).length,8);
  assert.equal(db.sql.prepare('SELECT attempts FROM auth_attempts WHERE bucket=?').get('account:'+await a.sha256('other')).attempts,8);
  // A failed transaction cannot leave a valid-looking session behind.
  const count=db.sql.prepare('SELECT count(*) n FROM auth_sessions').get().n;
  await assert.rejects(db.batch([db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,?)').bind('fixture','own',1,1,2),db.prepare('INSERT INTO accounts(username_key) VALUES(?)').bind('invalid') ]));assert.equal(db.sql.prepare('SELECT count(*) n FROM auth_sessions').get().n,count);
  console.log('PASS native auth with real SQLite: legacy hash upgrade, HttpOnly cookie, hashed tokens, live roles, coach isolation, revocation/logout, concurrent rate limit and atomic rollback. No live accounts used.');
})().catch(e=>{console.error(e);process.exitCode=1});
