import {AvatarStudio} from './AvatarStudio';
import {isDemo,resetDemo} from '@/lib/fit/demo';
import {locale,changeLocale,tr} from '@/lib/fit/locale';
import {AssessmentScreen} from './AssessmentScreen';
import {ShoppingScreen} from './ShoppingScreen';
import {OfflinePlans} from './OfflinePlans';
import {ReceiptStudio} from './ReceiptStudio';
import {Avatar} from './Avatar';
import {PageMotion} from './PageMotion';
import {BrandLoading} from "./BrandLoading";
import {RemindersScreen} from "./RemindersScreen";
import {SupplementsScreen} from "./SupplementsScreen";
import {PlanFiles} from "./PlanFiles";
import {ReminderRuntime} from "./ReminderRuntime";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Apple, ArrowRight, Dumbbell, Flame, Home, LayoutGrid, Pill, Pause, Plus, RefreshCw } from "lucide-react";
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

type Tab = "avatar" | "home" | "train" | "fuel" | "progress" | "more" | "membership" | "coach" | "reminders" | "supplements" | "files" | "receipt" | "offline" | "assessment" | "shopping";
export type Go = (t: Tab) => void;
const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: tr("خانه"), icon: Home },
  { id: "train", label: tr("تمرین"), icon: Dumbbell },
  { id: "fuel", label: tr("تغذیه"), icon: Apple },
  { id: "supplements", label: tr("مکمل‌ها"), icon: Pill },
  { id: "more", label: tr("بیشتر"), icon: LayoutGrid },
];
const TITLES: Record<Tab, string> = { home: tr("خانه"), train: tr("تمرین"), fuel: tr("تغذیه"), progress: tr("پیشرفت"), more: tr("پروفایل"), membership: tr("اشتراک"), coach: tr("مربی هوشمند"), reminders:tr("یادآورها"), supplements:tr("مکمل‌ها"), files:tr("برنامه‌های PDF"), receipt:tr("استودیو استوری"), offline:tr("برنامه‌های آفلاین"), assessment:tr("ارزیابی و سلامت"), shopping:tr("لیست خرید"), avatar:tr("آواتار ورزشی","Fitness avatar") };
const KICKER: Record<Tab, string> = { home: "", train: "TRAINING", fuel: "NUTRITION", progress: "PROGRESS", more: "PROFILE", membership: "MEMBERSHIP", coach: "AI COACH", reminders:"REMINDERS", supplements:"SUPPLEMENTS", files:"MY PROGRAMS", receipt:"STORY STUDIO", offline:"OFFLINE PLANS", assessment:"YOUR PROFILE", shopping:"SHOPPING LIST",avatar:"FITNESS AVATAR" };
const SUB: Tab[] = ["progress", "membership", "coach", "reminders", "files", "receipt", "offline", "assessment", "shopping", "avatar"];

export function FitApp() {
  const { token, signIn, signOut } = useSession();
  const [publicView,setPublicView]=useState(()=>{try{return !isDemo()&&['landing','login'].includes(new URLSearchParams(window.location.search).get('view')||'');}catch{return false;}});
  const leavePublic=()=>{const u=new URL(location.href);u.searchParams.delete('view');history.replaceState(null,'',u.href);setPublicView(false);};
  if (!token||publicView) return <LoginScreen onSignedIn={t=>{signIn(t);leavePublic();}} onResume={token&&new URLSearchParams(window.location.search).get('view')!=='login'?leavePublic:undefined}/>;
  return (
    <BootProvider token={token} onSignedOut={signOut} fallback={<BrandLoading />} errorView={(retry, msg) => <ErrorView retry={retry} message={msg} />}>
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
  if (tab === "avatar") screen=<AvatarStudio/>;
  else if (tab === "home") screen = <HomeScreen go={setTab} openChat={() => setChat(true)} />;
  else if (tab === "membership") screen = <MembershipScreen />;
  else if (tab === "coach") screen = <CoachAiScreen openMembership={() => setTab("membership")} />;
  else if (tab === "reminders") screen = <RemindersScreen go={setTab}/>;
  else if (tab === "supplements") screen = <SupplementsScreen go={setTab}/>;
  else if (tab === "files") screen = <PlanFiles/>;
  else if (tab === "receipt") screen = <ReceiptStudio/>;
  else if (tab === "offline") screen = <OfflineEntry/>;
  else if (tab === "assessment") screen = <AssessmentScreen/>;
  else if (tab === "shopping") screen = <ShoppingScreen/>;
  else if (tab === "train") screen = <TrainScreen />;
  else if (tab === "fuel") screen = <FuelScreen />;
  else if (tab === "progress") screen = <ProgressScreen />;
  else screen = <MoreScreen go={setTab} openChat={() => setChat(true)} />;
  if(isDemo()&&['membership','coach','reminders','files','offline','assessment','shopping'].includes(tab))screen=<div className="card-surface p-5"><span className="kicker text-volt">PERSONAL ACCOUNT</span><h2 className="mt-3 text-xl font-bold">{tr('این بخش برای حساب شخصی است.','This feature needs a personal account.')}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{tr('دمو به پرداخت، اطلاعات سلامت، دانلود خصوصی و اعلان واقعی دسترسی ندارد. تمرین، تغذیه، پیشرفت و استوری را با دادهٔ نمونه امتحان کنید.','The demo has no access to payments, health records, private downloads or real notifications. Explore training, nutrition, progress and stories with sample data.')}</p><a className="mt-5 block text-sm text-volt" href={'/?lang='+locale()} target="_top">{tr('بازگشت به سایت','Back to the website')}</a></div>;

  return (
    <div className={cn("sf-athlete-shell mx-auto min-h-dvh max-w-[460px] px-4", isSub ? "pb-[calc(24px+env(safe-area-inset-bottom))]" : "pb-[calc(120px+env(safe-area-inset-bottom))]")}>
      {isDemo()?<div className="v4-demo-banner"><b>DEMO</b><span>{tr('اطلاعات فرضی؛ ثبت‌ها فقط در این صفحه‌اند.','Sample data. Changes stay in this page.')}</span><button onClick={()=>{resetDemo();location.reload();}}>{tr('شروع مجدد','Reset')}</button><a href={'/?lang='+locale()} target="_top">{tr('خروج','Exit')}</a></div>:null}<header className="flex items-center gap-3 pt-[calc(18px+env(safe-area-inset-top))] pb-4">
        {isSub ? (
          <button type="button" onClick={() => setTab(back)} aria-label={tr("بازگشت")} className="glass pressable grid size-12 shrink-0 place-items-center rounded-2xl"><ArrowRight className="size-5" /></button>
        ) : (
          <button type="button" onClick={() => setTab("home")} aria-label={tr("خانه")} className="relative shrink-0">
            <span aria-hidden className="absolute inset-0 rounded-full bg-volt/20 blur-xl" />
            <Logo className="relative h-[68px] w-[64px]" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            {KICKER[tab] ? <span className="kicker text-volt">{KICKER[tab]}</span> : <span className="num text-sm tracking-wider text-faint">{latinStamp(now).toUpperCase()}</span>}
            <span className="size-1 rounded-full bg-gold" /><span>{locale()==='en'?now.toLocaleDateString('en-GB',{month:'short',day:'numeric'}):jalaliLong(now)}</span>
          </p>
          <h1 key={tab} className="animate-rise text-[22px] font-black leading-tight tracking-tight">
            {tab === "home" ? <>{locale()==='en'?"Your next starts here":greeting(now)}{locale()==='en'?', ':'، '}<span className="text-volt-metal">{name}</span></> : tr(TITLES[tab])}
          </h1>
        </div>
        <button className="v4-app-language" aria-label={locale()==='en'?'Switch to Persian':'Switch to English'} onClick={()=>changeLocale(locale()==='en'?'fa':tr("en"))}>{locale()==='en'?'FA':'EN'}</button>{tab === "home" ? <button type="button" onClick={()=>setTab("more")} className="sfx-profile-entry" aria-label={tr("مشاهدهٔ پروفایل شخصی")}><Avatar design={boot.profile.avatarDesign} url={boot.profile.avatarUrl} name={name}/><small>{tr("پروفایل شما")}</small></button> : <span className="glass inline-flex h-12 items-center gap-1.5 rounded-2xl px-3" title={tr("روزهای پیاپی")}>
          <Flame className="size-5 text-ember" /><span className="num text-2xl">{boot.streak}</span>
        </span>}
      </header>
      <PageMotion key={tab} page={tab}>{screen}</PageMotion>
      <RestPill /><ReminderRuntime/>
      {isSub ? null : <Dock tab={tab} setTab={setTab} />}
      <ChatSheet open={chat} onOpenChange={setChat} />
    </div>
  );
}

function Dock({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const i = TABS.findIndex((t) => t.id === tab);
  return (
    <nav aria-label={tr("منوی اصلی")} className="glass fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-40 mx-auto grid w-[min(420px,calc(100%-24px))] grid-cols-5 rounded-[22px] p-1.5">
      <span aria-hidden className="absolute inset-y-1.5 start-1.5 w-[calc((100%-12px)/5)] rounded-2xl shadow-[var(--glow-volt)] [background:var(--gradient-volt)] transition-transform duration-500 ease-[var(--ease-spring)]"
        style={{ transform: `translateX(${(locale()==='en'?1:-1)*i*100}%)` }} />
      {TABS.map((t) => {
        const on = t.id === tab, I = t.icon;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} aria-current={on ? "page" : undefined}
            className={cn("relative z-10 flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors", on ? "text-volt-foreground" : "text-muted-foreground")}>
            <I className={cn("size-[22px] transition-transform duration-500 ease-[var(--ease-spring)]", on && "-translate-y-0.5 scale-110")} strokeWidth={on ? 2.5 : 2} />
            {tr(t.label)}
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
      <span className="relative text-xs font-bold text-muted-foreground">{tr("استراحت")}</span>
      <span className="num relative flex-1 text-center text-3xl text-volt">{m}:{s}</span>
      <button onClick={() => addRest(15)} className="pressable relative grid size-9 place-items-center rounded-lg bg-foreground/10" aria-label="۱۵ ثانیه بیشتر"><Plus className="size-4" /></button>
      <button onClick={stopRest} className="pressable relative grid size-9 place-items-center rounded-lg bg-foreground/10" aria-label="توقف"><Pause className="size-4" /></button>
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
        <FitButton size="md" className="mt-5" onClick={retry}><RefreshCw className="size-4" />{tr("تلاش دوباره")}</FitButton>
      </div>
    </div>
  );
}


function OfflineEntry(){const {boot}=useFit();return <OfflinePlans boot={boot}/>;}
