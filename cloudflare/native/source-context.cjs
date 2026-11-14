// Offline migration only. Runs the existing plan parsers against a read-only
// local export; it is not shipped in the Worker or used as a runtime database.
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function context(book,configuration={}){
  const root=path.resolve(__dirname,'../..'),cache=new Map(),writes=[];
  const revive=v=>v&&typeof v==='object'&&v.type==='date'?new Date(v.value):v;
  const text=v=>v instanceof Date?v.toISOString():String(v??'');
  function sheet(source){
    const data=source.values.map(row=>row.map(revive));
    function range(r,c,h=1,w=1){const values=()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>data[r+i-1]?.[c+j-1]??'')),display=()=>Array.from({length:h},(_,i)=>Array.from({length:w},(_,j)=>source.display?.[r+i-1]?.[c+j-1]??text(data[r+i-1]?.[c+j-1])));return{getValues:values,getDisplayValues:display,getValue:()=>values()[0][0],getDisplayValue:()=>display()[0][0],getFormulas:()=>Array.from({length:h},()=>Array(w).fill('')),setValues:deny,setValue:deny,setNumberFormat:()=>range(r,c,h,w),setNumberFormats:()=>range(r,c,h,w)};}
    function deny(){writes.push(source.name);throw Error('Read-only source adapter');}
    return{getName:()=>source.name,getSheetId:()=>source.id,getLastRow:()=>data.length,getLastColumn:()=>source.columns,getMaxColumns:()=>source.columns,getMaxRows:()=>data.length,getRange:range,getDataRange:()=>range(1,1,Math.max(data.length,1),Math.max(source.columns,1)),appendRow:deny,deleteRow:deny,insertColumnsAfter:deny};
  }
  const sheets=book.sheets.map(sheet),ss={getId:()=>book.metadata.spreadsheetId,getName:()=> 'Private migration source',getSheetByName:n=>sheets.find(s=>s.getName()===n)||null,getSheets:()=>sheets,getSpreadsheetTimeZone:()=>book.metadata.timeZone,insertSheet:()=>{throw Error('Read-only source adapter');}};
  const props={getProperty:k=>configuration[k]??null,getProperties:()=>({...configuration}),setProperty(){throw Error('Read-only source configuration');},deleteProperty(){throw Error('Read-only source configuration');}};
  function formatDate(date,tz,pattern){
    const d=new Date(date),parts=new Intl.DateTimeFormat('en-CA',{timeZone:tz||'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(d),p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return pattern.replace(/yyyy|MM|dd|HH|mm|ss|H|m/g,t=>({yyyy:p.year,MM:p.month,dd:p.day,HH:p.hour,mm:p.minute,ss:p.second,H:String(Number(p.hour)),m:String(Number(p.minute))}[t]));
  }
  const ctx={console:{log(){},warn(){},error(){}},Date,JSON,Math,Set,Map,Buffer,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss,flush(){}},PropertiesService:{getScriptProperties:()=>props},Session:{getScriptTimeZone:()=> 'Asia/Tehran'},CacheService:{getScriptCache:()=>({get:k=>cache.get(k)??null,put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k),getAll:keys=>Object.fromEntries(keys.filter(k=>cache.has(k)).map(k=>[k,cache.get(k)])),putAll:obj=>Object.entries(obj).forEach(([k,v])=>cache.set(k,v))})},Utilities:{formatDate,getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256',MD5:'md5'},computeDigest:(alg,s)=>[...crypto.createHash(alg).update(String(s)).digest()],base64Encode:v=>Buffer.from(v).toString('base64'),base64Decode:v=>[...Buffer.from(v,'base64')],newBlob:v=>({getDataAsString:()=>String(v)})},UrlFetchApp:{fetch(){throw Error('Network disabled in offline migration');},fetchAll(){throw Error('Network disabled in offline migration');}},LockService:{getScriptLock:()=>({waitLock(){throw Error('No writes allowed in offline migration');},tryLock:()=>false,releaseLock(){}})}};
  vm.createContext(ctx);
  const files=['ExerciseData.js','Code.js','TrainingModule.js','ExerciseLibrary.js','MoveSearch.js','ProgramStudio.js','ReviewedMedia.js','ReviewedFoodMedia.js','Subscription.js','Wellness.js','WorkoutSessions.js','AthleteExperience.js','WorkoutReceipt.js'];
  for(const name of files)vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
  // Schema setup/seed must never change source data during conversion.
  ctx.ensureAppSheets_=()=>{};ctx.sfEnsure_=()=>ss;ctx.sfSubEnsure_=()=>true;ctx.sfEnsureTiers_=()=>{};
  ctx.requireSession_=token=>{if(!String(token).startsWith('offline:'))throw Error('Invalid offline token');return ctx.getUserRecord_(String(token).slice(8));};
  return{ctx,ss,writes,run:expression=>vm.runInContext(expression,ctx)};
}
module.exports={context};
