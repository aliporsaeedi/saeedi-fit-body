# Migration Dependencies: Saeedi Fit Body

## 1. Google Services Used

| Service | Usage | Migration replacement |
|---|---|---|
| `SpreadsheetApp` (Google Sheets) | Primary database (23 sheets) | Cloudflare D1 (SQLite) |
| `DriveApp` | Avatars, progress photos, receipt images, backups, AppJs.html serving | Cloudflare R2 |
| `CacheService` (script cache) | Sessions (`sess_<token>`), login lockout, media cache | KV / in-memory / JWT |
| `PropertiesService` | `SHEETS_READY`, `YT_KEY`, script config | D1 settings table or env vars |
| `ScriptApp` | Triggers (daily/weekly reminders, bot tick, backup) | Cloudflare Cron Triggers |
| `UrlFetchApp` | OpenFoodFacts barcode, YouTube, Telegram webhook | `fetch()` in Worker |
| `Session` / `Utilities` | Timezone, date formatting, SHA-256 hashing | JS `Date` + `crypto.subtle` |
| `HtmlService` | Serving Index/AdminApp, templating | Static HTML on Pages |
| `MailApp` (if used) | — | Resend / SendGrid |

## 2. Sheets (Database Tables)

From `CONFIG` + `setupApp()`:

| Sheet name | Header constant | Purpose |
|---|---|---|
| Users | (Users sheet, role/telegramChatId) | Accounts & roles |
| Dashboard | — | Admin dashboard cache |
| DailyLogs | DAILY_LOGS_SHEET | — |
| AppProfiles | PROFILE_HEADERS | User profile |
| ProfileHistory | PROFILE_HISTORY_HEADERS | Weight/BMI history |
| AppLogs | LOG_HEADERS | Daily body log |
| AppWaterLogs | WATER_HEADERS | Water intake |
| MealImages | MEAL_IMAGE_HEADERS | Meal image cache |
| MediaCache | MEDIA_CACHE_HEADERS | Media URL cache |
| Messages | MESSAGES_HEADERS | Chat |
| ProgressPhotos | PHOTOS_HEADERS | Progress photos |
| CoachNotes | COACH_NOTES_HEADERS | Coach notes |
| ExerciseLogs | EXERCISE_LOGS_HEADERS | Workout sets |
| MealLogs | MEAL_LOGS_HEADERS | Meal entries |
| ProgramBank | PROGRAM_BANK_HEADERS | Workout templates |
| FoodDatabase | FOOD_DB_HEADERS | Food calories |
| SF_Invites | SF_INVITES_HEADERS | Invite tokens |
| SF_Packages | SF_PACKAGES_HEADERS | Subscription packages |
| SF_Subs | SF_SUBS_HEADERS | Subscriptions |
| SF_Payments | SF_PAYMENTS_HEADERS | Payments + receipts |
| SF_Coupons | SF_COUPONS_HEADERS | Discount codes |
| SF_Audit | SF_AUDIT_HEADERS | Audit log |
| SF_PRs | SF_PRS_HEADERS | Personal records |
| SF_Risk | SF_RISK_HEADERS | Risk scoring |
| SF_Templates | SF_TEMPLATES_HEADERS | Message templates |
| SF_Settings | SF_SETTINGS_HEADERS | App settings |

## 3. Drive Folders Used

- `Fitness Coach Photos` — progress photos
- `Fitness Coach Backups` — spreadsheet backups
- `AppJs.html` — served as the client bundle (read by `sfGetAppJs`)
- Avatar uploads (folder name TBD — search `getFoldersByName`)

## 4. External APIs

- **OpenFoodFacts** (`world.openfoodfacts.org`) — barcode nutrition lookup (`getFoodByBarcode`)
- **YouTube** — video search (`YT_KEY` from script properties)
- **Telegram Bot API** — reminders, webhooks (`doPost`, `botTick`, `sendDailyReminders`, `sendWeeklyReport`)
- **Google (OAuth/Session)** — login, avatar

## 5. Server Functions (Code.js, ~224 exported)

Grouped by domain (full list in `Code.js`):

**Auth:** `login`, `logout`, `updateMyAccount`
**Admin (users):** `adminListUsers`, `adminCreateUser`, `adminSetRole`, `adminResetPassword`, `adminDeleteUser`
**Admin (plans):** `adminStudentPlans`, `adminRebuildPlans`, `adminMigrateLegacyPlans`, `adminExportAssignedPlans`, `adminRematchPlans`, `adminRepairProfiles`, `adminTidySheets`, `adminNormalizeSheets`, `adminDeleteSheets`, `adminRestoreArchivedSheets`, `adminSheetReport`
**Profile:** `saveProfile`, `uploadProfileAvatar`, `uploadProgressPhoto`
**Logging:** `saveLog`, `deleteLog`, `addWater`, `resetWater`, `logMeal`, `copyYesterdayMeals`, `deleteMeal`, `logExerciseSet`, `getExerciseHistory`, `setExerciseDone`
**Bootstrap:** `getBootstrap`, `adminStudentPlans`
**Content:** `getFoodByBarcode`, `getLeaderboard`, `getCoachNote`, `saveCoachNote`, `getMessages`, `sendMessage`, `getMedia`
**Plans:** `assignPlans` (via adminStudentPlans), `adminListPlans`/`adminGetPlan`/`adminSavePlan` (sf* variants)
**Subscriptions (SF_X):** `sfXConfig`, `sfXListPackages`, `sfXSavePackage`, `sfXSeedPackages`, `sfXInviteNew`, `sfXInvites`, `sfXRevokeInvite`, `sfXPayments`, `sfXApprovePayment`, `sfXRejectPayment`, `sfXMySub`, `sfXSubmitReceipt`, `sfXPublicPackages`
**Invites/Registration:** `sfInviteInfo`, `sfRegister`
**Payments:** `sfPayReceipt_` (internal), receipt upload
**Bot/Reminders:** `getBotLink`, `unlinkBot`, `saveReminders`, `getBotSettings`, `saveBotSettings`, `sendBotTest`, `installBotTrigger`, `botTick`
**Triggers:** `installDailyReminderTrigger`, `sendDailyReminders`, `installWeeklyReportTrigger`, `sendWeeklyReport`, `installWeeklyBackupTrigger`, `backupSpreadsheet`
**AI/Diet:** `sfAiAsk`, `sfAiStatus`, `sfAiSaveConfig`, `sfAiLogs`, `sfAutoDiet`, `sfDietModels`, `sfAdminGetDiet`, `sfAdminSaveDiet`, `sfAdminListDiets`, `sfAdminListSupps`, `sfAdminSaveSupp`, `sfAdminGetBody`, `sfAdminSetPlanActive`, `sfAdminDeleteFood`, `sfAdminSyncCatalog`, `sfAdminYoutubeFill`, `sfFoodBank`, `sfFoodGet`, `sfLogFood`, `sfLogSet`, `sfDayDetail`, `sfPrevPlanExercises`, `sfExerciseHistory`
**Coach:** `sfCoachBoard`, `sfCoachAlertsDismiss`, `sfProgressBoard`
**Export:** `sfExportPlanPdf`
**Gate/Feature flags:** `sfGateInfo`, `sfRequireFeature_`
**Webhook:** `doPost` (Telegram), `sfBotWebhookSet`, `sfBotWebhookDel`

## 6. Frontend API Calls (AppJs.html → server())

90 unique calls. Most frequent:
- `sfAdminMeta`, `sfAdminListPlans`, `sfAdminGetPlan`, `sfAdminListSupps`, `sfAdminListDiets` (admin)
- `sfFoodBank`, `sfLogFood`, `sfLogSet`, `sfDayDetail` (nutrition logging)
- `getBootstrap` (initial load)
- `login`, `logout`, `updateMyAccount`
- `saveProfile`, `saveLog`, `addWater`, `resetWater`, `logMeal`, `deleteMeal`, `copyYesterdayMeals`
- `getMessages`, `sendMessage`
- `getLeaderboard`, `getCoachNote`, `saveCoachNote`
- `uploadProfileAvatar`, `uploadProgressPhoto`
- `sfXConfig`, `sfXListPackages`, `sfXMySub`, `sfXPayments`, `sfXSubmitReceipt`
- `sfInviteInfo`, `sfRegister`
- `getBotLink`, `unlinkBot`, `saveReminders`, `getBotSettings`, `saveBotSettings`
- `getFoodByBarcode`, `sfExerciseHistory`, `sfPrevPlanExercises`
- `adminListUsers`, `adminCreateUser`, `adminSetRole`, `adminResetPassword`, `adminDeleteUser`
- `adminStudentPlans`, `adminRepairProfiles`, `adminRematchPlans`, `adminTidySheets`, `adminExportAssignedPlans`

## 7. Auth Flow (to replicate)

1. `login(username, password)` → validates against `Users` sheet (SHA-256 + salt), checks lockout via CacheService.
2. On success: `createSession_()` → token stored in `CacheService` (`sess_<token>`, TTL 6h) + returned to client.
3. Client stores token in `localStorage` as `fc_session`.
4. Every `server()` call sends token; backend validates via `CacheService.get('sess_' + token)`.
5. `logout(token)` → removes cache entry.

**Migration:** Replace with JWT (signed with `JWT_SECRET` env var) stored in `HttpOnly` cookie, or keep token-in-localStorage with a `/api/login` endpoint. Recommend JWT + cookie for security.

## 8. Migration Mapping (Google → Cloudflare)

| Google | Cloudflare | Notes |
|---|---|---|
| Sheets (23 tabs) | D1 (SQLite) | One DB, 23 tables. Write a one-time export (Apps Script → CSV → D1 import). |
| DriveApp (files) | R2 | Avatars, photos, receipts, backups. |
| CacheService (sessions) | KV or JWT | Prefer JWT (stateless). |
| PropertiesService | D1 `settings` table or env vars | `YT_KEY` → secret. |
| ScriptApp triggers | Cron Triggers | daily/weekly reminders, bot tick, backup. |
| UrlFetchApp | `fetch()` in Worker | OpenFoodFacts, YouTube, Telegram. |
| Utilities (SHA-256) | `crypto.subtle.digest` | Password hashing. |
| HtmlService | Static HTML (Pages) | Index.html, AdminApp.html. |
| `google.script.run` | `fetch('/api/...')` | 90 endpoints to create. |

## 9. Effort Estimate

- **Phase 1 (frontend to Pages):** 2–3 days
- **Phase 2 (backend to Worker + D1):** 2–3 weeks (90 endpoints + 23 tables + data migration + auth)
- **Phase 3 (PWA/offline):** 3–5 days
- **Total:** ~4 weeks

## 10. Recommended First Step

Create a Cloudflare Worker skeleton with:
1. `POST /api/login` + `POST /api/logout`
2. `GET /api/bootstrap` (replaces `getBootstrap`)
3. D1 schema for `Users`, `AppProfiles`, `AppLogs`, `MealLogs`, `ExerciseLogs`
4. Migrate one vertical slice (e.g., daily log) end-to-end, then replicate the pattern for the rest.
