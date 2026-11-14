// The pack is private. Only schema, importer and synthetic tests belong in Git.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),dir=path.resolve(process.argv[2]||'');
if(!process.argv[2]||dir===root||dir.startsWith(root+path.sep))throw Error('Private prepared directory outside repository required');
const data=JSON.parse(fs.readFileSync(path.join(dir,'prepared.json'),'utf8')),config=JSON.parse(fs.readFileSync(path.join(__dirname,'wrangler.jsonc'),'utf8'));
const token=fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];if(!token)throw Error('Owner Cloudflare login required');
const url=`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/d1/database/${config.d1_databases[0].database_id}/query`;
async function query(batch){const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({batch}),signal:AbortSignal.timeout(60000)});const j=await r.json();if(!r.ok||!j.success)throw Error('Catalog D1 request failed ('+r.status+'); private rows omitted');return j.result;}
const columns={catalog_entries:['entry_id','pack_id','kind','source_id','name','category','goal','audience','level','template_id','review_status','revision','body_json','source_ref','updated_at','source_hash'],catalog_templates:['template_id','pack_id','kind','name','columns_json','is_default','layout_json','source_ref'],catalog_issues:['issue_id','pack_id','entry_id','severity','code','message','detail_json','resolved'],catalog_sources:['pack_id','part_no','parts','source_name','source_sha','body_base64']};
const rows={catalog_entries:data.entries.map(e=>[e.id,data.pack,e.kind,e.sourceId,e.name,e.category,e.goal,e.audience,e.level,e.templateId,e.reviewStatus,e.revision,JSON.stringify(e.body),e.sourceRef,e.updatedAt,e.sourceHash]),catalog_templates:data.templates.map(t=>[t.id,data.pack,t.kind,t.name,JSON.stringify(t.columns),Number(t.default),JSON.stringify(t.layout),t.sourceRef]),catalog_issues:data.issues.map(i=>[i.id,data.pack,i.entryId,i.severity,i.code,i.message,JSON.stringify(i.detail),Number(i.resolved)]),catalog_sources:data.tables.SF_PackSources.slice(1).map(r=>[r[0],r[3],r[4],r[1],r[2],r[5]])};
(async()=>{
 const archive=Buffer.from(rows.catalog_sources.map(r=>r[5]).join(''),'base64');assert.equal(archive.length,data.archiveBytes);assert.equal(crypto.createHash('sha256').update(archive).digest('hex'),data.sha256);
 await query(fs.readFileSync(path.join(__dirname,'catalog-schema.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean).map(sql=>({sql,params:[]})));
 const old=(await query([{sql:'SELECT * FROM catalog_packs WHERE pack_id=?',params:[data.pack]}]))[0].results[0];if(old&&old.source_sha!==data.sha256)throw Error('Pack source changed; refusing overwrite');
 if(old?.state==='verified'){console.log('Catalog already verified; no records overwritten.');return;}
 await query([{sql:'INSERT INTO catalog_packs VALUES(?,?,?,?,?,?) ON CONFLICT(pack_id) DO NOTHING',params:[data.pack,data.sha256,data.archiveBytes,data.entries.length,'importing',new Date().toISOString()]}]);
 for(const [table,values] of Object.entries(rows)){
  const cols=columns[table],sql='INSERT INTO '+table+'('+cols.join(',')+') VALUES('+cols.map(()=>'?').join(',')+') ON CONFLICT DO NOTHING';
  for(let i=0;i<values.length;i+=75)await query(values.slice(i,i+75).map(params=>({sql,params})));
  const actual=(await query([{sql:'SELECT '+cols.join(',')+' FROM '+table+' WHERE pack_id=?',params:[data.pack]}]))[0].results;assert.equal(actual.length,values.length,table+' count');
  const key=r=>table==='catalog_sources'?String(r[1]):String(r[0]),by=new Map(actual.map(row=>[key(cols.map(c=>row[c])),row]));
  for(const expected of values){const row=by.get(key(expected));assert(row,table+' missing row');cols.forEach((col,i)=>assert.equal(row[col],expected[i],table+' '+col+' readback'));}
  console.log('Verified every column:',table,values.length);
 }
 const restored=(await query([{sql:'SELECT body_base64 FROM catalog_sources WHERE pack_id=? ORDER BY part_no',params:[data.pack]}]))[0].results.map(r=>r.body_base64).join('');assert.equal(crypto.createHash('sha256').update(Buffer.from(restored,'base64')).digest('hex'),data.sha256);
 await query([{sql:"UPDATE catalog_packs SET state='verified' WHERE pack_id=? AND source_sha=?",params:[data.pack,data.sha256]}]);
 fs.writeFileSync(path.join(dir,'d1-verified.json'),JSON.stringify({pack:data.pack,sha256:data.sha256,entries:data.entries.length,templates:data.templates.length,issues:data.issues.length,archiveBytes:data.archiveBytes,verifiedAt:new Date().toISOString()}));console.log('Native catalog verified; current athlete accounts and assigned programs untouched.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
