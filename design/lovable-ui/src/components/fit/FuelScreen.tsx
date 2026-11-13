import { useState } from "react";
import { ChevronDown, Copy, Pill, Plus, RotateCcw, ScanLine, Search, Trash2, Utensils } from "lucide-react";
import { FoodSheet } from "./FoodSheet";
import { useFit } from "./store";
import { Bar, Card, CountUp, Empty, Field, FitButton, Section, Sheet, TickRing } from "./primitives";
import { mealTotals } from "@/lib/fit/plan";
import { fmt } from "@/lib/fit/format";
import { useMeals, useWater } from "./useActions";
import { cn } from "@/lib/utils";

type Draft = { title: string; kcal: string; protein: string; carbs: string; fat: string };
const blank: Draft = { title: "", kcal: "", protein: "", carbs: "", fat: "" };

export function FuelScreen() {
  const { boot } = useFit();
  const p = boot.profile;
  const t = mealTotals(boot);
  const left = Math.max(0, (p.targetCalories || 0) - t.kcal);
  const water = useWater();
  const meals = useMeals();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [openSec, setOpenSec] = useState<number>(0);
  const [food, setFood] = useState<null | "search" | "scan">(null);
  const diet = boot.diets[0];
  const supp = boot.supplements[0];
  const over = t.kcal > (p.targetCalories || 0) && p.targetCalories > 0;

  const macros = [
    { k: "protein", l: "پروتئین", v: t.protein, g: p.targetProtein, tone: "volt" as const },
    { k: "carbs", l: "کربوهیدرات", v: t.carbs, g: p.targetCarbs, tone: "aqua" as const },
    { k: "fat", l: "چربی", v: t.fat, g: p.targetFat, tone: "ember" as const },
  ];

  const save = async () => {
    if (!draft) return;
    const ok = await meals.log({ title: draft.title || "وعده", kcal: +draft.kcal || 0, protein: +draft.protein || 0, carbs: +draft.carbs || 0, fat: +draft.fat || 0 });
    if (ok) setDraft(null);
  };

  return (
    <div>
      <Card className="flex items-center gap-5 p-5">
        <TickRing size={150} ticks={48} value={p.targetCalories ? t.kcal / p.targetCalories : 0} tone={over ? "ember" : "volt"}>
          <CountUp value={over ? t.kcal - p.targetCalories : left} className="text-[46px]" />
          <small className="text-xs text-muted-foreground">{over ? "مازاد" : "باقی‌مانده"}</small>
        </TickRing>
        <div className="flex-1 space-y-3">
          <div><div className="text-xs text-muted-foreground">مصرف‌شده</div><div className="num text-3xl">{fmt(t.kcal)} <small className="text-sm text-faint">KCAL</small></div></div>
          <div><div className="text-xs text-muted-foreground">هدف روزانه</div><div className="num text-xl text-muted-foreground">{fmt(p.targetCalories)}</div></div>
        </div>
      </Card>

      <div className="mt-2.5 grid grid-cols-3 gap-2.5">
        {macros.map((m, i) => (
          <Card key={m.k} className="p-3" style={{ ["--d" as string]: `${i * 70}ms` }}>
            <span className="text-xs text-muted-foreground">{m.l}</span>
            <div dir="ltr" className="mt-1 mb-2 text-end"><span className="num text-[28px]">{fmt(m.v)}</span><span className="num text-xs text-faint"> /{fmt(m.g)}G</span></div>
            <Bar value={m.g ? m.v / m.g : 0} tone={m.tone} />
          </Card>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2.5">
        <button type="button" onClick={() => setFood("search")} className="card-surface volt-edge animate-rise pressable flex h-16 items-center gap-3 px-4 text-start" style={{ ["--d" as string]: "200ms" }}>
          <span className="grid size-10 place-items-center rounded-xl bg-volt text-volt-foreground shadow-[var(--glow-volt)]"><Search className="size-5" strokeWidth={2.6} /></span>
          <span className="min-w-0"><b className="block text-sm">جستجوی غذا</b><span className="text-xs text-muted-foreground">کالری و ماکرو با یک لمس</span></span>
        </button>
        <button type="button" onClick={() => setFood("scan")} aria-label="اسکن بارکد" className="card-surface animate-rise pressable grid h-16 w-[76px] place-items-center text-volt" style={{ ["--d" as string]: "260ms" }}>
          <ScanLine className="size-7" /><span className="-mt-2 text-[10px] font-bold text-muted-foreground">بارکد</span>
        </button>
      </div>

      <Section en="TODAY'S INTAKE" title="امروز خوردم" aside={<button onClick={meals.copyYesterday} className="pressable inline-flex items-center gap-1 text-xs font-bold text-volt"><Copy className="size-3.5" />کپی دیروز</button>} />
      {boot.meals.today.length ? (
        <Card className="divide-y divide-line">
          {boot.meals.today.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1"><b className="block truncate text-sm">{m.title}</b>
                <span className="num text-xs text-muted-foreground">P{fmt(m.protein)} · C{fmt(m.carbs)} · F{fmt(m.fat)}</span></div>
              <span className="num text-xl">{fmt(m.kcal)}</span>
              <button onClick={() => meals.remove(m.id)} className="pressable grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="حذف"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </Card>
      ) : <p className="card-surface px-4 py-5 text-center text-sm text-muted-foreground">هنوز وعده‌ای ثبت نکردی. غذا را جستجو کن، بارکدش را اسکن کن یا از برنامهٔ غذایی پایین انتخاب کن.</p>}
      <FitButton variant="outline" size="md" className="mt-2.5 w-full" onClick={() => setDraft({ ...blank })}><Plus className="size-4" />ثبت وعدهٔ دلخواه</FitButton>

      <Section title="آب" aside={<><span dir="ltr" className="num text-sm text-foreground">{water.glasses} / {water.goal}</span> لیوان</>} />
      <Card className="p-3.5">
        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: Math.min(16, Math.max(water.goal, water.glasses)) }, (_, i) => {
            const on = i < water.glasses;
            return (
              <button key={i} onClick={() => water.set(on && i === water.glasses - 1 ? i : i + 1)} aria-label={`${i + 1} لیوان`}
                className="relative h-14 -skew-x-[8deg] overflow-hidden rounded-[4px] bg-foreground/[0.07]">
                <span className={cn("absolute inset-x-0 bottom-0 origin-bottom transition-transform duration-700 ease-[var(--ease-spring)]", on ? "scale-y-100" : "scale-y-0")}
                  style={{ top: 0, background: "var(--gradient-water)" }} />
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button onClick={() => water.set(0)} className="pressable inline-flex items-center gap-1 text-xs text-muted-foreground"><RotateCcw className="size-3.5" />صفر کردن</button>
          <FitButton size="sm" variant="glass" onClick={() => water.set(water.glasses + 1)}><Plus className="size-4" />یک لیوان</FitButton>
        </div>
      </Card>

      <Section title={diet ? diet.name : "برنامهٔ غذایی"} />
      {diet ? (
        <div className="space-y-2">
          {diet.sections.map((s, si) => (
            <Card key={si} className="p-0">
              <button onClick={() => setOpenSec(openSec === si ? -1 : si)} className="flex w-full items-center gap-3 px-4 py-3.5 text-start">
                <span className="grid size-9 place-items-center rounded-lg bg-volt/10 text-volt"><Utensils className="size-4" /></span>
                <b className="flex-1">{s.title}</b>
                <span className="text-xs text-muted-foreground">{s.items.length} گزینه</span>
                <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", openSec === si && "rotate-180")} />
              </button>
              {openSec === si ? (
                <div className="space-y-2 px-3 pb-3">
                  {s.items.map((it, ii) => (
                    <div key={ii} className="rounded-xl border border-line bg-ink/40 p-3">
                      <p className="text-sm leading-7 text-foreground/90">{it.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        {it.kcal ? <span className="num rounded-md bg-foreground/5 px-2 py-1 text-xs">{fmt(it.kcal)} KCAL · P{fmt(it.protein)} C{fmt(it.carbs)} F{fmt(it.fat)}</span> : <span className="text-xs text-faint">بدون اطلاعات کالری</span>}
                        <button onClick={() => it.kcal
                          ? meals.log({ title: `${s.title} · ${it.title}`, kcal: it.kcal || 0, protein: it.protein || 0, carbs: it.carbs || 0, fat: it.fat || 0 })
                          : setDraft({ ...blank, title: `${s.title} · ${it.title}` })}
                          className="pressable ms-auto inline-flex h-9 items-center gap-1 rounded-lg bg-volt px-3 text-xs font-black text-volt-foreground">
                          <Plus className="size-3.5" strokeWidth={3} />خوردم
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : <Empty icon={<Utensils className="size-6" />} title="برنامهٔ غذایی ثبت نشده" />}

      {supp ? (
        <>
          <Section title="مکمل‌ها" aside={supp.name} />
          <Card className="p-4">
            <ol className="relative space-y-4 border-s border-line ps-5">
              {supp.schedule.map((s, i) => (
                <li key={i} className="relative">
                  <span className="absolute -start-[27px] top-1 grid size-3.5 place-items-center rounded-full border-2 border-volt bg-ink" />
                  <b className="text-sm text-volt">{s.timing}</b>
                  <ul className="mt-1 space-y-1">{s.items.map((x, j) => <li key={j} className="flex items-center gap-2 text-sm text-foreground/90"><Pill className="size-3.5 text-faint" />{x}</li>)}</ul>
                </li>
              ))}
            </ol>
            {supp.groups?.map((g, gi) => (
              <div key={gi} className="mt-4 border-t border-line pt-3">
                <b className="text-sm">{g.title}</b>
                <div className="mt-2 grid gap-2">
                  {g.items.map((x, j) => (
                    <div key={j} className="flex flex-wrap items-center gap-1.5">
                      <span className="me-1 text-sm font-bold">{x.name}</span>
                      {x.timings.map((tm, k) => <span key={k} className="rounded-md bg-foreground/5 px-2 py-0.5 text-[11px] text-muted-foreground">{tm}</span>)}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      <FoodSheet open={!!food} mode={food || "search"} onOpenChange={(o) => !o && setFood(null)} />
      <Sheet open={!!draft} onOpenChange={(o) => !o && setDraft(null)} title="ثبت وعده"
        footer={<FitButton className="w-full" onClick={save}>ذخیره</FitButton>}>
        {draft ? (
          <div className="space-y-3">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-muted-foreground">عنوان</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="مثلاً ناهار"
                className="h-12 w-full rounded-xl border border-line bg-ink/60 px-3 text-base outline-none focus:border-volt/70" /></label>
            <Field label="کالری" suffix="KCAL" inputMode="numeric" value={draft.kcal} onChange={(e) => setDraft({ ...draft, kcal: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <Field label="پروتئین" suffix="G" inputMode="numeric" value={draft.protein} onChange={(e) => setDraft({ ...draft, protein: e.target.value })} />
              <Field label="کربو" suffix="G" inputMode="numeric" value={draft.carbs} onChange={(e) => setDraft({ ...draft, carbs: e.target.value })} />
              <Field label="چربی" suffix="G" inputMode="numeric" value={draft.fat} onChange={(e) => setDraft({ ...draft, fat: e.target.value })} />
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}

