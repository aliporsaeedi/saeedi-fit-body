/** Repair library copies from their source, keeping a recoverable snapshot first. */
function sfBackupLibraryPlan_(plan) {
  var snapshot={plan:plan,blocks:sfObjects_(sfRead_(SF.BLOCKS)).filter(function(r){return r.PlanID===plan.PlanID;}),items:sfObjects_(sfRead_(SF.ITEMS)).filter(function(r){return r.PlanID===plan.PlanID;}),sets:sfObjects_(sfRead_(SF.SETS)).filter(function(r){return r.PlanID===plan.PlanID;})};
  var ss=getSS_(),name='SF_ProgramBackups',sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,6).setValues([['SnapshotID','PlanID','PlanName','CreatedAt','ChunkNo','SnapshotJSON']]);sh.setFrozenRows(1);}
  var text=JSON.stringify(snapshot),id=Utilities.getUuid(),now=new Date().toISOString(),rows=[];
  for(var i=0;i<text.length;i+=20000) rows.push([id,plan.PlanID,plan.PlanName,now,String(rows.length+1),text.slice(i,i+20000)]);
  sh.getRange(sh.getLastRow()+1,1,rows.length,6).setNumberFormat('@').setValues(rows);return id;
}
function adm_legacyBankRepair(token,name) {
  var session=adm_who_(token,true);sfEnsure_();name=normalize_(name);
  var plans=sfObjects_(sfRead_(SF.PLANS)),target=plans.find(function(p){return normalize_(p.Username)===SF7_LIB && normalize_(p.PlanName)===name;});
  if(!target)throw new Error('نسخهٔ بانکی پیدا نشد.');
  var sourceName=(listPlanSheets_().workout || []).find(function(n){return normalize_(n)===name;}),payload=null,original=null;
  if(sourceName){var text=getSS_().getSheetByName(sourceName).getDataRange().getDisplayValues().map(function(r){return r.join('\t');}).join('\n'),parsed=sfPiParse_(text,{createMissing:false});if(parsed.unmatched.length)throw new Error('حرکت‌های ناشناخته باید ابتدا تطبیق داده شوند: '+parsed.unmatched.map(function(x){return x.name;}).join('، '));payload=sfPiPayload_(parsed,{username:SF7_LIB,planName:name});payload.planId=target.PlanID;payload.goal=target.Goal || '';payload.level=target.Level || '';payload.audience=target.Audience || '';payload.coachNotes=target.CoachNotes || '';sfValidatePlan_(payload,sfBankMap_());}
  else{original=plans.find(function(p){return normalize_(p.Username)!==SF7_LIB && normalize_(p.PlanName)===name;});if(!original)throw new Error('مبدا پیدا نشد.');}
  var snapshot=sfWithLock_(function(){return sfBackupLibraryPlan_(target);});
  if(payload)sfAdminSavePlan(token,payload);else sfWithLock_(function(){sf7CopyWorkoutTo_(original.PlanID,SF7_LIB,name,session.username);});
  var audit=adm_legacyBankAudit(token,name);return {ok:true,name:name,snapshotId:snapshot,verified:audit.structureMatch,audit:audit};
}
