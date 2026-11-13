import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { gas } from "@/lib/fit/api";
import { todayISO } from "@/lib/fit/format";
import type { BodyLog, Meal } from "@/lib/fit/types";
import { useFit } from "./store";

const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "خطا در ذخیره");

export function useWater() {
  const { boot, patch, token, refresh } = useFit();
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const glasses = boot.water?.glasses ?? 0, goal = boot.water?.goal || boot.profile.waterGoal || 8;
  const set = useCallback((next: number) => {
    const target = Math.max(0, next), delta = target - glasses;
    if (!delta) return;
    const t = todayISO();
    patch((b) => ({ ...b, water: { ...b.water, glasses: target }, activity: target > 0 ? { ...b.activity, [t]: { ...b.activity[t], h: 1 } } : b.activity }));
    queue.current = queue.current.then(() =>
      gas<{ water: { glasses: number; goal: number } }>("setWater", token, target, t)
        .then((r) => {patch((b) => ({ ...b, water: r.water }));if (r.water.glasses >= goal && glasses < goal) toast.success("هدف آب امروز کامل شد 💧");})
        .catch((e)=>{fail(e);void refresh();}));
  }, [glasses, goal, patch, token, refresh]);
  return { glasses, goal, set };
}

export function useDone() {
  const { boot, patch, token, refresh } = useFit();
  const toggle = useCallback(async (key: string, done: boolean) => {
    const t = todayISO();
    patch((b) => ({
      ...b,
      doneToday: done ? [...new Set([...b.doneToday, key])] : b.doneToday.filter((k) => k !== key),
      activity: done ? { ...b.activity, [t]: { ...b.activity[t], w: 1 } } : b.activity,
    }));
    try {await gas("setExerciseDone", token, key, done, t);return true;}catch(e){fail(e);await refresh();return false;}
  }, [patch, token, refresh]);
  return { done: boot.doneToday, toggle };
}

export function useMeals() {
  const { patch, token } = useFit();
  const apply = (r: { meals: { today: Meal[]; yesterday: Meal[] } }) =>
    patch((b) => ({ ...b, meals: { ...b.meals, today: r.meals.today, yesterday: r.meals.yesterday } }));
  const log = useCallback(async (m: { title: string; kcal: number; protein: number; carbs: number; fat: number }) => {
    try { apply(await gas("logMeal", token, m, todayISO())); toast.success("وعده ثبت شد"); return true; } catch (e) { fail(e); return false; }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const remove = useCallback(async (id: string) => {
    patch((b) => ({ ...b, meals: { ...b.meals, today: b.meals.today.filter((m) => m.id !== id) } }));
    try { apply(await gas("deleteMeal", token, id, todayISO())); } catch (e) { fail(e); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const copyYesterday = useCallback(async () => {
    try { apply(await gas("copyYesterdayMeals", token, todayISO())); toast.success("وعده‌های دیروز کپی شد"); } catch (e) { fail(e); }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  return { log, remove, copyYesterday };
}

export function useBodyLog() {
  const { patch, token } = useFit();
  const save = useCallback(async (input: { date: string; weight?: number; waist?: number; bodyFat?: number; notes?: string }) => {
    try {
      const r = await gas<{ logs: BodyLog[]; streak: number }>("saveLog", token, input);
      patch((b) => ({ ...b, logs: r.logs, streak: r.streak }));
      toast.success("ثبت شد");
      return true;
    } catch (e) { fail(e); return false; }
  }, [patch, token]);
  const remove = useCallback(async (date: string) => {
    patch((b) => ({ ...b, logs: b.logs.filter((l) => l.date !== date) }));
    try { const r = await gas<{ logs: BodyLog[] }>("deleteLog", token, date); patch((b) => ({ ...b, logs: r.logs })); } catch (e) { fail(e); }
  }, [patch, token]);
  return { save, remove };
}

export { fail as toastError };

