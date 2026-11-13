import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Barcode, Minus, Plus, ScanLine, Search, X } from "lucide-react";
import { gas } from "@/lib/fit/api";
import { fmt, todayISO } from "@/lib/fit/format";
import type { BarcodeFood, Food, Meal } from "@/lib/fit/types";
import { cn } from "@/lib/utils";
import { useFit } from "./store";
import { FitButton, Sheet } from "./primitives";
import { BarcodeScanner } from "./BarcodeScanner";

type Mode = "search" | "scan";
type Pick = { kind: "bank"; food: Food } | { kind: "barcode"; food: BarcodeFood };
const SLOTS = ["صبحانه", "ناهار", "شام", "میان‌وعده", "قبل تمرین", "بعد تمرین"];
const norm = (s: string) => s.toLowerCase().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[\u200c\s]+/g, " ").trim();

function defaultSlot() {
  const h = new Date().getHours();
  return h < 11 ? "صبحانه" : h < 16 ? "ناهار" : h < 19 ? "میان‌وعده" : "شام";
}

export function FoodSheet({ open, mode, onOpenChange }: { open: boolean; mode: Mode; onOpenChange: (o: boolean) => void }) {
  const { token, patch } = useFit();
  const [tab, setTab] = useState<Mode>(mode);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [manual, setManual] = useState("");
  const [looking, setLooking] = useState(false);
  const [miss, setMiss] = useState("");

  useEffect(() => { if (open) { setTab(mode); setPick(null); setMiss(""); setManual(""); } }, [open, mode]);

  const bank = useQuery({
    queryKey: ["fit-foods", token],
    queryFn: () => gas<{ foods: Food[]; categories: string[] }>("sfFoodBank", token, { limit: 400 }),
    enabled: open, staleTime: 10 * 60_000,
  });
  const foods = bank.data?.foods || [];
  const cats = bank.data?.categories || [];
  const results = useMemo(() => {
    const n = norm(q);
    return foods.filter((f) => (!cat || f.category === cat) && (!n || norm(`${f.name} ${f.en}`).includes(n))).slice(0, 60);
  }, [foods, q, cat]);

  const lookup = async (code: string) => {
    if (looking) return;
    setLooking(true); setMiss("");
    try {
      const r = await gas<BarcodeFood | null>("sfBarcodeFood", token, code);
      if (r) setPick({ kind: "barcode", food: r });
      else setMiss(code);
    } catch (e) { toast.error(e instanceof Error ? e.message : "جستجوی بارکد ناموفق بود"); }
    finally { setLooking(false); }
  };

  const logged = (meals: { today: Meal[]; yesterday: Meal[] }) => {
    patch((b) => ({ ...b, meals: { ...b.meals, today: meals.today, yesterday: meals.yesterday } }));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={pick ? (
      <button type="button" onClick={() => setPick(null)} className="inline-flex items-center gap-1.5"><ArrowRight className="size-5" />جزئیات غذا</button>
    ) : "افزودن غذا"}>
      {pick ? <Portion pick={pick} onLogged={logged} /> : (
        <div>
          <div className="glass relative mb-4 grid grid-cols-2 rounded-2xl p-1">
            <span aria-hidden className="absolute inset-y-1 start-1 w-[calc(50%-4px)] rounded-xl bg-volt transition-transform duration-500 ease-[var(--ease-spring)]"
              style={{ transform: `translateX(${tab === "scan" ? "-100%" : "0"})` }} />
            {([["search", "جستجوی غذا", Search], ["scan", "اسکن بارکد", ScanLine]] as const).map(([id, l, I]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={cn("relative z-10 flex h-11 items-center justify-center gap-1.5 text-sm font-black transition-colors", tab === id ? "text-volt-foreground" : "text-muted-foreground")}>
                <I className="size-4" />{l}
              </button>
            ))}
          </div>

          {tab === "search" ? (
            <>
              <label className="flex h-13 items-center gap-2 rounded-2xl border border-line bg-ink/60 px-4 py-3 focus-within:border-volt/70 focus-within:shadow-[var(--glow-volt)]">
                <Search className="size-5 text-faint" />
                <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="مثلاً مرغ، برنج، تخم‌مرغ…" className="w-full bg-transparent text-base outline-none placeholder:text-faint" />
                {q ? <button type="button" onClick={() => setQ("")} aria-label="پاک کردن"><X className="size-4 text-faint" /></button> : null}
              </label>
              {cats.length ? (
                <div className="hide-scrollbar -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
                  {["", ...cats].map((c) => (
                    <button key={c || "all"} type="button" onClick={() => setCat(c)}
                      className={cn("pressable shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold", cat === c ? "border-volt bg-volt/15 text-volt" : "border-line text-muted-foreground")}>{c || "همه"}</button>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 space-y-1.5">
                {bank.isPending ? Array.from({ length: 5 }, (_, i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-foreground/5" />) : null}
                {bank.error ? <p className="py-6 text-center text-sm text-destructive">{bank.error.message}</p> : null}
                {!bank.isPending && !results.length ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    چیزی پیدا نشد.
                    <button type="button" onClick={() => setTab("scan")} className="mt-2 block w-full font-bold text-volt">بارکدش را اسکن کن</button>
                  </div>
                ) : null}
                {results.map((f, i) => (
                  <button key={f.id} type="button" onClick={() => setPick({ kind: "bank", food: f })} style={{ ["--d" as string]: `${Math.min(i, 8) * 35}ms` }}
                    className="animate-rise pressable flex w-full items-center gap-3 rounded-2xl border border-line bg-steel/70 p-2.5 text-start hover:border-volt/40">
                    <FoodThumb src={f.image} name={f.name} />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-sm">{f.name}</b>
                      <span className="text-xs text-muted-foreground">{f.servingName || `${fmt(f.servingGrams || 100)} گرم`}</span>
                    </span>
                    <span dir="ltr" className="text-end">
                      <span className="num text-xl">{fmt(Math.round((f.kcal100 * (f.servingGrams || 100)) / 100))}</span><span className="num text-[10px] text-faint"> KCAL</span>
                      <span className="num block text-[10px] text-muted-foreground">P{fmt(Math.round((f.protein100 * (f.servingGrams || 100)) / 100))} C{fmt(Math.round((f.carb100 * (f.servingGrams || 100)) / 100))} F{fmt(Math.round((f.fat100 * (f.servingGrams || 100)) / 100))}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <BarcodeScanner active={open && tab === "scan" && !looking && !miss} onCode={(c) => void lookup(c)} />
              {looking ? <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><span className="size-4 animate-spin rounded-full border-2 border-volt border-e-transparent" />در حال جستجوی محصول…</p> : null}
              {miss ? (
                <div className="rounded-2xl border border-ember/30 bg-ember/10 p-3 text-sm">
                  محصولی با بارکد <span className="num">{miss}</span> پیدا نشد. از «جستجوی غذا» یا «ثبت وعدهٔ دلخواه» استفاده کن.
                  <button type="button" onClick={() => setMiss("")} className="mt-2 block font-bold text-volt">اسکن دوباره</button>
                </div>
              ) : null}
              <form onSubmit={(e) => { e.preventDefault(); if (manual.trim()) void lookup(manual.trim()); }} className="flex gap-2">
                <label className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-line bg-ink/60 px-3 focus-within:border-volt/60">
                  <Barcode className="size-5 text-faint" />
                  <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="شمارهٔ بارکد" dir="ltr" className="num w-full bg-transparent text-end text-lg outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-faint" />
                </label>
                <FitButton type="submit" size="md" variant="outline" loading={looking} disabled={!manual.trim()}>جستجو</FitButton>
              </form>
              <p className="text-center text-[11px] text-faint">اطلاعات بارکد از بانک جهانی Open Food Facts می‌آید.</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function FoodThumb({ src, name }: { src: string; name: string }) {
  const [bad, setBad] = useState(false);
  return src && !bad
    ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="size-12 shrink-0 rounded-xl object-cover" />
    : <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-volt/10 text-lg font-black text-volt">{name.slice(0, 1)}</span>;
}

function Portion({ pick, onLogged }: { pick: Pick; onLogged: (m: { today: Meal[]; yesterday: Meal[] }) => void }) {
  const { token } = useFit();
  const f = pick.food;
  const per = pick.kind === "bank"
    ? { k: pick.food.kcal100, p: pick.food.protein100, c: pick.food.carb100, f: pick.food.fat100 }
    : { k: pick.food.kcal100, p: pick.food.protein100, c: pick.food.carbs100, f: pick.food.fat100 };
  const base = f.servingGrams || 100;
  const [g, setG] = useState(base);
  const [slot, setSlot] = useState(defaultSlot);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const k = g / 100;
  const vals = { kcal: Math.round(per.k * k), protein: Math.round(per.p * k), carbs: Math.round(per.c * k), fat: Math.round(per.f * k) };
  const step = base >= 100 ? 25 : 10;
  const presets = Array.from(new Set([Math.round(base / 2), base, base * 2, 100])).filter((x) => x > 0).sort((a, b) => a - b);

  const save = async () => {
    if (!g || busy) return;
    setBusy(true);
    try {
      const input = pick.kind === "bank"
        ? { foodId: pick.food.id, grams: g, slot }
        : { title: [pick.food.name, pick.food.brand].filter(Boolean).join(" · ").slice(0, 80), grams: g, slot, ...vals };
      const r = await gas<{ meals: { today: Meal[]; yesterday: Meal[] } }>("sfLogFood", token, input, todayISO());
      setBusy(false); setOk(true);
      toast.success(`${f.name} ثبت شد`);
      setTimeout(() => onLogged(r.meals), 550);
    } catch (e) { setBusy(false); toast.error(e instanceof Error ? e.message : "ثبت نشد"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FoodThumb src={pick.kind === "bank" ? pick.food.image : pick.food.image} name={f.name} />
        <div className="min-w-0">
          <b className="block text-lg leading-tight">{f.name}</b>
          <span className="text-xs text-muted-foreground">{pick.kind === "barcode" ? (pick.food.brand || "محصول بسته‌بندی") : pick.food.category}{pick.kind === "barcode" ? <span className="num ms-2 text-faint">#{pick.food.code}</span> : null}</span>
        </div>
      </div>

      <div className="card-surface relative overflow-hidden p-4">
        <div className="flex items-end justify-between">
          <div dir="ltr"><span className="num text-[56px] leading-none text-volt">{fmt(vals.kcal)}</span><span className="num text-sm text-faint"> KCAL</span></div>
          <span className="text-xs text-muted-foreground">برای {fmt(g)} گرم</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[["پروتئین", vals.protein, "text-volt"], ["کربوهیدرات", vals.carbs, "text-aqua"], ["چربی", vals.fat, "text-ember"]].map(([l, v, c]) => (
            <div key={String(l)} className="rounded-xl bg-foreground/[0.05] py-2"><div className={cn("num text-2xl", String(c))}>{fmt(Number(v))}<small className="text-[10px] text-faint">G</small></div><div className="text-[11px] text-muted-foreground">{l}</div></div>
          ))}
        </div>
        {!per.k ? <p className="mt-3 text-xs text-ember">برای این محصول کالری ثبت نشده؛ اگر می‌دانی از «ثبت وعدهٔ دلخواه» استفاده کن.</p> : null}
      </div>

      <div>
        <span className="mb-2 block text-xs font-bold text-muted-foreground">مقدار (گرم)</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setG((x) => Math.max(step, x - step))} className="pressable grid size-12 place-items-center rounded-xl bg-foreground/10" aria-label="کمتر"><Minus className="size-5" /></button>
          <input value={g} onChange={(e) => setG(Math.max(0, Math.min(3000, Number(e.target.value.replace(/\D/g, "")) || 0)))} inputMode="numeric" dir="ltr"
            className="num h-12 min-w-0 flex-1 rounded-xl border border-line bg-ink/60 text-center text-3xl outline-none focus:border-volt/60" aria-label="گرم" />
          <button type="button" onClick={() => setG((x) => Math.min(3000, x + step))} className="pressable grid size-12 place-items-center rounded-xl bg-foreground/10" aria-label="بیشتر"><Plus className="size-5" /></button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((x) => (
            <button key={x} type="button" onClick={() => setG(x)} className={cn("pressable num rounded-lg border px-3 py-1.5 text-sm", g === x ? "border-volt bg-volt/15 text-volt" : "border-line text-muted-foreground")}>{x}G{x === base && f.servingName ? <span className="ms-1 font-sans text-[11px]">({f.servingName})</span> : null}</button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-xs font-bold text-muted-foreground">کدام وعده؟</span>
        <div className="grid grid-cols-3 gap-1.5">
          {SLOTS.map((s) => (
            <button key={s} type="button" onClick={() => setSlot(s)} className={cn("pressable h-10 rounded-xl border text-xs font-bold", slot === s ? "border-volt bg-volt text-volt-foreground" : "border-line text-muted-foreground")}>{s}</button>
          ))}
        </div>
      </div>

      <FitButton className="w-full" loading={busy} success={ok} disabled={!g || (!vals.kcal && !vals.protein)} onClick={save}>
        {busy ? "در حال ثبت…" : <><Plus className="size-5" strokeWidth={3} />ثبت در وعده‌های امروز</>}
      </FitButton>
    </div>
  );
}

