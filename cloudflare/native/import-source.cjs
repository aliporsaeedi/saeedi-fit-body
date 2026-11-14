// Build a new native database from a signed, private source export. Never
// overwrite an existing native database or commit the generated SQL/data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {context}=require('./source-context.cjs');
const root=path.resolve(__dirname,'../..'),directory=path.resolve(process.argv[2]||'');
if(!process.argv[2]||directory===root||directory.startsWith(root+path.sep))throw Error('Private input/output folder outside repository required');
const text=x=>String(x??'').trim(),key=x=>text(x).toLowerCase();
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function quote(v){return v==null?'NULL':"'"+String(v).replace(/'/g,"''")+"'";}
(async()=>{
  const raw=fs.readFileSync(path.join(directory,'source-live.json'),'utf8'),book=JSON.parse(raw),configuration=JSON.parse(fs.readFileSync(path.join(directory,'source-configuration.json'),'utf8'));
  const batch=hash(raw),manifestPath=path.join(directory,'native-import-manifest.json'),previous=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath,'utf8')):null;
  const now=previous?.batch===batch?previous.createdAt:new Date().toISOString(),{ctx,ss,writes}=context(book,configuration);
  const {makePassword}=await import('./auth.mjs'),{workoutFromEditor}=await import('./plans.mjs');
  function table(name){const s=book.sheets.find(s=>s.name===name);if(!s)return[];const h=s.values[0].map(text);return s.values.slice(1).filter(row=>row.some(v=>v!==''&&v!=null)).map((row,i)=>Object.assign(Object.fromEntries(h.map((h,j)=>[h,row[j]??''])),{__row:i+2}));}
  const counts={accounts:0,profiles:0,programs:0,exercises:0,records:0,packages:0,subscriptions:0},warnings={unknownCoach:0,orphanSubscriptions:0};
  const sql=[fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8')],statements=[];
  function insert(table,columns,values){sql.push('INSERT INTO '+table+'('+columns.join(',')+') VALUES('+values.map(quote).join(',')+');');statements.push({table,columns,sql:'INSERT INTO '+table+'('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')',params:values});if(table in counts)counts[table]++;}
  // Fail instead of quietly replacing current accounts or newer application data.
  sql.push('CREATE TABLE IF NOT EXISTS native_initial_import(id INTEGER PRIMARY KEY CHECK(id=1),batch_id TEXT NOT NULL);');
  insert('native_initial_import',['id','batch_id'],[1,batch]);
  const users=table('Users'),known=new Set(users.map(u=>key(u.user||u.Username)));
  const oldUser=ctx.getUserRecord_;
  ctx.getUserRecord_=username=>{
    const record=oldUser(username),u=users.find(u=>key(u.user||u.Username)===key(username));
    return record&&u?{...record,email:text(u.Email||u.email),coachUsername:text(u.coachUsername||u.CoachUsername)}:record;
  };
  for(const u of users){
    const username=text(u.user||u.Username),owner=key(username),role=key(u.role||u.Role)||'user';
    if(!owner||!['user','coach','admin'].includes(role))throw Error('Invalid source account schema');
    let password=text(u.pass||u.Password);if(!password)throw Error('Source account has an empty password');
    if(!password.includes('$'))password=await makePassword(password);
    const coach=key(u.coachUsername||u.CoachUsername);if(coach&&!known.has(coach))warnings.unknownCoach++;
    insert('accounts',['username_key','username','password_hash','role','email','coach_key','telegram_chat_id','source_batch','created_at','updated_at'],[owner,username,password,role,text(u.Email||u.email),coach,text(u.telegramChatId),batch,now,now]);
    const profile=ctx.getProfile_(username);
    insert('profiles',['username_key','body','updated_at'],[owner,JSON.stringify(profile),now]);
  }
  const bank=ctx.sfBankMap_(),projectionBank={};
  for(const row of table('SF_ExerciseBank')){
    const id=text(row.ExerciseID);if(!id)continue;
    projectionBank[id]=ctx.sfBankLegacyInfo_(bank[id]);
    insert('exercises',['exercise_id','name','name_key','body','active'],[id,text(row.PersianName),key(row.PersianName),JSON.stringify({...row,legacy:projectionBank[id]}),String(row.Active).toLowerCase()==='false'?0:1]);
  }
  const memo=ctx.sfBankMemo_();
  for(const[alias,index]of Object.entries(memo.map))insert('records',['record_id','kind','lookup_key','body','source_batch','updated_at'],['exercise-name:'+hash(alias),'exercise_exact_name',alias,JSON.stringify({exerciseId:memo.list[index].ExerciseID,order:index}),batch,now]);
  const imported=new Set(),planOwners=new Map(),editors=ctx.sfBuildPlans_(ctx.sfObjects_(ctx.sfRead_('SF_Plans')),bank).plans;
  function addProgram(owner,kind,body,id,active=true,editor=null){
    const identity=id||'legacy_'+hash(owner+'\n'+kind+'\n'+body.name).slice(0,24);
    if(imported.has(identity))throw Error('Duplicate source program ID');imported.add(identity);
    insert('programs',['program_id','owner_key','kind','name','active','body','editor_body','source_batch','updated_at'],[identity,owner,kind,body.name,active?1:0,JSON.stringify(body),editor?JSON.stringify(editor):null,batch,now]);
  }
  for(const editor of editors){const owner=key(editor.username);planOwners.set(editor.planId,owner);addProgram(owner,'workout',workoutFromEditor(editor,projectionBank),editor.planId,editor.active,editor);}
  const canonical={};
  for(const owner of known){
    const resolved=ctx.resolveUserPlans_(owner);canonical[owner]=resolved;
    for(const plan of resolved.workout){
      if(plan.sfPlanId){const editor=editors.find(p=>p.planId===plan.sfPlanId);if(!editor)throw Error('Resolved plan lost its original ID');assert.deepEqual(JSON.parse(JSON.stringify(workoutFromEditor(editor,projectionBank))),JSON.parse(JSON.stringify(plan)),'Native workout projection differs from source');}
      else addProgram(owner,'workout',plan,null,true);
    }
    // Stored as baseline for migration comparisons only; never serve this as a
    // fake live bootstrap response after profile/log/subscription changes.
    const extras={assignments:ctx.getAssignedPlans_(owner),planLibrary:ctx.listPlanNames_()};
    insert('records',['record_id','kind','owner_key','body','source_batch','updated_at'],['baseline:'+owner,'migration_baseline',owner,JSON.stringify(extras),batch,now]);
  }
  // Keep inactive diet/supplement groups too; restore original active filtering
  // immediately after this read-only projection.
  for(const[kind,name,helper,idField,falseFunction]of [['diet','SF_Diets','sfDietsAsLegacy_','DietID','sfIsFalseValue2_'],['supplement','SF_Supps','sfSuppsAsLegacy_','SuppID','sfIsFalseValue_']]){
    const rows=table(name),owners=[...new Set(rows.map(r=>key(r.Username)).filter(Boolean))],old=ctx[falseFunction];ctx[falseFunction]=()=>false;
    try{for(const owner of owners){for(const plan of ctx[helper](owner)){
      const group=rows.filter(r=>key(r.Username)===owner&&text(r.PlanName)===plan.name);
      const active=group.some(r=>key(r.Active)!=='false');
      const id=text(group[0]?.[idField])||kind+'_'+hash(owner+'\n'+plan.name).slice(0,24);
      addProgram(owner,kind,plan,id,active);
    }}}finally{ctx[falseFunction]=old;}
  }
  // Legacy-only assigned diet/supplement sheets remain assigned with exact names.
  for(const[owner,resolved]of Object.entries(canonical))for(const kind of ['diet','supplement'])for(const plan of resolved[kind]){
    const existing=sql.some(line=>line.startsWith('INSERT INTO programs(')&&line.includes(','+quote(owner)+','+quote(kind)+','+quote(plan.name)+','));
    if(!existing)addProgram(owner,kind,plan,null,true);
  }
  for(const s of book.sheets){
    if(s.name==='Users')continue;
    const h=s.values[0]?.map(text)||[];
    for(let i=1;i<s.values.length;i++){
      const row=s.values[i];if(!row.some(v=>v!==''&&v!=null))continue;
      const body=Object.fromEntries(h.filter(Boolean).map(label=>[label,row[h.indexOf(label)]??'']));
      let owner=key(body.Username||body.Athlete||body['شاگرد']);if(!owner&&body.PlanID)owner=planOwners.get(text(body.PlanID))||'';
      const date=body.DateISO?ctx.dateKey_(body.DateISO?.type==='date'?new Date(body.DateISO.value):body.DateISO):'';
      const lookup=text(body.PlanID||body.Key||body.Code||body.PayID||body.ExerciseID||'');
      insert('records',['record_id','kind','owner_key','date_key','lookup_key','body','source_batch','updated_at'],['source:'+s.id+':'+(i+1),s.name,owner,date,lookup,JSON.stringify(body),batch,now]);
    }
  }
  for(const p of table('SF_Packages'))insert('packages',['package_id','body','active'],[text(p.PackageID),JSON.stringify(p),key(p.Active)==='false'?0:1]);
  const reviveDate=v=>v?.type==='date'?new Date(v.value):v;
  for(const s of table('SF_Subs')){const owner=key(s.Username);if(!known.has(owner)){warnings.orphanSubscriptions++;continue;}const pkg=table('SF_Packages').find(p=>text(p.PackageID)===text(s.PackageID));const body={...s,_migrationTier:ctx.sfTierKeyOf_({packageId:s.PackageID},pkg?.Name||''),_migrationHonorExistingWindow:true};insert('subscriptions',['sub_id','owner_key','package_id','start_date','end_date','status','body'],[text(s.SubID),owner,text(s.PackageID),ctx.sfDateIso_(reviveDate(s.StartDate)),ctx.sfDateIso_(reviveDate(s.EndDate)),key(s.Status),JSON.stringify(body)]);}
  for(const s of table('SF_Settings'))if(text(s.Key))insert('settings',['key','value'],[text(s.Key),String(s.Value??'')]);
  if(writes.length)throw Error('Source parsers attempted writes; migration stopped');
  insert('native_imports',['batch_id','imported_at','source_sha256','counts'],[batch,now,batch,JSON.stringify(counts)]);
  fs.writeFileSync(path.join(directory,'native-import.sql'),sql.join('\n'));
  fs.writeFileSync(path.join(directory,'native-import.ndjson'),statements.map(s=>JSON.stringify(s)).join('\n'));
  fs.writeFileSync(path.join(directory,'native-program-baseline.json'),JSON.stringify(canonical));
  fs.writeFileSync(path.join(directory,'native-import-manifest.json'),JSON.stringify({batch,counts,warnings,createdAt:now}));
  console.log(JSON.stringify({prepared:true,counts,warnings,sqlBytes:fs.statSync(path.join(directory,'native-import.sql')).size}));
})().catch(e=>{console.error('Native conversion stopped: '+e.message);if(process.env.SF_DEBUG_IMPORT==='1')console.error(e.stack);process.exitCode=1});
