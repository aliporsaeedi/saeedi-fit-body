import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, Lock, ShieldCheck, User } from "lucide-react";
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
    <main className="relative isolate mx-auto flex min-h-dvh max-w-[460px] flex-col overflow-hidden px-6 pt-[calc(28px+env(safe-area-inset-top))] pb-8">
      {/* Arena lights */}
      <div aria-hidden className="speed-lines pointer-events-none absolute inset-0 -z-10 opacity-70 [mask-image:linear-gradient(180deg,black,transparent_70%)]" />
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--volt)_22%,transparent),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -start-32 -z-10 size-[420px] rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--gold)_14%,transparent),transparent)]" />

      <header className="animate-rise flex items-center justify-between">
        <span className="kicker">EST. COACHING</span>
        <span className="kicker text-gold-metal">MEMBERS ONLY</span>
      </header>

      {/* Emblem */}
      <section className="relative mt-6 grid place-items-center">
        <div className="relative grid size-[264px] place-items-center">
          <svg aria-hidden viewBox="0 0 200 200" className="animate-orbit absolute inset-0 size-full">
            {Array.from({ length: 60 }, (_, i) => {
              const a = (i / 60) * Math.PI * 2, long = i % 5 === 0;
              return <line key={i} x1={100 + 96 * Math.cos(a)} y1={100 + 96 * Math.sin(a)} x2={100 + (long ? 86 : 91) * Math.cos(a)} y2={100 + (long ? 86 : 91) * Math.sin(a)}
                strokeWidth={long ? 1.6 : 0.8} strokeLinecap="round" style={{ stroke: long ? "var(--volt)" : "color-mix(in oklab, var(--foreground) 28%, transparent)" }} />;
            })}
          </svg>
          <svg aria-hidden viewBox="0 0 200 200" className="animate-orbit-rev absolute inset-6 size-[calc(100%-48px)]">
            <circle cx="100" cy="100" r="96" fill="none" strokeWidth="1" strokeDasharray="2 10" style={{ stroke: "var(--gold)" }} opacity=".55" />
          </svg>
          <div className="animate-float relative">
            <Logo className="h-44 drop-shadow-[0_0_36px_color-mix(in_oklab,var(--volt)_45%,transparent)]" />
          </div>
        </div>
        <h2 className="animate-rise num -mt-2 text-[68px] leading-none tracking-[.04em] text-gold-metal" style={{ ["--d" as string]: "80ms" }}>SAEEDI</h2>
        <div className="animate-rise mt-1 flex items-center gap-3" style={{ ["--d" as string]: "140ms" }}>
          <i className="h-px w-10 bg-gradient-to-l from-volt to-transparent" />
          <span className="num text-base tracking-[.55em] text-volt">FIT BODY</span>
          <i className="h-px w-10 bg-gradient-to-r from-volt to-transparent" />
        </div>
      </section>

      <form ref={formRef} onSubmit={submit}
        className={cn("animate-rise glass relative mt-8 space-y-3 rounded-[26px] p-5", shake && "animate-shake")} style={{ ["--d" as string]: "200ms" }}>
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[26px] font-black leading-tight">خوش برگشتی، قهرمان</h1>
            <p className="text-sm text-muted-foreground">وارد شو تا تمرین امروزت را ادامه بدهی.</p>
          </div>
          <span className="kicker hidden sm:inline">SIGN IN</span>
        </div>
        <FloatField icon={<User className="size-5" />} label="نام کاربری" value={u} onChange={setU} autoComplete="username" invalid={!!err && !u.trim()} />
        <FloatField icon={<Lock className="size-5" />} label="رمز عبور" value={pw} onChange={setPw} type={show ? "text" : "password"} autoComplete="current-password" invalid={!!err && !pw}
          trailing={<button type="button" onClick={() => setShow(!show)} className="pressable grid size-9 place-items-center rounded-lg text-faint hover:text-foreground" aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}>{show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button>} />
        {err ? <p role="alert" className="animate-rise rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{err}</p> : null}
        <FitButton type="submit" className="mt-1 w-full text-[17px]" loading={busy} success={done}>
          {busy ? "در حال بررسی…" : <>ورود به باشگاه<ArrowLeft className="size-5 transition-transform duration-500 ease-[var(--ease-spring)] group-hover/btn:-translate-x-1.5" strokeWidth={3} /></>}
        </FitButton>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5 text-volt" />حساب نداری؟ برای ساخت حساب با مربی هماهنگ کن.</p>
      </form>

      <div className="animate-rise mt-auto grid grid-cols-3 gap-2 pt-8 text-center" style={{ ["--d" as string]: "320ms" }}>
        {STATS.map(([a, b]) => (
          <div key={b} className="border-t border-line pt-3"><div className="num text-2xl">{a}</div><div className="kicker mt-1 text-[9px]">{b}</div></div>
        ))}
      </div>
      {done ? <div aria-hidden className="pointer-events-none fixed inset-0 z-50 animate-[rise_.6s_var(--ease-out-expo)_both] bg-[radial-gradient(circle_at_50%_70%,color-mix(in_oklab,var(--volt)_30%,transparent),transparent_60%)]" /> : null}
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

