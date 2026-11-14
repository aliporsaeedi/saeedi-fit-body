import {tr} from '@/lib/fit/locale';
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Drawer as V } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const fitButton = cva(
  "group/btn relative inline-flex select-none items-center justify-center gap-2 overflow-hidden font-black transition-[transform,box-shadow,filter,opacity] duration-500 ease-[var(--ease-spring)] active:scale-[.965] disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        volt: "text-volt-foreground shadow-[var(--glow-volt)] [background:var(--gradient-volt)] [clip-path:polygon(5%_0,100%_0,95%_100%,0_100%)] hover:brightness-110 hover:shadow-[0_0_38px_color-mix(in_oklab,var(--volt)_60%,transparent)]",
        gold: "text-ink shadow-[var(--glow-gold)] [background:var(--gradient-gold)] [background-size:200%_100%] hover:[background-position:100%_0] [clip-path:polygon(5%_0,100%_0,95%_100%,0_100%)]",
        glass: "glass text-foreground rounded-xl",
        ghost: "text-muted-foreground hover:text-foreground rounded-xl",
        outline: "rounded-xl border border-line bg-steel-2/60 text-foreground hover:border-volt/60",
        danger: "rounded-xl bg-destructive/15 text-destructive",
      },
      size: { lg: "h-14 px-6 text-base", md: "h-11 px-4 text-sm", sm: "h-9 px-3 text-xs", icon: "size-11" },
    },
    defaultVariants: { variant: "volt", size: "lg" },
  },
);

type Ripple = { id: number; x: number; y: number; s: number };
type FitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof fitButton> & { loading?: boolean; success?: boolean };

/** Athletic button: touch ripple, shine sweep, striped loading state and a check-mark finish. */
export const FitButton = forwardRef<HTMLButtonElement, FitButtonProps>(
  ({ className, variant, size, children, loading, success, onPointerDown, ...p }, ref) => {
    const [ripples, setRipples] = useState<Ripple[]>([]);
    const solid = variant === "volt" || variant === "gold" || variant == null;
    const down = (e: React.PointerEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const s = Math.hypot(r.width, r.height) * 2;
      const id = performance.now();
      setRipples((old) => [...old.slice(-3), { id, x: e.clientX - r.left, y: e.clientY - r.top, s }]);
      window.setTimeout(() => setRipples((old) => old.filter((x) => x.id !== id)), 750);
      onPointerDown?.(e);
    };
    return (
      <button ref={ref} aria-busy={loading || undefined} className={cn("sf-liquid-button",fitButton({ variant, size }), loading && "cursor-wait", className)} onPointerDown={down} {...p}>
        {solid ? <span aria-hidden className="animate-shine pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/35 to-transparent" /> : null}
        {loading ? <span aria-hidden className="animate-stripes pointer-events-none absolute inset-0" /> : null}
        {ripples.map((r) => (
          <span key={r.id} aria-hidden className={cn("animate-ripple pointer-events-none absolute rounded-full", solid ? "bg-ink/25" : "bg-volt/25")}
            style={{ left: r.x, top: r.y, width: r.s, height: r.s }} />
        ))}
        <span className={cn("relative z-10 inline-flex items-center gap-2 transition-[transform,opacity] duration-300", (success) && "scale-75 opacity-0")}>
          {loading ? <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" /> : null}
          {children}
        </span>
        {success ? (
          <svg aria-hidden viewBox="0 0 24 24" className="absolute z-10 size-7"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" className="animate-check" /></svg>
        ) : null}
      </button>
    );
  },
);
FitButton.displayName = "FitButton";

export function Section({ title, aside, className, en }: { title: ReactNode; aside?: ReactNode; className?: string; en?: string }) {
  return (
    <div className={cn("slash-title mt-8 mb-3 text-[17px]", className)}>
      <span className="flex flex-col">{en ? <span className="kicker -mb-0.5 self-start">{en}</span> : null}<span>{title}</span></span>
      {aside ? <span className="ms-auto text-xs font-medium text-faint">{aside}</span> : null}
    </div>
  );
}

export function Card({ className, children, style }: { className?: string; children: ReactNode; style?: React.CSSProperties }) {
  return <div className={cn("card-surface animate-rise relative overflow-hidden", className)} style={style}>{children}</div>;
}

/** Replays a bounded count when a metric re-enters the viewport; never changes its underlying value. */
export function CountUp({ value, digits = 0, className }: { value: number; digits?: number; className?: string }) {
  const actual=Number.isFinite(Number(value))?Number(value):0;
  const [v,setV]=useState(actual),host=useRef<HTMLSpanElement>(null);
  const format=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:digits,minimumFractionDigits:digits});
  useEffect(()=>{const node=host.current;if(!node)return;let raf=0,inside=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)');const stop=()=>{cancelAnimationFrame(raf);setV(actual);};const play=()=>{cancelAnimationFrame(raf);if(reduced.matches||document.visibilityState==='hidden'){setV(actual);return;}const start=performance.now(),from=actual*.72;const step=(t:number)=>{const k=Math.min(1,(t-start)/650);setV(from+(actual-from)*(1-Math.pow(1-k,3)));if(k<1)raf=requestAnimationFrame(step);};raf=requestAnimationFrame(step);};const visibility=()=>{if(document.visibilityState==='hidden')stop();else if(inside)play();};const preference=()=>{if(reduced.matches)stop();};let observer:IntersectionObserver|undefined;if(typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(entries=>{inside=!!entries[0]?.isIntersecting;if(inside)play();else stop();},{threshold:.3});observer.observe(node);}else setV(actual);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);return()=>{cancelAnimationFrame(raf);observer?.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);};},[actual]);
  return <span ref={host} aria-label={format(actual)} className={cn('num',className)}><span aria-hidden="true">{format(v)}</span></span>;
}

/** Segmented tick ring like a race-watch bezel. */
export function TickRing({ size = 124, ticks = 40, value, tone = "volt", children }: { size?: number; ticks?: number; value: number; tone?: "volt" | "ember" | "aqua"; children?: ReactNode }) {
  const lit = Math.round(Math.max(0, Math.min(1, value)) * ticks);
  const r = size / 2, inner = r - 14, outer = r - 3;
  const col = tone === "ember" ? "var(--ember)" : tone === "aqua" ? "var(--aqua)" : "var(--volt)";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
        {Array.from({ length: ticks }, (_, i) => {
          const a = (i / ticks) * Math.PI * 2;
          const on = i < lit;
          return (
            <line key={i} x1={r + inner * Math.cos(a)} y1={r + inner * Math.sin(a)} x2={r + outer * Math.cos(a)} y2={r + outer * Math.sin(a)}
              strokeWidth={2.6} strokeLinecap="round"
              style={{ stroke: on ? col : "color-mix(in oklab, var(--foreground) 14%, transparent)", filter: on ? `drop-shadow(0 0 3px ${col})` : undefined, transition: `stroke .3s ${i * 22}ms` }} />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ value, tone = "volt" }: { value: number; tone?: "volt" | "ember" | "aqua" }) {
  const w = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  const bg = tone === "ember" ? "bg-ember" : tone === "aqua" ? "bg-aqua" : "bg-volt";
  return (
    <div className="h-1.5 -skew-x-[20deg] overflow-hidden bg-foreground/10">
      <div className={cn("h-full transition-[width] duration-[1300ms] ease-[var(--ease-out-expo)]", bg)} style={{ width: w }} />
    </div>
  );
}

export function Sheet({ open, onOpenChange, title, children, footer }: { open: boolean; onOpenChange: (o: boolean) => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <V.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <V.Portal>
        <V.Overlay className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm" />
        <V.Content dir="rtl" className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[460px] flex-col rounded-t-[28px] border border-b-0 border-line bg-popover outline-none">
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-foreground/20" />
          <div className="flex items-center gap-3 px-5 pt-4 pb-2">
            <V.Title className="flex-1 text-lg font-black">{title}</V.Title>
            <V.Close className="pressable grid size-9 place-items-center rounded-full bg-foreground/5 text-muted-foreground" aria-label={tr("بستن")}><X className="size-4" /></V.Close>
          </div>
          <V.Description className="sr-only">جزئیات</V.Description>
          <div className="hide-scrollbar flex-1 overflow-y-auto px-5 pb-6">{children}</div>
          {footer ? <div className="border-t border-line px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">{footer}</div> : null}
        </V.Content>
      </V.Portal>
    </V.Root>
  );
}

export function Field({ label, suffix, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; suffix?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</span>
      <span className="flex h-12 items-center gap-2 rounded-xl border border-line bg-ink/60 px-3 focus-within:border-volt/70 focus-within:shadow-[var(--glow-volt)]">
        <input {...p} className={cn("num h-full w-full min-w-0 bg-transparent text-xl font-bold text-foreground outline-none placeholder:text-faint/60", p.className)} />
        {suffix ? <span className="num text-sm text-faint">{suffix}</span> : null}
      </span>
    </label>
  );
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="card-surface grid place-items-center gap-2 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-volt/10 text-volt">{icon}</div>
      <b className="text-base">{title}</b>
      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

