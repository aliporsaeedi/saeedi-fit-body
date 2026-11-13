import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUp, Crown, Lock, Pencil, RotateCcw, Sparkles, Target } from "lucide-react";
import { gas } from "@/lib/fit/api";
import { todayISO } from "@/lib/fit/format";
import type { AiState, AiTurn } from "@/lib/fit/types";
import { cn } from "@/lib/utils";
import { useFit } from "./store";
import { Card, FitButton, Sheet } from "./primitives";
import { mealTotals } from "@/lib/fit/plan";

export function CoachAiScreen({ openMembership }: { openMembership: () => void }) {
  const { token, boot } = useFit();
  const qc = useQueryClient();
  const key = ["fit-ai", token] as const;
  const q = useQuery({ queryKey: key, queryFn: () => gas<AiState>("sfCoachAiState", token), staleTime: 60_000 });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const [goalsOpen, setGoalsOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const st = q.data;
  const hist = st?.history || [];

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [hist.length, busy]);

  const p = boot.profile;
  const t = mealTotals(boot);
  const firstName = (p.name || boot.user.username).split(" ")[0];
  const suggestions = [
    "با برنامهٔ امروزم چطور بهترین نتیجه را بگیرم؟",
    p.targetProtein ? `امروز ${Math.max(0, Math.round(p.targetProtein - t.protein))} گرم پروتئین کم دارم؛ چی بخورم؟` : "پروتئین روزانه‌ام را چطور کامل کنم؟",
    "روند وزنم را تحلیل کن؛ در مسیر درستی هستم؟",
    "قبل و بعد از تمرین چی بخورم؟",
    "برای ریکاوری و خواب بهتر چه کنم؟",
  ];

  const ask = async (question: string) => {
    const qText = question.trim();
    if (qText.length < 2 || busy || !st) return;
    setBusy(true); setDraftQ(qText); setText("");
    try {
      const r = await gas<{ answer: string; remaining: number; monthRemaining: number; history: AiTurn[] }>("sfCoachAiAsk", token, qText, todayISO());
      qc.setQueryData<AiState>(key, (old) => (old ? { ...old, history: r.history, remaining: r.remaining, monthRemaining: r.monthRemaining } : old));
    } catch (e) {
      setText(qText);
      toast.error(e instanceof Error ? e.message : "پاسخ دریافت نشد");
    } finally { setBusy(false); setDraftQ(""); }
  };

  const clear = async () => {
    try { await gas("sfCoachAiClear", token); qc.setQueryData<AiState>(key, (old) => (old ? { ...old, history: [] } : old)); } catch (e) { toast.error(e instanceof Error ? e.message : "پاک نشد"); }
  };

  if (q.isPending) return <div className="space-y-3"><div className="card-surface h-44 animate-pulse" /><div className="card-surface h-64 animate-pulse" /></div>;
  if (q.error || !st) return <Card className="p-6 text-center text-sm text-muted-foreground">{q.error?.message || "مربی هوشمند در دسترس نیست."}</Card>;

  const quota = st.monthCap > 0 ? `${st.monthRemaining} سؤال این ماه` : `${st.remaining} سؤال امروز`;

  return (
    <div className="flex min-h-[calc(100dvh-220px)] flex-col">
      {/* Hero */}
      <article className="animate-rise relative isolate overflow-hidden rounded-[26px] p-5 shadow-[var(--shadow-lux)]" style={{ background: "var(--gradient-lux)" }}>
        <div aria-hidden className="speed-lines pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div className="flex items-center gap-4">
          <Orb busy={busy} />
          <div className="min-w-0 flex-1">
            <span className="kicker">AI PERFORMANCE COACH</span>
            <h2 className="text-2xl font-black leading-tight">مربی <span className="text-gold-metal">هوشمند</span></h2>
            <p className="text-xs leading-6 text-muted-foreground">راهنمایی شخصی بر اساس برنامه، وزن و ثبت‌های خودت</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 text-[11px]">
          {[p.weight ? `${p.weight} KG` : null, p.targetCalories ? `${p.targetCalories} KCAL` : null, boot.workouts[0]?.name || null, `STREAK ${boot.streak}`].filter(Boolean).map((x) => (
            <span key={String(x)} className="num rounded-md bg-foreground/[0.07] px-2 py-1 text-xs tracking-wide text-muted-foreground">{x}</span>
          ))}
        </div>
      </article>

      {/* Goals */}
      <button type="button" onClick={() => setGoalsOpen(true)} className="card-surface animate-rise pressable mt-2.5 flex items-start gap-3 p-4 text-start" style={{ ["--d" as string]: "60ms" }}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-volt/10 text-volt"><Target className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <b className="flex items-center gap-1.5 text-sm">هدف‌های من<Pencil className="size-3.5 text-faint" /></b>
          <span className="line-clamp-2 text-xs leading-6 text-muted-foreground">{st.goals || "بنویس دنبال چه هستی (مثلاً ۵ کیلو کم کنم، اسکوات ۱۰۰ کیلو، شکم صاف) تا جواب‌ها دقیق‌تر شوند."}</span>
        </span>
      </button>

      {st.locked ? (
        <Card className="lux-edge mt-3 p-5 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-gold/15 text-gold"><Lock className="size-6" /></div>
          <h3 className="mt-3 text-lg font-black">مربی هوشمند مخصوص اعضاست</h3>
          <p className="mt-1 text-sm text-muted-foreground">وضعیت فعلی تو «{st.tierName}» است. با اشتراک نقره‌ای یا طلایی باز می‌شود.</p>
          <FitButton variant="gold" className="mt-4 w-full" onClick={openMembership}><Crown className="size-5" />مشاهدهٔ اشتراک‌ها</FitButton>
        </Card>
      ) : !st.enabled ? (
        <Card className="mt-3 p-5 text-center text-sm text-muted-foreground">مربی هوشمند فعلاً توسط مربی خاموش شده است.</Card>
      ) : (
        <>
          {/* Thread */}
          <div className="mt-4 flex-1 space-y-3">
            {hist.length === 0 && !busy ? (
              <div className="animate-rise space-y-2" style={{ ["--d" as string]: "120ms" }}>
                <p className="px-1 text-sm text-muted-foreground">سلام {firstName}! هر سؤالی دربارهٔ تمرین، تغذیه یا هدفت داری بپرس. چند پیشنهاد:</p>
                {suggestions.map((s, i) => (
                  <button key={s} type="button" onClick={() => void ask(s)} style={{ ["--d" as string]: `${150 + i * 60}ms` }}
                    className="animate-rise pressable flex w-full items-center gap-2 rounded-2xl border border-line bg-steel/70 px-4 py-3 text-start text-sm hover:border-volt/50">
                    <Sparkles className="size-4 shrink-0 text-gold" />{s}
                  </button>
                ))}
              </div>
            ) : null}
            {hist.map((m, i) => <Bubble key={i + m.at} m={m} />)}
            {busy ? (
              <>
                <Bubble m={{ role: "me", text: draftQ, at: "" }} />
                <div className="animate-rise flex items-center gap-2 px-1 text-xs text-muted-foreground">
                  <span className="flex gap-1">{[0, 1, 2].map((i) => <i key={i} className="animate-dot size-2 rounded-full bg-gold" style={{ ["--d" as string]: `${i * 150}ms` }} />)}</span>
                  در حال بررسی برنامه و پیشرفتت…
                </div>
              </>
            ) : null}
            <div ref={endRef} />
          </div>

          {hist.length ? (
            <div className="hide-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
              {suggestions.slice(0, 4).map((s) => (
                <button key={s} type="button" disabled={busy} onClick={() => void ask(s)} className="pressable shrink-0 rounded-full border border-line bg-steel/70 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40">{s}</button>
              ))}
            </div>
          ) : null}

          {/* Composer */}
          <div className="sticky bottom-0 z-30 -mx-4 mt-3 bg-gradient-to-t from-ink via-ink/95 to-transparent px-4 pt-6 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <form onSubmit={(e) => { e.preventDefault(); void ask(text); }} className="flex items-end gap-2 rounded-[22px] border border-foreground/15 bg-steel p-2 shadow-[var(--shadow-dock)] focus-within:border-volt/50">
              <textarea ref={taRef} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={800} disabled={busy}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(text); } }}
                placeholder="سؤال یا هدفت را بنویس…" aria-label="سؤال از مربی هوشمند"
                className="hide-scrollbar max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] leading-6 outline-none placeholder:text-faint [field-sizing:content]" />
              <FitButton type="submit" size="icon" className="shrink-0 rounded-2xl [clip-path:none]" loading={busy} disabled={text.trim().length < 2} aria-label="ارسال">
                {busy ? null : <ArrowUp className="size-5" strokeWidth={3} />}
              </FitButton>
            </form>
            <div className="mt-1.5 flex items-center justify-between px-2 text-[11px] text-faint">
              <span>{quota}</span>
              {hist.length ? <button type="button" onClick={clear} className="inline-flex items-center gap-1 hover:text-foreground"><RotateCcw className="size-3" />گفتگوی تازه</button> : <span>پاسخ‌ها جایگزین نظر پزشک یا مربی نیستند</span>}
            </div>
          </div>
        </>
      )}

      <GoalsSheet open={goalsOpen} onOpenChange={setGoalsOpen} value={st.goals} onSaved={(g) => qc.setQueryData<AiState>(key, (old) => (old ? { ...old, goals: g } : old))} />
    </div>
  );
}

function Orb({ busy }: { busy: boolean }) {
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <span className={cn("absolute inset-0 rounded-full [background:conic-gradient(from_0deg,var(--gold),var(--volt),var(--gold-deep),var(--gold))]", busy ? "animate-[orbit_1.4s_linear_infinite]" : "animate-orbit")} />
      <span className="absolute inset-[3px] rounded-full bg-ink" />
      <Sparkles className="relative size-7 text-gold" />
    </span>
  );
}

function Bubble({ m }: { m: AiTurn }) {
  const me = m.role === "me";
  return (
    <div className={cn("animate-rise flex", me ? "justify-start" : "justify-end")}>
      <div className={cn("max-w-[88%] rounded-[20px] px-4 py-3 text-[15px] leading-7",
        me ? "rounded-ss-md bg-volt text-volt-foreground" : "lux-edge rounded-se-md bg-steel-2/90")}>
        {me ? m.text : <Rich text={m.text} />}
      </div>
    </div>
  );
}

/** Renders the coach's short answer: paragraphs, "- " bullets and **bold**. */
function Rich({ text }: { text: string }) {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i} className="text-gold">{part.slice(2, -2)}</b> : <span key={i}>{part.replace(/^#+\s*/, "")}</span>);
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => /^([-•*]|\d+[.)])\s+/.test(l)
        ? <div key={i} className="flex gap-2"><i className="mt-2.5 block size-1.5 shrink-0 -skew-x-[20deg] bg-volt" /><span>{inline(l.replace(/^([-•*]|\d+[.)])\s+/, ""))}</span></div>
        : <p key={i}>{inline(l)}</p>)}
    </div>
  );
}

function GoalsSheet({ open, onOpenChange, value, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; value: string; onSaved: (g: string) => void }) {
  const { token } = useFit();
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setV(value); }, [open, value]);
  const chips = ["کاهش چربی شکم", "افزایش حجم عضلانی", "قدرت بیشتر در اسکوات و پرس", "آمادگی مسابقه", "بهبود استقامت", "تناسب بعد از بارداری"];
  const save = async () => {
    setBusy(true);
    try { const r = await gas<{ goals: string }>("sfCoachAiSaveGoals", token, v); onSaved(r.goals); toast.success("هدف‌هایت ذخیره شد"); onOpenChange(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "ذخیره نشد"); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="هدف‌های تمرینی من" footer={<FitButton className="w-full" loading={busy} onClick={save}>ذخیرهٔ هدف‌ها</FitButton>}>
      <p className="text-sm leading-7 text-muted-foreground">مربی هوشمند این‌ها را همراه برنامه و پیشرفتت در نظر می‌گیرد.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => setV((x) => (x.includes(c) ? x : (x ? x.trim() + "، " : "") + c))}
            className="pressable rounded-full border border-line bg-ink/40 px-3 py-1.5 text-xs hover:border-volt/50">+ {c}</button>
        ))}
      </div>
      <textarea value={v} onChange={(e) => setV(e.target.value)} maxLength={700} rows={5}
        placeholder="مثلاً: تا ۳ ماه دیگر ۶ کیلو کم کنم، زانوی چپم کمی حساس است، هفته‌ای ۴ روز وقت تمرین دارم."
        className="mt-3 w-full resize-none rounded-2xl border border-line bg-ink/60 p-3 text-[15px] leading-7 outline-none placeholder:text-faint focus:border-volt/60" />
      <div className="num text-end text-xs text-faint">{v.length}/700</div>
    </Sheet>
  );
}

