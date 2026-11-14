// Native equivalent of the existing athlete plan projection. No database,
// network, Google runtime or global state. Used by import and program editing.
export const TECHNIQUES=[
  {key:'normal',label:'ست معمولی',desc:'یک حرکت، چند ست با استراحت بین ست‌ها.'},
  {key:'superset',label:'سوپرست',desc:'دو حرکت پشت سر هم بدون استراحت؛ سپس استراحت.'},
  {key:'triset',label:'تری‌ست',desc:'سه حرکت پشت سر هم بدون استراحت.'},
  {key:'giantset',label:'جاینت‌ست',desc:'چهار حرکت یا بیشتر پشت سر هم برای یک عضله.'},
  {key:'dropset',label:'دراپ‌ست',desc:'بعد از رسیدن به ناتوانی، وزنه کم می‌شود و بدون استراحت ادامه می‌دهید.'},
  {key:'pyramid',label:'ست هرمی',desc:'وزنه از ست‌ها بالا می‌رود و تکرار کم می‌شود.'},
  {key:'reverse_pyramid',label:'هرمی معکوس',desc:'ست اول سنگین‌ترین، بعد وزنه کم و تکرار بیشتر.'},
  {key:'restpause',label:'رست‌پاز',desc:'ست سنگین تا ناتوانی؛ چند ثانیه مکث و ادامه با تکرارهای کوتاه.'},
  {key:'myoreps',label:'مایو-رپس',desc:'یک ست فعال‌سازی و بعد چند مینی‌ست کوتاه با مکث کم.'},
  {key:'mechanical_drop',label:'دراپ‌ست مکانیکی',desc:'از سخت‌ترین فرم حرکت به آسان‌ترین، بدون کم کردن وزنه.'},
  {key:'tempo',label:'اسلو / تمپو',desc:'اجرای کند با تمپوی مشخص (مثلاً ۳-۱-۱).'},
  {key:'fst7',label:'FST-7',desc:'هفت ست پشت سر هم با استراحت کوتاه (۳۰ تا ۴۵ ثانیه).'},
  {key:'cardio',label:'هوازی',desc:'فعالیت هوازی بر اساس مدت زمان و شدت.'},
];
const text=x=>String(x??'').trim();
export function workoutFromEditor(plan,bank={}){
  const days=(plan.days||[]).map(day=>{
    const exercises=[];
    for(const block of day.blocks||[]){
      const sets=block.sets||[],tech=TECHNIQUES.find(t=>t.key===block.technique);
      const firstReps=[];for(const set of sets){const rep=text(set.cells?.[0]?.reps);if(rep&&!firstReps.includes(rep))firstReps.push(rep);}
      (block.items||[]).forEach((item,index)=>{
        const cells=sets.map(set=>{const c=set.cells?.find(c=>Number(c.pos)===Number(item.pos))||{};return{setNo:set.setNo,reps:text(c.reps),weight:text(c.weight),rest:set.rest};});
        const reps=cells.map(c=>c.reps).filter(Boolean),info=bank[item.exerciseId];
        let one=info?{sets:info.sets,reps:info.reps,rest:info.rest,gif:info.gif,frames:info.frames}:null;
        if(block.restBetweenSec!=null&&Number.isFinite(Number(block.restBetweenSec))){one=one||{gif:[],frames:[]};one.rest=Math.max(0,Number(block.restBetweenSec));}
        exercises.push({name:text(item.name),sets:sets.length?String(sets.length):'',reps:reps.length&&reps.every(v=>v===reps[0])?reps[0]:reps.join('-')||firstReps.join('-'),notes:text(block.notes),training:{blockId:block.blockId,technique:block.technique,label:block.techniqueLabel,exerciseId:item.exerciseId,position:index+1,size:block.items.length,peers:block.items.map(i=>i.name),betweenRest:block.restBetweenSec,sets:cells,description:tech?.desc||''},bank:one});
      });
    }
    return{title:text(day.title)||('روز '+day.dayNo),isRest:day.isRest===true&&!exercises.length,exercises};
  });
  return{name:text(plan.planName),days,notes:text(plan.coachNotes)?[text(plan.coachNotes)]:[],sfPlanId:plan.planId,fromSF:true};
}
