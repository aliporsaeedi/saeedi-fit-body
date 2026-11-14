import {tr} from '@/lib/fit/locale';
import {useState} from 'react';
import { classicUrl } from "@/lib/fit/api";
import {Avatar} from './Avatar';
import {Themes} from './Themes';
import { ArrowLeft, Camera, Bot, Crown, LayoutDashboard, LogOut, FileText, Pill, MessageCircle, Ruler, Sparkles, Target, User } from "lucide-react";
import { useFit } from "./store";
import { Card, Section } from "./primitives";
import { fmt, jalaliShort } from "@/lib/fit/format";
import { cn } from "@/lib/utils";

const GOALS: Record<string, string> = { lose: tr("کاهش وزن"), gain: tr("افزایش حجم"), maintain: tr("تثبیت وزن"), cut: tr("کات"), bulk: tr("حجم") };

export function MoreScreen({ openChat, go }: { openChat: () => void; go: (t: "membership" | "coach" | "reminders" | "supplements" | "files" | "receipt" | "offline" | "assessment" | "shopping") => void }) {
  const { boot, logout } = useFit();
  const [group,setGroup]=useState('daily');
  const p = boot.profile, g = boot.gate;
  const staff = ["admin", "coach"].includes(String(boot.user.role).toLowerCase());
  return (
    <div>
      <Card className="relative p-5">
        <div aria-hidden className="pointer-events-none absolute -top-10 -end-10 size-40 rounded-full bg-volt/10 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <Avatar url={p.avatarUrl} name={p.name||boot.user.username} className="sf-profile-portrait"/>
          <div className="min-w-0 flex-1">
            <b className="block truncate text-xl">{p.name || boot.user.username}</b>
            <span className="num text-sm text-muted-foreground">@{boot.user.username}</span>
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-4 gap-2 text-center">
          {[[p.height, tr("قد"), "CM"], [p.weight, tr("وزن"), "KG"], [p.age, tr("سن"), ""], [p.tdee, "TDEE", ""]].map(([v, l, u]) => (
            <div key={String(l)} className="rounded-xl bg-foreground/[0.04] py-2.5">
              <div className="num text-xl">{fmt(Number(v))}<small className="text-[10px] text-faint">{u}</small></div>
              <div className="text-[11px] text-muted-foreground">{tr(String(l))}</div>
            </div>
          ))}
        </div>
        <div className="relative mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg bg-foreground/5 px-2.5 py-1.5"><Target className="size-3.5 text-volt" />{GOALS[p.goal] || p.goal || "—"}</span>
          <span className="inline-flex items-center gap-1 rounded-lg bg-foreground/5 px-2.5 py-1.5"><Ruler className="size-3.5 text-volt" />BMI <span className="num text-sm">{fmt(p.bmi, 1)}</span></span>
        </div>
      </Card>

      <div className="sf-more-groups" role="group" aria-label="گروه ابزارهای بیشتر">{[["daily",tr("روزمره")],["support",tr("پرونده و ارتباط")],["account",tr("حساب و اشتراک")]].map(([id,label])=><button type="button" key={id} aria-pressed={group===id} onClick={()=>setGroup(id)}>{tr(label)}</button>)}</div>
      {g&&group==='account' ? (
        <>
          <Section en="MEMBERSHIP" title={tr("اشتراک")} />
          <Card className="lux-edge overflow-hidden p-0">
            <div className="flex items-center gap-3 p-4" style={{ background: "linear-gradient(120deg, color-mix(in oklab, var(--gold) 16%, transparent), transparent 70%)" }}>
              <Crown className="size-7 text-gold" />
              <div className="flex-1"><b className="text-lg text-gold-metal">{g.tierName || tr("اشتراک")}</b><p className="text-xs text-muted-foreground">{g.active && g.endDate ? `تا ${jalaliShort(g.endDate)}` : "برای شروع یک پکیج انتخاب کن"}</p></div>
              <div className="text-end"><span className="num text-4xl">{g.daysLeft}</span><div className="text-[11px] text-muted-foreground">{tr("روز")}</div></div>
            </div>
            <button type="button" onClick={() => go("membership")} className="flex w-full items-center justify-between border-t border-line px-4 py-3 text-sm font-bold text-volt">{g.active ? "تمدید یا ارتقای اشتراک" : tr("خرید اشتراک")}<ArrowLeft className="size-4" /></button>
          </Card>
        </>
      ) : null}

      <div className="sf-more-tools mt-4 grid gap-2">
        {group==='daily'?<>
          <Tool onClick={()=>go("receipt")} icon={<Camera className="size-5"/>} title={tr("استودیو استوری و رسید")} sub={tr("عکس شخصی و خروجی FHD / QHD / 4K")} accent/>
          <Tool onClick={()=>go("supplements")} icon={<Pill className="size-5"/>} title={tr("مکمل‌ها و ویتامین‌ها")} sub={tr("برنامه و زمان مصرف")}/>
          <Tool onClick={()=>go("reminders")} icon={<Bot className="size-5"/>} title={tr("یادآورها")} sub={tr("زمان‌بندی شخصی و ربات")}/>
          <Tool onClick={()=>go("shopping")} icon={<FileText className="size-5"/>} title={tr("لیست خرید برنامه")} sub={tr("مواد اولیه و مقدار مورد نیاز")}/>
          <Tool onClick={()=>go("offline")} icon={<FileText className="size-5"/>} title={tr("برنامه‌های آفلاین")} sub={tr("دریافت نسخهٔ خواندنی روی دستگاه")}/>
        </>:group==='support'?<>
          <Tool onClick={()=>go("assessment")} icon={<User className="size-5"/>} title={tr("ارزیابی، آسیب و سابقهٔ سلامت")} sub={tr("هدف، شرایط و درخواست بررسی مربی")}/>
          <Tool onClick={openChat} icon={<MessageCircle className="size-5"/>} title={tr("پیام به مربی")} sub={tr("سؤال، گزارش و هماهنگی")}/>
          <Tool onClick={()=>go("coach")} icon={<Sparkles className="size-5"/>} title={tr("مربی هوشمند")} sub={tr("راهنمایی در کنار برنامهٔ مربی")} accent/>
          <Tool onClick={()=>go("files")} icon={<FileText className="size-5"/>} title={tr("دریافت برنامه‌ها")} sub={tr("دانلود PDF تمرین، تغذیه و مکمل")}/>
        </>:<>
          <Themes/>
          <Tool onClick={()=>go("membership")} icon={<Crown className="size-5"/>} title={tr("مدیریت اشتراک")} sub={tr("پکیج‌ها، پرداخت و اعتبار حساب")}/>
          {staff?<Tool href={classicUrl("/classic?page=admin")} icon={<LayoutDashboard className="size-5"/>} title={tr("پنل مربی")} sub="مدیریت شاگردها" accent/>:null}
        </>}
      </div>

      <button onClick={() => void logout()} className="pressable mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3.5 text-sm font-bold text-destructive">
        <LogOut className="size-4" />{tr("خروج از حساب")}
      </button>
      <p className="num mt-6 text-center text-xs tracking-[.3em] text-faint">SAEEDI FIT BODY</p>
    </div>
  );
}

function Tool({ icon, title, sub, href, onClick, accent }: { icon: React.ReactNode; title: string; sub: string; href?: string; onClick?: () => void; accent?: boolean }) {
  const cls = cn("card-surface pressable animate-rise flex items-center gap-3 p-3 text-start", accent && "border-volt/40");
  const inner = (<><span className={cn("grid size-10 place-items-center rounded-xl", accent ? "bg-volt text-volt-foreground" : "bg-volt/10 text-volt")}>{icon}</span><span><b className="block text-sm">{title}</b><span className="text-xs text-muted-foreground">{sub}</span></span></>);
  return href ? <a href={href} className={cls}>{inner}</a> : <button onClick={onClick} className={cls}>{inner}</button>;
}

