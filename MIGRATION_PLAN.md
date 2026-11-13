# Migration Plan: Saeedi Fit Body (Apps Script → Cloudflare)

## 1. Current Architecture

- **Backend:** Google Apps Script (`Code.js`, ~3,800 lines). Functions exposed via `doGet`/`doPost` and called from the frontend through `google.script.run` (wrapped as `server()`).
- **Frontend:** `Index.html` + `AppJs.html` (~7,000 lines, vanilla JS). Bundled into a single script by `sfGetAppJs()`.
- **Database:** Google Sheets (one spreadsheet, many tabs). Headers defined in `Code.js` (`*_HEADERS`).
- **Auth:** Username/password stored in Sheets (hashed), session token in `CacheService` + `localStorage` (`fc_session`).
- **File storage:** Google Drive (avatars, progress photos, receipt images).
- **Messaging:** Telegram bot (webhook via `doPost`).
- **Admin:** Separate `AdminApp.html` (login + dashboard).

## 2. Data Model (Sheets → Tables)

| Sheet | Key columns | Notes |
|---|---|---|
| Profile | Username, … | User profile + avatar URL |
| ProfileHistory | Username, DateISO, WeightKg, BMI, TargetCalories | Weight history |
| Log | Username, DateISO, WeightKg, WaistCm, BodyFat, Calories, Notes | Daily body log |
| Water | Username, DateISO, Glasses, Goal | Water intake |
| MealLog | Username, DateISO, Title, Kcal, Protein, Carbs, Fat | Meal entries |
| ExerciseLogs | Username, DateISO, WorkoutName, ExerciseName, WeightKg, Reps | Workout sets |
| FoodDB | FoodName, KcalPer100g | Food calorie lookup |
| CoachNotes | Username, Note, UpdatedAt | Coach → athlete notes |
| Messages | Athlete, Sender, Text, CreatedAt | Chat |
| Photos | Username, DateISO, Label, DriveFileId, Url | Progress photos |
| ProgramBank | PlanName, Type, Template, Tags, CreatedAt | Workout plan templates |
| SF_Invites | Token, Coach, PackageID, ExpiresAt, UsedBy, Status | Invite tokens |
| SF_Packages | PackageID, Name, Days, Price, Features, Badge, Active, Sort | Subscription packages |
| SF_Subs | SubID, Username, PackageID, StartDate, EndDate, Status | Subscriptions |
| SF_Payments | PayID, Username, PackageID, Amount, Discount, Final, Method, Status, Authority, RefId, ReceiptFileId, … | Payments + receipts |
| SF_Coupons | Code, Type, Value, MaxUses, Used, ExpiresAt, PackageIds, Active | Discount codes |
| SF_Audit | Time, Actor, Entity, Id, Old, New, Reason | Audit log |
| SF_PRs | Username, ExerciseID, Type, Value, Date | Personal records |
| SF_Risk | Username, Score, Reasons, Date | Risk scoring |
| SF_Templates | Key, Title, Body, UpdatedAt | Message templates |
| SF_Settings | Key, Value | App settings |
| MealImage / MediaCache | Query/ImageURL, Key/Url | Image caches |

## 3. API Surface (Frontend → Backend)

- **90 unique `server()` calls** from `AppJs.html` (login, bootstrap, profile, logs, meals, water, exercises, chat, leaderboard, coach notes, media, admin CRUD, subscriptions, payments, invites, packages, coupons, bot settings, reminders, AI diet, …).
- All functions are in `Code.js` and follow the pattern `fn(token, ...args)`. Token is validated server-side via session cache.

## 4. Migration Phases

### Phase 1 — Frontend to Cloudflare Pages (2–3 days)
- Move `Index.html` + `AppJs.html` to a Cloudflare Pages project.
- Replace `google.script.run` calls with `fetch()` to a temporary Apps Script Web App endpoint (keep backend on Google for now).
- Benefit: faster static asset delivery, custom domain (`saeedifitbody.ir`) works without redirect.

### Phase 2 — Backend to Cloudflare Worker + D1 (2–3 weeks)
- Create a Cloudflare Worker with REST routes mirroring the 90 `server()` functions.
- Migrate Sheets → D1 (SQLite). Write a one-time export script (Apps Script → CSV → D1 import).
- Replace session auth with JWT (stored in `HttpOnly` cookie) or keep token-in-localStorage with a proper `/api/login`.
- Move file uploads (avatars, photos, receipts) to Cloudflare R2.
- Migrate Telegram webhook to a Worker route.

### Phase 3 — Offline / PWA (3–5 days)
- Add a Service Worker (cache-first for assets, network-first for API with IndexedDB fallback).
- Store daily logs, meals, water, and exercise sets in IndexedDB; sync when online.
- Add a manifest + icons for installability.

## 5. Effort Summary

| Phase | Effort | Risk |
|---|---|---|
| 1 | 2–3 days | Low |
| 2 | 2–3 weeks | Medium–High (largest chunk) |
| 3 | 3–5 days | Low |

**Total: ~4 weeks** of focused full-stack work.

## 6. Git / GitHub

The project is **not** currently in a git repository — it lives as an Apps Script project pulled via `clasp` into `tmp_pull/`. For the migration, I recommend:

1. Initialize a git repo in the project folder.
2. Push to a private GitHub repository.
3. Use branches per phase (`phase-1-frontend`, `phase-2-backend`, `phase-3-pwa`).
4. Keep `appsscript/` as the legacy reference until migration is complete.

I can set up the git repo + GitHub remote for you if you provide the repo URL (or I can create one via `gh` if available).

## 7. Recommended Next Step

Before writing any migration code, do a **dependency scan**: list every `google.script.run` / `server()` call, every Sheet read/write, and every Drive file operation. This is what makes Phase 2 predictable. I can generate that scan as a separate file (`MIGRATION_DEPENDENCIES.md`) on request.
