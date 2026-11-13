import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Medal, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useFit } from "./store";
import { Card, CountUp, Empty, Field, FitButton, Section } from "./primitives";
import { weightSeries } from "@/lib/fit/plan";
import { compressImage, fmt, jalaliShort, todayISO } from "@/lib/fit/format";
import { gas } from "@/lib/fit/api";
import { useBodyLog, toastError } from "./useActions";
import { cn } from "@/lib/utils";

const TABS = ["وزن", "اندازه‌ها", "عکس"] as const;

export function ProgressScreen() {
  const { boot, token, patch } = useFit();
  const [tab, setTab] = useState(0);
  const series = weightSeries(boot);
  const p = boot.profile;
  const cur = series.at(-1)?.weight ?? p.weight;
  const first = series[0]?.weight ?? cur;
  const diff = (Number(cur) || 0) - (Number(first) || 0);
  const body = useBodyLog();
  const [form, setForm] = useState({ weight: "", waist: "", bodyFat: "", notes: "" });
  const board = useQuery({ queryKey: ["fit-board", token], queryFn: () => gas<{ rank: number; total: number; streak: number }>("getLeaderboard", token), staleTime: 300_000 });

  const save = async () => {
    const input: { date: string; weight?: number; waist?: number; bodyFat?: number; notes?: string } = { date: todayISO() };
    if (form.weight) input.weight = +form.weight;
    if (form.waist) input.waist = +form.waist;
    if (form.bodyFat) input.bodyFat = +form.bodyFat;
    if (form.notes) input.notes = form.notes;
    if (!input.weight && !input.waist && !input.bodyFat) { toast.error("حداقل یکی از اندازه‌ها را وارد کن."); return; }
    if (await body.save(input)) setForm({ weight: "", waist: "", bodyFat: "", notes: "" });
  };

  return (
    <div>
      <div className="glass relative mb-4 grid grid-cols-3 rounded-2xl p-1">
        <span className="absolute inset-y-1 start-1 w-[calc((100%-8px)/3)] rounded-xl bg-volt transition-transform duration-500 ease-[var(--ease-spring)]"
          style={{ transform: `translateX(${-tab * 100}%)` }} />
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={cn("relative z-10 h-11 text-sm font-black transition-colors", i === tab ? "text-volt-foreground" : "text-muted-foreground")}>{t}</button>
        ))}
      </div>

      {tab === 0 ? (
        <>
          <Card className="p-5">
            <div className="flex items-end gap-3">
              <div dir="ltr"><CountUp value={Number(cur) || 0} digits={1} className="text-[64px]" /><span className="num ms-1 text-lg text-muted-foreground">KG</span></div>
              {series.length > 1 ? (
                <span className={cn("mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold", diff <= 0 ? "bg-volt/15 text-volt" : "bg-ember/15 text-ember")}>
                  {diff <= 0 ? <TrendingDown className="size-4" /> : <TrendingUp className="size-4" />}<span className="num">{diff > 0 ? "+" : ""}{fmt(diff, 1)}</span>
                </span>
              ) : null}
              <span className="ms-auto mb-3 text-xs text-muted-foreground">هدف <span className="num text-base text-foreground">{fmt(p.goalWeight)}</span></span>
            </div>
            <WeightChart points={series.map((s) => Number(s.weight))} goal={p.goalWeight} />
            {series.length < 2 ? <p className="mt-2 text-center text-xs text-muted-foreground">با ثبت وزن در روزهای مختلف، نمودار پیشرفتت اینجا ساخته می‌شود.</p> : null}
          </Card>
          <Section title="ثبت امروز" />
          <Card className="space-y-3 p-4">
            <Field label="وزن" suffix="KG" inputMode="decimal" placeholder={fmt(cur, 1)} value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            <FitButton className="w-full" onClick={save}>ذخیرهٔ وزن امروز</FitButton>
          </Card>
          {board.data ? (
            <Card className="mt-3 flex items-center gap-4 p-4">
              <div className="grid size-12 place-items-center rounded-xl bg-gold/15 text-gold"><Medal className="size-6" /></div>
              <div className="flex-1"><b className="text-sm">رتبه بین شاگردها</b><p className="text-xs text-muted-foreground">بر اساس روزهای فعال اخیر</p></div>
              <div className="num text-4xl text-gold">#{board.data.rank}<span className="text-lg text-faint">/{board.data.total}</span></div>
            </Card>
          ) : null}
        </>
      ) : null}

      {tab === 1 ? (
        <>
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2">
              <Field label="دور کمر" suffix="CM" inputMode="decimal" value={form.waist} onChange={(e) => setForm({ ...form, waist: e.target.value })} />
              <Field label="درصد چربی" suffix="%" inputMode="decimal" value={form.bodyFat} onChange={(e) => setForm({ ...form, bodyFat: e.target.value })} />
            </div>
            <Field label="وزن (اختیاری)" suffix="KG" inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-muted-foreground">یادداشت</span>
              <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="حس امروز، خواب، انرژی…"
                className="w-full rounded-xl border border-line bg-ink/60 p-3 text-sm outline-none focus:border-volt/70" /></label>
            <FitButton className="w-full" onClick={save}>ثبت اندازه‌ها</FitButton>
          </Card>
          <Section title="تاریخچه" aside={`${boot.logs.length} ثبت`} />
          {boot.logs.length ? (
            <Card className="divide-y divide-line">
              {boot.logs.slice(0, 30).map((l) => (
                <div key={l.date} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-16 text-xs text-muted-foreground">{jalaliShort(l.date)}</span>
                  <div className="num flex flex-1 flex-wrap gap-x-4 text-lg">
                    {l.weight != null ? <span>{fmt(l.weight, 1)}<small className="text-xs text-faint">KG</small></span> : null}
                    {l.waist != null ? <span>{fmt(l.waist, 1)}<small className="text-xs text-faint">CM</small></span> : null}
                    {l.bodyFat != null ? <span>{fmt(l.bodyFat, 1)}<small className="text-xs text-faint">%</small></span> : null}
                  </div>
                  <button onClick={() => body.remove(l.date)} className="pressable grid size-9 place-items-center rounded-lg text-muted-foreground hover:text-destructive" aria-label="حذف"><Trash2 className="size-4" /></button>
                </div>
              ))}
            </Card>
          ) : <p className="card-surface p-5 text-center text-sm text-muted-foreground">هنوز چیزی ثبت نشده.</p>}
        </>
      ) : null}

      {tab === 2 ? <Photos photos={boot.photos} token={token} onAdded={(ph) => patch((b) => ({ ...b, photos: ph }))} /> : null}
    </div>
  );
}

function WeightChart({ points, goal }: { points: number[]; goal: number }) {
  const data = points.length ? points.slice(-20) : [];
  if (data.length < 2) return <div className="mt-4 h-36 rounded-xl border border-dashed border-line" />;
  const all = [...data, goal || data[0]!];
  const max = Math.max(...all) + 0.5, min = Math.min(...all) - 0.5;
  const x = (i: number) => (i / (data.length - 1)) * 300, y = (v: number) => 10 + ((max - v) / (max - min)) * 120;
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const lx = x(data.length - 1), ly = y(data.at(-1)!);
  return (
    <svg viewBox="0 0 300 140" className="mt-3 h-40 w-full overflow-visible" preserveAspectRatio="none" style={{ direction: "ltr" }}>
      {goal ? <line x1="0" x2="300" y1={y(goal)} y2={y(goal)} strokeDasharray="3 7" style={{ stroke: "color-mix(in oklab, var(--foreground) 30%, transparent)" }} /> : null}
      <path d={`${d} L300 140 L0 140Z`} style={{ fill: "color-mix(in oklab, var(--volt) 12%, transparent)" }} />
      <path d={d} fill="none" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" className="animate-draw" style={{ stroke: "var(--volt)", filter: "drop-shadow(0 0 8px color-mix(in oklab, var(--volt) 60%, transparent))" }} />
      <circle cx={lx} cy={ly} r="5" style={{ fill: "var(--volt)" }} />
      <circle cx={lx} cy={ly} r="5" className="animate-ping-soft" style={{ fill: "var(--volt)" }} />
    </svg>
  );
}

function Photos({ photos, token, onAdded }: { photos: { date: string; label: string; url: string }[]; token: string; onAdded: (p: { date: string; label: string; url: string }[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<string | null>(null);
  useEffect(() => { if (!view) return; const f = (e: KeyboardEvent) => e.key === "Escape" && setView(null); addEventListener("keydown", f); return () => removeEventListener("keydown", f); }, [view]);
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const { base64, type } = await compressImage(file);
      const r = await gas<{ photos?: { date: string; label: string; url: string }[] }>("uploadProgressPhoto", token, base64, type, "");
      if (r?.photos) onAdded(r.photos); else onAdded([{ date: todayISO(), label: "", url: URL.createObjectURL(file) }, ...photos]);
      toast.success("عکس ذخیره شد");
    } catch (e) { toastError(e); } finally { setBusy(false); }
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
      <FitButton className="w-full" onClick={() => ref.current?.click()} disabled={busy}><ImagePlus className="size-5" />{busy ? "در حال آپلود…" : "افزودن عکس پیشرفت"}</FitButton>
      <div className="mt-4">
        {photos.length ? (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((ph, i) => (
              <button key={ph.url + i} onClick={() => setView(ph.url)} className="pressable animate-rise relative aspect-[3/4] overflow-hidden rounded-xl border border-line bg-steel" style={{ ["--d" as string]: `${i * 50}ms` }}>
                <img src={ph.url} alt={ph.label || "عکس پیشرفت"} loading="lazy" referrerPolicy="no-referrer" className="size-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/90 to-transparent px-2 pt-6 pb-1.5 text-[11px] font-bold">{jalaliShort(ph.date)}</span>
              </button>
            ))}
          </div>
        ) : <Empty icon={<Camera className="size-6" />} title="هنوز عکسی نداری" hint="هر دو هفته یک عکس در نور یکسان بگیر تا تغییرات را ببینی." />}
      </div>
      {view ? (
        <button onClick={() => setView(null)} className="fixed inset-0 z-[60] grid place-items-center bg-ink/95 p-4 backdrop-blur" aria-label="بستن">
          <img src={view} alt="" referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-2xl" />
        </button>
      ) : null}
    </div>
  );
}

