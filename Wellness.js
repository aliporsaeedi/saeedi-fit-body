/* Structured wellness records, scoped to the signed-in athlete and today's date. */
function sfRefWellnessToday_(username,today){
  var sh=getSS_().getSheetByName('WellnessLogs');if(!sh)return null;
  var rows=sh.getDataRange().getValues().slice(1).filter(function(r){return normalize_(r[0]).toLowerCase()===username.toLowerCase() && dateKey_(r[1])===today;});
  if(!rows.length)return null;var r=rows[rows.length-1];return {date:today,sleepHours:r[2]==='' ? null : Number(r[2]),sleep:Number(r[3]),energy:Number(r[4]),hunger:Number(r[5]),sore:Number(r[6]),note:String(r[7] || '')};
}
function sfRefWellnessSave(token,input){
  var user=requireSession_(token).username,today=todayISO_();input=input || {};
  var hours=input.sleepHours==null || String(input.sleepHours).trim()==='' ? null : Number(input.sleepHours);
  if(hours!==null && (!isFinite(hours) || hours<0 || hours>24))throw new Error('ساعت خواب باید بین 0 تا 24 باشد.');
  var scores=['sleep','energy','hunger','sore'].map(function(k){var n=Number(input[k]);if(!Number.isInteger(n) || n<1 || n>5)throw new Error('امتیازها باید بین 1 تا 5 باشند.');return n;});
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try{var ss=getSS_(),sh=ss.getSheetByName('WellnessLogs'),headers=['Username','DateISO','SleepHours','SleepScore','Energy','Hunger','Soreness','Notes','UpdatedAt'];
    if(!sh){sh=ss.insertSheet('WellnessLogs');sh.appendRow(headers);}
    var values=sh.getDataRange().getValues();if(headers.some(function(h,i){return values[0][i]!==h;}))throw new Error('ساختار جدول چک‌این نیاز به بررسی دارد؛ داده‌ای تغییر نکرد.');
    var row=[user,today,hours===null?'':hours].concat(scores,[normalize_(input.note).slice(0,2000),new Date().toISOString()]),index=-1;
    for(var i=1;i<values.length;i++)if(normalize_(values[i][0]).toLowerCase()===user.toLowerCase() && dateKey_(values[i][1])===today)index=i;
    if(index<0)sh.appendRow(row);else sh.getRange(index+1,1,1,row.length).setValues([row]);
    return {ok:true,wellness:sfRefWellnessToday_(user,today)};
  }finally{lock.releaseLock();}
}
