// Private, resumable, parameterized import. Production requests stay disabled
// until every imported column has been read back and verified, then sealed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),directory=path.resolve(process.argv[2]||'');
if(!process.argv[2]||directory===root||directory.startsWith(root+path.sep))throw Error('Private folder outside repository required');
const config=JSON.parse(fs.readFileSync(path.join(__dirname,'wrangler.jsonc'),'utf8'));
const credential=fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if(!credential)throw Error('Cloudflare login required');
const url='https://api.cloudflare.com/client/v4/accounts/'+config.account_id+'/d1/database/'+config.d1_databases[0].database_id+'/query';
async function query(statements){
  for(let attempt=0;attempt<3;attempt++){
    try{
      const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},body:JSON.stringify({batch:statements}),signal:AbortSignal.timeout(60000)});
      if([429,502,503,504].includes(r.status)&&attempt<2){await r.arrayBuffer();await new Promise(r=>setTimeout(r,750*(attempt+1)));continue;}
      const j=await r.json();if(!r.ok||!j.success)throw Error('D1 request failed ('+r.status+', codes '+(j.errors||[]).map(e=>e.code).join(',')+'); private rows omitted');return j.result;
    }catch(error){if((error instanceof TypeError||error.name==='TimeoutError')&&attempt<2){await new Promise(r=>setTimeout(r,750*(attempt+1)));continue;}throw error;}
  }
}
(async()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(directory,'native-import-manifest.json'),'utf8'));
  const statements=fs.readFileSync(path.join(directory,'native-import.ndjson'),'utf8').trim().split('\n').map(JSON.parse);
  const schema=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean);
  await query(schema.map(sql=>({sql,params:[]})));
  const existing=(await query([{sql:'SELECT batch_id FROM native_initial_import WHERE id=1',params:[]}]))[0].results[0];
  if(existing&&existing.batch_id!==manifest.batch)throw Error('Existing native database belongs to another source batch; refusing overwrite');
  const sealed=(await query([{sql:'SELECT batch_id FROM native_imports',params:[]}]))[0].results;
  if(sealed.length){if(sealed[0].batch_id!==manifest.batch)throw Error('Unexpected sealed database');console.log('Native database already sealed; no source data writes performed.');return;}
  const data=statements.filter(s=>s.table!=='native_imports');
  for(let offset=0;!process.argv.includes('--verify-only')&&offset<data.length;offset+=100){
    await query(data.slice(offset,offset+100).map(s=>({sql:s.sql+' ON CONFLICT DO UPDATE SET '+s.columns.map(c=>c+'=excluded.'+c).join(',')+' WHERE NOT ('+s.columns.map(c=>s.table+'.'+c+' IS excluded.'+c).join(' AND ')+')',params:s.params})));
    if(offset%1000===0)console.log('Imported '+Math.min(offset+100,data.length)+'/'+data.length+' private records');
  }
  const byTable=new Map();for(const stmt of data){if(!byTable.has(stmt.table))byTable.set(stmt.table,[]);byTable.get(stmt.table).push(stmt);}
  for(const[table,expected]of byTable){
    const columns=[...new Set(expected.flatMap(s=>s.columns))];
    const info=(await query([{sql:'PRAGMA table_info('+table+')',params:[]}]))[0].results;
    const primary=info.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);
    const identity=row=>JSON.stringify(primary.map(c=>String(row[c]))),actual=new Map();
    let offset=0;for(;;){const rows=(await query([{sql:'SELECT '+columns.join(',')+' FROM '+table+' ORDER BY rowid LIMIT 1000 OFFSET ?',params:[offset]}]))[0].results;if(!rows.length)break;for(const row of rows)actual.set(identity(row),row);offset+=rows.length;}
    if(actual.size!==expected.length)throw Error('Verification count mismatch for '+table);
    for(let index=0;index<expected.length;index++){const stmt=expected[index],row=Object.fromEntries(stmt.columns.map((c,i)=>[c,stmt.params[i]])),got=actual.get(identity(row));if(!got)throw Error('Verification ID mismatch for '+table);for(const c of stmt.columns){const normalize=v=>v==null?null:String(v);if(normalize(got[c])!==normalize(row[c])){console.error(JSON.stringify({table,column:c,rowIndex:index,expectedLength:String(row[c]).length,actualLength:String(got[c]).length}));throw Error('Verification column mismatch for '+table+'.'+c);}}}
    console.log('Verified '+table+' ('+expected.length+')');
  }
  if(process.argv.includes('--seal')){const seal=statements.find(s=>s.table==='native_imports');await query([{sql:seal.sql,params:seal.params}]);}
  console.log(JSON.stringify({verified:true,sealed:process.argv.includes('--seal'),counts:manifest.counts}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
