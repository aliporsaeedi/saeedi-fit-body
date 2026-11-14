// Read-only source export using an owner-deployed signed migration channel.
// Never log credentials, user rows or exported configuration.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const output=path.resolve(process.argv[2]||'');
const root=path.resolve(__dirname,'..');
if(!process.argv[2]||output===root||output.startsWith(root+path.sep))throw Error('A private output folder outside this repository is required');
const secretPath=path.join(output,'migration-key.json');
if(process.argv.includes('--prepare')){
  fs.mkdirSync(output,{recursive:true});
  if(!fs.existsSync(secretPath))fs.writeFileSync(secretPath,JSON.stringify({key:crypto.randomBytes(32).toString('hex')}));
  const {key}=JSON.parse(fs.readFileSync(secretPath,'utf8'));
  fs.writeFileSync(path.join(root,'MigrationSecret.js'),'// Private deployment configuration. Never commit.\nfunction sfMigrationKey_(){return '+JSON.stringify(key)+';}\n');
  console.log('Private migration credential prepared; no data exported.');
  process.exit(0);
}
const {key}=JSON.parse(fs.readFileSync(secretPath,'utf8'));
const url=process.env.SF_MIGRATION_SOURCE_URL||'https://script.google.com/macros/s/AKfycbzO_LMU-DubcWtLc2ediWJJVO5lAHwPBQPoV0LzGq9MOJ8g8pYgviCHkDy2LwbVyxNs/exec';
let sourceClockOffset=0;
async function call(payload){
  const timestamp=Date.now()+sourceClockOffset,nonce=crypto.randomBytes(16).toString('hex');
  const signature=crypto.createHmac('sha256',key).update(timestamp+'\n'+nonce+'\n'+JSON.stringify(payload)).digest('hex');
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({a:'migration-read',timestamp,nonce,payload,signature}),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error('Source export HTTP '+r.status);
  let j;try{j=await r.json();}catch{throw Error('Source export returned a non-JSON response');}
  if(!j.ok)throw Error('Source export rejected: '+j.error);
  return j.data;
}
(async()=>{
  // Align request timestamps to the TLS-authenticated source HTTP clock without
  // weakening server freshness checks or changing the owner's computer clock.
  const clock=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"a":"migration-read"}',signal:AbortSignal.timeout(30000)});
  const sourceTime=Date.parse(clock.headers.get('Date'));
  if(!Number.isFinite(sourceTime))throw Error('Source clock unavailable');
  sourceClockOffset=Math.round(sourceTime-Date.now());
  await clock.arrayBuffer();
  const metadata=await call({op:'metadata'});
  if(metadata.spreadsheetId!=='1LMQPydjxPR_bnY8aORu5KhDeIZHu5j7DjaYce4B3o5s')throw Error('Unexpected source workbook');
  const book={exportedAt:new Date().toISOString(),metadata,sheets:[]};
  // Two bounded reads in flight; avoids flooding Apps Script execution quotas.
  for(const sh of metadata.sheets){
    const target={...sh,values:[],display:[]};
    const page=Math.max(1,Math.min(300,Math.floor(15000/Math.max(1,sh.columns))));
    for(let start=1;start<=sh.rows;start+=page*2){
      const jobs=[start,start+page].filter(s=>s<=sh.rows).map(s=>call({op:'rows',sheetId:sh.id,start:s,count:Math.min(page,sh.rows-s+1)}));
      for(const data of await Promise.all(jobs)){target.values.push(...data.rows);target.display.push(...data.display);}
    }
    book.sheets.push(target);
    fs.writeFileSync(path.join(output,'source-live.partial.json'),JSON.stringify(book));
    console.log('Exported sheet '+book.sheets.length+'/'+metadata.sheets.length+' ('+target.values.length+' rows)');
  }
  const config=await call({op:'configuration'});
  fs.writeFileSync(path.join(output,'source-configuration.json'),JSON.stringify(config));
  fs.writeFileSync(path.join(output,'source-live.json'),JSON.stringify(book));
  const hash=crypto.createHash('sha256').update(JSON.stringify(book)).digest('hex');
  fs.writeFileSync(path.join(output,'source-live.sha256'),hash+'\n');
  console.log(JSON.stringify({complete:true,sheets:book.sheets.length,sha256:hash}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
