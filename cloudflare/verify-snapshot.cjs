// Owner-only migration verification. Uses the normal Wrangler CLI login;
// never emits row contents or credentials. Run outside the browser bundle.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const cfg=fs.readFileSync(path.join(process.env.APPDATA,'xdg.config/.wrangler/config/default.toml'),'utf8');
const token=cfg.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if(!token)throw Error('Cloudflare login required');
async function query(sql,params=[]){
  const r=await fetch('https://api.cloudflare.com/client/v4/accounts/7eda224d6c9b5361506b0572f10ca8b3/d1/database/2d63400a-dff4-4b3e-8eec-ef5fb7273658/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
  const j=await r.json();if(!r.ok||!j.success)throw Error('D1 verification request failed: '+r.status);return j.result[0].results;
}
(async()=>{
  const sheets=await query('SELECT * FROM source_sheets WHERE batch_id=? ORDER BY sheet_index',[manifest.batch]);
  if(sheets.length!==manifest.sheets.length)throw Error('Sheet count mismatch');
  const buckets=new Map();let after=-1,total=0;
  for(;;){
    const rows=await query('SELECT rowid,sheet_index,row_index,cells FROM source_rows WHERE batch_id=? AND rowid>? ORDER BY rowid LIMIT 1000',[manifest.batch,after]);
    if(!rows.length)break;
    for(const r of rows){if(!buckets.has(r.sheet_index))buckets.set(r.sheet_index,[]);buckets.get(r.sheet_index).push(r);after=r.rowid;total++;}
  }
  for(const expected of manifest.sheets){
    const actual=sheets.find(s=>s.sheet_index===expected.index),rows=(buckets.get(expected.index)||[]).sort((a,b)=>a.row_index-b.row_index);
    if(actual.name!==expected.name||rows.length!==expected.rows)throw Error('Sheet name/count mismatch at index '+expected.index);
    const json='['+rows.map(r=>'['+r.row_index+','+r.cells+']').join(',')+']';
    const hash=crypto.createHash('sha256').update(json).digest('hex');
    if(hash!==expected.sha256)throw Error('Cell content mismatch at sheet index '+expected.index);
  }
  console.log(JSON.stringify({verified:true,sheets:sheets.length,nonemptyRows:total,batch:manifest.batch,production:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1});
