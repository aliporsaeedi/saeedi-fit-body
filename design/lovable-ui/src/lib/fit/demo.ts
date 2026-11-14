import type {Boot} from './types';
import {locale} from './locale';
export function isDemo(){try{return new URLSearchParams(window.location.search).get('demo')==='1';}catch{return false;}}
const day=()=>new Date().toISOString().slice(0,10),copy=<T,>(x:T):T=>JSON.parse(JSON.stringify(x));
let boot:Boot|null=null,history:Record<string,any[]>={},messages:any[]=[];
function init():Boot{
 const en=locale()==='en',label=(fa:string,enText:string)=>en?enText:fa;
 const names=[label('پرس سینه هالتر','Barbell bench press'),label('فلای سیم‌کش','Cable fly'),label('اسکات با بالابردن دست','Squat to overhead reach')];
 const exercises=names.map((name,i)=>({name,sets:'3',reps:i===2?'12':'10',notes:label('آرام و کنترل‌شده؛ دامنهٔ بدون درد.','Move with control through a comfortable, pain-free range.'),bank:{preview:`/demo-media/exercise-${i+1}.webp`,rest:60,gif:[`/demo-media/exercise-${i+1}.gif`],frames:[]},training:{blockId:'demo-'+i,technique:i<2?'superset':'normal',label:i<2?label('سوپرست','Superset'):label('ست معمولی','Straight sets'),exerciseId:'demo-'+i,position:i<2?i+1:1,size:i<2?2:1,peers:i<2?names.slice(0,2):[name],betweenRest:60,description:i<2?label('دو حرکت پشت سر هم؛ سپس استراحت.','Perform both movements, then rest.'):label('استراحت بین ست‌ها.','Rest between sets.'),sets:Array.from({length:3},(_,k)=>({setNo:k+1,reps:i===2?'12':'10',weight:'',rest:60}))}}));
 return {user:{username:'demo-athlete',role:'user',email:''},profile:{username:'demo-athlete',name:label('ورزشکار نمونه','Alex Morgan'),gender:'male',age:30,height:178,weight:76,goalWeight:74,goal:'recomp',bmr:1730,tdee:2400,targetCalories:2200,targetProtein:140,targetCarbs:260,targetFat:65,waterGoal:8,avatarUrl:'/media/sf-athlete-hero-v2.webp',bmi:24},workouts:[{name:label('برنامهٔ نمونه — قدرت و کنترل','Sample plan — strength & control'),days:[{title:label('قدرت تمام‌بدن','Full-body strength'),isRest:false,exercises},{title:label('ریکاوری','Recovery'),isRest:true,exercises:[]}]}],diets:[{name:label('تغذیهٔ خانگی — نمونه','Home-style nutrition — sample'),sections:[{title:label('ناهار','Lunch'),items:[{title:label('مرغ، برنج و سبزیجات','Chicken, rice & vegetables'),description:label('یک وعدهٔ نمونه؛ مقدار و ماکرو صرفاً برای نمایش اپ.','An example meal; portions and macros are demo data.'),kcal:560,protein:42,carbs:68,fat:14}]}]}],supplements:[{name:label('چارت نمایشی؛ توصیهٔ مصرف نیست','Sample schedule — not a dosage recommendation'),schedule:[{timing:label('پس از وعده','After a meal'),items:[label('مکملِ تعیین‌شده توسط مربی','Coach-assigned supplement')]}],groups:[]}],logs:Array.from({length:6},(_,i)=>{const d=new Date();d.setDate(d.getDate()-5+i);return {date:d.toISOString().slice(0,10),jalali:'',weight:77-i*.2,waist:82,bodyFat:null,calories:null,notes:''};}),photos:[],water:{glasses:3,goal:8},meals:{today:[],yesterday:[],days:{}},activity:{[day()]:{h:1}},doneToday:[],streak:3,gate:{active:true,staff:false,tier:'gold',tierName:label('نمایشی','Demo'),status:'active',daysLeft:30,endDate:'',renewSoon:false,features:{gif:true,ai:false,bot:false}} as any,wellness:null};
}
export function resetDemo(){boot=null;history={};messages=[];try{for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i);if(k?.startsWith("sfb:isolated-demo:"))localStorage.removeItem(k);}}catch{}}
export async function demoRpc(fn:string,args:any[]):Promise<any>{
 boot??=init();const b=boot;
 switch(fn){
 case 'getBootstrap':return copy(b);
 case 'logout':resetDemo();return {ok:true};
 case 'sfAvatarState':return {design:b.profile.avatarDesign||null,mode:b.profile.avatarDesign?'avatar':'photo',revision:0,aiGenerationAvailable:false};
 case 'sfAvatarSave':b.profile.avatarDesign=args[1].mode==='avatar'?args[1].design:null;return {ok:true,design:args[1].design,mode:args[1].mode,revision:1};
 case 'sfErrorReport':return {ok:true};
 case 'setWater':b.water.glasses=Math.max(0,Math.min(60,Number(args[1])||0));return {water:copy(b.water)};
 case 'setExerciseDone':{const [,key,done]=args;b.doneToday=done?[...new Set([...b.doneToday,key])]:b.doneToday.filter(k=>k!==key);return {ok:true};}
 case 'getExerciseHistory':return copy(history[args[1]]||[]);
 case 'logExerciseSet':{const input=args[1];const rows=history[input.exerciseName]??=[];rows.push({date:day(),weight:input.weight,reps:input.reps});return {history:copy(rows)};}
 case 'sfAthleteExerciseGuide':{const ex=b.workouts[0].days[args[2]]?.exercises[args[3]];if(!ex)throw Error('Demo exercise not found');return {parts:[{name:ex.name,found:true,instructions:locale()==='en'?'Set a stable starting position. Move slowly, breathe out on effort and control the return. Use the animation as a visual example.':'وضعیت شروع را پایدار کنید. حرکت را آرام اجرا کنید، هنگام فشار بازدم کنید و بازگشت را کنترل کنید. انیمیشن نمونهٔ تصویری اجراست.',tips:locale()==='en'?'Stop if the movement causes pain; this sample does not replace individual coaching.':'در صورت درد متوقف کنید؛ این نمونه جایگزین راهنمای اختصاصی مربی نیست.',muscle:args[3]===2?'Quadriceps / glutes':'Chest / triceps',equipment:args[3]===2?'Bodyweight':'Gym equipment',gif:ex.bank?.gif}],training:ex.training,notes:ex.notes};}
 case 'logMeal':{const m={...args[1],id:crypto.randomUUID()};b.meals.today.push(m);return {meals:copy(b.meals)};}
 case 'deleteMeal':b.meals.today=b.meals.today.filter(m=>m.id!==args[1]);return {meals:copy(b.meals)};
 case 'copyYesterdayMeals':return {meals:copy(b.meals)};
 case 'saveLog':{const input=args[1];b.logs=b.logs.filter(l=>l.date!==input.date);b.logs.push({...input,jalali:'',waist:input.waist??null,bodyFat:input.bodyFat??null,calories:null,notes:input.notes||''});return {logs:copy(b.logs),streak:b.streak};}
 case 'deleteLog':b.logs=b.logs.filter(l=>l.date!==args[1]);return {logs:copy(b.logs)};
 case 'getMessages':return copy(messages);
 case 'sendMessage':messages.push({sender:'demo-athlete',text:String(args[2]),createdAt:new Date().toISOString()});return {messages:copy(messages)};
 case 'sfAthleteReminderState':return {reminders:{configured:false,linked:false,platform:'telegram',items:[],timeZone:'Asia/Tehran'},gate:{features:{bot:false}}};
 case 'sfRefSessionState':return {active:null};
 case 'sfRefWellnessSave':b.wellness={...args[1],date:args[2]||day()};return {wellness:copy(b.wellness)};
 case 'getLeaderboard':return [];
 case 'sfAthleteWorkoutReceipt':{const rows=Object.entries(history).flatMap(([name,sets])=>sets.map(set=>({...set,name}))),volume=rows.reduce((n,r)=>n+r.weight*r.reps,0);return {date:day(),workoutName:b.workouts[0].name,workouts:[b.workouts[0].name],sets:rows.length,reps:rows.reduce((n,r)=>n+r.reps,0),volumeKg:volume,volumeComplete:true,exercises:Object.entries(history).map(([name,sets])=>({name,sets:sets.length})),sessionMinutes:null,source:'isolated-demo',timeZone:'Asia/Tehran'};}
 case 'sfCoachAiState':return {enabled:false,locked:true,history:[],goals:'',tierName:'Demo',remaining:0,limit:0,monthCap:0,monthRemaining:0};
 case 'sfFoodBank':return {items:[],categories:[]};
 default:throw Error(locale()==='en'?'This action requires a personal account. No data was sent.':'این قابلیت به حساب شخصی نیاز دارد؛ اطلاعاتی ارسال نشد.');
 }
}
