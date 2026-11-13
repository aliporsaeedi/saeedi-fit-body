/* Read-only receipt of the signed-in athlete's saved sets. Never counts prescribed work as performed. */
function sfAthleteWorkoutReceipt(token, date, workoutName) {
  var s=requireSession_(token),day=normalize_(date)||todayISO_(),today=todayISO_(),name=normalize_(workoutName);
  var parsed=new Date(day+'T12:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>today||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)throw new Error('تاریخ رسید معتبر نیست.');
  var sh=getSS_().getSheetByName(CONFIG.EXERCISE_LOGS_SHEET),groups=Object.create(null),available=[],sets=0,reps=0,volume=0,volumeComplete=true;
  if(sh)sh.getDataRange().getValues().slice(1).forEach(function(r){
    if(normalize_(r[0]).toLowerCase()!==s.username.toLowerCase()||dateKey_(r[1])!==day)return;
    var wn=normalize_(r[2]);if(available.indexOf(wn)<0)available.push(wn);if(name&&wn!==name)return;
    var rn=r[5],kg=r[4],count=Number(rn),load=kg==null||kg===''?null:Number(kg);
    var validReps=rn!=null&&rn!==''&&Number.isFinite(count)&&count>0&&count<=10000&&Number.isInteger(count),validLoad=load!=null&&Number.isFinite(load)&&load>=0&&load<=10000;
    if(!validReps&&!validLoad)return;
    var ex=normalize_(r[3]);if(!ex)return;var key=wn+'\u0000'+ex;if(!groups[key])groups[key]={name:ex,workoutName:wn,sets:0,reps:0,volumeKg:0};
    sets++;groups[key].sets++;if(validReps){reps+=count;groups[key].reps+=count;}
    if(validReps&&validLoad){volume+=count*load;groups[key].volumeKg+=count*load;}else volumeComplete=false;
  });
  var intervals=[],ss=getSS_().getSheetByName('WorkoutSessions'),now=Date.now();
  if(ss){sfRefSessionValidate_(ss);ss.getDataRange().getValues().slice(1).forEach(function(r){if(normalize_(r[1]).toLowerCase()!==s.username.toLowerCase()||r[6]!=='finished'||(name&&normalize_(r[2])!==name))return;var start=new Date(r[4]),end=new Date(r[5]);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||end.getTime()>now||Utilities.formatDate(start,tz_(),'yyyy-MM-dd')!==day)return;intervals.push([start.getTime(),end.getTime()]);});}
  intervals.sort(function(a,b){return a[0]-b[0];});var merged=[],seconds=0;intervals.forEach(function(i){var last=merged[merged.length-1];if(last&&i[0]<=last[1])last[1]=Math.max(last[1],i[1]);else merged.push(i.slice());});merged.forEach(function(i){seconds+=(i[1]-i[0])/1000;});
  return {ok:true,date:day,workoutName:name,workouts:available,sets:sets,reps:reps,volumeKg:Math.round(volume*100)/100,volumeComplete:volumeComplete,exercises:Object.keys(groups).map(function(k){var g=groups[k];g.volumeKg=Math.round(g.volumeKg*100)/100;return g;}),sessionMinutes:seconds>0?Math.round(seconds/60):null,source:'saved-exercise-sets',timeZone:tz_()};
}
