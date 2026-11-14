import {AppError,sha256} from './auth.mjs';
import {text,number,ownDate,isoToday,records,sourceOrder,profile,bootstrap} from './data.mjs';
export async function mutate(c,action,args,build,after=base=>base){
  const id=c.request.headers.get('X-Request-ID')||crypto.randomUUID();
  if(!/^[a-zA-Z0-9_-]{16,100}$/.test(id))throw new AppError('شناسهٔ ثبت معتبر نیست.');
  const fingerprint=action+'\n'+await sha256(JSON.stringify(args)),owner=c.user.username_key;
  async function existing(){const row=await c.db.prepare('SELECT action,result FROM request_results WHERE owner_key=? AND request_id=?').bind(owner,id).first();if(!row)return null;if(row.action!==fingerprint)throw new AppError('این شناسه قبلاً برای درخواست دیگری استفاده شده است.',409);return{value:JSON.parse(row.result)};}
  const old=await existing();if(old)return after(old.value);
  const {statements,base={ok:true}}=await build(id);
  try{await c.db.batch([c.db.prepare('INSERT INTO request_results VALUES(?,?,?,?,?)').bind(owner,id,fingerprint,JSON.stringify(base),Math.floor(Date.now()/1000)),...statements]);}
  catch(error){const saved=await existing();if(saved)return after(saved.value);if(/mutation_guard|CHECK constraint/i.test(String(error)))throw new AppError('اطلاعات هم‌زمان تغییر کرده‌اند؛ صفحه را تازه کنید و دوباره ذخیره کنید.',409);throw error;}
  return after(base);
}
export function guard(db){return db.prepare('INSERT INTO mutation_guard(singleton,passed) VALUES(1,changes()) ON CONFLICT(singleton) DO UPDATE SET passed=excluded.passed');}
function saveRecord(c,kind,id,day,body){return c.db.prepare(`INSERT INTO records(record_id,kind,owner_key,date_key,body,updated_at) VALUES(?,?,?,?,?,?)
  ON CONFLICT(record_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at,source_batch='' WHERE records.owner_key=excluded.owner_key AND records.kind=excluded.kind`).bind(id,kind,c.user.username_key,day,JSON.stringify(body),new Date().toISOString());}
function onePerDay(c,kind,id,day,body){return[saveRecord(c,kind,id,day,body),guard(c.db),c.db.prepare('DELETE FROM records WHERE kind=? AND owner_key=? AND date_key=? AND record_id<>?').bind(kind,c.user.username_key,day,id)];}
export async function waterState(c,day){const rows=await records(c.db,'AppWaterLogs',c.user.username_key,{date:day});const p=await profile(c.db,c.user);return{glasses:Math.max(0,...rows.map(r=>number(r.value.Glasses))),goal:number(p.waterGoal,8)};}
async function water(c,mode,amount,clientDay){
  const day=ownDate(clientDay),value=Number(amount),owner=c.user.username_key;
  if(!Number.isInteger(value)||Math.abs(value)>60||mode==='target'&&value<0)throw new AppError('مقدار آب معتبر نیست.');
  return mutate(c,'water:'+mode,[value,day],async()=>{
    const p=await profile(c.db,c.user),id='native:water:'+owner+':'+day,at=new Date().toISOString();
    const sql=`INSERT INTO records(record_id,kind,owner_key,date_key,body,updated_at)
      SELECT ?,'AppWaterLogs',?,?,json_object('Username',?,'DateISO',?,'Glasses',MAX(0,MIN(60,${mode==='target'?'?':"COALESCE((SELECT MAX(CAST(json_extract(body,'$.Glasses') AS REAL)) FROM records WHERE kind='AppWaterLogs' AND owner_key=? AND date_key=?),0)+?"})), 'Goal',?,'UpdatedAt',?),?
      ON CONFLICT(record_id) DO UPDATE SET body=excluded.body,updated_at=excluded.updated_at,source_batch=''`;
    const values=[id,owner,day,c.user.username,day,...(mode==='target'?[value]:[owner,day,value]),number(p.waterGoal,8),at,at];
    return{statements:[c.db.prepare(sql).bind(...values),c.db.prepare("DELETE FROM records WHERE kind='AppWaterLogs' AND owner_key=? AND date_key=? AND record_id<>?").bind(owner,day,id)]};
  },async()=>({ok:true,water:await waterState(c,day)}));
}
export function metrics(p){const w=number(p.weight,75),h=number(p.height,175),age=number(p.age,25),activity=number(p.activity,1.55),bmr=10*w+6.25*h-5*age+(p.gender==='f'?-161:5),tdee=bmr*activity,target=tdee+(p.goal==='lose'?-450:p.goal==='gain'?450:0),protein=Math.max(1.6*w,120),fat=target*.25/9,carbs=Math.max(50,(target-protein*4-fat*9)/4);return{bmr:Math.round(bmr),tdee:Math.round(tdee),targetCalories:Math.round(target),targetProtein:Math.round(protein),targetCarbs:Math.round(carbs),targetFat:Math.round(fat),waterGoal:Math.max(6,Math.round(w/11)),bmi:Number((w/(h/100)**2).toFixed(1))};}
async function saveProfile(c,input={}){
  const p={username:c.user.username,name:text(input.name).slice(0,80),gender:input.gender==='f'?'f':'m',age:number(input.age,25),height:number(input.height,175),weight:number(input.weight,75),goalWeight:number(input.goalWeight,number(input.weight,75)),activity:number(input.activity,1.55),goal:['lose','maintain','gain'].includes(input.goal)?input.goal:'maintain'};
  if(p.age<10||p.age>120||p.height<80||p.height>250||p.weight<20||p.weight>350||p.goalWeight<20||p.goalWeight>350||p.activity<1||p.activity>2.5)throw new AppError('قد، وزن، سن یا سطح فعالیت خارج از محدودهٔ مجاز است.');
  return mutate(c,'saveProfile',[p],async requestId=>{
    const old=await c.db.prepare('SELECT body,updated_at FROM profiles WHERE username_key=?').bind(c.user.username_key).first();if(!old)throw new AppError('پروفایل حساب پیدا نشد.');
    Object.assign(p,metrics(p),{avatarUrl:JSON.parse(old.body).avatarUrl||'',updatedAt:new Date().toISOString()});
    const history={Username:c.user.username,DateISO:isoToday(),WeightKg:p.weight,BMI:p.bmi,TargetCalories:p.targetCalories,CreatedAt:p.updatedAt};
    return{base:{ok:true},statements:[c.db.prepare('UPDATE profiles SET body=?,updated_at=? WHERE username_key=? AND body=?').bind(JSON.stringify(p),p.updatedAt,c.user.username_key,old.body),guard(c.db),saveRecord(c,'ProfileHistory','native:profile-history:'+requestId,isoToday(),history)]};
  },async()=>({ok:true,profile:await profile(c.db,c.user)}));
}
async function saveLog(c,input={},clientDay){
  const day=ownDate(input.date||clientDay),nullable=v=>v==null||text(v)===''?null:Number(v),weight=nullable(input.weight),waist=nullable(input.waist),bodyFat=nullable(input.bodyFat),calories=nullable(input.calories);
  if([weight,waist,bodyFat,calories].some(v=>v!==null&&!Number.isFinite(v))||weight!==null&&(weight<20||weight>350)||waist!==null&&(waist<0||waist>300)||bodyFat!==null&&(bodyFat<0||bodyFat>100)||calories!==null&&(calories<0||calories>20000))throw new AppError('مقدار ثبت بدن معتبر نیست.');
  const body={Username:c.user.username,DateISO:day,DateJalali:new Intl.DateTimeFormat('fa-IR-u-nu-latn',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(day+'T12:00:00Z')),WeightKg:weight,WaistCm:waist,BodyFat:bodyFat,Calories:calories,Notes:text(input.notes).slice(0,2000),CreatedAt:new Date().toISOString()};
  return mutate(c,'saveLog',[day,input],async()=>({statements:onePerDay(c,'AppLogs','native:body:'+c.user.username_key+':'+day,day,body)}),async()=>{const boot=await bootstrap(c.db,c.user,day,c.env);return{ok:true,logs:boot.logs,streak:boot.streak};});
}
async function wellness(c,input={}){
  const day=isoToday(),hours=input.sleepHours==null||text(input.sleepHours)===''?null:Number(input.sleepHours),scores=['sleep','energy','hunger','sore'].map(k=>Number(input[k]));
  if(hours!==null&&(!Number.isFinite(hours)||hours<0||hours>24)||scores.some(s=>!Number.isInteger(s)||s<1||s>5))throw new AppError('ساعت خواب یا امتیاز چک‌این معتبر نیست.');
  const value={Username:c.user.username,DateISO:day,SleepHours:hours,SleepScore:scores[0],Energy:scores[1],Hunger:scores[2],Soreness:scores[3],Notes:text(input.note).slice(0,2000),UpdatedAt:new Date().toISOString()};
  return mutate(c,'sfRefWellnessSave',[day,input],async()=>({statements:onePerDay(c,'WellnessLogs','native:wellness:'+c.user.username_key+':'+day,day,value)}),()=>({ok:true,wellness:{date:day,sleepHours:hours,sleep:scores[0],energy:scores[1],hunger:scores[2],sore:scores[3],note:value.Notes}}));
}
async function remindersSave(c,items){
  const allowed=['workout','water','meal','weight','pill','supplement','nutrition'];
  if(!Array.isArray(items)||items.length>12||items.some(i=>!i||!allowed.includes(i.type)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(i.time)))throw new AppError('نوع یا ساعت یادآور معتبر نیست.');
  const clean=items.map(i=>({type:i.type,time:i.time,on:i.on!==false,daily:i.daily!==false,label:text(i.label).slice(0,60)}));
  return mutate(c,'saveReminders',[clean],async()=>({statements:[saveRecord(c,'Reminders','native:reminders:'+c.user.username_key,'',{Username:c.user.username,ItemsJSON:JSON.stringify(clean),UpdatedAt:new Date().toISOString()}),c.db.prepare("DELETE FROM records WHERE kind='Reminders' AND owner_key=? AND record_id<>?").bind(c.user.username_key,'native:reminders:'+c.user.username_key)]}),async()=>({ok:true,reminders:(await bootstrap(c.db,c.user,isoToday(),c.env)).reminders}));
}
export const WRITE_METHODS={
  addWater:(c,_token,amount,day)=>water(c,'delta',amount??1,day),
  setWater:(c,_token,amount,day)=>water(c,'target',amount,day),
  resetWater:(c,_token,day)=>water(c,'target',0,day),
  saveProfile:(c,_token,input)=>saveProfile(c,input),
  saveLog:(c,_token,input,day)=>saveLog(c,input,day),
  sfRefWellnessSave:(c,_token,input)=>wellness(c,input),
  saveReminders:(c,_token,items)=>remindersSave(c,items),
};
