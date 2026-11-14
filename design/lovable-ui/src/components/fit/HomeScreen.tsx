import {useMemo} from 'react';
import {ArrowLeft,MessageCircle,LineChart} from 'lucide-react';
import {useFit} from './store';
import {useWater} from './useActions';
import {DailyRhythm} from './DailyRhythm';
import {StoryEntry} from './StoryMode';
import {FitButton,TickRing} from './primitives';
import {FocusText} from './FocusReveal';
import {activeWorkoutIndex,suggestedDay,doneKey} from '@/lib/fit/plan';
import {tr} from '@/lib/fit/locale';
export function HomeScreen({go,openChat}:{go:(t:any)=>void;openChat:()=>void}){
 const {boot}=useFit(),water=useWater(),w=boot.workouts[activeWorkoutIndex(boot)],di=w?suggestedDay(boot,w):0,day=w?.days[di];
 const prescribed=useMemo(()=>{if(!day)return null;let count=0;for(const e of day.exercises){const raw=String(e.sets).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)),n=e.training?.sets?.length||(/^\d+$/.test(raw)?Number(raw):null);if(n==null)return null;count+=n;}return count;},[day]);
 const completed=day&&w?day.exercises.filter((_,i)=>boot.doneToday.includes(doneKey(w,di,i))).length:0,total=day?.exercises.length||0;
 return <div className="sf-home-screen sf-home-focus"><StoryEntry go={go}/><article className="sf-today-card"><div className="sf-today-top"><span className="kicker text-volt">TODAY / YOUR NEXT</span><span className="sf-day-label" dir="ltr">DAY {di+1}</span></div><FocusText as="h2" text={day?.title||tr('برنامه‌ای فعال نیست','No active plan')} immediate className="sf-today-title"/><p className="sf-today-plan">{w?.name||tr('برنامه پس از ثبت مربی اینجا قرار می‌گیرد.','Your assigned plan will appear here.')}</p><div className="sf-today-summary"><TickRing size={70} ticks={28} value={total?completed/total:0}><strong dir="ltr">{completed}<small>/{total}</small></strong></TickRing><div><b>{day?.isRest?tr('روز استراحت','Recovery day'):tr('برنامهٔ این جلسه','This session')}</b><p>{total} {tr('حرکت','exercises')} <span>·</span> {prescribed??'—'} {tr('ست','sets')}</p></div></div><FitButton size="md" className="w-full" onClick={()=>go('train')}>{day?.isRest?tr('مشاهدهٔ برنامه','View plan'):completed?tr('ادامهٔ تمرین','Continue training'):tr('شروع تمرین','Start training')}<ArrowLeft size={18}/></FitButton></article><DailyRhythm go={go} water={water}/><div className="sf-home-actions"><button onClick={openChat}><MessageCircle size={18}/><span>{tr('گفتگو با مربی','Coach chat')}</span>{boot.lastMessage?<i className="sf-unread-dot"/>:null}</button><button onClick={()=>go('progress')}><LineChart size={18}/>{tr('گزارش عملکرد','Performance')}</button></div></div>;
}
