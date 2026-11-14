import {tr} from '@/lib/fit/locale';
import {useState} from 'react';
import {Droplets,Moon,Pill} from 'lucide-react';
import {useFit} from './store';
import {useWater} from './useActions';
import {FitButton,Sheet} from './primitives';
import {gas} from '@/lib/fit/api';
import {toast} from 'sonner';

export function DailyRhythm({go,water}:{go:(t:'supplements'|'reminders')=>void;water:ReturnType<typeof useWater>}){
 const {boot,token,patch}=useFit(),wellness=boot.wellness;
 const [open,setOpen]=useState(false),[hours,setHours]=useState(wellness?.sleepHours==null?'':String(wellness.sleepHours)),[scores,setScores]=useState<Record<string,string>>({sleep:String(wellness?.sleep||''),energy:String(wellness?.energy||''),hunger:String(wellness?.hunger||''),sore:String(wellness?.sore||'')}),[busy,setBusy]=useState(false);
 async function save(){if(busy)return;setBusy(true);try{const r=await gas<{wellness:NonNullable<typeof wellness>}>('sfRefWellnessSave',token,{sleepHours:hours,...scores,note:wellness?.note||''});patch(b=>({...b,wellness:r.wellness}));setOpen(false);toast.success('چک‌این امروز ذخیره شد.');}catch(e){toast.error(e instanceof Error?e.message:'ثبت انجام نشد.');}finally{setBusy(false);}}
 const supplementCount=boot.supplements.reduce((n,p)=>n+(p.items?.length||p.groups?.reduce((s,g)=>s+g.items.length,0)||0),0);
 return <><div className="sf-quick-rhythm" aria-label="وضعیت سریع روزانه">
  <button type="button" onClick={()=>water.set(water.glasses+1)} aria-label={`آب امروز ${water.glasses} از ${water.goal} لیوان؛ افزودن یک لیوان`}><Droplets/><small>{tr("آب امروز")}</small><b dir="ltr">{water.glasses} / {water.goal} <em>GLASSES</em></b><small>{tr("افزودن یک لیوان")}</small></button>
  <button type="button" onClick={()=>{setHours(wellness?.sleepHours==null?'':String(wellness.sleepHours));setScores({sleep:String(wellness?.sleep||''),energy:String(wellness?.energy||''),hunger:String(wellness?.hunger||''),sore:String(wellness?.sore||'')});setOpen(true);}}><Moon/><small>{tr("خواب و ریکاوری")}</small><b>{wellness?.sleepHours!=null?<span dir="ltr">{wellness.sleepHours} <em>HOURS</em></span>:tr("ثبت نشده")}</b><small>{tr("چک‌این امروز")}</small></button>
  <button type="button" onClick={()=>go('supplements')}><Pill/><small>{tr("برنامهٔ مکمل")}</small><b>{supplementCount?`${supplementCount} قلم در برنامه`:tr("تخصیص داده نشده")}</b><small>{tr("مشاهدهٔ زمان مصرف")}</small></button>
 </div><Sheet open={open} onOpenChange={o=>{if(!busy)setOpen(o);}} title={tr("چک‌این خواب و ریکاوری")}><form className="p-4 space-y-4" onSubmit={e=>{e.preventDefault();void save();}}><p className="text-xs leading-7 text-muted-foreground">وضعیت امروزتان را ثبت کنید. ساعت خواب اختیاری است؛ امتیازها را مطابق احساس خودتان انتخاب کنید.</p><label className="sf-studio-field">{tr("ساعت خواب")}<input type="number" min="0" max="24" step=".25" value={hours} onChange={e=>setHours(e.target.value)} disabled={busy}/></label>{[['sleep',tr("کیفیت خواب")],['energy',tr("انرژی")],['hunger',tr("گرسنگی")],['sore',tr("کوفتگی عضلات")]].map(([key,label])=><label className="sf-studio-field" key={key}>{tr(label)}<select required value={scores[key]} disabled={busy} onChange={e=>setScores(s=>({...s,[key]:e.target.value}))}><option value="">{tr("انتخاب کنید")}</option>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n} — {[tr("خیلی کم"),tr("کم"),tr("متوسط"),tr("زیاد"),tr("خیلی زیاد")][n-1]}</option>)}</select></label>)}<FitButton type="submit" className="w-full" disabled={busy} loading={busy}>{tr("ذخیرهٔ چک‌این امروز")}</FitButton></form></Sheet></>;
}
