import { classicUrl } from "@/lib/fit/api";
import { useMemo } from "react";
import { ArrowLeft, Crown, Droplets, Flame, LayoutDashboard, MessageCircle, Plus, Scale, Sparkles, Zap } from "lucide-react";
import { useFit } from "./store";
import { Card, CountUp, FitButton, Section, TickRing, Bar } from "./primitives";
import { activeWorkoutIndex, activityLevel, mealTotals, suggestedDay, validActivity, weekDays, weightSeries } from "@/lib/fit/plan";
import { addDays, fmt, jalaliShort, todayISO } from "@/lib/fit/format";
import { cn } from "@/lib/utils";
import { useWater } from "./useActions";

export function HomeScreen({ go, openChat }: { go: (t: "train" | "fuel" | "progress" | "more" | "membership" | "coach") => void; openChat: () => void }) {
  const { boot } = useFit();
  const p = boot.profile;
  const w = boot.workouts[activeWorkoutIndex(boot)];
  const dayIdx = w ? suggestedDay(boot, w) : 0;
  const day = w?.days[dayIdx];
  const trainDays = w ? w.days.filter((d) => !d.isRest && d.exercises.length).length : 0;
  const act = useMemo(() => validActivity(boot), [boot]);
  const week = weekDays();
  const weekDone = week.filter((d) => act[d]?.w).length;
  const weekGoal = Math.max(1, Math.min(7, trainDays || 4));
  const sets = day ? day.exercises.reduce((s, e) => s + (parseInt(String(e.sets), 10) || 0), 0) : 0;
  const doneNow = w && day ? day.exercises.filter((_, i) => boot.doneToday.includes(`${w.name}_${dayIdx}_${i}`)).length : 0;
  const totals = mealTotals(boot);
  const series = weightSeries(boot);
  const lastW = series.at(-1)?.weight ?? p.weight;
  const prevW = series.at(-2)?.weight;
  const delta = lastW != null && prevW != null ? lastW - prevW : null;
  const water = useWater();
  const today = todayISO();
  const heat = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27));
  const activeDays = heat.filter((d) => activityLevel(act[d]) > 0).length;
  const gate = boot.gate;

  const ticker = [
    `STREAK ${boot.streak} DAYS`, `TARGET ${fmt(p.targetCalories)} KCAL`, `BMI ${fmt(p.bmi, 1)}`,
    `PROTEIN ${fmt(p.targetProtein)} G`, `WEEK ${weekDone}/${weekGoal}`, `WATER ${water.glasses}/${water.goal}`,
  ];

  const staff = ["admin", "coach"].includes(String(boot.user.role).toLowerCase());
  return (
    <div className="space-y-3">
      {staff ? (
        <a href={classicUrl("/classic?page=admin")} className="card-surface animate-rise pressable flex items-center gap-3 border-volt/40 p-4">
          <span className="grid size-10 place-items-center rounded-xl bg-volt text-volt-foreground"><LayoutDashboard className="size-5" /></span>
          <span className="flex-1"><b className="block text-sm">پنل مربی</b><span className="text-xs text-muted-foreground">مدیریت شاگردها، برنامه‌ها و پرداخت‌ها</span></span>
          <ArrowLeft className="size-4 text-muted-foreground" />
        </a>
      ) : null}
      {/* Hero: today's session */}
      <article className="animate-rise relative overflow-hidden rounded-2xl border border-volt/25 p-5 shadow-[var(--shadow-card)]" style={{ background: "var(--gradient-hero)" }}>
        <div aria-hidden className="num pointer-events-none absolute -top-4 -end-2 text-[128px] font-black text-transparent [-webkit-text-stroke:1px_color-mix(in_oklab,var(--volt)_22%,transparent)]">
          DAY {dayIdx + 1}
        </div>
        <div aria-hidden className="pointer-events-none absolute -inset-y-1/3 start-[34%] w-12 -skew-x-[22deg] bg-volt/[0.06]" />
        <span className="skew-tag"><span>{day?.isRest ? "روز استراحت" : `جلسهٔ امروز · روز ${dayIdx + 1} از ${w?.days.length ?? 0}`}</span></span>
        <h2 className="relative mt-3 text-[44px] font-black leading-[1.05] tracking-tight">{day?.title || "برنامه‌ای فعال نیست"}</h2>
        <p className="relative text-sm text-muted-foreground">{w ? w.name : "مربی هنوز برنامه‌ای برایت ثبت نکرده"}</p>

        <div className="relative my-5 flex items-center gap-5">
          <TickRing value={weekDone / weekGoal}>
            <div dir="ltr"><CountUp value={Math.round((weekDone / weekGoal) * 100)} className="text-[40px]" /><small className="num text-sm text-muted-foreground">%</small></div>
            <small className="text-[11px] text-muted-foreground">این هفته</small>
          </TickRing>
          <div className="grid flex-1 gap-2">
            {[
              [day?.exercises.length ?? 0, "حرکت"],
              [sets, "ست"],
              [Math.round(sets * 2.6), "دقیقه تقریبی"],
            ].map(([v, l]) => (
              <div key={String(l)} className="flex items-baseline gap-2 border-b border-line pb-1.5">
                <CountUp value={Number(v)} className="text-[32px]" />
                <span className="text-xs text-muted-foreground">{l}</span>
              </div>
            ))}
          </div>
        </div>
        {day && !day.isRest ? (
          <FitButton className="w-full" onClick={() => go("train")}>
            {doneNow > 0 ? `ادامهٔ جلسه · ${doneNow} از ${day.exercises.length}` : "شروع جلسه"}
            <ArrowLeft className="size-5" strokeWidth={3} />
          </FitButton>
        ) : (
          <FitButton variant="outline" className="w-full" onClick={() => go("train")}>مشاهدهٔ برنامهٔ هفته</FitButton>
        )}
      </article>

      {/* Ticker */}
      <div dir="ltr" className="-mx-4 overflow-hidden border-y border-line py-3 [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
        <div className="animate-marquee flex w-max gap-8">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i} className="num flex items-center gap-8 whitespace-nowrap text-lg tracking-[.08em] text-muted-foreground">
              {t}<i className="block size-2 -skew-x-[20deg] bg-volt" />
            </span>
          ))}
        </div>
      </div>

      {/* Subscription */}
      {gate ? (
        <button type="button" onClick={() => go("membership")} className="card-surface lux-edge animate-rise pressable flex w-full items-center gap-3 p-4 text-start" style={{ ["--d" as string]: "60ms" }}>
          <div className="grid size-11 place-items-center rounded-xl bg-gold/15 text-gold"><Crown className="size-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm font-black">
              {gate.active ? <span>اشتراک <span className="text-gold-metal">{gate.tierName || "فعال"}</span></span> : "اشتراک فعال نیست"}
              {!gate.active ? <span className="rounded-md bg-ember/15 px-1.5 py-0.5 text-[11px] text-ember">خرید اشتراک</span>
                : gate.renewSoon ? <span className="rounded-md bg-ember/15 px-1.5 py-0.5 text-[11px] text-ember">وقت تمدید</span> : null}
            </div>
            <div className="mt-2"><Bar value={Math.min(1, (gate.daysLeft || 0) / 30)} tone={gate.daysLeft <= 5 ? "ember" : "volt"} /></div>
          </div>
          <div className="text-end"><CountUp value={gate.daysLeft || 0} className="text-3xl" /><div className="text-[11px] text-muted-foreground">روز مانده</div></div>
        </button>
      ) : null}

      {/* AI coach */}
      <button type="button" onClick={() => go("coach")} className="animate-rise pressable relative isolate flex w-full items-center gap-3 overflow-hidden rounded-2xl p-4 text-start shadow-[var(--shadow-lux)]" style={{ ["--d" as string]: "100ms", background: "var(--gradient-lux)" }}>
        <span aria-hidden className="speed-lines absolute inset-0 -z-10 opacity-50" />
        <span className="relative grid size-11 shrink-0 place-items-center">
          <span className="animate-orbit absolute inset-0 rounded-full [background:conic-gradient(from_0deg,var(--gold),var(--volt),var(--gold-deep),var(--gold))]" />
          <span className="absolute inset-[2px] rounded-full bg-ink" />
          <Sparkles className="relative size-5 text-gold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="kicker">AI COACH</span>
          <b className="block text-sm">از مربی هوشمند بپرس</b>
          <span className="block truncate text-xs text-muted-foreground">راهنمایی شخصی بر اساس برنامه و پیشرفت خودت</span>
        </span>
        <ArrowLeft className="size-4 text-gold" />
      </button>

      {/* Tiles */}
      <div className="grid grid-cols-2 gap-2.5">
        <Tile d={80} icon={<Scale className="size-4" />} label="وزن" onClick={() => go("progress")}
          value={<><CountUp value={Number(lastW) || 0} digits={1} className="text-[42px]" /><small className="num text-sm text-muted-foreground">KG</small></>}
          foot={delta != null ? <span className={cn("num", delta <= 0 ? "text-volt" : "text-ember")}>{delta > 0 ? "+" : ""}{fmt(delta, 1)}</span> : <span>هدف {fmt(p.goalWeight)}</span>} />
        <Tile d={140} icon={<Flame className="size-4" />} label="کالری امروز" onClick={() => go("fuel")}
          value={<><CountUp value={totals.kcal} className="text-[42px]" /><small className="num text-sm text-muted-foreground">KCAL</small></>}
          foot={<span className="num text-volt">{p.targetCalories ? Math.round((totals.kcal / p.targetCalories) * 100) : 0}%</span>} />
        <Tile d={200} icon={<Droplets className="size-4" />} label="لیوان آب"
          value={<><CountUp value={water.glasses} className="text-[42px]" /><small className="num text-sm text-muted-foreground">/ {water.goal}</small></>}
          foot={<button onClick={() => water.set(water.glasses + 1)} className="pressable -my-1 inline-flex items-center gap-1 rounded-lg bg-aqua/15 px-2 py-1 text-xs font-bold text-aqua"><Plus className="size-3.5" />یک لیوان</button>} />
        <Tile d={260} icon={<Zap className="size-4" />} label="شاخص بدنی" onClick={() => go("progress")}
          value={<><CountUp value={Number(p.bmi) || 0} digits={1} className="text-[42px]" /><small className="num text-sm text-muted-foreground">BMI</small></>}
          foot={<span>{bmiLabel(p.bmi)}</span>} />
      </div>

      {/* Coach message */}
      {boot.lastMessage?.sender ? (
        <button onClick={openChat} className="card-surface animate-rise pressable flex w-full items-center gap-3 p-4 text-start">
          <div className="relative grid size-11 place-items-center rounded-full bg-volt/15 text-volt">
            <MessageCircle className="size-5" />
            <i className="absolute -top-0.5 -end-0.5 size-3 rounded-full border-2 border-steel bg-ember" />
          </div>
          <div className="flex-1"><b className="text-sm">پیام از مربی</b><p className="text-xs text-muted-foreground">آخرین پیام {jalaliShort(String(boot.lastMessage.at).slice(0, 10))}</p></div>
          <ArrowLeft className="size-4 text-muted-foreground" />
        </button>
      ) : null}

      {/* Heatmap */}
      <Section en="28-DAY ACTIVITY" title="فعالیت ۲۸ روز اخیر" aside={<><span className="num text-sm text-foreground">{activeDays}</span> روز فعال</>} />
      <Card className="grid grid-cols-7 gap-1.5 p-3.5">
        {heat.map((d, i) => {
          const lv = activityLevel(act[d]);
          return (
            <i key={d} title={jalaliShort(d)} style={{ ["--d" as string]: `${(Math.floor(i / 7) + (i % 7)) * 45}ms` }}
              className={cn("animate-pop block aspect-square rounded-[4px]",
                lv === 0 && "bg-foreground/[0.07]", lv === 1 && "bg-volt/25", lv === 3 && "bg-volt/70", lv === 4 && "bg-volt shadow-[var(--glow-volt)]",
                d === today && "outline-2 outline-offset-2 outline-foreground")} />
          );
        })}
        <div className="col-span-7 mt-2 flex items-center justify-end gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-volt/25" />آب</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-volt/70" />تمرین</span>
          <span className="flex items-center gap-1"><i className="size-2.5 rounded-sm bg-volt" />هر دو</span>
        </div>
      </Card>
    </div>
  );
}

function bmiLabel(b: number) {
  if (!b) return "—";
  if (b < 18.5) return "کمبود وزن";
  if (b < 25) return "نرمال";
  if (b < 30) return "اضافه وزن";
  return "چاقی";
}

function Tile({ icon, label, value, foot, d, onClick }: { icon: React.ReactNode; label: string; value: React.ReactNode; foot: React.ReactNode; d: number; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className={cn("card-surface animate-rise flex flex-col p-4 text-start", onClick && "pressable")} style={{ ["--d" as string]: `${d}ms` }}>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</span>
      <span dir="ltr" className="mt-2 flex items-baseline justify-end gap-1">{value}</span>
      <span className="mt-2 text-xs text-muted-foreground">{foot}</span>
    </C>
  );
}

