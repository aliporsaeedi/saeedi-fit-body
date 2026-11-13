export type Exercise = {
  name: string; sets: string; reps: string; notes?: string;
  bank?: { sets?: string; reps?: string; rest?: number; gif?: string[]; frames?: string[][] };
};
export type WorkoutDay = { title: string; isRest: boolean; exercises: Exercise[] };
export type Workout = { name: string; days: WorkoutDay[]; notes?: string[] };
export type DietItem = { title: string; description: string; kcal: number | null; protein: number | null; carbs: number | null; fat: number | null };
export type Diet = { name: string; sections: { title: string; items: DietItem[] }[] };
export type Supplement = { name: string; schedule: { timing: string; items: string[] }[]; groups: { title: string; items: { name: string; timings: string[] }[] }[] };
export type Meal = { id: string; title: string; kcal: number; protein: number; carbs: number; fat: number };
export type BodyLog = { date: string; jalali: string; weight: number | null; waist: number | null; bodyFat: number | null; calories: number | null; notes: string };
export type Profile = {
  username: string; name: string; gender: string; age: number; height: number; weight: number; goalWeight: number;
  goal: string; bmr: number; tdee: number; targetCalories: number; targetProtein: number; targetCarbs: number; targetFat: number;
  waterGoal: number; avatarUrl: string; bmi: number;
};
export type Gate = { active: boolean; staff: boolean; tier: string; tierName: string; status: string; daysLeft: number; endDate: string; renewSoon: boolean };
export type Boot = {
  user: { username: string; role: string; email: string };
  profile: Profile;
  logs: BodyLog[];
  streak: number;
  photos: { date: string; label: string; url: string }[];
  workouts: Workout[];
  diets: Diet[];
  supplements: Supplement[];
  water: { glasses: number; goal: number };
  meals: { today: Meal[]; yesterday: Meal[]; days: Record<string, { kcal: number; protein: number; carbs: number; fat: number }> };
  activity: Record<string, { w?: number; h?: number }>;
  doneToday: string[];
  lastMessage?: { sender: string; at: string; text?: string };
  gate?: Gate;
};
export type Message = { sender: string; text: string; createdAt: string };

export type SubPlan = {
  id: string; name: string; tier: "gold" | "silver"; days: number; price: number; compareAt: number; perDay: number;
  features: string[]; badge: string; description: string;
};
export type SubState = {
  serverDate: string;
  me: { staff: boolean; status: string; active: boolean; tier: string; tierName: string; packageId: string; packageName: string; daysLeft: number; endDate: string };
  plans: SubPlan[];
  matrix: { key: string; label: string; silver: string; gold: string }[];
  card: { number: string; holder: string };
  support: { phone: string; whatsapp: string };
  marketing: { guarantee: string; slots: string };
  stats: { activeCount: number };
  renewRemindDays: number;
};
export type Payment = {
  payId: string; packageId: string; packageName: string; amount: number; discount: number; final: number;
  status: string; createdAt: string; reviewedAt: string; reason: string;
};
export type Food = {
  id: string; name: string; en: string; category: string; servingName: string; servingGrams: number;
  kcal100: number; protein100: number; carb100: number; fat100: number; image: string;
};
export type BarcodeFood = {
  code: string; name: string; brand: string; image: string;
  kcal100: number; protein100: number; carbs100: number; fat100: number; servingGrams: number; servingName: string;
};
export type AiTurn = { role: "me" | "ai"; text: string; at: string };
export type AiState = {
  enabled: boolean; locked: boolean; tierName: string; limit: number; remaining: number;
  monthCap: number; monthRemaining: number; goals: string; history: AiTurn[];
};

