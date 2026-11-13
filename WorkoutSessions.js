/* Real, user-owned workout sessions. Existing exercise records remain the source of volume. */
function sfRefSessionValidate_(sh){
  var headers=['SessionID','Username','WorkoutName','DayNo','StartedAt','FinishedAt','Status','Minutes','Sets','VolumeKg'],actual=sh.getDataRange().getValues()[0] || [];
  if(headers.some(function(h,i){return actual[i]!==h;}))throw new Error('ساختار جدول جلسه‌ها نیاز به بررسی دارد؛ داده‌ای تغییر نکرد.');
}
function sfRefSessionSheet_(){
  var ss=getSS_(),sh=ss.getSheetByName('WorkoutSessions');
  if(!sh){sh=ss.insertSheet('WorkoutSessions');sh.appendRow(['SessionID','Username','WorkoutName','DayNo','StartedAt','FinishedAt','Status','Minutes','Sets','VolumeKg']);}
  sfRefSessionValidate_(sh);return sh;
}
function sfRefSessionMetrics_(row,now){
  var start=new Date(row[4]).getTime(),stop=row[5] ? new Date(row[5]).getTime() : now,sets=0,volume=0;
  var sh=getSS_().getSheetByName(CONFIG.EXERCISE_LOGS_SHEET);
  if(sh){sh.getDataRange().getValues().slice(1).forEach(function(r){var at=new Date(r[6]).getTime();if(normalize_(r[0]).toLowerCase()===normalize_(row[1]).toLowerCase() && normalize_(r[2])===normalize_(row[2]) && at>=start && at<=stop){sets++;volume+=(Number(r[4])||0)*(Number(r[5])||0);}});}
  return {id:String(row[0]),workoutName:String(row[2]),dayNo:Number(row[3]),startedAt:new Date(row[4]).toISOString(),finishedAt:row[5] ? new Date(row[5]).toISOString() : '',status:String(row[6]),seconds:Math.max(0,Math.floor((stop-start)/1000)),sets:sets,volume:Math.round(volume*100)/100};
}
function sfRefSessionState(token){
  var user=requireSession_(token).username,sh=getSS_().getSheetByName('WorkoutSessions');if(!sh)return {ok:true,session:null};sfRefSessionValidate_(sh);
  var rows=sh.getDataRange().getValues().slice(1).filter(function(r){return normalize_(r[1]).toLowerCase()===user.toLowerCase() && r[6]==='active';});
  return {ok:true,session:rows.length ? sfRefSessionMetrics_(rows[rows.length-1],Date.now()) : null};
}
function sfRefSessionStart(token,input){
  var user=requireSession_(token).username;
  var plans=resolveUserPlans_(user).workout || [],name=normalize_(input && input.workoutName),day=Number(input && input.dayNo);
  var plan=plans.filter(function(p){return p.name===name;})[0];
  if(!plan || !Number.isInteger(day) || day<1 || day>(plan.days || []).length)throw new Error('این جلسه در برنامهٔ تخصیص‌یافتهٔ تو نیست.');
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try{var current=sfRefSessionState(token).session;if(current){if(current.workoutName===name && current.dayNo===day)return {ok:true,session:current};throw new Error('یک جلسهٔ باز داری؛ ابتدا همان جلسه را پایان بده.');}
    var row=[Utilities.getUuid(),user,name,day,new Date().toISOString(),'','active','','',''];sfRefSessionSheet_().appendRow(row);return {ok:true,session:sfRefSessionMetrics_(row,Date.now())};
  }finally{lock.releaseLock();}
}
function sfRefSessionFinish(token,id){
  var user=requireSession_(token).username,lock=LockService.getScriptLock();lock.waitLock(10000);
  try{var sh=sfRefSessionSheet_(),rows=sh.getDataRange().getValues(),index=-1;
    for(var i=1;i<rows.length;i++)if(String(rows[i][0])===String(id) && normalize_(rows[i][1]).toLowerCase()===user.toLowerCase()){index=i;break;}
    if(index<0)throw new Error('جلسه پیدا نشد.');var row=rows[index];if(row[6]==='finished')return {ok:true,session:sfRefSessionMetrics_(row,Date.now())};
    row[5]=new Date().toISOString();row[6]='finished';var result=sfRefSessionMetrics_(row,Date.now());row[7]=Math.round(result.seconds/60*100)/100;row[8]=result.sets;row[9]=result.volume;
    sh.getRange(index+1,6,1,5).setValues([row.slice(5,10)]);return {ok:true,session:result};
  }finally{lock.releaseLock();}
}
function sfRefSessionSummary_(username){
  var out={days:{}},sh=getSS_().getSheetByName('WorkoutSessions');if(!sh)return out;sfRefSessionValidate_(sh);
  sh.getDataRange().getValues().slice(1).forEach(function(r){if(normalize_(r[1]).toLowerCase()!==username.toLowerCase() || r[6]!=='finished')return;var d=Utilities.formatDate(new Date(r[4]),tz_(),'yyyy-MM-dd'),x=out.days[d] || (out.days[d]={minutes:0,sessions:0});x.minutes+=Number(r[7])||0;if(Number(r[8])>0)x.sessions++;});return out;
}
