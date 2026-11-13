import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Dumbbell, Info, Moon, Timer } from "lucide-react";
import { useFit } from "./store";
import { Bar, Card, Empty, Section } from "./primitives";
import { activeWorkoutIndex, doneKey, exerciseImages, rememberFinishedDay, restSeconds, setActiveWorkoutIndex, suggestedDay } from "@/lib/fit/plan";
import { useDone } from "./useActions";
import { startRest } from "./restTimer";
import { ExerciseSheet } from "./ExerciseSheet";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/lib/fit/types";
import { toast } from "sonner";

export function TrainScreen() {
  const { boot } = useFit();
  const [wi, setWi] = useState(() => activeWorkoutIndex(boot));
  const w = boot.workouts[wi];
  const [di, setDi] = useState(() => (w ? suggestedDay(boot, w) : 0));
  const [open, setOpen] = useState<{ ex: Exercise; i: number } | null>(null);
  const { done, toggle } = useDone();
  useEffect(() => { if (w) setDi(suggestedDay(boot, w)); }, [wi]); // eslint-disable-line react-hooks/exhaustive-deps

  const day = w?.days[di];
  const keys = useMemo(() => (w && day ? day.exercises.map((_, i) => doneKey(w, di, i)) : []), [w, day, di]);
  const finished = keys.filter((k) => done.includes(k)).length;

  if (!w) return <Empty icon={<Dumbbell className="size-6" />} title="هنوز برنامهٔ تمرینی نداری" hint="به‌محض اینکه مربی برنامه‌ات را ثبت کند، اینجا نمایش داده می‌شود." />;

  const onToggle = async (i: number) => {
    const k = keys[i]!; const now = !done.includes(k);
    if(!await toggle(k, now))return;
    if (now) {
      const ex = day!.exercises[i]!;
      if(!ex.training || ex.training.size < 2 || ex.training.position === ex.training.size) startRest(restSeconds(ex));
      if (finished + 1 === keys.length) { rememberFinishedDay(w, di); toast.success("جلسه کامل شد! عالی بود "); }
    }
  };

  return (
    <div>
      {boot.workouts.length > 1 ? (
        <div className="hide-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
          {boot.workouts.map((x, i) => (
            <button key={x.name} onClick={() => { setWi(i); setActiveWorkoutIndex(i); }}
              className={cn("pressable shrink-0 rounded-full border px-4 py-2 text-sm font-bold", i === wi ? "border-volt bg-volt text-volt-foreground" : "border-line text-muted-foreground")}>
              {x.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="hide-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {w.days.map((d, i) => {
          const allDone = d.exercises.length > 0 && d.exercises.every((_, xi) => done.includes(doneKey(w, i, xi)));
          return (
            <button key={i} onClick={() => setDi(i)} aria-pressed={i === di}
              className={cn("pressable relative grid min-h-[72px] min-w-[64px] shrink-0 place-content-center gap-0.5 rounded-xl border px-3 text-center",
                i === di ? "border-volt bg-volt text-volt-foreground shadow-[var(--glow-volt)]" : "card-surface text-muted-foreground")}>
              <b className="num text-[26px]">{d.isRest ? <Moon className="mx-auto size-5" /> : String(i + 1).padStart(2, "0")}</b>
              <span className="max-w-[72px] truncate text-[11px] font-bold">{d.isRest ? "استراحت" : d.title}</span>
              {allDone ? <i className="absolute top-1.5 end-1.5 grid size-4 place-items-center rounded-full bg-volt text-volt-foreground"><Check className="size-3" strokeWidth={4} /></i> : null}
            </button>
          );
        })}
      </div>

      {day?.isRest || !day?.exercises.length ? (
        <div className="mt-4"><Empty icon={<Moon className="size-6" />} title="امروز روز ریکاوری است" hint="خواب کافی، آب و کمی پیاده‌روی سبک بهترین تمرین امروز است." /></div>
      ) : (
        <Card className="mt-4">
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <div className="flex-1">
              <h3 className="text-2xl font-black">{day.title}</h3>
              <p className="text-xs text-muted-foreground">{day.exercises.length} حرکت · برای جزئیات و ثبت وزنه روی هر حرکت بزن</p>
            </div>
            <div dir="ltr"><span className="num text-3xl text-volt">{finished}</span><span className="num text-lg text-faint">/{keys.length}</span></div>
          </div>
          <div className="px-5 pb-4"><Bar value={keys.length ? finished / keys.length : 0} /></div>
          <ol>
            {day.exercises.map((ex, i) => {
              const k = keys[i]!, isDone = done.includes(k), isNext = !isDone && keys.findIndex((x) => !done.includes(x)) === i;
              const img = exerciseImages(ex)[0];
              const combo=!!(ex.training && ex.training.size>1), combined=combo||ex.name.includes("+")||/سوپر\s*ست|superset/i.test(ex.notes||"");
              return (
                <li key={k} className={cn("relative flex items-center gap-3 border-t border-line px-4 py-3 transition-colors", combined && "sfx-combo-row", isNext && "bg-gradient-to-l from-volt/[0.12] to-transparent", isDone && "opacity-55")}>
                  {isNext ? <span className="animate-breathe absolute inset-y-0 start-0 w-1 bg-volt" /> : null}
                  <button onClick={() => setOpen({ ex, i })} className="pressable flex min-w-0 flex-1 items-center gap-3 text-start">
                    <span className="num w-7 shrink-0 text-2xl text-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-line bg-foreground/90">
                      {img ? <img src={img} alt="" loading="lazy" className="size-full object-cover" /> : <Dumbbell className="m-auto mt-4 size-6 text-ink" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      {combined?<span className="mb-1 block text-[11px] font-black text-aqua">{ex.training?.label||(/سوپر\s*ست|superset/i.test(ex.notes||"")?"سوپرست":"حرکت ترکیبی")}{combo?` · ${ex.training!.position}/${ex.training!.size}`:""}</span>:null}
                      <b className={cn("block truncate text-[15px]", isNext && "text-volt", isDone && "line-through")}>{ex.name}</b>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span><span className="num text-sm text-foreground">{ex.sets}</span> ست</span>
                        <span><span className="num text-sm text-foreground">{ex.reps}</span> تکرار</span>
                        <span className="flex items-center gap-1"><Clock className="size-3" /><span className="num text-sm">{restSeconds(ex)}S</span></span>
                      </span>
                      {ex.notes ? <span className="mt-1 block truncate text-[11px] text-ember">{ex.notes}</span> : null}
                    </span>
                  </button>
                  <button onClick={() => onToggle(i)} aria-label={isDone ? "برگرداندن" : "انجام شد"} aria-pressed={isDone}
                    className={cn("grid size-11 shrink-0 place-items-center rounded-full border-2 transition-all duration-500 ease-[var(--ease-spring)]",
                      isDone ? "rotate-[360deg] scale-105 border-volt bg-volt text-volt-foreground" : "border-foreground/25 text-transparent hover:border-volt/60")}>
                    <Check className="size-5" strokeWidth={3.4} />
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {w.notes?.filter(Boolean).length ? (
        <>
          <Section title="توصیه‌های مربی" />
          <Card className="space-y-2 p-4">
            {w.notes.flatMap((n) => n.split("|")).map((n) => n.trim()).filter(Boolean).map((n, i) => (
              <p key={i} className="flex gap-2 text-sm leading-7 text-muted-foreground"><Info className="mt-1.5 size-4 shrink-0 text-volt" />{n}</p>
            ))}
          </Card>
        </>
      ) : null}

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-faint"><Timer className="size-3.5" />تایمر استراحت پس از حرکت مستقل یا آخرین حرکت گروه شروع می‌شود</p>

      <ExerciseSheet dayIndex={di} item={open} workoutName={w.name} onClose={() => setOpen(null)}
        done={open ? done.includes(keys[open.i] ?? "") : false} onToggle={() => open && onToggle(open.i)} />
    </div>
  );
}

