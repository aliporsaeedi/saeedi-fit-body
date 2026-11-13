import { useSyncExternalStore } from "react";

let endsAt = 0, total = 0;
const subs = new Set<() => void>();
let tick: ReturnType<typeof setInterval> | null = null;
const emit = () => subs.forEach((f) => f());

export function startRest(seconds: number) {
  total = seconds; endsAt = Date.now() + seconds * 1000; emit();
  if (!tick) tick = setInterval(() => {
    if (Date.now() >= endsAt) {
      stopRest();
      try { navigator.vibrate?.([180, 80, 180]); } catch { /* ignore */ }
    } else emit();
  }, 250);
}
export function stopRest() { endsAt = 0; if (tick) { clearInterval(tick); tick = null; } emit(); }
export function addRest(s: number) { if (endsAt) { endsAt += s * 1000; total += s; emit(); } }

let snap = { left: 0, total: 0 };
function read() {
  const left = endsAt ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)) : 0;
  if (left !== snap.left || total !== snap.total) snap = { left, total };
  return snap;
}
const server = { left: 0, total: 0 };
export function useRest() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, read, () => server);
}

