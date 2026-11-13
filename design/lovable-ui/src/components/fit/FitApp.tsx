import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Apple, ArrowRight, Dumbbell, Flame, Home, LayoutGrid, LineChart, Pause, Plus, RefreshCw } from "lucide-react";
import { BootProvider, useFit, useSession } from "./store";
import { LoginScreen } from "./LoginScreen";
import { HomeScreen } from "./HomeScreen";
import { TrainScreen } from "./TrainScreen";
import { FuelScreen } from "./FuelScreen";
import { ProgressScreen } from "./ProgressScreen";
import { MoreScreen } from "./MoreScreen";
import { ChatSheet } from "./ChatSheet";
import { MembershipScreen } from "./MembershipScreen";
import { CoachAiScreen } from "./CoachAiScreen";
import { Logo } from "./Logo";
import { FitButton } from "./primitives";
import { addRest, stopRest, useRest } from "./restTimer";
import { greeting, jalaliLong, latinStamp } from "@/lib/fit/format";
import { cn } from "@/lib/utils";

type Tab = "home" | "train" | "fuel" | "progress" | "more" | "membership" | "coach";
export type Go = (t: Tab) => void;
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "خانه", icon: Home },
  { id: "train", label: "تمرین", icon: Dumbbell },
  { id: "fuel", label: "تغذیه", icon: Apple },
  { id: "progress", label: "پیشرفت", icon: LineChart },
  { id: "more", label: "بیشتر", icon: LayoutGrid },
];
const TITLES: Record<Tab, string> = { home: "خانه", train: "تمرین", fuel: "تغذیه", progress: "پیشرفت", more: "پروفایل", membership: "اشتراک", coach: "مربی هوشمند" };
const KICKER: Record<Tab, string> = { home: "", train: "TRAINING", fuel: "NUTRITION", progress: "PROGRESS", more: "PROFILE", membership: "MEMBERSHIP", coach: "AI COACH" };
const SUB: Tab[] = ["membership", "coach"];

export function FitApp() {
  const { token, signIn, signOut } = useSession();
  if (!token) return <LoginScreen onSignedIn={signIn} />;
  return (
    <BootProvider token={token} onSignedOut={signOut} fallback={<Splash />} errorView={(retry, msg) => <ErrorView retry={retry} message={msg} />}>
      <Shell />
    </BootProvider>
  );
}

function readTab(): Tab {
  if (typeof window === "undefined") return "home";
  const h = window.location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === h) || SUB.includes(h) ? h : "home";
}

function Shell() {
  const { boot } = useFit();
  const [tab, setTabState] = useState<Tab>(readTab);
  const [chat, setChat] = useState(false);
  const [back, setBack] = useState<Tab>("home");
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const setTab = useCallback((t: Tab) => {
    if (SUB.includes(t) && !SUB.includes(tabRef.current)) setBack(tabRef.current);
    setTabState(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const isSub = SUB.includes(tab);
  useEffect(() => { const f = () => setTabState(readTab()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  const now = new Date();
  const name = boot.profile.name || boot.user.username;

  let screen: ReactNode;
  if (tab === "home") screen = <HomeScreen go={setTab} openChat={() => setChat(true)} />;
  else if (tab === "membership") screen = <MembershipScreen />;
  else if (tab === "coach") screen = <CoachAiScreen openMembership={() => setTab("membership")} />;
  else if (tab === "train") screen = <TrainScreen />;
  else if (tab === "fuel") screen = <FuelScreen />;
  else if (tab === "progress") screen = <ProgressScreen />;
  else screen = <MoreScreen go={setTab} openChat={() => setChat(true)} />;

  return (
    <div className={cn("mx-auto min-h-dvh max-w-[460px] px-4", isSub ? "pb-[calc(24px+env(safe-area-inset-bottom))]" : "pb-[calc(120px+env(safe-area-inset-bottom))]")}>
      <header className="flex items-center gap-3 pt-[calc(18px+env(safe-area-inset-top))] pb-4">
        {isSub ? (
          <button type="button" onClick={() => setTab(back)} aria-label="بازگشت" className="glass pressable grid size-12 shrink-0 place-items-center rounded-2xl"><ArrowRight className="size-5" /></button>
        ) : (
          <button type="button" onClick={() => setTab("home")} aria-label="خانه" className="relative shrink-0">
            <span aria-hidden className="absolute inset-0 rounded-full bg-volt/20 blur-xl" />
            <Logo className="relative h-[60px]" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            {KICKER[tab] ? <span className="kicker text-volt">{KICKER[tab]}</span> : <span className="num text-sm tracking-wider text-faint">{latinStamp(now).toUpperCase()}</span>}
            <span className="size-1 rounded-full bg-gold" /><span>{jalaliLong(now)}</span>
          </p>
          <h1 key={tab} className="animate-rise truncate text-[28px] font-black leading-tight tracking-tight">
            {tab === "home" ? <>{greeting(now)}، <span className="text-volt-metal">{name}</span></> : TITLES[tab]}
          </h1>
        </div>
        <span className="glass inline-flex h-12 items-center gap-1.5 rounded-2xl px-3" title="روزهای پیاپی">
          <Flame className="size-5 text-ember" /><span className="num text-2xl">{boot.streak}</span>
        </span>
      </header>
      <main key={tab}>{screen}</main>
      <RestPill />
      {isSub ? null : <Dock tab={tab} setTab={setTab} />}
      <ChatSheet open={chat} onOpenChange={setChat} />
    </div>
  );
}

function Dock({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const i = TABS.findIndex((t) => t.id === tab);
  return (
    <nav aria-label="منوی اصلی" className="glass fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 mx-auto grid w-[min(420px,calc(100%-24px))] grid-cols-5 rounded-[22px] p-1.5">
      <span aria-hidden className="absolute inset-y-1.5 start-1.5 w-[calc((100%-12px)/5)] rounded-2xl shadow-[var(--glow-volt)] [background:var(--gradient-volt)] transition-transform duration-500 ease-[var(--ease-spring)]"
        style={{ transform: `translateX(${-i * 100}%)` }} />
      {TABS.map((t) => {
        const on = t.id === tab, I = t.icon;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={on ? "page" : undefined}
            className={cn("relative z-10 flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors", on ? "text-volt-foreground" : "text-muted-foreground")}>
            <I className={cn("size-[22px] transition-transform duration-500 ease-[var(--ease-spring)]", on && "-translate-y-0.5 scale-110")} strokeWidth={on ? 2.5 : 2} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

function RestPill() {
  const { left, total } = useRest();
  if (!left) return null;
  const m = Math.floor(left / 60), s = String(left % 60).padStart(2, "0");
  return (
    <div className="animate-rise glass fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-40 mx-auto flex w-[min(320px,calc(100%-48px))] items-center gap-3 overflow-hidden rounded-2xl px-3 py-2">
      <span aria-hidden className="absolute inset-y-0 start-0 bg-volt/15 transition-[width] duration-300" style={{ width: `${(left / Math.max(1, total)) * 100}%` }} />
      <span className="relative text-xs font-bold text-muted-foreground">استراحت</span>
      <span className="num relative flex-1 text-center text-3xl text-volt">{m}:{s}</span>
      <button onClick={() => addRest(15)} className="pressable relative grid size-9 place-items-center rounded-lg bg-foreground/10" aria-label="۱۵ ثانیه بیشتر"><Plus className="size-4" /></button>
      <button onClick={stopRest} className="pressable relative grid size-9 place-items-center rounded-lg bg-foreground/10" aria-label="توقف"><Pause className="size-4" /></button>
    </div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="text-center">
        <Logo className="mx-auto h-32 animate-float drop-shadow-[0_0_30px_color-mix(in_oklab,var(--volt)_40%,transparent)]" />
        <div className="num mt-4 text-5xl tracking-[.04em] text-gold-metal">SAEEDI</div>
        <div className="num mt-1 text-xs tracking-[.55em] text-volt">FIT BODY</div>
        <div className="mx-auto mt-4 h-1 w-32 overflow-hidden rounded-full bg-foreground/10"><div className="h-full w-1/3 animate-[marquee_1.2s_ease-in-out_infinite] bg-volt" /></div>
        <p className="mt-3 text-xs text-muted-foreground">در حال آماده‌سازی برنامه‌ات…</p>
      </div>
    </div>
  );
}

function ErrorView({ retry, message }: { retry: () => void; message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo className="mx-auto h-24 opacity-60" />
        <p className="mt-4 font-bold">اطلاعات بارگذاری نشد</p>
        <p className="mt-1 text-sm text-muted-foreground">{message || "اتصال اینترنت را بررسی کن."}</p>
        <FitButton size="md" className="mt-5" onClick={retry}><RefreshCw className="size-4" />تلاش دوباره</FitButton>
      </div>
    </div>
  );
}

