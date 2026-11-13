import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { gas } from "@/lib/fit/api";
import type { Message } from "@/lib/fit/types";
import { cn } from "@/lib/utils";
import { Sheet } from "./primitives";
import { useFit } from "./store";
import { toastError } from "./useActions";

export function ChatSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { token, boot } = useFit();
  const qc = useQueryClient();
  const key = ["fit-chat", token];
  const q = useQuery({ queryKey: key, queryFn: () => gas<Message[]>("getMessages", token, ""), enabled: open, refetchInterval: open ? 20_000 : false });
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [q.data, open]);
  const me = boot.user.username.toLowerCase();

  const send = async () => {
    const t = text.trim(); if (!t) return;
    setBusy(true);
    try { const r = await gas<{ messages: Message[] }>("sendMessage", token, "", t); qc.setQueryData(key, r.messages); setText(""); }
    catch (e) { toastError(e); } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="گفتگو با مربی"
      footer={
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="پیامت را بنویس…" className="h-12 flex-1 rounded-xl border border-line bg-ink/60 px-4 text-sm outline-none focus:border-volt/70" />
          <button disabled={busy || !text.trim()} className="pressable grid size-12 place-items-center rounded-xl bg-volt text-volt-foreground disabled:opacity-40" aria-label="ارسال"><SendHorizontal className="size-5 -scale-x-100" /></button>
        </form>
      }>
      <div className="min-h-[40dvh] space-y-2 py-2">
        {q.isPending ? <div className="h-20 animate-pulse rounded-xl bg-foreground/5" /> : null}
        {q.data?.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">هنوز پیامی رد و بدل نشده. سؤالت را از مربی بپرس.</p> : null}
        {q.data?.map((m, i) => {
          const mine = m.sender.toLowerCase() === me;
          return (
            <div key={i} className={cn("flex", mine ? "justify-start" : "justify-end")}>
              <div className={cn("max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-7", mine ? "rounded-ss-md bg-volt text-volt-foreground" : "rounded-se-md border border-line bg-steel-2")}>
                {m.text}
                <div className={cn("num mt-1 text-[10px]", mine ? "text-volt-foreground/60" : "text-faint")}>{String(m.createdAt).slice(11, 16)}</div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
    </Sheet>
  );
}

