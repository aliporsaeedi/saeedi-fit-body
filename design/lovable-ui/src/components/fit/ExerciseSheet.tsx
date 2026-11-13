import { useEffect, useRef, useState } from "react";
import { Check, Minus, Plus, Timer, Trophy } from "lucide-react";
import { gas } from "@/lib/fit/api";
import { fmt, jalaliShort, todayISO } from "@/lib/fit/format";
import { exerciseImages, restSeconds } from "@/lib/fit/plan";
import type { Exercise } from "@/lib/fit/types";
import { cn } from "@/lib/utils";
import { FitButton, Sheet } from "./primitives";
import { startRest } from "./restTimer";
import { useFit } from "./store";
import { toastError } from "./useActions";
import { toast } from "sonner";

type H = { date: string; weight: number | null; reps: number | null };
const e1rm = (h: H) => (Number(h.weight) || 0) * (1 + (Number(h.reps) || 0) / 30);

export function ExerciseSheet({ item, workoutName, onClose, done, onToggle }: { item: { ex: Exercise; i: number } | null; workoutName: string; onClose: () => void; done: boolean; onToggle: () => void }) {
  const { token } = useFit();
  const ex = item?.ex;
  const [hist, setHist] = useState<H[] | null>(null);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(0);
  const edited=useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ex) return;
    let current=true;edited.current=false;setWeight(0);setReps(0);
    setHist(null);
    gas<H[]>("getExerciseHistory", token, ex.name).then((h) => {
      if(!current)return;
      setHist(h);
      const last = h.at(-1);
      if (!edited.current && last?.weight!=null) setWeight(last.weight);
      if (!edited.current && last?.reps!=null) setReps(last.reps);
    }).catch(() => {if(current)setHist([]);});
    return ()=>{current=false;};
  }, [ex, token]);

  const imgs = ex ? exerciseImages(ex) : [];
  const today = todayISO();
  const todaySets = (hist || []).filter((h) => h.date === today);
  const best = Math.max(0, ...(hist || []).filter((h) => h.date < today).map(e1rm));

  const log = async () => {
    if (!ex || busy) return;
    if(!Number.isFinite(weight)||weight<0||!Number.isInteger(reps)||reps<1){toast.error('وزن معتبر و تعداد تکرار صحیح وارد کن.');return;}
    setBusy(true);
    try {
      const r = await gas<{ history: H[] }>("logExerciseSet", token, { exerciseName: ex.name, workoutName, weight, reps });
      setHist(r.history);
      const pr = best > 0 && weight * (1 + reps / 30) > best;
      toast.success(pr ? "رکورد جدید! 🏆" : `ست ${todaySets.length + 1} ثبت شد`);
      startRest(restSeconds(ex));
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };

  const series = (hist || []).slice(-14).map(e1rm);
  const max = Math.max(1, ...series), min = Math.min(...series, max);
  const pts = series.map((v, i) => `${(i / Math.max(1, series.length - 1)) * 300},${70 - ((v - min) / Math.max(1, max - min)) * 60}`).join(" ");

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()} title={ex?.name}
      footer={
        <div className="flex gap-2">
          <FitButton className="flex-1" onClick={log} disabled={busy}>ثبت ست {todaySets.length + 1}</FitButton>
          <FitButton variant={done ? "outline" : "glass"} size="lg" className="w-14 px-0" onClick={onToggle} aria-label="انجام شد">
            <Check className={cn("size-5", done && "text-volt")} strokeWidth={3} />
          </FitButton>
        </div>
      }>
      {ex ? (
        <div className="space-y-5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line bg-foreground">
            {imgs[0] ? <img src={imgs[0]} alt={ex.name} className="absolute inset-0 size-full object-contain" /> : null}
            {imgs[1] ? <img src={imgs[1]} alt="" className="animate-frames absolute inset-0 size-full object-contain" /> : null}
            <span className="skew-tag absolute top-3 start-3"><span>{imgs.length > 1 ? "حرکت نمایشی" : "راهنما"}</span></span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[[ex.sets, "ست"], [ex.reps, "تکرار"], [`${restSeconds(ex)}S`, "استراحت"]].map(([v, l]) => (
              <div key={l} className="card-surface p-3 text-center"><div className="num text-2xl">{v}</div><div className="text-[11px] text-muted-foreground">{l}</div></div>
            ))}
          </div>
          {ex.notes ? <p className="rounded-xl border border-ember/30 bg-ember/10 px-3 py-2 text-sm text-ember">{ex.notes}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <Stepper label="وزنه (کیلو)" value={weight} step={2.5} onChange={v=>{edited.current=true;setWeight(v);}} />
            <Stepper label="تکرار" value={reps} step={1} onChange={v=>{edited.current=true;setReps(v);}} />
          </div>
          <button onClick={() => startRest(restSeconds(ex))} className="pressable flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-bold text-muted-foreground">
            <Timer className="size-4" />شروع تایمر استراحت
          </button>

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-black">
              سابقهٔ این حرکت
              {best > 0 ? <span className="ms-auto flex items-center gap-1 text-xs text-gold"><Trophy className="size-3.5" />بهترین <span className="num text-sm">{fmt(best, 0)}KG</span> 1RM</span> : null}
            </div>
            {hist == null ? <div className="h-24 animate-pulse rounded-xl bg-foreground/5" /> : hist.length === 0 ? (
              <p className="rounded-xl bg-foreground/5 p-4 text-center text-sm text-muted-foreground">اولین ست را ثبت کن تا نمودار پیشرفتت ساخته شود.</p>
            ) : (
              <div className="card-surface p-3">
                {series.length > 1 ? (
                  <svg viewBox="0 0 300 76" className="mb-2 h-20 w-full overflow-visible" preserveAspectRatio="none" style={{ direction: "ltr" }}>
                    <polyline points={pts} fill="none" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" className="animate-draw" style={{ stroke: "var(--volt)" }} />
                  </svg>
                ) : null}
                <ul className="divide-y divide-line">
                  {[...hist].reverse().slice(0, 6).map((h, i) => (
                    <li key={i} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-muted-foreground">{h.date === today ? "امروز" : jalaliShort(h.date)}</span>
                      <span className="num text-base">{fmt(h.weight, 1)}KG × {fmt(h.reps)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Sheet>
  );
}

function Stepper({ label, value, step, onChange }: { label: string; value: number; step: number; onChange: (n: number) => void }) {
  return (
    <div className="card-surface p-3">
      <div className="mb-2 text-center text-xs font-bold text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(0, +(value - step).toFixed(2)))} className="pressable grid size-10 place-items-center rounded-lg bg-foreground/5" aria-label="کم"><Minus className="size-4" /></button>
        <input inputMode="decimal" value={value} onChange={(e) => { const n = Number(e.target.value.replace(/[^\d.]/g, "")); if (isFinite(n)) onChange(n); }}
          className="num h-10 w-full min-w-0 bg-transparent text-center text-3xl outline-none" aria-label={label} />
        <button onClick={() => onChange(+(value + step).toFixed(2))} className="pressable grid size-10 place-items-center rounded-lg bg-volt/15 text-volt" aria-label="زیاد"><Plus className="size-4" /></button>
      </div>
    </div>
  );
}

