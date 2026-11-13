import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, User, Dumbbell, Utensils, TrendingUp } from "lucide-react";
import { gas } from "@/lib/fit/api";
import { FitButton } from "./primitives";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const STATS = [["01", "TRAIN"], ["02", "FUEL"], ["03", "PROGRESS"]] as const;

export function LoginScreen({ onSignedIn }: { onSignedIn: (token: string) => void }) {
  const [u, setU] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!shake) return undefined;
    const t = setTimeout(() => setShake(0), 520);
    return () => clearTimeout(t);
  }, [shake]);

  const fail = (m: string) => { setErr(m); setShake(Date.now()); navigator.vibrate?.(40); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || done) return;
    if (!u.trim() || !pw) { fail("نام کاربری و رمز عبور را وارد کن."); return; }
    setBusy(true); setErr("");
    try {
      const r = await gas<{ token: string }>("login", u.trim(), pw);
      setBusy(false); setDone(true);
      navigator.vibrate?.([12, 40, 12]);
      setTimeout(() => onSignedIn(r.token), 650);
    } catch (x) {
      setBusy(false);
      fail(x instanceof Error ? x.message : "ورود ناموفق بود");
    }
  };

  return (
    <main className="sfx-landing"><div className="sfx-arena" aria-hidden/>
      <div className="sfx-landing-grid">
        <section className="sfx-landing-hero">
          <div className="sfx-landing-brand"><Logo className="h-[150px] w-[150px]"/><div><span className="kicker text-volt">SAEEDI FIT BODY</span><p className="mt-2 text-sm text-muted-foreground">مربیگری تخصصی · مسیر شخصی پیشرفت</p></div></div>
          <h1>برنامهٔ دقیق.<br/><span className="text-volt">اجرای پیوسته.</span><br/>پیشرفت قابل مشاهده.</h1>
          <p>تمرین، تغذیه و پیگیری مربی در یک فضای اختصاصی. برنامهٔ خود را دنبال کنید، عملکردتان را ثبت کنید و مسیر تغییر را آگاهانه پیش ببرید.</p>
          <div className="sfx-pillars">
            <div className="sfx-pillar"><Dumbbell className="size-6 text-volt"/><div><strong>تمرین اختصاصی</strong><p>حرکت‌ها، تکنیک اجرا و سابقهٔ وزنه در کنار هم</p></div></div>
            <div className="sfx-pillar"><Utensils className="size-6 text-volt"/><div><strong>تغذیهٔ هدفمند</strong><p>برنامهٔ غذا، ماکرو و زمان مصرف مکمل</p></div></div>
            <div className="sfx-pillar"><TrendingUp className="size-6 text-volt"/><div><strong>پیگیری مستمر</strong><p>ثبت پیشرفت و ارتباط مستقیم با مربی</p></div></div>
          </div>
        </section>
        <section>
          <form ref={formRef} onSubmit={submit} className={cn("sfx-signin space-y-3",shake&&"animate-shake")}>
            <span className="kicker text-volt">YOUR PERSONAL TRAINING SPACE</span>
            <h2>ورود به حساب ورزشکار</h2><p>برای دسترسی به برنامه‌ها و ادامهٔ مسیر شخصی خود وارد شوید.</p>
            <FloatField icon={<User className="size-5"/>} label="نام کاربری" value={u} onChange={setU} autoComplete="username" invalid={!!err&&!u.trim()}/>
            <FloatField icon={<Lock className="size-5"/>} label="رمز عبور" value={pw} onChange={setPw} type={show?'text':'password'} autoComplete="current-password" invalid={!!err&&!pw} trailing={<button type="button" onClick={()=>setShow(!show)} className="pressable grid size-9 place-items-center rounded-lg text-muted-foreground" aria-label={show?'پنهان کردن رمز':'نمایش رمز'}>{show?<EyeOff className="size-5"/>:<Eye className="size-5"/>}</button>}/>
            {err?<div role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm leading-7 text-destructive">{err}</div>:null}
            <FitButton type="submit" className="w-full" loading={busy} success={done} disabled={busy||done}>{busy?'در حال بررسی حساب…':'ورود به فضای اختصاصی'}<ArrowLeft className="size-5"/></FitButton>
            <p className="sfx-landing-note">اگر حساب فعالی ندارید، برای دریافت برنامه و ایجاد حساب با مربی خود هماهنگ کنید.</p>
          </form>
          <p className="sfx-landing-note flex items-center justify-center gap-2"><ShieldCheck className="size-4 text-volt"/>برنامه‌ها و سوابق، متصل به حساب شخصی شما هستند.</p>
        </section>
      </div>
    </main>
  );
}

function FloatField({ icon, label, value, onChange, trailing, invalid, ...p }: {
  icon: React.ReactNode; label: string; value: string; onChange: (v: string) => void; trailing?: React.ReactNode; invalid?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  const filled = value.length > 0;
  return (
    <label className={cn("group relative flex h-[62px] items-center gap-3 rounded-2xl border bg-ink/55 px-4 transition-[border-color,box-shadow] duration-300",
      invalid ? "border-destructive/60" : "border-line focus-within:border-volt/70 focus-within:shadow-[var(--glow-volt)]")}>
      <span className="text-faint transition-colors group-focus-within:text-volt">{icon}</span>
      <span className="relative h-full flex-1">
        <span className={cn("pointer-events-none absolute start-0 text-faint transition-all duration-300 ease-[var(--ease-out-expo)]",
          filled ? "top-2 text-[11px] font-bold text-volt" : "top-1/2 -translate-y-1/2 text-base group-focus-within:top-2 group-focus-within:translate-y-0 group-focus-within:text-[11px] group-focus-within:font-bold group-focus-within:text-volt")}>{label}</span>
        <input {...p} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} dir="ltr"
          className="absolute inset-x-0 bottom-2 h-7 bg-transparent text-end text-[17px] font-bold tracking-wide outline-none" />
      </span>
      {trailing}
    </label>
  );
}

