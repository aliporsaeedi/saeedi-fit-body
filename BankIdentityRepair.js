var SF_BI_LIBRARY_ALIASES = [{"oldId":"EXLdumbbell-standing-one-arm-curl-over-incline-be","newId":"EXLdumbbell-standing-one-ar-e7dbf1f213","english":"Dumbbell Standing One Arm Curl Over Incline Bench"},{"oldId":"EXLexercise-ball-on-the-wall-calf-raise-tennis-ba","newId":"EXLexercise-ball-on-the-wal-330b513824","english":"Exercise Ball On The Wall Calf Raise Tennis Ball Between Knees"}];
/** Recoverable repair of colliding catalog IDs. Names, nutrition and logs stay intact. */
function sfBiKey_(v) { return adm_norm_(normalize_(v)).replace(/\s+/g,' ').trim(); }
function sfBiHash_(value) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(value),Utilities.Charset.UTF_8).map(function(n){return ('0'+((n+256)%256).toString(16)).slice(-2);}).join(''); }
function sfBiRead_(name) { if(!getSS_().getSheetByName(name)) return null;sfInvalidate_(name);return sfRead_(name); }
function sfBiAnchors_(rd,row){var out={};['PersianName','EnglishName','PlanID','BlockID','PosNo','SetNo','ItemID','DietID','ProgressID','ExerciseName','ItemTitle'].forEach(function(k){if(rd.idx[k]!=null)out[k]=normalize_(row[rd.idx[k]]);});return out;}
function sfBiPlan_() {
  var changes=[],refs=[],unresolved=[],bankRows={},remaps={},originals={};
  ['foods','exercises'].forEach(function(kind){
    var b=adm_bank_(kind),rd=sfBiRead_(b.sheet);if(!rd)return;
    var objects=sfObjects_(rd),used={},seen={},lib={};
    if(kind==='exercises')SF_BI_LIBRARY_ALIASES.forEach(function(it){lib[it.oldId+'|'+sfBiKey_(it.english)]=it.newId;});
    objects.forEach(function(o){var id=normalize_(o[b.id]);used[id]=true;var names=originals[kind+'|'+id] || (originals[kind+'|'+id]=[]);names.push(sfBiKey_(o[b.name]),sfBiKey_(o[b.sub]));});
    rd.rows.forEach(function(row,i){
      var o=sfObj_(rd,row),id=normalize_(o[b.id]);if(!id)return;
      var name=normalize_(o[b.name]),english=normalize_(o[b.sub]),newId=id;
      if(seen[id])newId=(kind==='foods'?'FDR':'EXR')+sfBiHash_(id+'|'+name+'|'+english).slice(0,14);
      if(kind==='exercises' && lib[id+'|'+sfBiKey_(english)])newId=lib[id+'|'+sfBiKey_(english)];
      seen[id]=true;if(newId===id)return;
      if(used[newId])throw new Error('شناسهٔ مقصد از قبل موجود است؛ اصلاح خودکار متوقف شد: '+name);
      used[newId]=true;
      var change={sheet:b.sheet,row:i+2,col:rd.idx[b.id]+1,before:id,after:newId,name:name,english:english,kind:kind,anchors:sfBiAnchors_(rd,row)};
      changes.push(change);(remaps[kind+'|'+id] || (remaps[kind+'|'+id]=[])).push(change);bankRows[b.sheet+'|'+(i+2)]={sheet:b.sheet,row:i+2,headers:rd.headers || Object.keys(rd.idx),values:row};
    });
  });
  function choose(kind,id,name){var list=remaps[kind+'|'+normalize_(id)] || [],key=sfBiKey_(name);return list.filter(function(x){return key && (sfBiKey_(x.name)===key || sfBiKey_(x.english)===key);})[0];}
  function warnUnmatched(kind,id,name,sheet,row){var key=kind+'|'+normalize_(id);if(remaps[key] && (originals[key] || []).indexOf(sfBiKey_(name))<0)unresolved.push({sheet:sheet,row:row,name:normalize_(name),reason:'نام ذخیره‌شده با هیچ‌یک از ردیف‌های برخوردکرده تطبیق قطعی ندارد؛ شناسه تغییر نکرد.'});}
  function addRef(rd,rowNo,col,after,name){var before=normalize_(rd.rows[rowNo-2][rd.idx[col]]);if(before===after)return;refs.push({sheet:rd.sh.getName(),row:rowNo,col:rd.idx[col]+1,before:before,after:after,name:normalize_(name),kind:'reference',anchors:sfBiAnchors_(rd,rd.rows[rowNo-2])});}
  var diets=sfBiRead_('SF_Diets');if(diets && diets.idx.FoodID!=null)diets.rows.forEach(function(row,i){var o=sfObj_(diets,row),match=choose('foods',o.FoodID,o.ItemTitle);if(match)addRef(diets,i+2,'FoodID',match.after,o.ItemTitle);else warnUnmatched('foods',o.FoodID,o.ItemTitle,'SF_Diets',i+2);});
  var itemChanges={},items=sfBiRead_(SF.ITEMS);
  if(items)items.rows.forEach(function(row,i){var o=sfObj_(items,row),match=choose('exercises',o.ExerciseID,o.ExerciseName);if(match){addRef(items,i+2,'ExerciseID',match.after,o.ExerciseName);itemChanges[o.PlanID+'|'+o.BlockID+'|'+o.PosNo]=match.after;}else warnUnmatched('exercises',o.ExerciseID,o.ExerciseName,SF.ITEMS,i+2);});
  var sets=sfBiRead_(SF.SETS);if(sets)sets.rows.forEach(function(row,i){var o=sfObj_(sets,row),id=itemChanges[o.PlanID+'|'+o.BlockID+'|'+o.PosNo];if(id)addRef(sets,i+2,'ExerciseID',id,'');});
  var progress=sfBiRead_(SF.PROGRESS);if(progress)progress.rows.forEach(function(row,i){var o=sfObj_(progress,row),match=choose('exercises',o.ExerciseID,o.ExerciseName);if(match)addRef(progress,i+2,'ExerciseID',match.after,o.ExerciseName);else warnUnmatched('exercises',o.ExerciseID,o.ExerciseName,SF.PROGRESS,i+2);});
  var cells=changes.concat(refs),plan={changes:changes,references:refs,unresolved:unresolved,originalBankRows:Object.keys(bankRows).map(function(k){return bankRows[k];})};
  plan.fingerprint=sfBiHash_(JSON.stringify(cells));return plan;
}
function sfBiBackup_(plan,actor) {
  var ss=getSS_(),sh=ss.getSheetByName('SF_DataRepairBackups');if(!sh){sh=ss.insertSheet('SF_DataRepairBackups');sh.getRange(1,1,1,5).setValues([['SnapshotID','CreatedAt','Actor','ChunkNo','SnapshotJSON']]);sh.setFrozenRows(1);}
  var id=Utilities.getUuid(),text=JSON.stringify(plan),rows=[],now=new Date().toISOString();
  for(var i=0;i<text.length;i+=20000)rows.push([id,now,actor,String(rows.length+1),text.slice(i,i+20000)]);
  sh.getRange(sh.getLastRow()+1,1,rows.length,5).setNumberFormat('@').setValues(rows);SpreadsheetApp.flush();return id;
}
function sfBiLoad_(id) {
  var sh=getSS_().getSheetByName('SF_DataRepairBackups');if(!sh)throw new Error('نسخهٔ پشتیبان پیدا نشد.');
  var rows=sh.getDataRange().getValues().slice(1).filter(function(r){return normalize_(r[0])===normalize_(id);}).sort(function(a,b){return Number(a[3])-Number(b[3]);});
  if(!rows.length)throw new Error('نسخهٔ پشتیبان پیدا نشد.');return JSON.parse(rows.map(function(r){return r[4];}).join(''));
}
function sfBiPublic_(plan,id) { return {ok:true,snapshotId:id || '',fingerprint:plan.fingerprint,changes:plan.changes,references:plan.references.length,unresolved:plan.unresolved}; }
function adm_bankIdentityPreview(token) {
  adm_who_(token,true);adm_ensure_();var pending=PropertiesService.getScriptProperties().getProperty('SF_BANK_ID_PENDING');return pending ? sfBiPublic_(sfBiLoad_(pending),pending) : sfBiPublic_(sfBiPlan_());
}
function sfBiApply_(plan,restore) {
  var cells=plan.changes.concat(plan.references),ss=getSS_(),reads={},targets=cells.map(function(change){var sh=ss.getSheetByName(change.sheet);if(!reads[change.sheet]){var values=sh.getDataRange().getDisplayValues(),idx={};values[0].forEach(function(k,i){idx[normalize_(k)]=i;});reads[change.sheet]={values:values,idx:idx};}var rd=reads[change.sheet],row=rd.values[change.row-1] || [],current=normalize_(row[change.col-1]);if((current!==change.before && current!==change.after) || Object.keys(change.anchors || {}).some(function(k){return rd.idx[k]==null || normalize_(row[rd.idx[k]])!==change.anchors[k];}))throw new Error('اطلاعات این ردیف پس از پیش‌نمایش تغییر کرده است: '+change.sheet+' / '+change.row);return {cell:sh.getRange(change.row,change.col),change:change,current:current};});
  try{targets.forEach(function(t){var desired=restore?t.change.before:t.change.after;if(t.current!==desired)t.cell.setNumberFormat('@').setValue(desired);});SpreadsheetApp.flush();}
  finally{var names={};cells.forEach(function(c){names[c.sheet]=true;});Object.keys(names).forEach(sfInvalidate_);try{sfBumpFoodCache_();}catch(e){}}
}
function adm_bankIdentityRepair(token,fingerprint) {
  var session=adm_who_(token,true);adm_ensure_();return sfWithLock_(function(){
    var props=PropertiesService.getScriptProperties(),pending=props.getProperty('SF_BANK_ID_PENDING'),plan=pending?sfBiLoad_(pending):sfBiPlan_();
    if(plan.fingerprint!==String(fingerprint))throw new Error('دیتابیس تغییر کرده است؛ پیش‌نمایش تازه بگیر.');
    if(!plan.changes.length)return {ok:true,changed:0,references:0};
    var id=pending || sfBiBackup_(plan,session.username);props.setProperty('SF_BANK_ID_PENDING',id);sfBiApply_(plan,false);props.deleteProperty('SF_BANK_ID_PENDING');
    try{CacheService.getScriptCache().remove('adm_dash_v6_admin_'+String(session.username).toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,48));}catch(e){}
    return {ok:true,snapshotId:id,changed:plan.changes.length,references:plan.references.length,unresolved:plan.unresolved};
  });
}
function adm_bankIdentityRestore(token,snapshotId) {
  adm_who_(token,true);return sfWithLock_(function(){var plan=sfBiLoad_(snapshotId);sfBiApply_(plan,true);var props=PropertiesService.getScriptProperties();if(props.getProperty('SF_BANK_ID_PENDING')===String(snapshotId))props.deleteProperty('SF_BANK_ID_PENDING');return {ok:true,restored:plan.changes.length};});
}
