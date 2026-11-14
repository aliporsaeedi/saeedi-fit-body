import {AppError,authorizeAthlete} from './auth.mjs';
import {bootstrap,gate,records,reminders,text,number,sourceOrder,isoToday,assignedPrograms} from './data.mjs';

async function messages(c,target){const owner=await authorizeAthlete(c.db,c.user,target||c.user.username_key),rows=await records(c.db,'Messages',owner,{limit:200});return rows.sort(sourceOrder).map(({value:r})=>({sender:text(r.Sender),text:text(r.Text),createdAt:text(r.CreatedAt)}));}
async function payments(c){const [rows,catalog]=await Promise.all([records(c.db,'SF_Payments',c.user.username_key),c.db.prepare('SELECT package_id,body FROM packages').all()]);const names=new Map(catalog.results.map(r=>[r.package_id,JSON.parse(r.body).Name]));return rows.map(({value:r})=>({payId:text(r.PayID),packageId:text(r.PackageID),packageName:text(names.get(r.PackageID)||r.PackageID),amount:number(r.Amount),discount:number(r.Discount),final:number(r.Final),status:text(r.Status).toLowerCase(),createdAt:text(r.CreatedAt),reviewedAt:text(r.ReviewedAt),reason:text(r.RejectReason)})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,12);}
async function exerciseHistory(c,name){const rows=await records(c.db,'ExerciseLogs',c.user.username_key);return rows.sort(sourceOrder).filter(r=>text(r.value.ExerciseName).toLowerCase()===text(name).toLowerCase()).map(r=>({date:r.date_key,weight:number(r.value.WeightKg,null),reps:number(r.value.Reps,null)})).sort((a,b)=>a.date.localeCompare(b.date)).slice(-40);}
export function nameKey(value){return String(value??'').toLowerCase().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[^\u0621-\u06d3\u06f0-\u06f9a-z0-9]/g,'');}
async function exerciseGuide(c,planName,dayIndex,exerciseIndex){
  const plans=await assignedPrograms(c.db,c.user),plan=plans.workout.find(p=>text(p.name)===text(planName));
  if(!plan||!Number.isInteger(Number(dayIndex))||!Number.isInteger(Number(exerciseIndex)))throw new AppError('برنامه یا حرکت معتبر نیست.');
  const exercise=plan.days?.[Number(dayIndex)]?.exercises?.[Number(exerciseIndex)];if(!exercise)throw new AppError('حرکت در برنامهٔ شما پیدا نشد.');
  const training=exercise.training||null,names=training?.size>1?[exercise.name]:String(exercise.name).split(/\s*\+\s*/).filter(Boolean).slice(0,6),g=await gate(c.db,c.user),parts=[];
  for(const name of names){
    let row=null;if(training?.exerciseId&&names.length===1)row=await c.db.prepare('SELECT body FROM exercises WHERE exercise_id=? AND active=1').bind(training.exerciseId).first();
    // Alias lookup reads only the exercise catalog, never another user's plan.
    if(!row)row=await c.db.prepare(`SELECT e.body FROM records n JOIN exercises e ON e.exercise_id=json_extract(n.body,'$.exerciseId') WHERE n.kind='exercise_exact_name' AND n.lookup_key=? AND e.active=1 LIMIT 1`).bind(nameKey(name)).first();
    if(!row){parts.push({name,found:false});continue;}
    const b=JSON.parse(row.body);parts.push({name,matchedName:text(b.PersianName),found:true,instructions:text(b.Instructions),tips:text(b.Tips),muscle:text(b.MuscleGroup),secondary:text(b.SecondaryMuscle),equipment:text(b.Equipment),movementType:text(b.MovementType),gif:g.features.gif?b.legacy?.gif||[]:[],frames:g.features.gif?b.legacy?.frames||[]:[]});
  }
  return{ok:true,name:exercise.name,training,notes:exercise.notes||'',parts};
}
export const READ_METHODS={
  getBootstrap:(c,_token,day)=>bootstrap(c.db,c.user,day,c.env),
  getMessages:(c,_token,target)=>messages(c,target),
  getExerciseHistory:(c,_token,name)=>exerciseHistory(c,name),
  sfMyPayments:payments,
  sfAthleteExerciseGuide:(c,_token,name,day,index)=>exerciseGuide(c,name,day,index),
  sfAthleteReminderState:async c=>({ok:true,reminders:await reminders(c.db,c.user,c.env),gate:await gate(c.db,c.user)}),
  sfGateInfo:async c=>({gate:await gate(c.db,c.user)}),
};
