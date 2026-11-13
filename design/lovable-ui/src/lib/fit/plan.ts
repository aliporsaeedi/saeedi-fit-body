import type { Boot, Exercise, Workout } from "./types";
import { addDays, isISODate, todayISO } from "./format";

const PLAN_KEY = "sfb_plan", DAY_KEY = "sfb_day";
const read = (k: string) => { try { return localStorage.getItem('sfb:'+ (localStorage.getItem('sfb_plan_owner')||'')+':'+k) || ""; } catch { return ""; } };
const write = (k: string, v: string) => { try { localStorage.setItem('sfb:'+ (localStorage.getItem('sfb_plan_owner')||'')+':'+k, v); } catch { /* ignore */ } };

export function activeWorkoutIndex(b: Boot) {
  const n = Number(read(PLAN_KEY));
  return Number.isInteger(n) && n >= 0 && n < b.workouts.length ? n : 0;
}
export function setActiveWorkoutIndex(i: number) { write(PLAN_KEY, String(i)); }

export const doneKey = (w: Workout, dayIdx: number, exIdx: number) => `${w.name}_${dayIdx}_${exIdx}`;

/** Today's training day: the day already started today, else the one after the last finished, else the first. */
export function suggestedDay(b: Boot, w: Workout): number {
  const train = w.days.map((d, i) => ({ d, i })).filter((x) => !x.d.isRest && x.d.exercises.length);
  if (!train.length) return 0;
  for (const k of b.doneToday || []) {
    if (!k.startsWith(w.name + "_")) continue;
    const di = Number(k.slice(w.name.length + 1).split("_")[0]);
    if (Number.isInteger(di) && w.days[di]) return di;
  }
  const raw = read(`${DAY_KEY}:${w.name}`);
  const last = raw === "" ? -1 : Number(raw);
  if (Number.isInteger(last) && last >= 0) {
    const next = train.find((x) => x.i > last) || train[0];
    return next ? next.i : 0;
  }
  return train[0]?.i ?? 0;
}
export function rememberFinishedDay(w: Workout, dayIdx: number) { write(`${DAY_KEY}:${w.name}`, String(dayIdx)); }

export function exerciseImages(ex: Exercise): string[] {
  const gif = ex.bank?.gif?.[0];
  if (gif) return [gif];
  return (ex.bank?.frames || []).map((f) => f[0]).filter((x): x is string => !!x).slice(0, 2);
}
export function restSeconds(ex: Exercise) { return ex.bank?.rest != null && Number.isFinite(Number(ex.bank.rest)) ? Math.max(0, Number(ex.bank.rest)) : 90; }
export function setCount(ex: Exercise) { const n = parseInt(String(ex.sets), 10); return Number.isFinite(n) && n > 0 ? n : 3; }

/** Saturday-first week (Iranian calendar) containing today. */
export function weekDays(today = todayISO()) {
  const d = new Date(today + "T12:00:00");
  const offset = (d.getDay() + 1) % 7; // Sat=0
  const start = addDays(today, -offset);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function activityLevel(a: { w?: number; h?: number } | undefined) {
  if (!a) return 0;
  return (a.w ? 3 : 0) + (a.h ? 1 : 0);
}
export function validActivity(b: Boot) {
  const out: Record<string, { w?: number; h?: number }> = {};
  for (const [k, v] of Object.entries(b.activity || {})) if (isISODate(k)) out[k] = v;
  return out;
}

export function mealTotals(b: Boot) {
  return (b.meals?.today || []).reduce(
    (s, m) => ({ kcal: s.kcal + (Number(m.kcal) || 0), protein: s.protein + (Number(m.protein) || 0), carbs: s.carbs + (Number(m.carbs) || 0), fat: s.fat + (Number(m.fat) || 0) }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function weightSeries(b: Boot) {
  return [...(b.logs || [])].filter((l) => l.weight != null && isISODate(l.date)).sort((x, y) => x.date.localeCompare(y.date));
}

