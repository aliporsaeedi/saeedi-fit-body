import {AppError} from './auth.mjs';
export const text=value=>String(value&&typeof value==='object'&&value.type==='date'?value.value:value??'').trim();
export const number=(value,fallback=0)=>value==null||value===''||!Number.isFinite(Number(value))?fallback:Number(value);
export function isoToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function dayKey(value){
  if(value&&typeof value==='object'&&value.type==='date')return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value.value));
  const s=text(value);return validDate(s)?s:s.slice(0,10);
}
export function ownDate(value){const today=isoToday();if(!value)return today;if(!validDate(value)||Math.abs(Date.parse(value+'T12:00:00Z')-Date.parse(today+'T12:00:00Z'))>36*3600*1000)throw new AppError('تاریخ ثبت باید مربوط به امروز باشد.');return value;}
export function previousDay(day){return new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);}
export function sourceOrder(a,b){return Number(a.record_id?.split(':').at(-1)||0)-Number(b.record_id?.split(':').at(-1)||0);}
export async function records(db,kind,owner,{limit=5000,date,from}={}){
  let query='SELECT record_id,date_key,body,updated_at,source_batch FROM records WHERE kind=? AND owner_key=?',args=[kind,owner];
  if(date){query+=' AND date_key=?';args.push(date);}if(from){query+=' AND date_key>=?';args.push(from);}
  query+=' ORDER BY updated_at DESC LIMIT ?';args.push(limit);
  const r=await db.prepare(query).bind(...args).all();return r.results.map(r=>({...r,value:JSON.parse(r.body)}));
}
const NONE={key:'none',name:'بدون اشتراک',pdf:true,gif:false,bot:false,ai:0,reports:false},SILVER={key:'silver',name:'نقره‌ای',pdf:true,gif:false,bot:false,ai:10,reports:false},GOLD={key:'gold',name:'طلایی',pdf:true,gif:true,bot:true,ai:-1,reports:true};
export async function gate(db,user){
  const today=isoToday(),[subscriptions,packages]=await Promise.all([db.prepare('SELECT * FROM subscriptions WHERE owner_key=?').bind(user.username_key).all(),db.prepare('SELECT package_id,body FROM packages').all()]);
  const catalog=new Map(packages.results.map(p=>[p.package_id,JSON.parse(p.body)]));let best=null;
  for(const sub of subscriptions.results){
    const historical=JSON.parse(sub.body);
    // Existing prepaid extensions already granted benefits in the old system.
    // Preserve those rights; newly created subscriptions do not get this flag.
    if(/cancel|reject|refund|لغو/.test(sub.status)||sub.start_date&&sub.start_date>today&&!historical._migrationHonorExistingWindow)continue;
    if(!['','active','grace','expired'].includes(sub.status))continue;
    let pkg=catalog.get(sub.package_id);
    if(!pkg){const historicalTier=JSON.parse(sub.body)._migrationTier;if(!['silver','gold'].includes(historicalTier))continue;pkg={Tier:historicalTier,Name:''};}
    let end=sub.end_date;
    if(!end&&validDate(sub.start_date)&&Number(pkg.Days)>0)end=new Date(Date.parse(sub.start_date+'T00:00:00Z')+Number(pkg.Days)*86400000).toISOString().slice(0,10);
    if(!validDate(end))continue;
    const left=Math.round((Date.parse(end+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
    const status=sub.status==='expired'?'expired':left<0?(left>=-3?'grace':'expired'):'active';
    const rank=(status==='expired'?0:2)*100000000+Number(end.replaceAll('-',''));
    if(!best||rank>best.rank)best={pkg,end,left,status,rank,packageId:sub.package_id};
  }
  const staff=['coach','admin'].includes(user.role),active=!!best&&best.status!=='expired';
  const tier=staff?'gold':active?(text(best.pkg.Tier).toLowerCase()==='gold'||/طلای|gold|حرفه|الماس/i.test(best.pkg.Name)?'gold':'silver'):'none';
  const features={...(tier==='gold'?GOLD:tier==='silver'?SILVER:NONE)};
  return{active:staff||active,staff,tier,tierName:staff?'مربی':active?(tier==='gold'?'طلایی':'نقره‌ای'):best?'منقضی':'بدون اشتراک',status:staff?'staff':best?.status||'none',daysLeft:Math.max(0,Math.min(9999,best?.left||0)),endDate:best?.end||'',packageId:best?.packageId||'',packageName:text(best?.pkg.Name),renewSoon:!!best&&best.status!=='expired'&&best.left<=7,features,limits:{pdf:true,gif:features.gif,bot:features.bot,ai:features.ai,reports:features.reports}};
}
export async function profile(db,user){const row=await db.prepare('SELECT body FROM profiles WHERE username_key=?').bind(user.username_key).first();if(!row)throw new AppError('پروفایل حساب نیاز به تکمیل دارد.',409);return JSON.parse(row.body);}
export async function assignedPrograms(db,user){const rows=await db.prepare('SELECT program_id,kind,body FROM programs WHERE owner_key=? AND active=1 ORDER BY rowid').bind(user.username_key).all();const out={workout:[],diet:[],supplement:[]};for(const row of rows.results)out[row.kind].push(JSON.parse(row.body));return out;}
export async function reminders(db,user,env){
  const rows=(await records(db,'Reminders',user.username_key,{limit:50})).sort(sourceOrder),raw=rows.at(-1)?.value.ItemsJSON;
  let items=[];try{items=JSON.parse(raw||'[]');}catch{}
  return{timeZone:'Asia/Tehran',items,configured:!!(env.TELEGRAM_BOT_TOKEN&&env.BOT_USERNAME),linked:!!user.telegram_chat_id,platform:env.BOT_PLATFORM||'telegram'};
}
export function mealsFromRows(rows,today){
  const out={today:[],yesterday:[],days:{}},yesterday=previousDay(today);
  for(const row of rows.sort(sourceOrder)){
    const r=row.value,day=row.date_key||dayKey(r.DateISO),item={id:text(r.CreatedAt),title:text(r.Title),kcal:number(r.Kcal),protein:number(r.Protein),carbs:number(r.Carbs),fat:number(r.Fat)};
    const sum=out.days[day]||(out.days[day]={kcal:0,protein:0,carbs:0,fat:0});for(const k of ['kcal','protein','carbs','fat'])sum[k]+=item[k];
    if(day===today)out.today.push(item);else if(day===yesterday)out.yesterday.push(item);
  }
  return out;
}
export async function bootstrap(db,user,clientToday,env){
  const today=validDate(clientToday)?clientToday:isoToday();
  const [p,programs,g,logs,water,meals,photos,done,sets,history,messages,rem,baseline,wellness]=await Promise.all([
    profile(db,user),assignedPrograms(db,user),gate(db,user),records(db,'AppLogs',user.username_key,{limit:2000}),records(db,'AppWaterLogs',user.username_key),records(db,'MealLogs',user.username_key),records(db,'ProgressPhotos',user.username_key),records(db,'WorkoutDone',user.username_key),records(db,'ExerciseLogs',user.username_key),records(db,'ProfileHistory',user.username_key),records(db,'Messages',user.username_key,{limit:200}),reminders(db,user,env),records(db,'migration_baseline',user.username_key,{limit:1}),records(db,'WellnessLogs',user.username_key,{date:today}),
  ]);
  const bodyLogs=logs.sort((a,b)=>b.date_key.localeCompare(a.date_key)).slice(0,180).map(({value:r,date_key})=>({date:date_key||dayKey(r.DateISO),jalali:r.DateJalali?.type==='date'&&validDate(date_key)?new Intl.DateTimeFormat('fa-IR-u-nu-latn',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date_key+'T12:00:00Z')):text(r.DateJalali),weight:number(r.WeightKg,null),waist:number(r.WaistCm,null),bodyFat:number(r.BodyFat,null),calories:number(r.Calories,null),notes:text(r.Notes)}));
  const activity={};function mark(day,k){if(day&&day<=today)(activity[day]||(activity[day]={}))[k]=1;}
  for(const row of sets.concat(done))mark(row.date_key,'w');for(const row of water)if(number(row.value.Glasses)>0)mark(row.date_key,'h');
  const dates=new Set(bodyLogs.map(r=>r.date));let streak=0,cursor=dates.has(today)?today:previousDay(today);while(dates.has(cursor)){streak++;cursor=previousDay(cursor);}
  const glasses=Math.max(0,...water.filter(r=>r.date_key===today).map(r=>number(r.value.Glasses)));
  const message=messages.sort(sourceOrder).at(-1)?.value;
  if(!g.staff&&!g.features.gif)for(const plan of programs.workout)for(const day of plan.days||[])for(const ex of day.exercises||[])if(ex.bank){delete ex.bank.gif;delete ex.bank.frames;}
  const b=baseline[0]?.value||{},w=wellness.sort(sourceOrder).at(-1)?.value;
  return{user:{username:user.username,role:user.role,email:user.email},profile:p,wellness:w?{date:today,sleepHours:number(w.SleepHours,null),sleep:number(w.SleepScore),energy:number(w.Energy),hunger:number(w.Hunger),sore:number(w.Soreness),note:text(w.Notes)}:null,profileHistory:history.map(r=>({date:r.date_key,weight:number(r.value.WeightKg,null),bmi:number(r.value.BMI,null)})).sort((a,b)=>a.date.localeCompare(b.date)).slice(-60),assignments:b.assignments||{workout:[],diet:[],supplement:[]},logs:bodyLogs,streak,photos:photos.map(({value:r,date_key})=>({date:date_key,label:text(r.Label),url:text(r.Url)})).sort((a,b)=>a.date.localeCompare(b.date)),planLibrary:b.planLibrary||{workout:[],diet:[],supplement:[]},workouts:programs.workout,sfTraining:{plans:[],exercises:{},today:{},last:{},date:''},diets:programs.diet,supplements:programs.supplement,water:{glasses,goal:number(p.waterGoal,8)},meals:mealsFromRows(meals,today),activity,doneToday:done.filter(r=>r.date_key===today).map(r=>text(r.value.Key)),lastMessage:message?{sender:text(message.Sender),at:text(message.CreatedAt),text:text(message.Text)}:null,reminders:rem,hasYouTubeKey:!!env.YT_KEY,isCoach:['coach','admin'].includes(user.role),isAdmin:user.role==='admin',gate:g};
}
