import { classicUrl } from "@/lib/fit/api";
import {Themes} from './Themes';
import { ArrowLeft, Bot, Crown, LayoutDashboard, LogOut, FileText, Pill, MessageCircle, Ruler, Sparkles, Target, User } from "lucide-react";
import { useFit } from "./store";
import { Card, Section } from "./primitives";
import { fmt, jalaliShort } from "@/lib/fit/format";
import { cn } from "@/lib/utils";

const GOALS: Record<string, string> = { lose: "کاهش وزن", gain: "افزایش حجم", maintain: "تثبیت وزن", cut: "کات", bulk: "حجم" };

export function MoreScreen({ openChat, go }: { openChat: () => void; go: (t: "membership" | "coach" | "reminders" | "supplements" | "files") => void }) {
  const { boot, logout } = useFit();
  const p = boot.profile, g = boot.gate;
  const staff = ["admin", "coach"].includes(String(boot.user.role).toLowerCase());
  return (
    <div>
      <Card className="relative p-5">
        <div aria-hidden className="pointer-events-none absolute -top-10 -end-10 size-40 rounded-full bg-volt/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <div className="grid size-16 place-items-center overflow-hidden rounded-2xl border border-volt/40 bg-volt/10 text-2xl font-black text-volt">
            {p.avatarUrl ? <img src={p.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : (p.name || boot.user.username).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-xl">{p.name || boot.user.username}</b>
            <span className="num text-sm text-muted-foreground">@{boot.user.username}</span>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-4 gap-2 text-center">
          {[[p.height, "قد", "CM"], [p.weight, "وزن", "KG"], [p.age, "سن", ""], [p.tdee, "TDEE", ""]].map(([v, l, u]) => (
            <div key={String(l)} className="rounded-xl bg-foreground/[0.04] py-2.5">
              <div className="num text-xl">{fmt(Number(v))}<small className="text-[10px] text-faint">{u}</small></div>
              <div className="text-[11px] text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
        <div className="relative mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-foreground/5 px-2.5 py-1.5"><Target className="size-3.5 text-volt" />{GOALS[p.goal] || p.goal || "—"}</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-foreground/5 px-2.5 py-1.5"><Ruler className="size-3.5 text-volt" />BMI <span className="num text-sm">{fmt(p.bmi, 1)}</span></span>
        </div>
      </Card>

      {g ? (
        <>
          <Section en="MEMBERSHIP" title="اشتراک" />
          <Card className="lux-edge overflow-hidden p-0">
            <div className="flex items-center gap-3 p-4" style={{ background: "linear-gradient(120deg, color-mix(in oklab, var(--gold) 16%, transparent), transparent 70%)" }}>
              <Crown className="size-7 text-gold" />
              <div className="flex-1"><b className="text-lg text-gold-metal">{g.tierName || "اشتراک"}</b><p className="text-xs text-muted-foreground">{g.active && g.endDate ? `تا ${jalaliShort(g.endDate)}` : "برای شروع یک پکیج انتخاب کن"}</p></div>
              <div className="text-end"><span className="num text-4xl">{g.daysLeft}</span><div className="text-[11px] text-muted-foreground">روز</div></div>
            </div>
            <button type="button" onClick={() => go("membership")} className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-sm font-bold text-volt">{g.active ? "تمدید یا ارتقای اشتراک" : "خرید اشتراک"}<ArrowLeft className="size-4" /></button>
          </Card>
        </>
      ) : null}

      <Section en="TOOLS" title="ابزارها" />
      <div className="grid grid-cols-2 gap-2.5">
        <Themes/>
        <Tool onClick={()=>go("supplements")} icon={<Pill className="size-5"/>} title="مکمل‌ها و ویتامین‌ها" sub="برنامه و زمان مصرف"/>
        <Tool onClick={()=>go("files")} icon={<FileText className="size-5"/>} title="دریافت برنامه‌ها" sub="دانلود PDF تمرین، تغذیه و مکمل"/>
        <Tool onClick={openChat} icon={<MessageCircle className="size-5" />} title="پیام به مربی" sub="سؤال، گزارش، هماهنگی" />
        <Tool onClick={() => go("coach")} icon={<Sparkles className="size-5" />} title="مربی هوشمند" sub="راهنمایی شخصی با هوش مصنوعی" accent />
        <Tool onClick={()=>go("reminders")} icon={<Bot className="size-5" />} title="یادآورها" sub="ربات تلگرام / بله" />
        {staff ? <Tool href={classicUrl("/classic?page=admin")} icon={<LayoutDashboard className="size-5" />} title="پنل مربی" sub="مدیریت شاگردها" accent /> : null}
      </div>

      <button onClick={() => void logout()} className="pressable mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3.5 text-sm font-bold text-destructive">
        <LogOut className="size-4" />خروج از حساب
      </button>
      <p className="num mt-6 text-center text-xs tracking-[.3em] text-faint">SAEEDI FIT BODY</p>
    </div>
  );
}

function Tool({ icon, title, sub, href, onClick, accent }: { icon: React.ReactNode; title: string; sub: string; href?: string; onClick?: () => void; accent?: boolean }) {
  const cls = cn("card-surface pressable animate-rise flex flex-col gap-3 p-4 text-start", accent && "border-volt/40");
  const inner = (<><span className={cn("grid size-10 place-items-center rounded-xl", accent ? "bg-volt text-volt-foreground" : "bg-volt/10 text-volt")}>{icon}</span><span><b className="block text-sm">{title}</b><span className="text-xs text-muted-foreground">{sub}</span></span></>);
  return href ? <a href={href} className={cls}>{inner}</a> : <button onClick={onClick} className={cls}>{inner}</button>;
}

