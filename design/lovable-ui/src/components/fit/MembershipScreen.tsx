import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CheckCircle2, Clock3, Copy, CreditCard, Crown, ImagePlus, MessageCircle, Phone, ReceiptText, RefreshCw, ShieldCheck, Sparkles, Tag, XCircle } from "lucide-react";
import { gas } from "@/lib/fit/api";
import { compressImage, fmt } from "@/lib/fit/format";
import type { Payment, SubPlan, SubState } from "@/lib/fit/types";
import { cn } from "@/lib/utils";
import { useFit } from "./store";
import { Card, CountUp, Empty, FitButton, Section } from "./primitives";

const STEPS = ["انتخاب پکیج", "کارت‌به‌کارت", "ارسال رسید", "تأیید مربی"];
const toman = (n: number) => `${fmt(n)}`;
const faDate = (iso: string) => {
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  return isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn", { day: "numeric", month: "long", year: "numeric" }).format(d);
};
const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: "فعال", tone: "bg-volt/15 text-volt" },
  grace: { label: "مهلت تمدید", tone: "bg-ember/15 text-ember" },
  expired: { label: "منقضی‌شده", tone: "bg-destructive/15 text-destructive" },
  none: { label: "بدون اشتراک", tone: "bg-foreground/10 text-muted-foreground" },
  staff: { label: "مربی", tone: "bg-gold/15 text-gold" },
};
export const PAY_STATUS: Record<string, { label: string; tone: string; icon: typeof Clock3 }> = {
  pending_review: { label: "در انتظار تأیید مربی", tone: "text-gold bg-gold/12", icon: Clock3 },
  paid: { label: "تأیید شد", tone: "text-volt bg-volt/12", icon: CheckCircle2 },
  rejected: { label: "تأیید نشد", tone: "text-destructive bg-destructive/12", icon: XCircle },
};

export function MembershipScreen() {
  const { token, boot, refresh } = useFit();
  const qc = useQueryClient();
  const sub = useQuery({ queryKey: ["fit-sub", token], queryFn: () => gas<SubState>("sfSubState", token), staleTime: 30_000 });
  const pays = useQuery({ queryKey: ["fit-pay", token], queryFn: () => gas<Payment[]>("sfMyPayments", token), staleTime: 15_000 });
  const [step, setStep] = useState(0);
  const [planId, setPlanId] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; discount: number; final: number } | null>(null);
  const [lastPay, setLastPay] = useState<{ payId: string; amount: number } | null>(null);
  const flowRef = useRef<HTMLDivElement>(null);

  if (sub.isPending) return <Loading />;
  if (sub.error || !sub.data) return <Empty icon={<RefreshCw className="size-6" />} title="اطلاعات اشتراک بارگذاری نشد" hint={sub.error?.message} />;
  const s = sub.data;
  const me = s.me;
  const plans = s.plans;
  const plan = plans.find((p) => p.id === planId) || null;
  const payments = pays.data || [];
  const pending = payments.find((p) => p.status === "pending_review");
  const latest = payments[0];
  const curPlan = plans.find((p) => p.id === me.packageId);
  const totalDays = Math.max(me.daysLeft, curPlan?.days || 30);
  const st = STATUS[me.status] || STATUS["none"]!;
  const tier = me.tier === "gold" ? "gold" : me.tier === "silver" ? "silver" : "none";

  const choose = (id: string) => { setPlanId(id); setCoupon(null); };
  const goStep = (n: number) => { setStep(n); requestAnimationFrame(() => flowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); };
  const onSent = async (r: { payId: string; amount: number }) => {
    setLastPay(r); setStep(3);
    await Promise.all([qc.invalidateQueries({ queryKey: ["fit-pay", token] }), refresh()]);
  };

  return (
    <div className="space-y-3">
      {/* Membership card */}
      <article className={cn("animate-rise relative isolate overflow-hidden rounded-[26px] p-5 shadow-[var(--shadow-lux)]", tier === "none" && "border border-line")}
        style={{ background: tier === "gold" ? "linear-gradient(140deg, color-mix(in oklab, var(--gold) 26%, var(--steel-2)), var(--steel) 55%, var(--ink))" : tier === "silver" ? "linear-gradient(140deg, color-mix(in oklab, var(--silver) 18%, var(--steel-2)), var(--steel) 55%, var(--ink))" : "var(--gradient-card)" }}>
        <div aria-hidden className="speed-lines pointer-events-none absolute inset-0 -z-10 opacity-60" />
        <div aria-hidden className="pointer-events-none absolute -end-16 -top-16 -z-10 size-56 rounded-full blur-3xl" style={{ background: tier === "silver" ? "color-mix(in oklab, var(--silver) 22%, transparent)" : "color-mix(in oklab, var(--gold) 25%, transparent)" }} />
        <div className="flex items-start justify-between">
          <div>
            <span className="kicker">SAEEDI · MEMBERSHIP</span>
            <h2 className={cn("mt-1 text-[34px] font-black leading-tight", tier === "gold" ? "text-gold-metal" : tier === "silver" ? "text-silver-metal" : "")}>
              {me.staff ? "دسترسی مربی" : me.active ? `اشتراک ${me.tierName}` : me.status === "expired" ? "اشتراک تمام شده" : "هنوز عضو نشدی"}
            </h2>
            <span className={cn("mt-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", st.tone)}>
              <i className={cn("size-1.5 rounded-full bg-current", me.active && "animate-breathe")} />{st.label}
            </span>
          </div>
          <span className={cn("grid size-14 place-items-center rounded-2xl", tier === "gold" ? "bg-gold/15 text-gold" : tier === "silver" ? "bg-silver/15 text-silver" : "bg-foreground/5 text-faint")}>
            <Crown className="size-7" />
          </span>
        </div>
        {me.active && !me.staff ? (
          <div className="mt-6">
            <div className="flex items-end justify-between">
              <div dir="ltr" className="flex items-baseline gap-1"><CountUp value={me.daysLeft} className="text-[64px]" /><span className="num text-base text-muted-foreground">DAYS</span></div>
              <div className="text-end text-xs text-muted-foreground">اعتبار تا<br /><b className="text-sm text-foreground">{faDate(me.endDate)}</b></div>
            </div>
            <div className="mt-3 h-2 -skew-x-[20deg] overflow-hidden bg-foreground/10">
              <div className={cn("h-full transition-[width] duration-[1400ms] ease-[var(--ease-out-expo)]", me.daysLeft <= (s.renewRemindDays || 7) ? "bg-ember" : tier === "gold" ? "[background:var(--gradient-gold)]" : "bg-volt")}
                style={{ width: `${Math.min(100, Math.round((me.daysLeft / totalDays) * 100))}%` }} />
            </div>
            {me.daysLeft <= (s.renewRemindDays || 7) ? <p className="mt-3 text-sm font-bold text-ember">کمتر از {me.daysLeft + 1} روز مانده؛ برای قطع نشدن برنامه، همین حالا تمدید کن.</p> : null}
          </div>
        ) : !me.staff ? (
          <p className="mt-4 text-sm leading-7 text-muted-foreground">با اشتراک، برنامهٔ تمرین و تغذیه، مربی هوشمند و پیگیری پیشرفت برایت باز می‌شود. یک پکیج انتخاب کن؛ در ۴ قدم ساده تمام می‌شود.</p>
        ) : null}
        <div className="mt-5 flex items-center justify-between border-t border-foreground/10 pt-3">
          <span className="num text-sm tracking-[.2em] text-muted-foreground">@{boot.user.username.toUpperCase()}</span>
          <span className="num text-sm tracking-[.3em] text-faint">{me.packageId || "— — —"}</span>
        </div>
      </article>

      {/* Live payment status */}
      {pending ? <PaymentTracker pay={pending} /> : latest?.status === "rejected" && !payments.some((p) => p.status === "paid" && p.createdAt > latest.createdAt) ? (
        <Card className="border-destructive/30 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 size-6 shrink-0 text-destructive" />
            <div className="flex-1"><b>آخرین رسیدت تأیید نشد</b>
              <p className="mt-1 text-sm text-muted-foreground">{latest.reason ? `دلیل مربی: ${latest.reason}` : "رسید دیگری بفرست یا با مربی تماس بگیر."}</p></div>
          </div>
          <FitButton size="md" variant="outline" className="mt-3 w-full" onClick={() => { choose(latest.packageId); goStep(plans.some((p) => p.id === latest.packageId) ? 1 : 0); }}>ارسال دوبارهٔ رسید</FitButton>
        </Card>
      ) : null}

      {me.staff ? null : (
        <div ref={flowRef} className="scroll-mt-4">
          <Section en={me.active ? "RENEW · UPGRADE" : "JOIN THE CLUB"} title={me.active ? "تمدید یا ارتقا" : "خرید اشتراک"} />
          <Stepper step={step} onJump={(n) => n < step && step < 3 && goStep(n)} />

          {step === 0 ? (
            <div className="mt-3 space-y-2.5">
              {plans.length ? plans.map((p, i) => <PlanCard key={p.id} p={p} i={i} on={p.id === planId} current={p.id === me.packageId && me.active} onClick={() => choose(p.id)} />)
                : <Empty icon={<Crown className="size-6" />} title="پکیجی فعال نیست" hint="مربی هنوز پکیجی برای فروش فعال نکرده." />}
              {s.marketing.guarantee ? <p className="flex items-center gap-2 px-1 pt-1 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-volt" />{s.marketing.guarantee}</p> : null}
              <FitButton className="mt-2 w-full" disabled={!plan} onClick={() => goStep(1)}>{plan ? `ادامه با «${plan.name}»` : "یک پکیج انتخاب کن"}</FitButton>
            </div>
          ) : null}

          {step === 1 && plan ? <PayStep s={s} plan={plan} coupon={coupon} setCoupon={setCoupon} onBack={() => goStep(0)} onNext={() => goStep(2)} /> : null}
          {step === 2 && plan ? <ReceiptStep plan={plan} coupon={coupon} onBack={() => goStep(1)} onSent={onSent} /> : null}
          {step === 3 ? (
            <Card className="mt-3 p-5 text-center">
              <div className="animate-pop mx-auto grid size-16 place-items-center rounded-full bg-volt text-volt-foreground shadow-[var(--glow-volt)]"><Check className="size-8" strokeWidth={3} /></div>
              <h3 className="mt-4 text-xl font-black">رسیدت رسید!</h3>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">مربی رسید را بررسی می‌کند و بعد از تأیید، اشتراکت خودکار فعال می‌شود. وضعیتش را همین‌جا می‌بینی.</p>
              {lastPay ? <p className="num mt-3 text-sm text-faint">{lastPay.payId} · {toman(lastPay.amount)} T</p> : null}
              <FitButton variant="outline" size="md" className="mt-4" onClick={() => { setStep(0); setPlanId(""); setCoupon(null); }}>باشه</FitButton>
            </Card>
          ) : null}
        </div>
      )}

      {/* Compare */}
      {s.matrix?.length ? (
        <>
          <Section en="COMPARE" title="مقایسهٔ اشتراک‌ها" />
          <Card className="p-0">
            <div className="grid grid-cols-[1fr_72px_72px] items-center gap-2 border-b border-line px-4 py-3 text-xs">
              <span className="text-muted-foreground">امکانات</span>
              <span className="num text-center tracking-[.15em] text-silver-metal">SILVER</span>
              <span className="num text-center tracking-[.15em] text-gold-metal">GOLD</span>
            </div>
            {s.matrix.map((r) => (
              <div key={r.key} className="grid grid-cols-[1fr_72px_72px] items-center gap-2 border-b border-line/60 px-4 py-3 text-sm last:border-0">
                <span>{r.label}</span><Cell v={r.silver} /><Cell v={r.gold} gold />
              </div>
            ))}
          </Card>
        </>
      ) : null}

      {/* History */}
      <Section en="RECEIPTS" title="پرداخت‌های من" aside={pays.isFetching ? "به‌روزرسانی…" : undefined} />
      {payments.length ? (
        <Card className="divide-y divide-line p-0">
          {payments.map((p) => {
            const ps = PAY_STATUS[p.status] || { label: p.status, tone: "text-muted-foreground bg-foreground/5", icon: ReceiptText };
            const I = ps.icon;
            return (
              <div key={p.payId} className="flex items-center gap-3 px-4 py-3">
                <span className={cn("grid size-10 place-items-center rounded-xl", ps.tone)}><I className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <b className="block truncate text-sm">{p.packageName}</b>
                  <span className="text-xs text-muted-foreground">{faDate(p.createdAt)} · <span className={cn("font-bold", ps.tone.split(" ")[0])}>{ps.label}</span></span>
                  {p.status === "rejected" && p.reason ? <p className="text-xs text-destructive">{p.reason}</p> : null}
                </div>
                <div dir="ltr" className="text-end"><span className="num text-lg">{toman(p.final)}</span><div className="num text-[10px] text-faint">TOMAN</div></div>
              </div>
            );
          })}
        </Card>
      ) : <p className="card-surface px-4 py-5 text-center text-sm text-muted-foreground">{pays.isPending ? "در حال بارگذاری…" : "هنوز پرداختی ثبت نکردی."}</p>}

      {/* Support */}
      {s.support?.phone ? (
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <a href={`tel:${s.support.phone}`} className="card-surface pressable flex items-center gap-2 p-3.5 text-sm font-bold"><Phone className="size-4 text-volt" />تماس با پشتیبانی</a>
          <a href={`https://wa.me/${s.support.whatsapp}`} target="_blank" rel="noreferrer" className="card-surface pressable flex items-center gap-2 p-3.5 text-sm font-bold"><MessageCircle className="size-4 text-volt" />واتساپ مربی</a>
        </div>
      ) : null}
    </div>
  );
}

function Cell({ v, gold }: { v: string; gold?: boolean }) {
  const yes = /^(دارد|✓|yes)$/i.test(v.trim());
  const no = !v || /^[—-]$/.test(v.trim());
  return (
    <span className="grid place-items-center text-center text-xs">
      {yes ? <span className={cn("grid size-6 place-items-center rounded-full", gold ? "bg-gold/20 text-gold" : "bg-silver/15 text-silver")}><Check className="size-3.5" strokeWidth={3} /></span>
        : no ? <span className="text-faint">—</span> : <span className={cn("font-bold", gold && "text-gold")}>{v}</span>}
    </span>
  );
}

function Stepper({ step, onJump }: { step: number; onJump: (n: number) => void }) {
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="مراحل خرید">
      {STEPS.map((t, i) => {
        const done = i < step, on = i === step;
        return (
          <li key={t}>
            <button type="button" onClick={() => onJump(i)} className="w-full text-start" aria-current={on ? "step" : undefined}>
              <span className={cn("block h-1.5 -skew-x-[20deg] transition-colors duration-500", done ? "bg-volt" : on ? "bg-volt/70 animate-breathe" : "bg-foreground/10")} />
              <span className={cn("mt-2 flex items-center gap-1 text-[11px] font-bold", on ? "text-foreground" : done ? "text-volt" : "text-faint")}>
                <span className="num text-sm">{done ? "✓" : `0${i + 1}`}</span>{t}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function PlanCard({ p, i, on, current, onClick }: { p: SubPlan; i: number; on: boolean; current: boolean; onClick: () => void }) {
  const gold = p.tier === "gold";
  const off = p.compareAt > p.price ? Math.round((1 - p.price / p.compareAt) * 100) : 0;
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{ ["--d" as string]: `${i * 70}ms` }}
      className={cn("animate-rise pressable relative w-full overflow-hidden rounded-[22px] border p-4 text-start transition-[border-color,box-shadow] duration-300",
        on ? (gold ? "border-gold/70 shadow-[var(--glow-gold)]" : "border-volt/70 shadow-[var(--glow-volt)]") : "border-line")}
      >
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: gold ? "var(--gradient-lux)" : "var(--gradient-card)" }} />
      {p.badge ? <span className={cn("absolute end-0 top-0 rounded-es-xl px-3 py-1 text-[11px] font-black", gold ? "text-ink [background:var(--gradient-gold)]" : "bg-volt text-volt-foreground")}>{p.badge}</span> : null}
      <div className="flex items-center gap-3">
        <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors", on ? (gold ? "border-gold bg-gold text-ink" : "border-volt bg-volt text-volt-foreground") : "border-foreground/25")}>
          {on ? <Check className="size-3.5" strokeWidth={3.5} /> : null}
        </span>
        <div className="flex-1">
          <b className={cn("text-lg", gold && "text-gold-metal")}>{p.name}</b>
          <div className="text-xs text-muted-foreground">{fmt(p.days)} روز{current ? " · اشتراک فعلی تو" : ""}</div>
        </div>
        <div dir="ltr" className="text-end">
          {off ? <div className="flex items-center justify-end gap-1.5"><s className="num text-xs text-faint">{toman(p.compareAt)}</s><span className="rounded bg-ember/20 px-1 text-[10px] font-black text-ember">-{off}%</span></div> : null}
          <span className="num text-[28px]">{toman(p.price)}</span><span className="num text-[10px] text-faint"> TOMAN</span>
          {p.perDay ? <div className="text-[11px] text-muted-foreground" dir="rtl">روزی {fmt(p.perDay)} تومان</div> : null}
        </div>
      </div>
      {p.features.length ? (
        <ul className="mt-3 grid gap-1.5 border-t border-line pt-3">
          {p.features.map((f) => <li key={f} className="flex items-center gap-2 text-sm text-foreground/90"><Sparkles className={cn("size-3.5 shrink-0", gold ? "text-gold" : "text-volt")} />{f}</li>)}
        </ul>
      ) : null}
    </button>
  );
}

function PayStep({ s, plan, coupon, setCoupon, onBack, onNext }: {
  s: SubState; plan: SubPlan; coupon: { code: string; discount: number; final: number } | null;
  setCoupon: (c: { code: string; discount: number; final: number } | null) => void; onBack: () => void; onNext: () => void;
}) {
  const { token } = useFit();
  const [code, setCode] = useState(coupon?.code || "");
  const [busy, setBusy] = useState(false);
  const final = coupon ? coupon.final : plan.price;
  const card = s.card.number.replace(/\D/g, "");
  const groups = card ? card.match(/.{1,4}/g) || [] : [];
  const apply = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await gas<{ ok: boolean; discount: number; final: number; code: string }>("sfCouponPreview", token, plan.id, code.trim());
      if (r.ok) { setCoupon({ code: r.code, discount: r.discount, final: r.final }); toast.success("کد تخفیف اعمال شد"); }
      else { setCoupon(null); toast.error("این کد تخفیف برای این پکیج معتبر نیست."); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "بررسی کد ناموفق بود"); }
    finally { setBusy(false); }
  };
  const copy = async (t: string, m: string) => { try { await navigator.clipboard.writeText(t); toast.success(m); } catch { toast.error("کپی نشد؛ دستی یادداشت کن."); } };

  return (
    <div className="mt-3 space-y-2.5">
      <Card className="p-4">
        <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">پکیج</span><b>{plan.name} · {fmt(plan.days)} روز</b></div>
        <div className="mt-2 flex items-center justify-between text-sm"><span className="text-muted-foreground">قیمت</span><span className="num text-lg">{toman(plan.price)}</span></div>
        {coupon ? <div className="mt-2 flex items-center justify-between text-sm text-volt"><span>تخفیف ({coupon.code})</span><span className="num text-lg">-{toman(coupon.discount)}</span></div> : null}
        <div className="mt-3 flex items-end justify-between border-t border-line pt-3"><b>مبلغ قابل پرداخت</b>
          <span dir="ltr"><CountUp value={final} className="text-[34px] text-volt" /><span className="num text-xs text-faint"> TOMAN</span></span></div>
        <div className="mt-3 flex gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-line bg-ink/50 px-3 focus-within:border-volt/60">
            <Tag className="size-4 text-faint" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد تخفیف (اختیاری)" dir="ltr" className="h-full w-full bg-transparent text-end text-sm uppercase outline-none placeholder:normal-case placeholder:text-faint" />
          </label>
          <FitButton type="button" variant="outline" size="md" loading={busy} onClick={apply}>اعمال</FitButton>
        </div>
      </Card>

      {card ? (
        <div className="animate-rise relative overflow-hidden rounded-[22px] p-5 shadow-[var(--shadow-lux)]" style={{ background: "var(--gradient-lux)" }}>
          <div aria-hidden className="speed-lines pointer-events-none absolute inset-0 opacity-50" />
          <div className="relative flex items-center justify-between"><span className="kicker">CARD TO CARD</span><CreditCard className="size-6 text-gold" /></div>
          <div dir="ltr" className="num relative mt-5 flex justify-between text-[28px] tracking-[.06em]">{groups.map((g, i) => <span key={i}>{g}</span>)}</div>
          <div className="relative mt-4 flex items-center justify-between">
            <span className="text-sm">به نام <b className="text-gold-metal">{s.card.holder || "—"}</b></span>
            <button type="button" onClick={() => copy(card, "شمارهٔ کارت کپی شد")} className="pressable inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground/10 px-3 text-xs font-bold"><Copy className="size-3.5" />کپی شماره</button>
          </div>
        </div>
      ) : <Empty icon={<CreditCard className="size-6" />} title="شمارهٔ کارت ثبت نشده" hint="مربی هنوز شمارهٔ کارت را وارد نکرده؛ با پشتیبانی تماس بگیر." />}

      <ol className="space-y-2 px-1 text-sm text-muted-foreground">
        <li className="flex gap-2"><span className="num text-volt">1</span>مبلغ <b className="text-foreground">{toman(final)} تومان</b> را دقیقاً به این کارت واریز کن.</li>
        <li className="flex gap-2"><span className="num text-volt">2</span>از صفحهٔ «پرداخت موفق» بانک عکس یا اسکرین‌شات بگیر.</li>
        <li className="flex gap-2"><span className="num text-volt">3</span>در قدم بعد همان عکس را بفرست تا مربی تأیید کند.</li>
      </ol>
      <div className="flex gap-2">
        <FitButton type="button" variant="ghost" size="lg" onClick={onBack}>قبلی</FitButton>
        <FitButton type="button" className="flex-1" disabled={!card} onClick={onNext}>واریز کردم، ارسال رسید</FitButton>
      </div>
    </div>
  );
}

function ReceiptStep({ plan, coupon, onBack, onSent }: { plan: SubPlan; coupon: { code: string } | null; onBack: () => void; onSent: (r: { payId: string; amount: number }) => void }) {
  const { token } = useFit();
  const [img, setImg] = useState<{ base64: string; type: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const pick = async (f?: File) => {
    if (!f) return;
    const c = await compressImage(f, 1600);
    setImg({ ...c, url: URL.createObjectURL(f) });
  };
  const send = async () => {
    if (!img || busy || ok) return;
    setBusy(true);
    try {
      const r = await gas<{ payId: string; amount: number }>("sfSubReceipt", token, { packageId: plan.id, coupon: coupon?.code || "", receipt: { base64: img.base64, mime: img.type } });
      setBusy(false); setOk(true);
      setTimeout(() => onSent(r), 700);
    } catch (e) { setBusy(false); toast.error(e instanceof Error ? e.message : "ارسال رسید ناموفق بود"); }
  };
  const cid = useMemo(() => Math.random().toString(36).slice(2), []);
  return (
    <div className="mt-3 space-y-2.5">
      <input ref={input} id={`rc-${cid}`} type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      <button type="button" onClick={() => input.current?.click()}
        className={cn("pressable relative grid w-full place-items-center overflow-hidden rounded-[22px] border-2 border-dashed p-4 text-center", img ? "border-volt/60" : "border-line hover:border-volt/50")}>
        {img ? (
          <img src={img.url} alt="پیش‌نمایش رسید" className="max-h-72 rounded-xl object-contain" />
        ) : (
          <span className="grid place-items-center gap-2 py-8">
            <span className="grid size-14 place-items-center rounded-2xl bg-volt/10 text-volt"><ImagePlus className="size-7" /></span>
            <b>انتخاب عکس رسید</b><span className="text-xs text-muted-foreground">از گالری یا دوربین</span>
          </span>
        )}
      </button>
      {img ? <button type="button" onClick={() => input.current?.click()} className="w-full text-center text-xs font-bold text-volt">عوض کردن عکس</button> : null}
      <div className="flex gap-2">
        <FitButton type="button" variant="ghost" size="lg" onClick={onBack} disabled={busy}>قبلی</FitButton>
        <FitButton type="button" className="flex-1" disabled={!img || busy || ok} loading={busy} success={ok} onClick={send}>{busy ? "در حال ارسال…" : "ارسال رسید برای مربی"}</FitButton>
      </div>
    </div>
  );
}

function PaymentTracker({ pay }: { pay: Payment }) {
  const steps = [
    { t: "رسید ثبت شد", d: faDate(pay.createdAt), done: true },
    { t: "بررسی توسط مربی", d: "مربی رسید را با واریزی‌اش تطبیق می‌دهد", on: true },
    { t: "فعال شدن اشتراک", d: "خودکار بعد از تأیید" },
  ];
  return (
    <Card className="lux-edge p-4">
      <div className="flex items-center gap-2"><Clock3 className="size-5 text-gold" /><b className="flex-1">پرداختت در حال بررسی است</b><span dir="ltr" className="num text-sm text-faint">{fmt(pay.final)} T</span></div>
      <ol className="relative mt-4 space-y-4 border-s border-line ps-5">
        {steps.map((s) => (
          <li key={s.t} className="relative">
            <span className={cn("absolute -start-[27px] top-0.5 grid size-3.5 place-items-center rounded-full border-2", s.done ? "border-volt bg-volt" : s.on ? "animate-glow border-gold bg-ink" : "border-foreground/25 bg-ink")} />
            <b className={cn("text-sm", s.on && "text-gold")}>{s.t}</b>
            <p className="text-xs text-muted-foreground">{s.d}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">{pay.packageName} · شناسه <span className="num">{pay.payId}</span></p>
    </Card>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      <div className="card-surface h-56 animate-pulse" />
      <div className="card-surface h-24 animate-pulse" />
      <div className="card-surface h-40 animate-pulse" />
    </div>
  );
}

