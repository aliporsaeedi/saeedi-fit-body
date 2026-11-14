// Only Cloudflare's separately signed intake channel can mirror public requests.
// The private key is deployed from an ignored file, never included in client HTML.
function sfLeadAdminAccess(token) {var s=adm_who_(token,true);return {role:s.role,username:s.username};}
function sfRequestMirrorAuth_(body) {
  var age=Date.now()-Number(body.stamp),key=typeof sfProgramRequestKey_==='function'?sfProgramRequestKey_():'';
  if(!key||!/^\d{13}$/.test(String(body.stamp))||!isFinite(age)||age< -10000||age>120000||!/^[a-f0-9-]{36}$/.test(String(body.nonce))||typeof body.payload!=='string'||body.payload.length>12000)return false;
  var expected=Utilities.computeHmacSha256Signature('mirror\n'+body.stamp+'\n'+body.nonce+'\n'+body.payload,key,Utilities.Charset.UTF_8).map(function(x){return ('0'+((x+256)%256).toString(16)).slice(-2);}).join('');
  var received=String(body.sig||''),diff=expected.length^received.length;for(var i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(received.charCodeAt(i)||0);if(diff)return false;
  var cache=CacheService.getScriptCache(),id='program_req_'+body.nonce;if(cache.get(id))return false;cache.put(id,'1',180);return true;
}
function sfProgramRequestMirror_(body) {
  if(!sfRequestMirrorAuth_(body))return {ok:false,error:'unauthorized'};
  var p;try{p=JSON.parse(body.payload);}catch(e){return {ok:false,error:'invalid'};}
  if(!/^REQ-[a-f0-9]{24}$/.test(String(p.id))||!Number.isInteger(p.revision)||p.revision<1||!/^09\d{9}$/.test(String(p.phone))||['new','contacted','awaiting_info','ready','delivered','closed'].indexOf(p.status)<0)return {ok:false,error:'invalid'};
  var headers=['RequestID','Name','Phone','Goal','Service','Note','ConsentVersion','Status','AdminNote','Revision','CreatedAt','UpdatedAt','TelegramStatus','TelegramMessageID'];
  var lock=LockService.getScriptLock();lock.waitLock(10000);var sh,row,notification,shouldSend=false;
  try {
    sh=getSS_().getSheetByName('SF_ProgramRequests');if(!sh){sh=getSS_().insertSheet('SF_ProgramRequests');sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);}
    var values=sh.getDataRange().getValues();if(JSON.stringify(values[0])!==JSON.stringify(headers))throw new Error('ساختار جدول درخواست‌ها تغییر کرده است.');var index=values.findIndex(function(r){return r[0]===p.id;});row=index<0?sh.getLastRow()+1:index+1;var old=index<0?null:values[index];notification=old?String(old[12]||'pending'):'pending';
    if(!old||Number(old[9])<=p.revision){var cells=[p.id,p.name,p.phone,p.goal,p.service,p.note,p.consentVersion,p.status,p.adminNote,p.revision,p.createdAt,p.updatedAt,notification,old?old[13]:''].map(function(x){var s=String(x==null?'':x);return /^[=+@-]/.test(s)?"'"+s:s;});sh.getRange(row,1,1,headers.length).setNumberFormat('@').setValues([cells]);}
    if(notification==='pending'){sh.getRange(row,13).setValue('unknown');notification='unknown';shouldSend=true;SpreadsheetApp.flush();}
    p.revision=Math.max(p.revision,old?Number(old[9]):0);
  }finally{lock.releaseLock();}
  if(shouldSend){
    var props=PropertiesService.getScriptProperties(),token=typeof sfTgToken_==='function'?sfTgToken_():'',chat=props.getProperty('COACH_TELEGRAM_CHAT_ID')||props.getProperty('TG_ADMIN_CHAT')||'',messageId='';
    if(!token||!chat)notification='not_configured';
    else try {
      var goals={lose:'کاهش چربی',gain:'افزایش حجم',maintain:'تناسب اندام',strength:'قدرت',recomp:'بازترکیب بدن',posture:'اصلاح پوسچر'},services={training:'تمرین',nutrition:'تغذیه',combined:'تمرین و تغذیه',home:'تمرین در خانه'};
      var text='درخواست برنامهٔ جدید\n'+p.id+'\n'+String(p.name).slice(0,80)+'\nموبایل: '+p.phone+' (هنوز با OTP تأیید نشده)\nهدف: '+(goals[p.goal]||p.goal)+'\nخدمت: '+(services[p.service]||p.service)+'\n'+String(p.note||'').slice(0,700)+'\nپیگیری: https://admin.saeedifitbody.ir/#/comms.requests';
      var result=UrlFetchApp.fetch('https://api.telegram.org/bot'+token+'/sendMessage',{method:'post',contentType:'application/json',payload:JSON.stringify({chat_id:chat,text:text,disable_web_page_preview:true}),muteHttpExceptions:true});var data=JSON.parse(result.getContentText());notification=result.getResponseCode()===200&&data.ok===true?'sent':'rejected';if(notification==='sent')messageId=String(data.result.message_id);
    }catch(e){notification='unknown';}
    lock.waitLock(10000);try{sh.getRange(row,13,1,2).setValues([[notification,messageId]]);}finally{lock.releaseLock();}
  }
  return {ok:true,id:p.id,revision:p.revision,notification:notification};
}
