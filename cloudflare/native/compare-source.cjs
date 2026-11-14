// Private regression against the real exported source. Reports field names and
// counts only, never names, bodies, credentials, or differences in health data.
const fs=require('node:fs'),path=require('node:path'),{isDeepStrictEqual}=require('node:util');
const {context}=require('./source-context.cjs'),{database}=require('../../tests/d1-fixture.cjs');
(async()=>{
  const directory=path.resolve(process.argv[2]||''),book=JSON.parse(fs.readFileSync(path.join(directory,'source-live.json'),'utf8')),configuration=JSON.parse(fs.readFileSync(path.join(directory,'source-configuration.json'),'utf8'));
  const {ctx}=context(book,configuration),db=database();db.sql.exec(fs.readFileSync(path.join(directory,'native-import.sql'),'utf8'));
  const {bootstrap,isoToday}=await import('./data.mjs'),users=db.sql.prepare('SELECT * FROM accounts').all(),differences=[],approvedCorrections=[];
  const fields=['profile','profileHistory','assignments','logs','streak','photos','workouts','diets','supplements','water','meals','activity','doneToday','gate'];
  function paths(a,b,p=''){if(isDeepStrictEqual(a,b))return[];if(!a||!b||typeof a!=='object'||typeof b!=='object')return[p];const keys=new Set([...Object.keys(a),...Object.keys(b)]);return[...keys].flatMap(k=>paths(a[k],b[k],p+'.'+k)).slice(0,12);}
  for(let i=0;i<users.length;i++){
    const user=users[i],old=ctx.getBootstrap('offline:'+user.username,isoToday()),native=await bootstrap(db,user,isoToday(),{});
    if(!old.gate.endDate&&['none','staff'].includes(old.gate.status)&&old.gate.renewSoon===true){old.gate.renewSoon=false;approvedCorrections.push({accountIndex:i,field:'gate.renewSoon',reason:'No subscription is expiring'});}
    for(const row of db.sql.prepare("SELECT date_key,body FROM records WHERE kind='AppLogs' AND owner_key=?").all(user.username_key)){
      const r=JSON.parse(row.body);if(r.DateJalali?.type!=='date')continue;
      for(const log of old.logs.filter(l=>l.date===row.date_key)){log.jalali=new Intl.DateTimeFormat('fa-IR-u-nu-latn',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(log.date+'T12:00:00Z'));approvedCorrections.push({accountIndex:i,field:'logs.jalali',reason:'Jalali cell was a Date; render the actual log date with English digits'});}
    }
    if(process.argv.includes('--gate-details')){const pick=g=>Object.fromEntries(['active','tier','status','daysLeft','endDate','packageId','renewSoon'].map(k=>[k,g[k]]));console.log(JSON.stringify({accountIndex:i,source:pick(old.gate),native:pick(native.gate)}));}
    for(const field of fields){const left=JSON.parse(JSON.stringify(old[field])),right=JSON.parse(JSON.stringify(native[field]));if(!isDeepStrictEqual(left,right))differences.push({accountIndex:i,field,paths:paths(left,right,field)});}
  }
  console.log(JSON.stringify({accounts:users.length,fields:fields.length,approvedCorrections,differences}));if(differences.length)process.exitCode=1;
})().catch(e=>{console.error('Private regression failed: '+e.message);process.exitCode=1});
