/**
 * Fitness Coach - Google Apps Script backend (v5)
 * Updated by Agent - 2026-10-31
 *
 * v5 fixes — each one verified against your actual workbook data before

 * shipping (see the reasoning notes inline):
 *
 * 1) SUPPLEMENT/MEDICATION PARSER WAS DUMB. The "قرص و ویتامین" sheet has
 *    a timing-column grid (صبح/ظهر/قبل از تمرین/بعد از تمرین/قبل از خواب)
 *    for one section, then a completely different name+timings list for a
 *    second section ("مکمل غذایی"). The old code dumped every row into one
 *    flat table with no header, so morning and noon items visually blurred
 *    together. parseSupplementSheet_() now detects the timing-header row,
 *    groups items under their real time slot, and parses the second
 *    section (whey/creatine/etc.) as its own list with its own timings.
 *
 * 2) SOME WORKOUT SHEETS WERE INVISIBLE TO THE COACH. listPlanSheets_()
 *    only matched sheet names containing "تمرین"/"تمیرن"/"workout". Your
 *    workbook has "برنامه ماهان ماه 5 روزه" and "برنامه مهر 4 روزه" — real
 *    workout plans with day headers — that don't contain those words, so
 *    they never appeared in the coach's checkbox list and could never be
 *    assigned. This is the real answer to "how does one person see several
 *    workout plans": some plans literally weren't selectable. Fixed with
 *    classifySheetContent_(): any sheet not matched by name is now sniffed
 *    for a "روز ..."/"جلسه ..." day-header pattern (workout), meal-time
 *    words (diet), or vitamin/supplement words (supplement).
 *
 * 3) WATER COULD DRIFT A DAY. getWater_/addWater/resetWater computed
 *    "today" from Session.getScriptTimeZone() — the SPREADSHEET's
 *    timezone setting, not the athlete's device. If that setting doesn't
 *    match Iran time, "+1 glass" can silently land on the wrong day and
 *    look like it "doesn't work". These now take the athlete's own local
 *    date from the browser instead of guessing it server-side.
 *
 * 4) EXERCISE VIDEO LINK WAS HIDDEN UNTIL A NETWORK CALL SUCCEEDED. Even
 *    though a working YouTube-search fallback link was already built
 *    synchronously, the button had class="hidden" and only became visible
 *    after getMedia() returned — so if that background call was slow,
 *    blocked, or failed, the link just never appeared. It's now visible
 *    immediately with the fallback link and silently upgraded in place if
 *    getMedia() finds a better one.
 *
 * 5) WORKOUT DAYS WERE COLLAPSED BY DEFAULT. Only "today's" day was shown
 *    open; the rest needed a tap to expand, which read as "only day 1
 *    exists". Every day is now shown open, with a small pill marking the
 *    current one.
 *
 * New in v5:
 * - Real admin panel (separate from the coach panel): create/edit athletes,
 *   change roles, reset passwords, manage the MealImages override sheet —
 *   visible only to role "admin", not "coach".
 * - Rough calorie estimate on diet items, from a small built-in Persian
 *   food table (see FOOD_KCAL_PER_100G below). This is a coarse estimate
 *   from ~50 common items, not a nutrition database — I say so in the UI
 *   too, and it's easy to swap for a real API (Fatsecret/Edamam) later if
 *   you get a key.
 *
 * Everything from v4 is kept: multi-plan support, password hashing + auto
 * migration, login rate-limiting, streak, progress photos, weekly report,
 * weekly backup, chat, private coach notes, goal-weight chart, theme
 * toggle, print/PDF.
 */

const CONFIG = {
  SPREADSHEET_ID: '1LMQPydjxPR_bnY8aORu5KhDeIZHu5j7DjaYce4B3o5s',
  USERS_SHEET: 'Users',
  DASHBOARD_SHEET: 'Dashboard',
  DAILY_LOGS_SHEET: 'DailyLogs',
  PROFILES_SHEET: 'AppProfiles',
  PROFILE_HISTORY_SHEET: 'ProfileHistory',
  APP_LOGS_SHEET: 'AppLogs',
  WATER_LOGS_SHEET: 'AppWaterLogs',
  MEAL_IMAGES_SHEET: 'MealImages',
  MEDIA_CACHE_SHEET: 'MediaCache',
  MESSAGES_SHEET: 'Messages',
  PHOTOS_SHEET: 'ProgressPhotos',
  COACH_NOTES_SHEET: 'CoachNotes',
  EXERCISE_LOGS_SHEET: 'ExerciseLogs',
  MEAL_LOGS_SHEET: 'MealLogs',
  PROGRAM_BANK_SHEET: 'ProgramBank',
  FOOD_DB_SHEET: 'FoodDatabase',
  SESSION_TTL_SECONDS: 21600,
  LOGIN_LOCKOUT_SECONDS: 900,
  LOGIN_MAX_ATTEMPTS: 5,
  MISSED_LOG_ALERT_DAYS: 3,
  APP_NAME: 'Saeedi Fit Body',
};

const PROFILE_HEADERS = [
  'Username','Name','Gender','Age','HeightCm','WeightKg','GoalWeightKg','Activity','Goal',
  'BMR','TDEE','TargetCalories','TargetProtein','TargetCarbs','TargetFat',
  'WaterGoal','UpdatedAt','AvatarURL'
];
const PROFILE_HISTORY_HEADERS = ['Username','DateISO','WeightKg','BMI','TargetCalories','CreatedAt'];
const LOG_HEADERS = ['Username','DateISO','DateJalali','WeightKg','WaistCm','BodyFat','Calories','Notes','CreatedAt'];
const WATER_HEADERS = ['Username','DateISO','Glasses','Goal','UpdatedAt'];
const MEAL_IMAGE_HEADERS = ['Query','ImageURL'];
const MEDIA_CACHE_HEADERS = ['Key','Url','UpdatedAt'];
const MESSAGES_HEADERS = ['Athlete','Sender','Text','CreatedAt'];
const PHOTOS_HEADERS = ['Username','DateISO','Label','DriveFileId','Url','CreatedAt'];
const COACH_NOTES_HEADERS = ['Username','Note','UpdatedAt'];
const MEAL_LOG_HEADERS = ['Username','DateISO','Title','Kcal','Protein','CreatedAt','Carbs','Fat'];
const EXERCISE_LOGS_HEADERS = ['Username','DateISO','WorkoutName','ExerciseName','WeightKg','Reps','CreatedAt'];
const FOOD_DB_HEADERS = ['FoodName', 'KcalPer100g'];
const PROGRAM_BANK_HEADERS = ['PlanName', 'Type', 'Template', 'Tags', 'CreatedAt'];
const SF_INVITES_HEADERS = ['Token','Coach','PackageID','ExpiresAt','UsedBy','CreatedAt','Status'];
const SF_PACKAGES_HEADERS = ['PackageID','Name','Days','Price','Features','Badge','Active','Sort'];
const SF_SUBS_HEADERS = ['SubID','Username','PackageID','StartDate','EndDate','Status','Source','CreatedAt'];
const SF_PAYMENTS_HEADERS = ['PayID','Username','PackageID','Amount','Discount','Final','Method','Status','Authority','RefId','ReceiptFileId','ReceiptHash','ReviewedBy','ReviewedAt','RejectReason','CID','CreatedAt'];
const SF_COUPONS_HEADERS = ['Code','Type','Value','MaxUses','Used','ExpiresAt','PackageIds','Active'];
const SF_AUDIT_HEADERS = ['Time','Actor','Entity','Id','Old','New','Reason'];
const SF_PRS_HEADERS = ['Username','ExerciseID','Type','Value','Date'];
const SF_RISK_HEADERS = ['Username','Score','Reasons','Date'];
const SF_TEMPLATES_HEADERS = ['Key','Title','Body','UpdatedAt'];
const SF_SETTINGS_HEADERS = ['Key','Value'];



function getFoodKcal_(foodName) {
  if (!foodName) return 0;
  const normName = foodName.trim();
  
  // 1. Try FoodDatabase Sheet
  try {
    const sh = findSheet_(CONFIG.FOOD_DB_SHEET);
    if (sh) {
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] && data[i][0].toString().trim().toLowerCase() === normName.toLowerCase()) {
          return Number(data[i][1]) || 0;
        }
      }
    }
  } catch (e) { console.log('FoodDB error: ' + e); }

  // 2. Fallback to hardcoded table
  const fallback = FOOD_KCAL_PER_100G[normName];
  return fallback ? fallback : 0;
}

// A small, honest approximation table — NOT a nutrition database. Values
// are kcal per 100g for common Persian-diet ingredients. Swap in a real
// API (Fatsecret/Edamam) here if you get an API key later.
const FOOD_KCAL_PER_100G = {
  'برنج':130,'نان':265,'مرغ':165,'گوشت':250,'ماهی':140,'تخم مرغ':155,'ماست':60,'پنیر':300,
  'خیار':15,'گوجه':18,'سیب':52,'موز':89,'بادام':579,'گردو':654,'شیر':42,'عدس':116,'سالاد':20,
  'روغن زیتون':884,'خرما':282,'کره بادام زمینی':588,'جو دوسر':389,'کینوا':120,'سیب زمینی':77,
  'بلغور':342,'عسل':304,'توت فرنگی':32,'انار':83,'خربزه':34,'هندوانه':30,'کاهو':15,
  'فلفل دلمه':20,'پیاز':40,'سیر':149,'کدو':17,'بادمجان':25,'لوبیا':127,'نخود':164,
  'میگو':99,'بوقلمون':135,'کینوا':120,'دوغ':35,'کشک':160,'زیتون':115,'کنجد':573,
  'تن ماهی':132,'پروتئین وی':400,'شکلات تلخ':546,'آجیل':600,'نارنگی':53,'پرتقال':47
};

// ---------------------------------------------------------------------------
// Spreadsheet / sheet helpers
// ---------------------------------------------------------------------------

var __SS_OBJ = null;
function sfGetAppJs() {
  // Keep JavaScript inside an HTML raw-text script element while HtmlService reads it.
  // Returning bare JavaScript lets template markup be parsed as malformed HTML.
  const encoded = HtmlService.createHtmlOutputFromFile('AppBundle').getContent().replace(/\s/g, '');
  return Utilities.newBlob(Utilities.base64Decode(encoded)).getDataAsString('UTF-8');
}

/* همان HTML صفحهٔ Index که HtmlService می‌سازد؛ برای میزبانی بیرونی (Cloudflare)
   تا هر تغییری در اسکریپت، بدون بازسازی باندل، روی دامنهٔ دیگر هم دیده شود. */
function sfGetAppPage() { return HtmlService.createTemplateFromFile('LovableApp').evaluate().getContent(); }

function getSS_() {
  /* باز کردن مکرر شیت گران است؛ در هر اجرا یک‌بار باز می‌شود. */
  if (__SS_OBJ) { try { __SS_OBJ.getName(); return __SS_OBJ; } catch (e) { __SS_OBJ = null; } }
  try { const a = SpreadsheetApp.getActiveSpreadsheet(); if (a) { __SS_OBJ = a; return a; } } catch (e) {}
  __SS_OBJ = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  return __SS_OBJ;
}
function tz_() { return Session.getScriptTimeZone(); }
function todayISO_() { return Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd'); }

function findSheet_(name) {
  const ss = getSS_();
  const exact = ss.getSheetByName(name);
  if (exact) return exact;
  const wanted = normalize_(name);
  return ss.getSheets().find(s => s.getName().trim() === wanted) || null;
}


/**
 * AI Integration via Gemini API (Free Tier)
 * Requires GEMINI_API_KEY in ScriptProperties
 */


function doGet(e) {
  try { var q = (e && e.queryString) ? String(e.queryString) : ''; if (/(^|&)page=admin(&|$)/.test(q) && typeof admServePage_ === 'function') return admServePage_(); if (/(^|&)policy=1(&|$)/.test(q) && typeof sfPolicyPage_ === 'function') return sfPolicyPage_(); if (/(^|&)mini=1(&|$)/.test(q) && typeof sfMiniPage_ === 'function') return sfMiniPage_((e && e.parameter && e.parameter.k) || ''); } catch (err) {}
  // Worker integration: snap endpoint for bot read commands
  try { if (e && e.parameter && e.parameter.a === 'snap') {
    var chat = String(e.parameter.chat || '');
    var key = String(e.parameter.k || '');
    var props = PropertiesService.getScriptProperties();
    var gasKey = props.getProperty('GAS_API_KEY') || '';
    if (key && sfSafeEq_(key, gasKey) && chat) {
      var row = sfTgRowByChat_(chat);
      var snap = { ok: false };
      if (row) {
        try {
          var tok = sfTgSessionOf_(row);
          var boot = sfBootstrapV16();
          snap = { ok: true, username: row.username, role: row.role, chatId: chat, data: boot };
        } catch (eSnap) { snap = { ok: false, error: String(eSnap && eSnap.message) }; }
      }
      return ContentService.createTextOutput(JSON.stringify(snap)).setMimeType(ContentService.MimeType.JSON);
    }
  } } catch (eSnap2) {}

  // Worker integration: snap endpoint for bot read commands
  try { if (e && e.parameter && e.parameter.a === 'snap') {
    var chat = String(e.parameter.chat || '');
    var key = String(e.parameter.k || '');
    var props = PropertiesService.getScriptProperties();
    var gasKey = props.getProperty('GAS_API_KEY') || '';
    if (key && sfSafeEq_(key, gasKey) && chat) {
      var row = sfTgRowByChat_(chat);
      var snap = { ok: false };
      if (row) {
        try {
          var tok = sfTgSessionOf_(row);
          var boot = sfBootstrapV16();
          snap = { ok: true, username: row.username, role: row.role, chatId: chat, data: boot };
        } catch (eSnap) { snap = { ok: false, error: String(eSnap && eSnap.message) }; }
      }
      return ContentService.createTextOutput(JSON.stringify(snap)).setMimeType(ContentService.MimeType.JSON);
    }
  } } catch (eSnap2) {}

  // If anything blows up before the page even loads (bad spreadsheet ID,
  // missing sheet, no permission yet, etc.), show a readable error page
  // instead of a blank white screen.
  try {
    ensureAppSheets_();
    return HtmlService.createTemplateFromFile('LovableApp')
      .evaluate()
      .setTitle(CONFIG.APP_NAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (e) {
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;direction:rtl;padding:24px;max-width:500px;margin:auto">' +
      '<h2>مشکلی در راه‌اندازی پیش اومد</h2>' +
      '<p>پیام خطا:</p><pre style="white-space:pre-wrap;background:#f4f4f4;padding:12px;border-radius:8px">' +
      (e && e.message ? e.message : String(e)) + '</pre>' +
      '<p>این معمولاً یعنی مجوزهای جدید اسکریپت (Drive/Gmail) هنوز تایید نشدن. ' +
      'از ادیتور اسکریپت، یک تابع مثل setupApp رو یک‌بار مستقیم Run کنید تا صفحه‌ی مجوز باز بشه.</p>' +
      '</div>'
    ).setTitle(CONFIG.APP_NAME);
  }
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏋️ Saeedi Fit Body')
    .addItem('باز کردن پنل', 'showSidebar')
    .addItem('راه‌اندازی اولیه', 'setupApp')
    .addSeparator()
    .addItem('پاکسازی ردیف‌های تکراری آب', 'cleanWater')
    .addSeparator()
    .addItem('فعال‌سازی یادآور روزانه تلگرام', 'installDailyReminderTrigger')
    .addItem('فعال‌سازی ربات و یادآورهای هوشمند', 'installBotTrigger')
    .addItem('فعال‌سازی گزارش هفتگی مربی', 'installWeeklyReportTrigger')
    .addItem('فعال‌سازی پشتیبان‌گیری هفتگی', 'installWeeklyBackupTrigger')
    .addItem('پشتیبان‌گیری همین الان', 'backupSpreadsheet')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createTemplateFromFile('LovableApp').evaluate().setTitle(CONFIG.APP_NAME);
  SpreadsheetApp.getUi().showSidebar(html);
}




function setupApp() {
  const ss = getSS_();
  ensureSheetWithHeaders_(ss, CONFIG.PROFILES_SHEET, PROFILE_HEADERS);
  ensureProfileAvatarHeader_();
  ensureSheetWithHeaders_(ss, CONFIG.PROFILE_HISTORY_SHEET, PROFILE_HISTORY_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.APP_LOGS_SHEET, LOG_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.WATER_LOGS_SHEET, WATER_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.MEAL_IMAGES_SHEET, MEAL_IMAGE_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.MEDIA_CACHE_SHEET, MEDIA_CACHE_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.MESSAGES_SHEET, MESSAGES_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.PHOTOS_SHEET, PHOTOS_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.COACH_NOTES_SHEET, COACH_NOTES_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.EXERCISE_LOGS_SHEET, EXERCISE_LOGS_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.FOOD_DB_SHEET, FOOD_DB_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.PROGRAM_BANK_SHEET, PROGRAM_BANK_HEADERS);

  // --- added capabilities (subscription, payment, invite, audit, PR, risk, templates, settings) ---
  ensureSheetWithHeaders_(ss, 'SF_Invites', SF_INVITES_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Packages', SF_PACKAGES_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Subs', SF_SUBS_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Payments', SF_PAYMENTS_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Coupons', SF_COUPONS_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Audit', SF_AUDIT_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_PRs', SF_PRS_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Risk', SF_RISK_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Templates', SF_TEMPLATES_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Settings', SF_SETTINGS_HEADERS);
  ensureSheetWithHeaders_(ss, 'SF_Settings', SF_SETTINGS_HEADERS);

  const users = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (users) {
    if (users.getRange('F1').getValue() === '') users.getRange('F1').setValue('role');
    if (users.getRange('G1').getValue() === '') users.getRange('G1').setValue('telegramChatId');
  }
  PropertiesService.getScriptProperties().setProperty('SHEETS_READY', '1');
  return { ok: true, message: 'راه‌اندازی انجام شد.' };
}

// getBootstrap() used to call this on every single page load, and it used
// to reformat a large column on 5 sheets every time even when nothing was
// missing — that's real, measurable latency on every request for no reason.
// Now it only does real work once per deployment (cached via a script
// property), and even then only touches a sheet that's actually new/empty.
function ensureAppSheets_() {
  if (PropertiesService.getScriptProperties().getProperty('SHEETS_READY') === '1') { ensureProfileAvatarHeader_(); return; }
  const ss = getSS_();
  ensureSheetWithHeaders_(ss, CONFIG.PROFILES_SHEET, PROFILE_HEADERS);
  ensureProfileAvatarHeader_();
  ensureSheetWithHeaders_(ss, CONFIG.PROFILE_HISTORY_SHEET, PROFILE_HISTORY_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.APP_LOGS_SHEET, LOG_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.WATER_LOGS_SHEET, WATER_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.MEAL_IMAGES_SHEET, MEAL_IMAGE_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.MEDIA_CACHE_SHEET, MEDIA_CACHE_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.MESSAGES_SHEET, MESSAGES_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.PHOTOS_SHEET, PHOTOS_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.COACH_NOTES_SHEET, COACH_NOTES_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.EXERCISE_LOGS_SHEET, EXERCISE_LOGS_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.FOOD_DB_SHEET, FOOD_DB_HEADERS);
  ensureSheetWithHeaders_(ss, CONFIG.PROGRAM_BANK_SHEET, PROGRAM_BANK_HEADERS);
  PropertiesService.getScriptProperties().setProperty('SHEETS_READY', '1');
}

/* آدرس تصویر گوگل‌درایو را به شکلی تبدیل می‌کند که داخل <img> اپ نمایش داده شود
   (فرم uc?export=view در تگ img بارگذاری نمی‌شود). */
function fixImgUrl_(u) {
  const s = normalize_(u);
  if (!s) return '';
  const m = s.match(/[?&]id=([A-Za-z0-9_-]{20,})/) || s.match(/\/file\/d\/([A-Za-z0-9_-]{20,})/) || s.match(/googleusercontent\.com\/d\/([A-Za-z0-9_-]{20,})/);
  if (m && /drive\.google\.com|googleusercontent\.com/.test(s)) return 'https://lh3.googleusercontent.com/d/' + m[1];
  return s;
}

function ensureProfileAvatarHeader_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(CONFIG.PROFILES_SHEET);
  if (!sh) { ensureSheetWithHeaders_(ss, CONFIG.PROFILES_SHEET, PROFILE_HEADERS); sh = ss.getSheetByName(CONFIG.PROFILES_SHEET); }
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(normalize_);
  const aligned = PROFILE_HEADERS.every(function (h, i) { return headers[i] === h; });
  if (!aligned) {
    /* سرستون‌ها با ترتیب واقعیِ ذخیره‌سازی (PROFILE_HEADERS) هم‌تراز شوند */
    const width = Math.max(lastCol, PROFILE_HEADERS.length);
    const row = PROFILE_HEADERS.slice();
    while (row.length < width) row.push('');
    sh.getRange(1, 1, 1, width).setValues([row]);
  }
  sh.setFrozenRows(1);
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const current = sh.getRange(1, 1, 1, Math.max(headers.length, 1)).getValues()[0];
  const empty = current.every(v => v === '' || v == null);
  if (empty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    // Only needs to happen once, right when the sheet is first created —
    // the text format sticks, no need to reapply on every request.
    if ([CONFIG.APP_LOGS_SHEET, CONFIG.WATER_LOGS_SHEET, CONFIG.PROFILE_HISTORY_SHEET, CONFIG.PHOTOS_SHEET, CONFIG.EXERCISE_LOGS_SHEET].includes(name)) {
      sh.getRange('B2:B').setNumberFormat('@');
    }
  }
  sh.setFrozenRows(1);
}

// ---------------------------------------------------------------------------
// Generic value helpers
// ---------------------------------------------------------------------------

function normalize_(v) { return v == null ? '' : String(v).trim(); }
function dateKey_(v) { return v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : normalize_(v); }
function isValidDateStr_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(normalize_(s)); }

function toEnglishDigits_(s) {
  return String(s || '')
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}
function isNumberLike_(v) {
  if (typeof v === 'number') return true;
  const s = toEnglishDigits_(normalize_(v)).replace(/[,،]/g, '');
  return s !== '' && !isNaN(Number(s));
}
function safeNumber_(v, fallback) {
  const raw = toEnglishDigits_(String(v ?? '')).replace(/[,،]/g, '').trim();
  if (raw === '') return fallback;
  const n = Number(raw);
  return isFinite(n) ? n : fallback;
}
// Apps Script's RPC (google.script.run) cannot carry Date objects or
// non-finite numbers (Infinity/NaN): if the payload contains one, the whole
// response arrives on the client as null. Sanitise every outgoing payload.
function rpcSafe_(v, depth) {
  depth = depth || 0;
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  if (typeof v === 'string' || typeof v === 'boolean') return v;
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), 'yyyy-MM-dd');
  if (depth > 12) return null;
  if (Array.isArray(v)) return v.map(function (x) { return rpcSafe_(x, depth + 1); });
  if (typeof v === 'object') {
    const o = {};
    Object.keys(v).forEach(function (k) { o[k] = rpcSafe_(v[k], depth + 1); });
    return o;
  }
  return null;
}

function getRows_(sheetName) {
  const sh = findSheet_(sheetName);
  if (!sh) return [];
  return sh.getDataRange().getValues().map(row => row.map(v => v instanceof Date ? Utilities.formatDate(v, tz_(), 'yyyy-MM-dd') : v));
}
function splitPlans_(cellValue) { return normalize_(cellValue).split('|').map(s => s.trim()).filter(Boolean); }
function joinPlans_(arr) { return (arr || []).map(normalize_).filter(Boolean).join('|'); }

// ---------------------------------------------------------------------------
// Password hashing (SHA-256 + salt), auto-migrates legacy plaintext
// ---------------------------------------------------------------------------

function toHex_(bytes) { return bytes.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join(''); }
function hashPassword_(password, salt) { return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '::' + password)); }
function makeSaltedHash_(password) {
  const salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  return salt + '$' + hashPassword_(password, salt);
}
function passwordMatches_(candidatePassword, stored) {
  if (stored.indexOf('$') > -1) { const parts = String(stored).split('$'); const salt = parts[parts.length - 2]; const hash = parts[parts.length - 1]; if (hashPassword_(normalize_(candidatePassword), salt) === hash) return true; if (hashPassword_(candidatePassword, salt) === hash) return true; return false; }
  return stored === normalize_(candidatePassword);
}
function migratePasswordIfPlaintext_(row, storedPassword, candidatePassword) {
  if (String(storedPassword || '').indexOf('$') !== -1) return;
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  if (sh && row > 1) sh.getRange(row, 2).setValue(makeSaltedHash_(candidatePassword));
}

// ---------------------------------------------------------------------------
// Login rate limiting
// ---------------------------------------------------------------------------

function loginAttemptKey_(username) { return 'loginfail_' + normalize_(username).toLowerCase(); }
function isLockedOut_(username) { return CacheService.getScriptCache().get(loginAttemptKey_(username) + '_lock') !== null; }
function recordLoginFailure_(username) {
  const cache = CacheService.getScriptCache();
  const key = loginAttemptKey_(username);
  const count = Number(cache.get(key) || '0') + 1;
  cache.put(key, String(count), CONFIG.LOGIN_LOCKOUT_SECONDS);
  if (count >= CONFIG.LOGIN_MAX_ATTEMPTS) cache.put(key + '_lock', '1', CONFIG.LOGIN_LOCKOUT_SECONDS);
}
function clearLoginFailures_(username) {
  const cache = CacheService.getScriptCache();
  cache.remove(loginAttemptKey_(username));
  cache.remove(loginAttemptKey_(username) + '_lock');
}

// ---------------------------------------------------------------------------
// Users / sessions
// ---------------------------------------------------------------------------

function getUserRecord_(username) {
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  if (!sh) throw new Error('Sheet Users پیدا نشد.');
  const values = sh.getDataRange().getValues();
  const wanted = normalize_(username).toLowerCase();
  for (let r = 1; r < values.length; r++) {
    if (normalize_(values[r][0]).toLowerCase() === wanted) {
      return {
        row: r + 1, username: normalize_(values[r][0]), password: normalize_(values[r][1]),
        supplementPlan: normalize_(values[r][2]), workoutPlan: normalize_(values[r][3]), dietPlan: normalize_(values[r][4]),
        role: normalize_(values[r][5]).toLowerCase() || 'user', telegramChatId: normalize_(values[r][6]), email: normalize_(values[r][7]),
        coachUsername: normalize_(values[r][8])
      };
    }
  }
  return null;
}

function createSession_(username, role) {
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, JSON.stringify({ username, role }), CONFIG.SESSION_TTL_SECONDS);
  return token;
}
function requireSession_(token) {
  const raw = normalize_(token);
  if (!raw) throw new Error('جلسه ورود معتبر نیست. دوباره وارد شوید.');
  const data = CacheService.getScriptCache().get('sess_' + raw);
  if (!data) throw new Error('جلسه ورود منقضی شده است. دوباره وارد شوید.');
  return JSON.parse(data);
}
function requireAdmin_(tokenOrSession) { const s = (tokenOrSession && typeof tokenOrSession === 'object') ? tokenOrSession : requireSession_(tokenOrSession); if (!isAdmin_(s)) throw new Error('فقط ادمین به این بخش دسترسی دارد.'); return s; }

function login(username, password) {
  ensureAppSheets_();
  if (isLockedOut_(username)) throw new Error('به دلیل تلاش‌های ناموفق زیاد، تا ۱۵ دقیقه دیگر امکان ورود نیست.');
  const user = getUserRecord_(username);
  if (!user || !passwordMatches_(password, user.password)) { recordLoginFailure_(username); throw new Error('نام کاربری یا رمز عبور اشتباه است.'); }
  clearLoginFailures_(username);
  migratePasswordIfPlaintext_(user.row, user.password, password);
  const token = createSession_(user.username, user.role);
  return { ok: true, token, user: { username: user.username, role: user.role } };
}
function logout(token) {
  const t = normalize_(token);
  if (t) CacheService.getScriptCache().remove('sess_' + t);
  return { ok: true };
}
function isCoach_(session) { return ['coach', 'admin'].includes((session.role || '').toLowerCase()); }
function isAdmin_(session) { return (session.role || '').toLowerCase() === 'admin'; }

// ---------------------------------------------------------------------------
// Admin panel: user management
// ---------------------------------------------------------------------------

function adminListUsers(token) {
  const session = requireSession_(token);
  requireAdmin_(session);
  const values = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues();
  return values.slice(1).filter(r => normalize_(r[0])).map(r => ({
    username: normalize_(r[0]),
    role: normalize_(r[5]).toLowerCase() || 'user',
    workoutPlans: splitPlans_(r[3]), dietPlans: splitPlans_(r[4]), supplementPlans: splitPlans_(r[2]),
    telegramChatId: normalize_(r[6])
  }));
}

function adminCreateUser(token, input) {
  const session = requireSession_(token);
  requireAdmin_(session);
  const username = normalize_(input.username);
  if (!username) throw new Error('نام کاربری الزامی است.');
  if (getUserRecord_(username)) throw new Error('این نام کاربری قبلاً وجود دارد.');
  const password = normalize_(input.password);
  if (!password) throw new Error('رمز عبور الزامی است — خودتان رمز را برای کاربر تعیین کنید.');
  if (String(password).length < 6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  sh.appendRow([username, makeSaltedHash_(password), '', '', '', normalize_(input.role) || 'user', '']);
  return { ok: true, users: adminListUsers(token) };
}

function adminSetRole(token, username, role) {
  const session = requireSession_(token);
  requireAdmin_(session);
  const target = getUserRecord_(username);
  if (!target) throw new Error('کاربر پیدا نشد.');
  const allowed = ['user', 'coach', 'admin'];
  if (!allowed.includes(role)) throw new Error('نقش نامعتبر است.');
  getSS_().getSheetByName(CONFIG.USERS_SHEET).getRange(target.row, 6).setValue(role);
  return { ok: true, users: adminListUsers(token) };
}

function adminResetPassword(token, username, newPassword) {
  const session = requireSession_(token);
  requireAdmin_(session);
  const target = getUserRecord_(username);
  if (!target) throw new Error('کاربر پیدا نشد.');
  const pwd = normalize_(newPassword);
  if (!pwd) throw new Error('رمز عبور جدید الزامی است.');
  if (String(pwd).length < 6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
  getSS_().getSheetByName(CONFIG.USERS_SHEET).getRange(target.row, 2).setValue(makeSaltedHash_(pwd));
  return { ok: true };
}

function adminDeleteUser(token, username) {
  const session = requireSession_(token);
  requireAdmin_(session);
  const target = getUserRecord_(username);
  if (!target) throw new Error('کاربر پیدا نشد.');
  getSS_().getSheetByName(CONFIG.USERS_SHEET).deleteRow(target.row);
  return { ok: true, users: adminListUsers(token) };
}

// Self-service account settings. Email is stored in Users column H; older
// workbooks are extended without changing the existing seven-column layout.
function updateMyAccount(token, input) {
  const session = requireSession_(token);
  input = input || {};
  const target = getUserRecord_(session.username);
  if (!target) throw new Error('حساب کاربری پیدا نشد.');
  const oldPassword = normalize_(input.currentPassword);
  const newPassword = normalize_(input.newPassword);
  const requestedUsername = normalize_(input.username);
  const requestedEmail = normalize_(input.email);
  const identityChanged = requestedUsername !== target.username || requestedEmail !== target.email;
  if ((newPassword || identityChanged) && !passwordMatches_(oldPassword, target.password)) throw new Error('برای تغییر نام کاربری، ایمیل یا رمز عبور، رمز فعلی را درست وارد کنید.');
  if (newPassword && newPassword.length < 8) throw new Error('رمز جدید باید حداقل ۸ کاراکتر باشد.');
  const newUsername = normalize_(input.username);
  if (!newUsername) throw new Error('نام کاربری نمی‌تواند خالی باشد.');
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(newUsername)) throw new Error('نام کاربری باید ۳ تا ۴۰ کاراکتر و فقط شامل حروف انگلیسی، عدد، نقطه، خط تیره یا زیرخط باشد.');
  if (newUsername.toLowerCase() !== target.username.toLowerCase() && getUserRecord_(newUsername)) throw new Error('این نام کاربری قبلاً استفاده شده است.');
  const email = requestedEmail;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('فرمت ایمیل معتبر نیست.');
  const ss = getSS_();
  const users = ss.getSheetByName(CONFIG.USERS_SHEET);
  if (users.getMaxColumns() < 8) users.insertColumnsAfter(users.getMaxColumns(), 8 - users.getMaxColumns());
  if (!normalize_(users.getRange(1, 8).getValue())) users.getRange(1, 8).setValue('Email');
  // Update every app sheet that keys personal data by username, plus both
  // participant columns in Messages. Exact cell matches only; no text-wide replace.
  const oldLower = target.username.toLowerCase();
  if (newUsername !== target.username) {
    const mappings = [
      [CONFIG.PROFILES_SHEET, [1]], [CONFIG.PROFILE_HISTORY_SHEET, [1]],
      [CONFIG.DAILY_LOGS_SHEET, [1]], [CONFIG.WATER_LOGS_SHEET, [1]],
      [CONFIG.PHOTOS_SHEET, [1]], [CONFIG.COACH_NOTES_SHEET, [1]],
      [CONFIG.EXERCISE_LOGS_SHEET, [1]], [CONFIG.MESSAGES_SHEET, [1,2]]
    ];
    mappings.forEach(([sheetName, cols]) => {
      const sh = ss.getSheetByName(sheetName); if (!sh || sh.getLastRow() < 2) return;
      cols.forEach(col => {
        const range = sh.getRange(2, col, sh.getLastRow()-1, 1);
        const vals = range.getValues(); let changed = false;
        vals.forEach(row => { if (normalize_(row[0]).toLowerCase() === oldLower) { row[0] = newUsername; changed = true; } });
        if (changed) range.setValues(vals);
      });
    });
    users.getRange(target.row, 1).setValue(newUsername);
  }
  if (newPassword) users.getRange(target.row, 2).setValue(makeSaltedHash_(newPassword));
  users.getRange(target.row, 8).setValue(email);
  // Keep this login alive under the new username after a rename.
  const updatedSession = { username: newUsername, role: session.role };
  CacheService.getScriptCache().put('sess_' + normalize_(token), JSON.stringify(updatedSession), CONFIG.SESSION_TTL_SECONDS);
  return { ok: true, user: { username: newUsername, role: session.role, email }, passwordChanged: !!newPassword };
}

// Admin-managed manual meal-photo overrides (Query -> ImageURL)
function adminListMealImages(token) {
  requireAdmin_(requireSession_(token));
  const sh = getSS_().getSheetByName(CONFIG.MEAL_IMAGES_SHEET);
  const values = sh.getDataRange().getValues();
  return values.slice(1).filter(r => normalize_(r[0])).map(r => ({ query: normalize_(r[0]), url: normalize_(r[1]) }));
}
function adminSaveMealImage(token, query, url) {
  requireAdmin_(requireSession_(token));
  const sh = getSS_().getSheetByName(CONFIG.MEAL_IMAGES_SHEET);
  const values = sh.getDataRange().getValues();
  const q = normalize_(query).toLowerCase();
  let row = -1;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === q) { row = r + 1; break; }
  if (row === -1) sh.appendRow([normalize_(query), normalize_(url)]);
  else sh.getRange(row, 1, 1, 2).setValues([[normalize_(query), normalize_(url)]]);
  return { ok: true, images: adminListMealImages(token) };
}

// ---------------------------------------------------------------------------
// Profile + metrics (Mifflin-St Jeor)
// ---------------------------------------------------------------------------

function defaultProfileFromDashboard_() {
  const sh = getSS_().getSheetByName(CONFIG.DASHBOARD_SHEET);
  if (!sh) return { name: '', gender: 'm', age: 25, height: 175, weight: 75, goalWeight: 75, activity: 1.55, goal: 'maintain' };
  const vals = sh.getRange('A1:C20').getValues();
  const map = {};
  vals.forEach(r => { if (r[0] !== '') map[normalize_(r[0])] = r[1]; });
  const weight = safeNumber_(map['وزن فعلی (kg)'], 75);
  return {
    name: normalize_(map['نام ورزشکار']) || '',
    gender: normalize_(map['جنسیت (m/f)']).toLowerCase() === 'f' ? 'f' : 'm',
    age: safeNumber_(map['سن'], 25), height: safeNumber_(map['قد (cm)'], 175),
    weight, goalWeight: weight, activity: safeNumber_(map['سطح فعالیت'], 1.55),
    goal: ['lose','maintain','gain'].includes(normalize_(map['هدف'])) ? normalize_(map['هدف']) : 'maintain'
  };
}

function calculateMetrics_(profile) {
  const w = safeNumber_(profile.weight, 75), h = safeNumber_(profile.height, 175);
  const a = safeNumber_(profile.age, 25), act = safeNumber_(profile.activity, 1.55);
  const gender = normalize_(profile.gender).toLowerCase() === 'f' ? 'f' : 'm';
  let bmr = 10 * w + 6.25 * h - 5 * a;
  bmr = gender === 'm' ? bmr + 5 : bmr - 161;
  const tdee = bmr * act;
  let target = tdee;
  const goal = ['lose','maintain','gain'].includes(normalize_(profile.goal)) ? normalize_(profile.goal) : 'maintain';
  if (goal === 'lose') target -= 450;
  if (goal === 'gain') target += 450;
  const protein = Math.max(1.6 * w, 120);
  const fat = (target * 0.25) / 9;
  const carbs = Math.max(50, (target - (protein * 4) - (fat * 9)) / 4);
  const waterGoal = Math.max(6, Math.round(w / 11));
  const bmi = h > 0 ? w / Math.pow(h / 100, 2) : 0;
  return {
    bmr: Math.round(bmr), tdee: Math.round(tdee), targetCalories: Math.round(target),
    targetProtein: Math.round(protein), targetCarbs: Math.round(carbs), targetFat: Math.round(fat),
    waterGoal, bmi: Number(bmi.toFixed(1))
  };
}

function getProfile_(username) {
  const sh = getSS_().getSheetByName(CONFIG.PROFILES_SHEET);
  const values = sh.getDataRange().getValues();
  const wanted = normalize_(username).toLowerCase();
  for (let r = 1; r < values.length; r++) {
    if (normalize_(values[r][0]).toLowerCase() === wanted) {
      const p = {
        username: normalize_(values[r][0]), name: normalize_(values[r][1]), gender: normalize_(values[r][2]) || 'm',
        age: safeNumber_(values[r][3], 25), height: safeNumber_(values[r][4], 175), weight: safeNumber_(values[r][5], 75),
        goalWeight: safeNumber_(values[r][6], safeNumber_(values[r][5], 75)), activity: safeNumber_(values[r][7], 1.55),
        goal: normalize_(values[r][8]) || 'maintain', bmr: safeNumber_(values[r][9], 0), tdee: safeNumber_(values[r][10], 0),
        targetCalories: safeNumber_(values[r][11], 0), targetProtein: safeNumber_(values[r][12], 0),
        targetCarbs: safeNumber_(values[r][13], 0), targetFat: safeNumber_(values[r][14], 0),
        waterGoal: safeNumber_(values[r][15], 8), updatedAt: normalize_(values[r][16]), avatarUrl: fixImgUrl_(normalize_(values[r][17]))
      };
      if (!p.bmr || !p.tdee || !p.targetCalories) Object.assign(p, calculateMetrics_(p));
      /* شاخص توده بدنی برای کارت‌های اپ (مقدار شیت + محاسبه در صورت نبود) */
      if (!p.bmi) p.bmi = p.height > 0 ? Number((p.weight / Math.pow(p.height / 100, 2)).toFixed(1)) : 0;
      return p;
    }
  }
  const base = defaultProfileFromDashboard_();
  base.name = username;
  return Object.assign({ username, updatedAt: '' }, base, calculateMetrics_(base));
}

function appendProfileHistory_(profile) {
  const sh = getSS_().getSheetByName(CONFIG.PROFILE_HISTORY_SHEET);
  sh.appendRow([profile.username, todayISO_(), profile.weight, profile.bmi, profile.targetCalories, new Date().toISOString()]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(todayISO_());
}
function getProfileHistory_(username) {
  const sh = getSS_().getSheetByName(CONFIG.PROFILE_HISTORY_SHEET);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const out = [];
  for (let r = 1; r < values.length; r++) {
    if (normalize_(values[r][0]).toLowerCase() !== username.toLowerCase()) continue;
    out.push({ date: dateKey_(values[r][1]), weight: safeNumber_(values[r][2], null), bmi: safeNumber_(values[r][3], null) });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.slice(-60);
}

function saveProfile(token, input) {
  const session = requireSession_(token);
  const username = session.username;
  const p = {
    username, name: normalize_(input.name), gender: normalize_(input.gender).toLowerCase() === 'f' ? 'f' : 'm',
    age: Math.round(safeNumber_(input.age, 25)), height: safeNumber_(input.height, 175), weight: safeNumber_(input.weight, 75),
    goalWeight: safeNumber_(input.goalWeight, safeNumber_(input.weight, 75)), activity: safeNumber_(input.activity, 1.55),
    goal: ['lose','maintain','gain'].includes(normalize_(input.goal)) ? normalize_(input.goal) : 'maintain'
  };
  Object.assign(p, calculateMetrics_(p), { updatedAt: new Date().toISOString() });
  const sh = getSS_().getSheetByName(CONFIG.PROFILES_SHEET);
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === username.toLowerCase()) { row = r + 1; break; }
  const oldAvatar = row === -1 ? '' : normalize_(sh.getRange(row, 18).getValue());
  p.avatarUrl = fixImgUrl_(oldAvatar);
  const data = [p.username, p.name, p.gender, p.age, p.height, p.weight, p.goalWeight, p.activity, p.goal, p.bmr, p.tdee, p.targetCalories, p.targetProtein, p.targetCarbs, p.targetFat, p.waterGoal, p.updatedAt, oldAvatar];
  if (row === -1) sh.appendRow(data); else sh.getRange(row, 1, 1, data.length).setValues([data]);
  appendProfileHistory_(p);
  return { ok: true, profile: p };
}

// ---------------------------------------------------------------------------
// Template parsers
// ---------------------------------------------------------------------------

function parseWorkoutSheet_(sheetName) {
  if (!sheetName) return { name: '', days: [], notes: [] };
  const rows = getRows_(sheetName);
  if (!rows.length) return { name: sheetName, days: [], notes: [] };
  const days = [], notes = [];
  let current = null;
  rows.forEach(row => {
    const a = normalize_(row[0]), b = normalize_(row[1]), c = normalize_(row[2]), d = normalize_(row[3]);
    if (![a, b, c, d].some(Boolean)) return;
    const isDayHeader = (/^روز\s*\S+/.test(a) || /^جلسه\s*\S+/.test(a)) && !b && !c && !d;
    const isRest = a === 'استراحت' && !b && !c && !d;
    if (isDayHeader || isRest) { current = { title: isRest ? 'استراحت' : a, isRest, exercises: [] }; days.push(current); return; }
    if (a.indexOf('توصیه') === 0) { notes.push(a); return; }
    if (['حرکت تمرینی','ردیف','نام حرکت','ردیف / روز','نام حرکت / بخش'].includes(a)) return;
    if (!current) { current = { title: 'بخش اول', isRest: false, exercises: [] }; days.push(current); }

    if (a && (isNumberLike_(b) || (b && (b.indexOf('-') > -1 || b.indexOf('*') > -1)))) {
       current.exercises.push({ name: a, sets: b, reps: c, notes: d });
    } else if (isNumberLike_(a) && b) {
       current.exercises.push({ name: b, sets: '', reps: c, notes: d });
    } else if (a && !b && !c && !d && /^(پس از|یک روز|در حین)/.test(a)) {
       notes.push(a);
    }
  });
  return { name: sheetName, days, notes };
}

function parseDietSheet_(sheetName) {
  if (!sheetName) return { name: '', sections: [] };
  const rows = getRows_(sheetName);
  if (!rows.length) return { name: sheetName, sections: [] };
  const first = rows[0].map(normalize_);
  const isTableFormat = first[0] === 'وعده غذایی' || first[1] === 'عنوان منو / بخش' || rows.slice(0, 8).some(r => normalize_(r[1]) && normalize_(r[2]));
  const sections = [];
  let current = null;
  if (isTableFormat) {
    rows.forEach((row, idx) => {
      const a = normalize_(row[0]), b = normalize_(row[1]), c = normalize_(row[2]);
      if (!a && !b && !c) return;
      if (idx === 0 && (a === 'وعده غذایی' || b === 'عنوان منو / بخش')) return;
      if (!current || current.title !== a) { current = { title: a || 'سایر', items: [] }; sections.push(current); }
      const description = c || b || a;
      current.items.push({ title: b || 'گزینه', description, kcal: estimateCalories_(a + ' ' + b + ' ' + description) });
    });
    return { name: sheetName, sections };
  }
  const headings = ['صبحانه','ناشتا','میان وعده صبح','میان‌وعده صبح','ناهار','قبل از تمرین','میان وعده عصر','میان‌وعده عصر','شام','قبل از خواب','توصیه‌ها','توصیه های عمومی','توصیه‌های عمومی','طرز تهیه'];
  const looksHeading = t => { t = t.replace(/\s+/g, ' ').trim(); return headings.some(h => t === h || t.indexOf(h + ' ') === 0 || t.indexOf(h + '(') === 0 || t.indexOf(h + ':') === 0); };
  rows.forEach(row => {
    const a = normalize_(row[0]), b = normalize_(row[1]), c = normalize_(row[2]);
    if (!a && !b && !c) return;
    if (looksHeading(a) && !b && !c) { current = { title: a, items: [] }; sections.push(current); return; }
    if (!current) { current = { title: 'برنامه', items: [] }; sections.push(current); }
    const description = c || b || a;
    current.items.push({ title: b || 'گزینه', description, kcal: estimateCalories_(a + ' ' + b + ' ' + description) });
  });
  return { name: sheetName, sections };
}

// Rough kcal estimate from a small built-in food table (see FOOD_KCAL_PER_100G).
// Returns null when nothing in the text matches a known food, so the UI can
// hide the badge instead of showing a misleading number.
function estimateCalories_(text) {
  const t = normalize_(text);
  let total = 0, matched = false;
  Object.keys(FOOD_KCAL_PER_100G).forEach(food => {
    const idx = t.indexOf(food);
    if (idx === -1) return;
    matched = true;
    const near = toEnglishDigits_(t.slice(Math.max(0, idx - 5), idx + 30));
    const m = near.match(/(\d+)\s*گرم/);
    const grams = m ? Number(m[1]) : 100;
    total += FOOD_KCAL_PER_100G[food] * grams / 100;
  });
  return matched ? Math.round(total) : null;
}

// Time-of-day words used to detect a "schedule grid" header row and to
// separate it from a second, differently-shaped list further down the sheet.
// Includes both "قبل از تمرین" and the shorter "قبل تمرین" since the real
// workbook uses both spellings across different supplement sheets.
const TIMING_WORDS = ['صبح','ظهر','عصر','شب','ناشتا','قبل از تمرین','بعد از تمرین','قبل تمرین','بعد تمرین','حین تمرین','قبل از خواب','بین وعده'];
function looksLikeTiming_(s) { return TIMING_WORDS.some(w => s.indexOf(w) === 0 || s === w); }

function parseSupplementSheet_(sheetName) {
  if (!sheetName) return { name: '', schedule: [], groups: [], items: [] };
  const rows = getRows_(sheetName);
  if (!rows.length) return { name: sheetName, schedule: [], groups: [], items: [] };

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const cells = rows[i].map(normalize_).filter(Boolean);
    if (cells.length >= 2 && cells.filter(looksLikeTiming_).length >= Math.ceil(cells.length / 2)) { headerRowIdx = i; break; }
  }

  if (headerRowIdx > -1) {
    const headers = rows[headerRowIdx].map(normalize_);
    const byTiming = {};
    headers.forEach(h => { if (h) byTiming[h] = []; });
    const groups = [];

    // FIX: some sheets put the second section ("مکمل غذایی": name + its own
    // timings) right after the grid with NO blank separator row, which the
    // old blank-row-triggered detection missed entirely, silently dumping
    // "وی"/"کراتین"/etc. into the wrong time-of-day column. Detect the
    // second section directly instead: the first row whose own value in a
    // column other than 0 is itself a timing word (e.g. "وی | صبح | بعد از
    // تمرین") can only belong to that section, regardless of blank rows.
    let groupStartIdx = -1;
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const cells = rows[i].map(normalize_);
      const name = cells[0];
      const rest = cells.slice(1).filter(Boolean);
      if (name && rest.some(looksLikeTiming_)) { groupStartIdx = i; break; }
    }
    const gridEnd = groupStartIdx === -1 ? rows.length : groupStartIdx;

    for (let i = headerRowIdx + 1; i < gridEnd; i++) {
      const cells = rows[i].map(normalize_);
      const nonEmpty = cells.filter(Boolean);
      if (!nonEmpty.length) continue;
      // The row immediately before the second section, if it's a single lone
      // cell, is that section's title (e.g. "مکمل غذایی") — not one more dose.
      if (i === gridEnd - 1 && nonEmpty.length === 1 && groupStartIdx > -1) continue;
      cells.forEach((val, ci) => { if (val && headers[ci] && byTiming[headers[ci]]) byTiming[headers[ci]].push(val); });
    }

    if (groupStartIdx > -1) {
      const titleRow = rows[gridEnd - 1].map(normalize_).filter(Boolean);
      let current = { title: titleRow.length === 1 ? titleRow[0] : 'مکمل‌های دیگر', items: [] };
      groups.push(current);
      let pendingSep = false;
      for (let i = groupStartIdx; i < rows.length; i++) {
        const cells = rows[i].map(normalize_);
        const nonEmpty = cells.filter(Boolean);
        if (!nonEmpty.length) { pendingSep = true; continue; }
        if (pendingSep && nonEmpty.length === 1) { current = { title: cells[0], items: [] }; groups.push(current); pendingSep = false; continue; }
        pendingSep = false;
        const name = cells[0];
        if (!name) continue;
        current.items.push({ name, timings: cells.slice(1).filter(Boolean) });
      }
    }

    const schedule = [];
    headers.forEach(h => { if (h && byTiming[h] && byTiming[h].length) schedule.push({ timing: h, items: byTiming[h] }); });
    return { name: sheetName, schedule, groups, items: [] };
  }

  // Fallback: the old row-based table (Category | Name | Dosage | Timing | Instructions)
  const items = [];
  rows.forEach((row, idx) => {
    const cells = row.map(normalize_);
    if (!cells.some(Boolean) || idx === 0) return;
    if (cells[0] === 'دسته‌بندی' || cells[0] === 'ردیف / روز') return;
    items.push({ category: cells[0], name: cells[1] || cells[0], dosage: cells[2] || '', timing: cells[3] || '', instructions: cells[4] || '' });
  });
  return { name: sheetName, schedule: [], groups: [], items };
}

// ---------------------------------------------------------------------------
// Plan discovery: name match first, then content sniffing for anything
// missed (fixes workout sheets like "برنامه ماهان ماه 5 روزه" that don't
// contain the word "تمرین" but do have day headers).
// ---------------------------------------------------------------------------

function classifySheetContent_(sheetName) {
  const rows = getRows_(sheetName).slice(0, 40);
  const firstCol = rows.map(r => normalize_(r[0]));
  if (firstCol.some(a => /^روز\s*\S+/.test(a) || /^جلسه\s*\S+/.test(a))) return 'workout';
  const texts = rows.map(r => r.map(normalize_).join(' ')).join(' ');
  if (/صبحانه|ناهار|شام|میان\s?وعده|وعده غذایی/.test(texts)) return 'diet';
  if (/دسته‌بندی|قرص|ویتامین|مکمل/.test(texts)) return 'supplement';
  return null;
}

function getAssignedPlans_(username) {
  const rec = getUserRecord_(username);
  if (!rec) return { workout: [], diet: [], supplement: [] };
  return { workout: splitPlans_(rec.workoutPlan), diet: splitPlans_(rec.dietPlan), supplement: splitPlans_(rec.supplementPlan) };
}

function listPlanSheets_() {
  const system = new Set([
    CONFIG.USERS_SHEET, CONFIG.DASHBOARD_SHEET, CONFIG.DAILY_LOGS_SHEET, CONFIG.PROFILES_SHEET,
    CONFIG.PROFILE_HISTORY_SHEET, CONFIG.APP_LOGS_SHEET, CONFIG.WATER_LOGS_SHEET, CONFIG.MEAL_IMAGES_SHEET,
    CONFIG.MEDIA_CACHE_SHEET, CONFIG.MESSAGES_SHEET, CONFIG.PHOTOS_SHEET, CONFIG.COACH_NOTES_SHEET,
    CONFIG.EXERCISE_LOGS_SHEET,
    'MelikaData', 'WorkoutPlans', 'DietPlans', 'Supplements', 'WorkoutDone', 'Reminders', 'DailyLogs', 'SF_AssignedPlans'
  ]);
  // شیت‌های سیستم برنامه‌ساز (SF_*) هرگز به‌عنوان «برنامه شیتی» نمایش داده نمی‌شوند.
  const candidates = getSS_().getSheets().map(s => s.getName()).filter(n => !system.has(n) && !/^SF_/.test(n) && !/^آرشیو/.test(n));
  const byName = {
    workout: candidates.filter(n => /تمرین|تمیرن|workout/i.test(n)),
    diet: candidates.filter(n => /غذایی|رژیم|diet/i.test(n)),
    supplement: candidates.filter(n => /مکمل|ویتامین|قرص|supplement/i.test(n))
  };
  const claimed = new Set([...byName.workout, ...byName.diet, ...byName.supplement]);
  candidates.filter(n => !claimed.has(n)).forEach(n => {
    const kind = classifySheetContent_(n);
    if (kind) byName[kind].push(n);
  });
  return byName;
}

// ---------------------------------------------------------------------------
// Progress logs + streak
// ---------------------------------------------------------------------------

function getLogs_(username) {
  const sh = getSS_().getSheetByName(CONFIG.APP_LOGS_SHEET);
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  const me = normalize_(username).toLowerCase();

  // Optimization: filter immediately to reduce memory usage
  return values.slice(1)
    .filter(row => normalize_(row[0]).toLowerCase() === me)
    .map(row => ({
      date: dateKey_(row[1]),
      jalali: normalize_(row[2]),
      weight: safeNumber_(row[3], null),
      waist: safeNumber_(row[4], null),
      bodyFat: safeNumber_(row[5], null),
      calories: safeNumber_(row[6], null),
      notes: normalize_(row[7])
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 180);
}
function lastLogDate_(username) { const logs = getLogs_(username); return logs.length ? logs[0].date : ''; }

function computeStreak_(username, clientToday) {
  const logs = getLogs_(username);
  if (!logs.length) return 0;
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const dates = new Set(logs.map(l => l.date));
  const cursor = new Date(today + 'T00:00:00');
  if (!dates.has(today)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (dates.has(Utilities.formatDate(cursor, tz_(), 'yyyy-MM-dd'))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

function gregorianToJalali_(gy, gm, gd) {
  const gdm = [31,28,31,30,31,30,31,31,30,31,30,31];
  let gy2 = gy - 1600, gm2 = gm - 1, gd2 = gd - 1;
  let gDayNo = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);
  for (let i = 0; i < gm2; i++) gDayNo += gdm[i];
  if (gm2 > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) gDayNo++;
  gDayNo += gd2;
  let jDayNo = gDayNo - 79;
  const jNp = Math.floor(jDayNo / 12053);
  jDayNo %= 12053;
  let jy = 979 + 33 * jNp + 4 * Math.floor(jDayNo / 1461);
  jDayNo %= 1461;
  if (jDayNo >= 366) { jy += Math.floor((jDayNo - 1) / 365); jDayNo = (jDayNo - 1) % 365; }
  const jm = jDayNo < 186 ? Math.floor(jDayNo / 31) + 1 : Math.floor((jDayNo - 186) / 30) + 7;
  const jd = jDayNo < 186 ? (jDayNo % 31) + 1 : ((jDayNo - 186) % 30) + 1;
  return [jy, jm, jd];
}
function toJalaliString_(date) {
  const d = date || new Date();
  return gregorianToJalali_(d.getFullYear(), d.getMonth() + 1, d.getDate()).map(x => String(x).padStart(2, '0')).join('/');
}

function saveLog(token, input) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.APP_LOGS_SHEET);
  const date = isValidDateStr_(input.date) ? input.date : todayISO_();
  const jalali = normalize_(input.jalali) || toJalaliString_(new Date(date + 'T00:00:00'));
  const weight = safeNumber_(input.weight, null), waist = safeNumber_(input.waist, null);
  const bodyFat = safeNumber_(input.bodyFat, null), calories = safeNumber_(input.calories, null);
  const notes = normalize_(input.notes);
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === session.username.toLowerCase() && dateKey_(values[r][1]) === date) { row = r + 1; break; }
  const data = [session.username, date, jalali, weight, waist, bodyFat, calories, notes, new Date().toISOString()];
  if (row === -1) { sh.appendRow(data); sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(date); }
  else sh.getRange(row, 1, 1, data.length).setValues([data]);
  return { ok: true, logs: getLogs_(session.username), streak: computeStreak_(session.username, date) };
}

function deleteLog(token, date) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.APP_LOGS_SHEET);
  const values = sh.getDataRange().getValues();
  for (let r = values.length - 1; r >= 1; r--) if (normalize_(values[r][0]).toLowerCase() === session.username.toLowerCase() && dateKey_(values[r][1]) === normalize_(date)) sh.deleteRow(r + 1);
  return { ok: true, logs: getLogs_(session.username), streak: computeStreak_(session.username) };
}

// ---------------------------------------------------------------------------
// Water tracking — now takes the athlete's own local date from the browser
// instead of computing "today" from the spreadsheet's timezone setting.
// ---------------------------------------------------------------------------

function getWater_(username, clientToday) {
  const goal = getProfile_(username).waterGoal || 8;
  const sh = getSS_().getSheetByName(CONFIG.WATER_LOGS_SHEET);
  if (!sh) return { glasses: 0, goal };
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const values = sh.getDataRange().getValues();
  let glasses = 0;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === username.toLowerCase() && dateKey_(values[r][1]) === today) glasses = Math.max(glasses, safeNumber_(values[r][2], 0));
  return { glasses, goal };
}

function addWater(token, amount, clientToday) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.WATER_LOGS_SHEET);
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const add = Math.round(safeNumber_(amount, 1));
  const cur = getWater_(session.username, today);
  const glasses = Math.max(0, cur.glasses + add);
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === session.username.toLowerCase() && dateKey_(values[r][1]) === today) { row = r + 1; break; }
  const data = [session.username, today, glasses, cur.goal, new Date().toISOString()];
  if (row === -1) { sh.appendRow(data); sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(today); }
  else sh.getRange(row, 1, 1, data.length).setValues([data]);
  return { ok: true, water: { glasses, goal: cur.goal } };
}

function resetWater(token, clientToday) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.WATER_LOGS_SHEET);
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const values = sh.getDataRange().getValues();
  for (let r = values.length - 1; r >= 1; r--) if (normalize_(values[r][0]).toLowerCase() === session.username.toLowerCase() && dateKey_(values[r][1]) === today) sh.deleteRow(r + 1);
  return { ok: true, water: getWater_(session.username, today) };
}

function cleanWater_() {
  const sh = getSS_().getSheetByName(CONFIG.WATER_LOGS_SHEET);
  const values = sh.getDataRange().getValues();
  const seen = {};
  for (let r = values.length - 1; r >= 1; r--) {
    const key = normalize_(values[r][0]) + '|' + dateKey_(values[r][1]);
    if (seen[key]) sh.deleteRow(r + 1); else seen[key] = 1;
  }
}

// ---------------------------------------------------------------------------
// Profile avatar (one private-account reference per username)
// ---------------------------------------------------------------------------
function uploadProfileAvatar(token, base64Data, mimeType) {
  const session = requireSession_(token);
  const type = normalize_(mimeType).toLowerCase();
  if (!['image/jpeg','image/png','image/webp'].includes(type)) throw new Error('فرمت تصویر پشتیبانی نمی‌شود.');
  if (!base64Data || String(base64Data).length > 5 * 1024 * 1024) throw new Error('حجم تصویر بیش از حد مجاز است.');
  const ss = getSS_();
  ensureProfileAvatarHeader_();
  const sh = ss.getSheetByName(CONFIG.PROFILES_SHEET);
  const folderName = 'Saeedi Fit Profile Photos';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, type, 'avatar_' + session.username + '_' + Date.now() + '.jpg');
  const file = folder.createFile(blob);
  // A shareable image URL is needed for display in the web app. Users should
  // upload only a photo they are comfortable making viewable by link.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = 'https://lh3.googleusercontent.com/d/' + file.getId() + '=w720';
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === session.username.toLowerCase()) { row = r + 1; break; }
  if (row === -1) {
    const profile = getProfile_(session.username);
    const data = [profile.username, profile.name, profile.gender, profile.age, profile.height, profile.weight, profile.goalWeight, profile.activity, profile.goal, profile.bmr, profile.tdee, profile.targetCalories, profile.targetProtein, profile.targetCarbs, profile.targetFat, profile.waterGoal, profile.updatedAt || new Date().toISOString(), url];
    sh.appendRow(data);
  } else sh.getRange(row, 18).setValue(url);
  return { ok: true, avatarUrl: url };
}

// ---------------------------------------------------------------------------
// Progress photos (Drive-backed)
// ---------------------------------------------------------------------------

function getOrCreatePhotosFolder_() {
  const folders = DriveApp.getFoldersByName('Fitness Coach Photos');
  return folders.hasNext() ? folders.next() : DriveApp.createFolder('Fitness Coach Photos');
}
function uploadProgressPhoto(token, base64Data, mimeType, label) {
  const session = requireSession_(token);
  const folder = getOrCreatePhotosFolder_();
  const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType || 'image/jpeg', session.username + '_' + Date.now());
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  const sh = getSS_().getSheetByName(CONFIG.PHOTOS_SHEET);
  sh.appendRow([session.username, todayISO_(), normalize_(label), file.getId(), url, new Date().toISOString()]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(todayISO_());
  return { ok: true, photos: getProgressPhotos_(session.username) };
}
function getProgressPhotos_(username) {
  const sh = getSS_().getSheetByName(CONFIG.PHOTOS_SHEET);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const out = [];
  for (let r = 1; r < values.length; r++) {
    if (normalize_(values[r][0]).toLowerCase() !== username.toLowerCase()) continue;
    out.push({ date: dateKey_(values[r][1]), label: normalize_(values[r][2]), url: normalize_(values[r][4]) });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

// ---------------------------------------------------------------------------
// Real set logging (actual weight/reps per exercise) + strength history
// ---------------------------------------------------------------------------

function logExerciseSet(token, input) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.EXERCISE_LOGS_SHEET);
  const weight = safeNumber_(input.weight, null);
  const reps = safeNumber_(input.reps, null);
  if (weight == null && reps == null) throw new Error('وزنه یا تکرار را وارد کن.');
  const date = todayISO_();
  const row = [session.username, date, normalize_(input.workoutName), normalize_(input.exerciseName), weight, reps, new Date().toISOString()];
  sh.appendRow(row);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(date);
  return { ok: true, history: getExerciseHistory(token, input.exerciseName) };
}

// Last 12 logged sets for one exercise, oldest first — enough for a small
// strength-over-time sparkline without pulling the whole sheet every time.
function getExerciseHistory(token, exerciseName) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.EXERCISE_LOGS_SHEET);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const name = normalize_(exerciseName).toLowerCase();
  const out = [];
  for (let r = 1; r < values.length; r++) {
    if (normalize_(values[r][0]).toLowerCase() !== session.username.toLowerCase()) continue;
    if (normalize_(values[r][3]).toLowerCase() !== name) continue;
    out.push({ date: dateKey_(values[r][1]), weight: safeNumber_(values[r][4], null), reps: safeNumber_(values[r][5], null) });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out.slice(-40);
}

// ---------------------------------------------------------------------------
// Barcode food lookup via Open Food Facts (free, no API key required)
// ---------------------------------------------------------------------------

function getFoodByBarcode(token, barcode) {
  requireSession_(token);
  const code = normalize_(barcode).replace(/\D/g, '');
  if (!code) throw new Error('بارکد نامعتبر است.');

  const cache = CacheService.getScriptCache();
  const cacheKey = 'off_' + code;
  const cached = cache.get(cacheKey);
  if (cached !== null) return cached === '-' ? null : JSON.parse(cached);

  const resp = UrlFetchApp.fetch('https://world.openfoodfacts.org/api/v0/product/' + code + '.json', { muteHttpExceptions: true });
  let result = null;
  try {
    const json = JSON.parse(resp.getContentText());
    if (json.status === 1 && json.product) {
      const p = json.product;
      result = {
        name: p.product_name || p.generic_name || 'محصول ناشناس',
        brand: p.brands || '',
        kcalPer100g: p.nutriments && (p.nutriments['energy-kcal_100g'] || p.nutriments['energy-kcal']) || null,
        imageUrl: p.image_front_small_url || p.image_url || ''
      };
    }
  } catch (e) {}
  cache.put(cacheKey, result ? JSON.stringify(result) : '-', 21600);
  return result;
}

// ---------------------------------------------------------------------------
// Leaderboard — ranks every athlete under this workbook by current streak.
// An athlete only gets their own rank + total (not everyone else's streaks);
// a coach/admin gets the full ranked list.
// ---------------------------------------------------------------------------

function getLeaderboard(token) {
  const session = requireSession_(token);
  const values = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues();
  let all = values.slice(1).filter(r => normalize_(r[0])).map(r => {
    const username = normalize_(r[0]);
    return { username, name: getProfile_(username).name || username, streak: computeStreak_(username) };
  });
  all.sort((a, b) => b.streak - a.streak);

  if (isCoach_(session)) {
    if (!isAdmin_(session)) all = all.filter(x => {
      const u = getUserRecord_(x.username);
      return u && u.coachUsername.toLowerCase() === session.username.toLowerCase();
    });
    return { mode: 'coach', list: all };
  }

  const rank = all.findIndex(x => x.username.toLowerCase() === session.username.toLowerCase()) + 1;
  return { mode: 'athlete', rank: rank || null, total: all.length, streak: computeStreak_(session.username) };
}

// ---------------------------------------------------------------------------
// Coach / admin panel
// ---------------------------------------------------------------------------

function daysSince_(isoDate) {
  if (!isoDate) return 9999; // sentinel for 'never logged' — Infinity cannot cross the RPC boundary
  return Math.round((new Date(todayISO_() + 'T00:00:00') - new Date(isoDate + 'T00:00:00')) / 86400000);
}
function getCoachAthletes_(session) {
  const values = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues();
  const wk = doneCountsByUser_(7), lm = lastMessagesMap_();
  return values.slice(1).filter(r => normalize_(r[0]) && (!session || isAdmin_(session) || normalize_(r[8]).toLowerCase() === String(session.username || '').toLowerCase())).map(r => {
    const username = normalize_(r[0]);
    const profile = getProfile_(username);
    const lastLog = lastLogDate_(username);
    return {
      username, name: profile.name || username,
      workoutPlans: splitPlans_(r[3]), dietPlans: splitPlans_(r[4]), supplementPlans: splitPlans_(r[2]),
      weight: profile.weight, calories: profile.targetCalories,
      lastLogDate: lastLog, missedDays: daysSince_(lastLog),
      streak: computeStreak_(username), // used for the coach-side leaderboard
      weekWorkouts: wk[username.toLowerCase()] || 0,
      lastMsgFrom: (lm[username.toLowerCase()] || {}).sender || '', lastMsgAt: (lm[username.toLowerCase()] || {}).at || ''
    };
  });
}
function assignPlans(token, input) {
  const session = requireSession_(token);
  if (!isCoach_(session)) throw new Error('دسترسی مربی/ادمین لازم است.');
  const target = getUserRecord_(input.username);
  if (!target) throw new Error('ورزشکار پیدا نشد.');
  requireAssignedAthlete_(session, target.username);
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  sh.getRange(target.row, 3).setValue(joinPlans_(input.supplementPlans));
  sh.getRange(target.row, 4).setValue(joinPlans_(input.workoutPlans));
  sh.getRange(target.row, 5).setValue(joinPlans_(input.dietPlans));
  /* برنامه‌هایی که فقط اسمشان ثبت شده، همین حالا برای شاگرد کپی می‌شوند */
  try { if (typeof sf7SyncAssignedPlans === 'function') sf7SyncAssignedPlans(token, target.username); } catch (e) {}
  try { if (typeof sf7BumpPlans_ === 'function') sf7BumpPlans_(); } catch (e) {}
  return { ok: true, athletes: getCoachAthletes_(session) };
}
function requireAssignedAthlete_(session, athleteUsername) {
  if (isAdmin_(session)) return getUserRecord_(athleteUsername);
  const target = getUserRecord_(athleteUsername);
  if (!target || target.coachUsername.toLowerCase() !== String(session.username || '').toLowerCase()) throw new Error('این شاگرد به حساب مربی شما اختصاص داده نشده است.');
  return target;
}
function getCoachNote(token, athleteUsername) {
  const session = requireSession_(token);
  if (!isCoach_(session)) throw new Error('دسترسی مربی/ادمین لازم است.');
  requireAssignedAthlete_(session, athleteUsername);
  const sh = getSS_().getSheetByName(CONFIG.COACH_NOTES_SHEET);
  const values = sh.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === normalize_(athleteUsername).toLowerCase()) return { note: normalize_(values[r][1]) };
  return { note: '' };
}
function saveCoachNote(token, athleteUsername, note) {
  const session = requireSession_(token);
  if (!isCoach_(session)) throw new Error('دسترسی مربی/ادمین لازم است.');
  requireAssignedAthlete_(session, athleteUsername);
  const sh = getSS_().getSheetByName(CONFIG.COACH_NOTES_SHEET);
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === normalize_(athleteUsername).toLowerCase()) { row = r + 1; break; }
  const data = [normalize_(athleteUsername), normalize_(note), new Date().toISOString()];
  if (row === -1) sh.appendRow(data); else sh.getRange(row, 1, 1, data.length).setValues([data]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Media lookups: exercise videos + meal photos (sheet-backed cache)
// ---------------------------------------------------------------------------

function mediaCacheKey_(kind, query) { return kind + '::' + normalize_(query).toLowerCase(); }
function readMediaCache_() {
  const sh = getSS_().getSheetByName(CONFIG.MEDIA_CACHE_SHEET);
  if (!sh) return {};
  const values = sh.getDataRange().getValues();
  const map = {};
  for (let r = 1; r < values.length; r++) { const key = normalize_(values[r][0]); if (key) map[key] = { url: normalize_(values[r][1]), row: r + 1 }; }
  return map;
}
function writeMediaCache_(key, url, existingRow) {
  const sh = getSS_().getSheetByName(CONFIG.MEDIA_CACHE_SHEET);
  if (existingRow) sh.getRange(existingRow, 2, 1, 2).setValues([[url, new Date().toISOString()]]);
  else sh.appendRow([key, url, new Date().toISOString()]);
}
function readMealImageOverrides_() {
  const sh = getSS_().getSheetByName(CONFIG.MEAL_IMAGES_SHEET);
  if (!sh) return {};
  const values = sh.getDataRange().getValues();
  const map = {};
  for (let r = 1; r < values.length; r++) { const q = normalize_(values[r][0]).toLowerCase(); if (q) map[q] = normalize_(values[r][1]); }
  return map;
}

function getMedia(token, items) {
  requireSession_(token);
  const scriptCache = CacheService.getScriptCache();
  const ytKey = PropertiesService.getScriptProperties().getProperty('YT_KEY');
  const sheetCache = readMediaCache_();
  const overrides = readMealImageOverrides_();
  const out = {}, requests = [], meta = [];

  (items || []).slice(0, 16).forEach(it => {
    const q = normalize_(it.q);
    const id = it.k + '|' + q;
    if (!q) return;
    if (it.k === 'img') { const manual = overrides[q.toLowerCase()]; if (manual) { out[id] = manual; return; } }
    const cacheKey = mediaCacheKey_(it.k, q);
    if (sheetCache[cacheKey]) { out[id] = sheetCache[cacheKey].url; return; }
    const shortKey = 'media_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, id)).slice(0, 24);
    const cached = scriptCache.get(shortKey);
    if (cached !== null) { out[id] = cached === '-' ? '' : cached; return; }

    if (it.k === 'yt') {
      const searchLink = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q + ' آموزش');
      if (!ytKey) { out[id] = searchLink; writeMediaCache_(cacheKey, searchLink, null); return; }
      requests.push({ url: 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=' + encodeURIComponent(q + ' آموزش') + '&key=' + ytKey, muteHttpExceptions: true });
      meta.push({ id, cacheKey, shortKey, kind: 'yt', fallback: searchLink });
    } else {
      requests.push({ url: 'https://fa.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(q) + '&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json', muteHttpExceptions: true });
      meta.push({ id, cacheKey, shortKey, kind: 'img', fallback: '' });
    }
  });

  if (requests.length) {
    UrlFetchApp.fetchAll(requests).forEach((resp, i) => {
      const m = meta[i];
      let url = m.fallback;
      try {
        const json = JSON.parse(resp.getContentText());
        if (m.kind === 'yt') { const first = json.items && json.items[0]; if (first) url = 'https://www.youtube.com/watch?v=' + first.id.videoId; }
        else { const page = json.query && Object.values(json.query.pages)[0]; if (page && page.thumbnail) url = page.thumbnail.source; }
      } catch (e) {}
      out[m.id] = url;
      scriptCache.put(m.shortKey, url || '-', 21600);
      writeMediaCache_(m.cacheKey, url, null);
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

function getMessages(token, athleteUsername) {
  const session = requireSession_(token);
  const athlete = isCoach_(session) ? normalize_(athleteUsername) : session.username;
  if (!athlete) return [];
  if (isCoach_(session)) requireAssignedAthlete_(session, athlete);
  const sh = getSS_().getSheetByName(CONFIG.MESSAGES_SHEET);
  if (!sh) return [];
  const values = sh.getDataRange().getValues();
  const out = [];
  for (let r = 1; r < values.length; r++) {
    if (normalize_(values[r][0]).toLowerCase() !== athlete.toLowerCase()) continue;
    out.push({ sender: normalize_(values[r][1]), text: normalize_(values[r][2]), createdAt: normalize_(values[r][3]) });
  }
  return out.slice(-200);
}
function sendMessage(token, athleteUsername, text) {
  const session = requireSession_(token);
  const athlete = isCoach_(session) ? normalize_(athleteUsername) : session.username;
  if (isCoach_(session)) requireAssignedAthlete_(session, athlete);
  const body = normalize_(text);
  if (!athlete || !body) throw new Error('پیام یا ورزشکار مشخص نیست.');
  /* ضد تکرار: همان متن از همان فرستنده در ۱۰ دقیقه فقط یک‌بار ثبت می‌شود */
  try {
    const ck = 'mdup_' + session.username.toLowerCase() + '_' + Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, body).map(function (b) { return ((b < 0 ? b + 256 : b) + 256).toString(16).slice(1); }).join('');
    const cache = CacheService.getScriptCache();
    if (cache.get(ck)) return { ok: true, duplicate: true, messages: getMessages(token, athlete) };
    cache.put(ck, '1', 120);
  } catch (e) {}
  getSS_().getSheetByName(CONFIG.MESSAGES_SHEET).appendRow([athlete, session.username, body, new Date().toISOString()]);
  /* پیام شاگرد را همان لحظه به تلگرام مربی/ادمین هم می‌فرستیم */
  if (!isCoach_(session) && typeof sf7NotifyCoaches_ === 'function') { try { sf7NotifyCoaches_(athlete, body); } catch (e) {} }
  return { ok: true, messages: getMessages(token, athlete) };
}

// ---------------------------------------------------------------------------
// Optional daily Telegram reminder
// ---------------------------------------------------------------------------

function installDailyReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sendDailyReminders') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendDailyReminders').timeBased().everyDays(1).atHour(9).create();
  SpreadsheetApp.getUi().alert('یادآور روزانه ساعت ۹ صبح فعال شد.');
}
function sendDailyReminders() {
  const botToken = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!botToken) return;
  const values = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues();
  const today = todayISO_();
  const requests = [];
  values.slice(1).forEach(r => {
    const username = normalize_(r[0]), chatId = normalize_(r[6]);
    if (!username || !chatId || lastLogDate_(username) === today) return;
    requests.push({
      url: 'https://api.telegram.org/bot' + botToken + '/sendMessage', method: 'post',
      payload: { chat_id: chatId, text: 'سلام! یادت نره امروز وزن و پیشرفتت رو تو اپ Saeedi Fit Body ثبت کنی و آب کافی بخوری 💧' },
      muteHttpExceptions: true
    });
  });
  if (requests.length) UrlFetchApp.fetchAll(requests);
}

// ---------------------------------------------------------------------------
// Weekly coach report
// ---------------------------------------------------------------------------

function installWeeklyReportTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'sendWeeklyReport') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendWeeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(8).create();
  SpreadsheetApp.getUi().alert('گزارش هفتگی هر یکشنبه ساعت ۸ صبح فعال شد.');
}
function sendWeeklyReport() {
  const props = PropertiesService.getScriptProperties();
  const coachEmail = props.getProperty('COACH_EMAIL');
  const tgToken = props.getProperty('TELEGRAM_BOT_TOKEN');
  const tgChat = props.getProperty('COACH_TELEGRAM_CHAT_ID');
  if (!coachEmail && !(tgToken && tgChat)) return;
  const athletes = getCoachAthletes_(null);
  const missed = athletes.filter(a => a.missedDays >= CONFIG.MISSED_LOG_ALERT_DAYS);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = Utilities.formatDate(weekAgo, tz_(), 'yyyy-MM-dd');
  let newLogs = 0, weightSum = 0, weightCount = 0;
  athletes.forEach(a => {
    const logs = getLogs_(a.username).filter(l => l.date >= weekAgoStr);
    newLogs += logs.length;
    if (logs.length) { weightSum += Number(logs[0].weight) || 0; weightCount++; }
  });
  const avgWeight = weightCount ? (weightSum / weightCount).toFixed(1) : '-';
  const text = [
    'گزارش هفتگی Saeedi Fit Body', 'تعداد ورزشکار: ' + athletes.length, 'ثبت‌های جدید این هفته: ' + newLogs,
    'میانگین وزن فعلی تیم: ' + avgWeight + ' kg',
    'بی‌خبر (' + CONFIG.MISSED_LOG_ALERT_DAYS + '+ روز): ' + missed.length + (missed.length ? ' → ' + missed.map(a => a.name).join('، ') : '')
  ].join('\n');
  if (coachEmail) MailApp.sendEmail(coachEmail, 'گزارش هفتگی Saeedi Fit Body', text);
  if (tgToken && tgChat) UrlFetchApp.fetch('https://api.telegram.org/bot' + tgToken + '/sendMessage', { method: 'post', payload: { chat_id: tgChat, text }, muteHttpExceptions: true });
}

// ---------------------------------------------------------------------------
// Weekly full-spreadsheet backup
// ---------------------------------------------------------------------------

function getOrCreateBackupFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty('BACKUP_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  const folders = DriveApp.getFoldersByName('Fitness Coach Backups');
  return folders.hasNext() ? folders.next() : DriveApp.createFolder('Fitness Coach Backups');
}
function backupSpreadsheet() {
  const folder = getOrCreateBackupFolder_();
  DriveApp.getFileById(CONFIG.SPREADSHEET_ID).makeCopy('Fitness Coach Backup - ' + todayISO_(), folder);
}
function installWeeklyBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'backupSpreadsheet') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('backupSpreadsheet').timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(3).create();
  SpreadsheetApp.getUi().alert('پشتیبان‌گیری هفتگی هر جمعه ساعت ۳ بامداد فعال شد.');
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Meal log (daily calories / protein) + activity calendar
// ---------------------------------------------------------------------------

// Created lazily so existing installs (SHEETS_READY already set) get the sheet too.
function getMealSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName(CONFIG.MEAL_LOGS_SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.MEAL_LOGS_SHEET);
    sh.getRange(1, 1, 1, MEAL_LOG_HEADERS.length).setValues([MEAL_LOG_HEADERS]);
    sh.getRange('B2:B').setNumberFormat('@');
    sh.setFrozenRows(1);
  } else if (normalize_(sh.getRange(1, 7).getValue()) === '') {
    sh.getRange(1, 7, 1, 2).setValues([['Carbs', 'Fat']]);
  }
  return sh;
}

// { today:[...], yesterday:[...], days:{ 'yyyy-MM-dd': {kcal,protein,carbs,fat} } }
function getMeals_(username, clientToday) {
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const t = new Date(today + 'T12:00:00'); t.setDate(t.getDate() - 1);
  const yday = Utilities.formatDate(t, tz_(), 'yyyy-MM-dd');
  const out = { today: [], yesterday: [], days: {} };
  const sh = getSS_().getSheetByName(CONFIG.MEAL_LOGS_SHEET);
  if (!sh || sh.getLastRow() < 2) return out;
  const values = sh.getDataRange().getValues();
  const me = username.toLowerCase();
  for (let r = 1; r < values.length; r++) {
    if (normalize_(values[r][0]).toLowerCase() !== me) continue;
    const day = dateKey_(values[r][1]);
    const it = { id: normalize_(values[r][5]), title: normalize_(values[r][2]), kcal: safeNumber_(values[r][3], 0), protein: safeNumber_(values[r][4], 0), carbs: safeNumber_(values[r][6], 0), fat: safeNumber_(values[r][7], 0) };
    const d = out.days[day] || (out.days[day] = { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    d.kcal += it.kcal; d.protein += it.protein; d.carbs += it.carbs; d.fat += it.fat;
    if (day === today) out.today.push(it);
    else if (day === yday) out.yesterday.push(it);
  }
  return out;
}

function logMeal(token, input, clientToday) {
  const session = requireSession_(token);
  input = input || {};
  const title = normalize_(input.title).slice(0, 80) || 'وعده';
  const kcal = Math.round(safeNumber_(input.kcal, 0)), protein = Math.round(safeNumber_(input.protein, 0));
  const carbs = Math.round(safeNumber_(input.carbs, 0)), fat = Math.round(safeNumber_(input.fat, 0));
  if ([kcal, protein, carbs, fat].some(v => v < 0) || kcal > 5000 || protein > 500 || carbs > 800 || fat > 400) throw new Error('مقدار وارد شده معتبر نیست.');
  if (!kcal && !protein && !carbs && !fat) throw new Error('کالری یا ماکرو را وارد کن.');
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  appendMealRow_(session.username, today, title, kcal, protein, carbs, fat);
  return { ok: true, meals: getMeals_(session.username, today) };
}

function appendMealRow_(username, day, title, kcal, protein, carbs, fat) {
  const sh = getMealSheet_();
  const id = new Date().toISOString() + '_' + Math.floor(Math.random() * 100000);
  sh.appendRow([username, day, title, kcal, protein, id, carbs, fat]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(day);
}

// "Copy yesterday": re-logs every meal from yesterday under today's date.
function copyYesterdayMeals(token, clientToday) {
  const session = requireSession_(token);
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const y = getMeals_(session.username, today).yesterday;
  if (!y.length) throw new Error('دیروز وعده‌ای ثبت نشده.');
  y.forEach(m => appendMealRow_(session.username, today, m.title, m.kcal, m.protein, m.carbs, m.fat));
  return { ok: true, meals: getMeals_(session.username, today) };
}

function deleteMeal(token, id, clientToday) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.MEAL_LOGS_SHEET);
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  if (sh) {
    const values = sh.getDataRange().getValues();
    for (let r = values.length - 1; r >= 1; r--) {
      if (normalize_(values[r][0]).toLowerCase() === session.username.toLowerCase() && normalize_(values[r][5]) === normalize_(id)) { sh.deleteRow(r + 1); break; }
    }
  }
  return { ok: true, meals: getMeals_(session.username, today) };
}

// Days with workout sets logged (w) or water drunk (h) — feeds the calendar dots.
function getActivityDays_(username) {
  const out = {}, me = username.toLowerCase();
  const mark = (day, k) => { if (!day) return; (out[day] || (out[day] = {}))[k] = 1; };
  const ex = getSS_().getSheetByName(CONFIG.EXERCISE_LOGS_SHEET);
  if (ex && ex.getLastRow() > 1) { const v = ex.getDataRange().getValues(); for (let r = 1; r < v.length; r++) if (normalize_(v[r][0]).toLowerCase() === me) mark(dateKey_(v[r][1]), 'w'); }
  const dn = getSS_().getSheetByName('WorkoutDone');
  if (dn && dn.getLastRow() > 1) { const v = dn.getDataRange().getValues(); for (let r = 1; r < v.length; r++) if (normalize_(v[r][0]).toLowerCase() === me) mark(dateKey_(v[r][1]), 'w'); }
  const wt = getSS_().getSheetByName(CONFIG.WATER_LOGS_SHEET);
  if (wt && wt.getLastRow() > 1) { const v = wt.getDataRange().getValues(); for (let r = 1; r < v.length; r++) if (normalize_(v[r][0]).toLowerCase() === me && safeNumber_(v[r][2], 0) > 0) mark(dateKey_(v[r][1]), 'h'); }
  return out;
}


// ---------------------------------------------------------------------------
// Persisted workout completion (replaces the old per-phone checkboxes)
// ---------------------------------------------------------------------------
function getDoneSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName('WorkoutDone');
  if (!sh) { sh = ss.insertSheet('WorkoutDone'); sh.getRange(1, 1, 1, 4).setValues([['Username', 'DateISO', 'Key', 'UpdatedAt']]); sh.getRange('B2:B').setNumberFormat('@'); sh.setFrozenRows(1); }
  return sh;
}
function getDoneToday_(username, today) {
  const sh = getSS_().getSheetByName('WorkoutDone');
  const day = isValidDateStr_(today) ? today : todayISO_();
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), me = username.toLowerCase(), out = [];
  for (let r = 1; r < v.length; r++) if (normalize_(v[r][0]).toLowerCase() === me && dateKey_(v[r][1]) === day) out.push(normalize_(v[r][2]));
  return out;
}
function setExerciseDone(token, key, done, clientToday) {
  const session = requireSession_(token);
  const day = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  key = normalize_(key).slice(0, 200);
  if (!key) throw new Error('حرکت مشخص نیست.');
  const sh = getDoneSheet_(), v = sh.getDataRange().getValues(), me = session.username.toLowerCase();
  let found = -1;
  for (let r = v.length - 1; r >= 1; r--) if (normalize_(v[r][0]).toLowerCase() === me && dateKey_(v[r][1]) === day && normalize_(v[r][2]) === key) { found = r + 1; break; }
  if (done && found < 0) { sh.appendRow([session.username, day, key, new Date().toISOString()]); sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(day); }
  if (!done && found > 0) sh.deleteRow(found);
  return { ok: true };
}
// { username(lowercase): number of distinct workout days in the last N days }
function doneCountsByUser_(days) {
  const sh = getSS_().getSheetByName('WorkoutDone'), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  const from = new Date(); from.setDate(from.getDate() - days);
  const fromStr = Utilities.formatDate(from, tz_(), 'yyyy-MM-dd'), seen = {};
  sh.getDataRange().getValues().slice(1).forEach(r => {
    const u = normalize_(r[0]).toLowerCase(), d = dateKey_(r[1]);
    if (!u || d < fromStr || seen[u + d]) return;
    seen[u + d] = 1; out[u] = (out[u] || 0) + 1;
  });
  return out;
}
function lastMessagesMap_() {
  const sh = getSS_().getSheetByName(CONFIG.MESSAGES_SHEET), out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getDataRange().getValues().slice(1).forEach(r => { const a = normalize_(r[0]).toLowerCase(); if (a) out[a] = { sender: normalize_(r[1]), at: normalize_(r[3]) }; });
  return out;
}
function getLastMessage_(username) { return lastMessagesMap_()[username.toLowerCase()] || null; }

// ---------------------------------------------------------------------------
// Smart reminders through a Telegram / Bale bot (checked every minute)
//  Script properties: TELEGRAM_BOT_TOKEN, BOT_USERNAME, BOT_PLATFORM (telegram|bale)
// ---------------------------------------------------------------------------
function botProps_() { return PropertiesService.getScriptProperties(); }
function botBase_() { return botProps_().getProperty('BOT_PLATFORM') === 'bale' ? 'https://tapi.bale.ai' : 'https://api.telegram.org'; }
function botCall_(token, method, payload) {
  const r = UrlFetchApp.fetch(botBase_() + '/bot' + token + '/' + method, { method: 'post', payload: payload || {}, muteHttpExceptions: true });
  try { return JSON.parse(r.getContentText()); } catch (e) { return { ok: false }; }
}
function getRemSheet_() {
  const ss = getSS_();
  let sh = ss.getSheetByName('Reminders');
  if (!sh) { sh = ss.insertSheet('Reminders'); sh.getRange(1, 1, 1, 3).setValues([['Username', 'ItemsJSON', 'UpdatedAt']]); sh.setFrozenRows(1); }
  return sh;
}
function remindersOf_(username) {
  const sh = getSS_().getSheetByName('Reminders');
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), me = username.toLowerCase();
  for (let r = 1; r < v.length; r++) if (normalize_(v[r][0]).toLowerCase() === me) { try { return JSON.parse(v[r][1]) || []; } catch (e) { return []; } }
  return [];
}
function getRemindersInfo_(username) {
  const p = botProps_(), rec = getUserRecord_(username);
  return { timeZone: Session.getScriptTimeZone(), configured: !!(p.getProperty('TELEGRAM_BOT_TOKEN') && p.getProperty('BOT_USERNAME')), platform: p.getProperty('BOT_PLATFORM') || 'telegram', linked: !!(rec && rec.telegramChatId), items: remindersOf_(username) };
}
function getBotLink(token) {
  const s = requireSession_(token), p = botProps_(), bot = p.getProperty('BOT_USERNAME');
  if (!p.getProperty('TELEGRAM_BOT_TOKEN') || !bot) throw new Error('ربات هنوز توسط مربی تنظیم نشده.');
  const code = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  CacheService.getScriptCache().put('link_' + code, s.username, 21600);
  return { url: (p.getProperty('BOT_PLATFORM') === 'bale' ? 'https://ble.ir/' : 'https://t.me/') + bot + '?start=' + code };
}
function unlinkBot(token) {
  const s = requireSession_(token), rec = getUserRecord_(s.username);
  if (rec) getSS_().getSheetByName(CONFIG.USERS_SHEET).getRange(rec.row, 7).setValue('');
  return { ok: true, reminders: getRemindersInfo_(s.username) };
}
function saveReminders(token, items) {
  const s = requireSession_(token), types = { workout: 1, water: 1, meal: 1, weight: 1, pill: 1, supplement: 1, nutrition: 1 };
  const clean = (Array.isArray(items) ? items : []).slice(0, 12).filter(i => i && types[i.type] && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(i.time))).map(i => ({ type: i.type, time: String(i.time), on: i.on !== false, daily: i.daily !== false, label: String(i.label == null ? '' : i.label).slice(0, 60) }));
  const sh = getRemSheet_(), v = sh.getDataRange().getValues(), me = s.username.toLowerCase();
  let row = -1; for (let r = 1; r < v.length; r++) if (normalize_(v[r][0]).toLowerCase() === me) { row = r + 1; break; }
  const vals = [[s.username, JSON.stringify(clean), new Date().toISOString()]];
  if (row > 0) sh.getRange(row, 1, 1, 3).setValues(vals); else sh.appendRow(vals[0]);
  return { ok: true, reminders: getRemindersInfo_(s.username) };
}
function installBotTrigger_() {
  ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'botTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('botTick').timeBased().everyMinutes(1).create();
}
function installBotTrigger() {
  installBotTrigger_();
  try { SpreadsheetApp.getUi().alert('ربات و یادآورهای هوشمند فعال شد (هر دقیقه بررسی می‌شه).'); } catch (e) {}
}

function getBotSettings(token) {
  requireAdmin_(token);
  const p = botProps_(), t = p.getProperty('TELEGRAM_BOT_TOKEN') || '';
  let trig = false; try { trig = ScriptApp.getProjectTriggers().some(x => x.getHandlerFunction() === 'botTick'); } catch (e) {}
  return { hasToken: !!t, tokenHint: t ? '••••' + t.slice(-4) : '', username: p.getProperty('BOT_USERNAME') || '', platform: p.getProperty('BOT_PLATFORM') || 'telegram', trigger: trig };
}
// Admin pastes the BotFather token in the app: verify it (getMe), store it, drop any webhook, start the 1-minute trigger.
function saveBotSettings(token, input) {
  requireAdmin_(token);
  input = input || {};
  const p = botProps_(), platform = input.platform === 'bale' ? 'bale' : 'telegram';
  const botToken = normalize_(input.botToken) || p.getProperty('TELEGRAM_BOT_TOKEN') || '';
  if (!/^\d+:[\w-]{20,}$/.test(botToken)) throw new Error('توکن ربات معتبر نیست؛ از BotFather کپی کن.');
  const base = platform === 'bale' ? 'https://tapi.bale.ai' : 'https://api.telegram.org';
  let me;
  try { me = JSON.parse(UrlFetchApp.fetch(base + '/bot' + botToken + '/getMe', { muteHttpExceptions: true }).getContentText()); } catch (e) { me = null; }
  if (!me || !me.ok || !me.result || !me.result.username) throw new Error('توکن تأیید نشد یا سرور ' + (platform === 'bale' ? 'بله' : 'تلگرام') + ' در دسترس نیست.');
  p.setProperties({ TELEGRAM_BOT_TOKEN: botToken, BOT_USERNAME: me.result.username, BOT_PLATFORM: platform, BOT_OFFSET: '0' });
  try { botCall_(botToken, 'deleteWebhook', {}); } catch (e) {}
  let triggerError = '';
  try { installBotTrigger_(); } catch (e) { triggerError = String(e.message || e); }
  const s = getBotSettings(token); s.triggerError = triggerError;
  return s;
}
function sendBotTest(token) {
  const s = requireAdmin_(token), rec = getUserRecord_(s.username), bt = botProps_().getProperty('TELEGRAM_BOT_TOKEN');
  if (!bt) throw new Error('اول ربات رو ذخیره کن.');
  if (!rec || !rec.telegramChatId) throw new Error('اول حساب خودت رو از همین صفحه (دکمه «اتصال») به ربات وصل کن.');
  const r = botCall_(bt, 'sendMessage', { chat_id: rec.telegramChatId, text: '✅ پیام آزمایشی Saeedi Fit Body — اتصال برقراره.' });
  if (!r.ok) throw new Error('ارسال نشد؛ ربات رو دوباره Start کن.');
  return { ok: true };
}
function botTick() {
  const token = botProps_().getProperty('TELEGRAM_BOT_TOKEN');
  if (!token) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(4000)) return;
  try {
    botProps_().setProperty('BOT_LAST_TICK',new Date().toISOString());
    try { var _pr = pollBotUpdates_(token); if (_pr && (_pr.n || _pr.error || _pr.api)) console.log('poll ' + JSON.stringify(_pr)); } catch (e) { console.log('poll ERR ' + (e && e.message)); }
    try { sendDueReminders_(token); } catch (e) {}
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
/* ---------- وب‌هوک تلگرام: پاسخ فوری بدون انتظار تریگر دقیقه‌ای ---------- */
/* ---- احراز هویت doPost (تلگرام/Worker) ---- */
function sfSafeEq_(a, b) {
  a = String(a == null ? '' : a); b = String(b == null ? '' : b);
  var d = a.length ^ b.length, n = Math.max(a.length, b.length);
  for (var i = 0; i < n; i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function sfPostAuthOk_(body, e) {
  var P = PropertiesService.getScriptProperties();
  if (P.getProperty('TG_AUTH_OFF') === '1') return true;          /* خاموش‌کردن موقت هنگام مهاجرت */
  var gasKey = P.getProperty('GAS_API_KEY') || '';
  if (!gasKey) return false;
  var k = (body && body.k) || (e && e.parameter && e.parameter.k) || '';
  return sfSafeEq_(k, gasKey);
}
function doPost(e) {
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { body = {}; }
    if (body && body.a === 'migration-read') return sfMigrationRead_(body);
    // احراز هویت: فقط درخواست‌هایی که کلید GAS_API_KEY دارند پذیرفته می‌شوند (بدون آن هر کسی می‌توانست آپدیت جعلی تلگرام بفرستد)
    var sfAuthNeeded = !!(body && ((body.a === 'tgForward' && body.update) || body.update_id));
    if (sfAuthNeeded && !sfPostAuthOk_(body, e)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'unauthorized' })).setMimeType(ContentService.MimeType.JSON);
    }
    if (body && body.a === 'program-request-mirror') return sfApiJson_(sfProgramRequestMirror_(body));
      // Worker integration: tgForward (forwarded update from Worker)
    if (body && body.a === 'tgForward' && body.update) {
      var t = sfTgToken_();
      if (t) sfTgWebhookUpdate_(t, body.update);
      return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
    }
    // Worker integration: purge (invalidate snapshot)
    if (body && body.a === 'purge') {
      return ContentService.createTextOutput(JSON.stringify({ok:true})).setMimeType(ContentService.MimeType.JSON);
    }
    // --- HTTP bridge for the Cloudflare/Sites front-end ---
    if (body && body.a === 'call') {
      var apiFn = String(body.fn || '');
      var apiArgs = Array.isArray(body.args) ? body.args : [];
      if (SF_API_ALLOWED_.indexOf(apiFn) < 0) return sfApiJson_({ ok: false, error: 'forbidden' });
      try {
        var apiOut = globalThis[apiFn].apply(null, apiArgs);
        return sfApiJson_({ ok: true, data: (apiOut === undefined ? null : apiOut) });
      } catch (apiErr) {
        try { sfErrNotify_('api:' + apiFn, apiErr, 'payload omitted'); } catch (eRep) {}
        return sfApiJson_({ ok: false, error: String((apiErr && apiErr.message) || apiErr) });
      }
    }
    // Legacy Telegram webhook
    if (body && body.update_id) {
      var t2 = sfTgToken_();
      if (t2) sfTgWebhookUpdate_(t2, body);
    }
  } catch (err) { try { sfErrNotify_('doPost', err, ''); } catch (eRep2) {} }
  return ContentService.createTextOutput('ok');
}
function sfTgWebhookUpdate_(t, u) {
  try {
    var cache = CacheService.getScriptCache();
    var uid = String(u.update_id);
    if (cache.get('wh_' + uid)) return;
    var handled = false;
    if (u.callback_query) {
      var cq = u.callback_query, data = String(cq.data || '');
      try { botCall_(t, 'answerCallbackQuery', { callback_query_id: cq.id }); } catch (e2) {}
      if (data.indexOf('cmd:') === 0 && cq.message && cq.message.chat) {
        sfTelegramCommand_(String(cq.message.chat.id), data.slice(4), '');
        handled = true;
      }
    } else if (u.message) {
      var m = u.message;
      if (m && m.text && m.chat && !m.reply_to_message) {
        var raw = String(m.text).trim();
        var parts = raw.split(' ');
        var head = String(parts[0] || '').split('@')[0].toLowerCase();
        if (head.indexOf('inv_') === 0) {
          try { sfStartInvite_(t, String(m.chat.id), head); } catch (e6) {}
          handled = true;
        }
        if (head === '/start' && parts.length > 1) {
          try { sfStartInvite_(t, String(m.chat.id), parts.slice(1).join(' ')); } catch (e5) {}
          handled = true;
        }
        if (head.charAt(0) === '/' && !(head === '/start' && parts.length > 1)) {
          sfTelegramCommand_(String(m.chat.id), raw, (m.from && m.from.username) || '');
          handled = true;
        }
      }
    }
    if (handled) { try { cache.put('wh_' + uid, '1', 21600); } catch (e3) {} }
  } catch (err) {}
}
/* روشن/خاموش کردن وب‌هوک (مربی) */
function sfBotWebhookSet(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const t = sfTgToken_();
  if (!t) throw new Error('توکن ربات تنظیم نشده.');
  let url = '';
  try { url = ScriptApp.getService().getUrl(); } catch (e) {}
  try { url = String(url).replace('script.google.com/macros/', 'script.googleusercontent.com/macros/'); } catch (e2) {}
  if (!url) throw new Error('آدرس سرویس در دسترس نیست.');
  const gk = PropertiesService.getScriptProperties().getProperty('GAS_API_KEY') || '';
  const hookUrl = gk ? url + (url.indexOf('?') > -1 ? '&' : '?') + 'k=' + encodeURIComponent(gk) : url;
  const res = botCall_(t, 'setWebhook', { url: hookUrl, drop_pending_updates: false, allowed_updates: JSON.stringify(['message', 'callback_query']) });
  const info = botCall_(t, 'getWebhookInfo', {});
  try { if (info && info.result && info.result.url) info.result.url = String(info.result.url).replace(/([?&]k=)[^&]*/, '$1***'); } catch (e3) {}
  return rpcSafe_({ ok: !!(res && res.ok), url: url, res: res, info: info });
}
function sfBotWebhookDel(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const t = sfTgToken_();
  const res = botCall_(t, 'deleteWebhook', { drop_pending_updates: false });
  return rpcSafe_({ ok: !!(res && res.ok), res: res, info: botCall_(t, 'getWebhookInfo', {}) });
}
/* آدرس وب‌هوک ربات (بدون ریدایرکت) */
function sfTgWebhookUrl_() {
  try {
    const u = String(ScriptApp.getService().getUrl() || "");
    return u.replace("script.google.com/macros/", "script.googleusercontent.com/macros/");
  } catch (e) { return ""; }
}
function pollBotUpdates_(token) {
  const p = botProps_();
  /* نکته: قفل از botTick گرفته می‌شود؛ گرفتن دوبارهٔ همان قفل اینجا همیشه شکست می‌خورد و باعث می‌شد آپدیت‌ها هرگز خوانده نشوند. */
  try {
    /* منوی «/» تلگرام و دکمهٔ مینی‌اپ را یک‌بار ثبت کن */
    try { if (typeof sfTgEnsureCommands_ === 'function') sfTgEnsureCommands_(token); } catch (e) {}
    const cache = CacheService.getScriptCache();
    /* آفست فقط از پراپرتی خوانده می‌شود؛ کش قدیمی می‌توانست از آپدیت‌ها جلو بزند. */
    const offset = Number(p.getProperty('BOT_OFFSET') || 0);
    let res = botCall_(token, 'getUpdates', { timeout: 0, limit: 20, offset: offset });
    let usedOffset = offset;
    /* اگر وب‌هوکی روشن باشد و کار نکند (تلگرام خطای ۴۰۹ می‌دهد)، حذفش می‌کنیم تا ربات با تریگر دقیقه‌ای کار کند */
    if (!res.ok && /409|webhook|hook is active/i.test(String(res.description || ''))) {
      botCall_(token, 'deleteWebhook', { drop_pending_updates: false });
      res = botCall_(token, 'getUpdates', { timeout: 0, limit: 20, offset: offset });
    }
    /*     /* خودترمیمی: اگر هیچ آپدیتی برنگشت ولی تلگرام پیام در صف دارد، از ابتدا می‌خوانیم —
       حداکثر هر ۵ دقیقه یک‌بار تا هر تیکِ بی‌دلیل، کل صف را دوباره نخواند.
       اگر خواندن با آفست 0 هم خالی ماند، یعنی یک «آپدیت شبح» در صف مانده (نوعی که
       در allowed_updates ربات مجاز نیست و هرگز مصرف نمی‌شود)؛ وب‌هوک را با
       allowed_updates:null بازنشانی می‌کنیم تا تلگرام آن را آزاد کند و pending صفر شود. */
    try {
      if (res.ok && (!res.result || !res.result.length) && !cache.get('sf_selfheal')) {
        var _info = botCall_(token, 'getWebhookInfo', {});
        var _pend = Number(_info && _info.result && _info.result.pending_update_count) || 0;
        if (_pend > 0) {
          cache.put('sf_selfheal', '1', 1800);
          res = botCall_(token, 'getUpdates', { timeout: 0, limit: 20, offset: 0 });
          usedOffset = 0;
          try { p.setProperty('BOT_OFFSET', '0'); } catch (e1) {}
          if (res.ok && (!res.result || !res.result.length)) {
            /* آپدیت‌های شبح معمولاً از نوع‌هایی هستند که در لیست پیش‌فرض getUpdates هم تحویل نمی‌شوند (تعویض اعضا/ ری‌اکشن)؛
               با setWebhook خالی، همین نوع‌ها را صریحاً مجاز می‌کنیم تا تلگرام آن آپدیت را تحویل دهد و شمارنده صفر شود. */
            botCall_(token, 'deleteWebhook', { drop_pending_updates: false, allowed_updates: null });
          }
        }
      }
    } catch (e1) {}    if (!res.ok) return { ok: false, api: res.description || '' };
    const list = res.result || [];
    if (!list.length) return { ok: true, n: 0 };
    let max = usedOffset - 1;
    list.forEach(function (u) { max = Math.max(max, u.update_id); });
    /* آفست همیشه جلو می‌رود؛ تکرار با کش wh_<id> جلوگیری می‌شود. */
    try { p.setProperty('BOT_OFFSET', String(max + 1)); } catch (e) {}
    try { p.setProperty('BOT_LAST_UPD', String(max)); } catch (e) {}
    try { cache.put('BOT_OFF_CACHE', String(max + 1), 21600); } catch (e) {}
    let done = 0;
    list.forEach(function (u) {
      if (cache.get('wh_' + u.update_id)) return;
      try {
        /* دکمه‌های شیشه‌ای */
        if (u.callback_query) {
          const cq = u.callback_query, data = String(cq.data || '');
          try { botCall_(token, 'answerCallbackQuery', { callback_query_id: cq.id }); } catch (e2) {}
          if (data.indexOf('cmd:') === 0 && cq.message && cq.message.chat && typeof sfTelegramCommand_ === 'function') {
            sfTelegramCommand_(String(cq.message.chat.id), data.slice(4), '');
          }
          done++;
          return;
        }
        const m = u.message;
        if (!m || !m.text || !m.chat) return;
        const chat = String(m.chat.id), parts = m.text.trim().split(/\s+/);
        /* پاسخ مربی با ریپلای روی پیام شاگرد → مستقیم به شاگرد ارسال شود */
        var replied = false;
        if (m.reply_to_message && m.reply_to_message.message_id) {
          try {
            const row = sfTgRowByChat_(chat);
            if (row && typeof sf7CoachReply_ === 'function') {
              const rr = sf7CoachReply_(chat, m.reply_to_message.message_id, m.text, row.username);
              if (rr && rr.ok) {
                botCall_(token, 'sendMessage', { chat_id: chat, text: '✅ پاسخ برای ' + rr.student + ' ارسال شد.' });
                done++; replied = true;
              }
            }
          } catch (e) {}
          if (replied) return;
          if (sfTgRowByChat_(chat) && sfTgThrottle_('tg_replyhint_' + chat, 86400)) {
            botCall_(token, 'sendMessage', { chat_id: chat, text: '↩️ روی پیامی ریپلای کردی که پیام شاگرد نیست. همان پیام شاگرد را ریپلای کن تا پاسخت برایش ارسال شود.' });
          }
        }
        /* فهرست نام‌کاربری‌های تلگرامی که با ربات حرف زده‌اند تا حساب مدیر شناسایی شود */
        try {
          const un = String((m.from && m.from.username) || '').toLowerCase();
          if (un) {
            const pp = PropertiesService.getScriptProperties();
            let dir = {}; try { dir = JSON.parse(pp.getProperty('TG_DIR') || '{}') || {}; } catch (e2) { dir = {}; }
            dir[un] = chat;
            const ks = Object.keys(dir);
            if (ks.length > 60) ks.slice(0, ks.length - 60).forEach(function (k) { delete dir[k]; });
            pp.setProperty('TG_DIR', JSON.stringify(dir));
            if (un === 'alii_saeedi') {
              const ids = (pp.getProperty('ADMIN_CHATS') || '').split(',').filter(Boolean);
              if (ids.indexOf(chat) < 0) { ids.push(chat); pp.setProperty('ADMIN_CHATS', ids.slice(-20).join(',')); }
            }
            try { if (!pp.getProperty('COACH_TELEGRAM_CHAT_ID')) pp.setProperty('COACH_TELEGRAM_CHAT_ID', chat); } catch (e3) {}
          }
        } catch (e) {}
        /* همان متن از همان چت در ۶۰ ثانیه فقط یک‌بار پردازش می‌شود */
        const tk = 'tgtext_' + chat + '_' + String(m.text.length) + '_' + String(m.text.slice(0, 24));
        if (cache.get(tk)) return;
        cache.put(tk, '1', 8);
        if (parts[0].split('@')[0] === '/start' && parts[1]) {
          const username = cache.get('link_' + parts[1].toUpperCase());
          const rec = username ? getUserRecord_(username) : null;
          if (rec) {
            getSS_().getSheetByName(CONFIG.USERS_SHEET).getRange(rec.row, 7).setValue(chat);
            cache.remove('link_' + parts[1].toUpperCase());
            botCall_(token, 'sendMessage', { chat_id: chat, text: '✅ حساب ' + rec.username + ' متصل شد. از این به بعد یادآورها و برنامه‌ها را همین‌جا می‌گیری.', reply_markup: JSON.stringify(sfTgKeyboard_(chat)) });
            if (typeof sfTelegramCommand_ === 'function') sfTelegramCommand_(chat, 'منو', rec.username);
          } else botCall_(token, 'sendMessage', { chat_id: chat, text: 'لینک اتصال منقضی شده؛ از داخل اپ دوباره دکمهٔ «اتصال» را بزن.' });
        } else if (parts[0].split('@')[0] === '/stop') {
          const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET), vv = sh.getDataRange().getValues();
          for (let r = 1; r < vv.length; r++) if (normalize_(vv[r][6]) === chat) sh.getRange(r + 1, 7).setValue('');
          botCall_(token, 'sendMessage', { chat_id: chat, text: 'یادآورها متوقف شد.' });
        } else if (typeof sfTelegramCommand_ === 'function') {
          sfTelegramCommand_(chat, m.text, (m.from && (m.from.username || m.from.first_name)) || '');
        } else {
          botCall_(token, 'sendMessage', { chat_id: chat, text: '🆔 آیدی عددی تلگرام تو: ' + chat });
        }
        done++;
        try { cache.put('wh_' + u.update_id, '1', 3600); } catch (e9) {}
      } catch (e) { try { p.setProperty('BOT_LAST_ERR', String(u.update_id) + ':' + String((e && (e.message || e)) || '').slice(0, 160)); } catch (e8) {} }
    });
    return { ok: true, n: done };
  } catch (e) { try { p.setProperty('BOT_LAST_ERR', 'poll:' + String((e && (e.message || e)) || '').slice(0, 150)); } catch (e1) {} return { ok: false, error: String(e && e.message) }; }
}

function sendDueReminders_(token) {
  const rem = getSS_().getSheetByName('Reminders');
  if (!rem || rem.getLastRow() < 2) return;
  const now = new Date(), nowMin = Number(Utilities.formatDate(now, tz_(), 'H')) * 60 + Number(Utilities.formatDate(now, tz_(), 'm'));
  const today = todayISO_(), cache = CacheService.getScriptCache(), chats = {};
  /* ثبت پایدار «امروز فرستاده شد» تا حتی با پاک‌شدن کش، پیام تکراری نرود. */
  const props = PropertiesService.getScriptProperties();
  var SENT_TODAY = {};
  try { SENT_TODAY = JSON.parse(props.getProperty('SENT_' + today) || '{}') || {}; } catch (e) { SENT_TODAY = {}; }
  getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1).forEach(r => { const id = normalize_(r[6]); if (id) chats[normalize_(r[0]).toLowerCase()] = id; });
  const jobs = [];
  rem.getDataRange().getValues().slice(1).forEach(row => {
    const username = normalize_(row[0]), chat = chats[username.toLowerCase()]; if (!chat) return;
    let items = []; try { items = JSON.parse(row[1]) || []; } catch (e) {}
    items.forEach(it => {
      if (it.on === false) return;
      /* یادآورهای «یک‌بار» فقط همان روز ثبت‌شدن می‌آیند؛ بقیه هر روز تکرار می‌شوند */
      if (it.daily === false && String(row[2] || '').slice(0, 10) !== today) return;
      /* ارقام فارسی/عربی و مقدار نامعتبر نباید باعث ارسال هر دقیقه شوند */
      const tstr = String(it.time == null ? '' : it.time)
        .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
        .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
      const p = tstr.split(':'), hh = Number(p[0]), mm = Number(p[1]);
      if (p.length < 2 || !isFinite(hh) || !isFinite(mm)) return;
      const diff = nowMin - (hh * 60 + mm);
      if (!isFinite(diff) || diff < 0 || diff > 3) return;
      const key = 'rm_' + username + '_' + it.type + '_' + tstr + '_' + today;
      if (cache.get(key) || SENT_TODAY[key]) return;
      let text = '';
      try { if (typeof sf7ReminderText_ === 'function') { const _c = sf7ReminderText_(it, username, today); if (_c) text = _c; } } catch (e) {}
      if (it.type === 'workout') { if (getDoneToday_(username, today).length) return; text = '🏋️ وقت تمرینه! بریم که امروز رو کامل کنیم.'; }
      else if (it.type === 'water') { const w = getWater_(username, today) || {}, g = Number(w.glasses || 0), goal = Number(w.goal || 8); if (g >= goal) return; text = '💧 یه لیوان آب بخور! الان ' + g + ' از ' + goal + ' لیوان.'; }
      else if (it.type === 'meal') text = '🍽️ وعدهٔ غذاییت رو توی اپ ثبت کن تا کالری و پروتئین امروزت دقیق بمونه.';
      else if (it.type === 'weight') { if (lastLogDate_(username) === today) return; text = '⚖️ وقت وزن‌کشیه! وزنت رو توی اپ ثبت کن.'; }
      else if (it.type === 'nutrition') text = '🍽️ یادآوری برنامهٔ تغذیه: ' + normalize_(it.label || 'برنامهٔ ثبت‌شدهٔ مربی را بررسی کنید.');
      else if (it.type === 'pill' || it.type === 'supplement') text = '🔔 یادآوری ثبت‌شدهٔ شما: ' + normalize_(it.label || 'برنامهٔ مکمل و داروی تجویزشده را بررسی کنید.');
      if (!text) return;
      /* اثرانگشت متن: همان متن در همان روز برای همان چت فقط یک‌بار */
      let tkey = '';
      try {
        const dig = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(text)).map(function (b) { return ((b < 0 ? b + 256 : b) + 256).toString(16).slice(1); }).join('');
        tkey = 'rmtxt_' + chat + '_' + dig + '_' + today;
        if (cache.get(tkey)) return;
      } catch (e) {}
      cache.put(key, '1', 21600);
      if (tkey) try { cache.put(tkey, '1', 43200); } catch (e2) {}
      SENT_TODAY[key] = 1;
      jobs.push({ url: botBase_() + '/bot' + token + '/sendMessage', method: 'post', payload: { chat_id: chat, text: text }, muteHttpExceptions: true });
    });
  });
  /* «امروز فرستاده شد» قبل از ارسال ذخیره می‌شود تا هیچ‌وقت دوباره ارسال نشود */
  try {
    props.setProperty('SENT_' + today, JSON.stringify(SENT_TODAY));
    props.getKeys().forEach(function (k) { if (String(k).indexOf('SENT_') === 0 && k !== 'SENT_' + today) props.deleteProperty(k); });
  } catch (e) {}
  if (jobs.length) UrlFetchApp.fetchAll(jobs);
}

function getBootstrap(token, clientToday) {
  const session = requireSession_(token);
  ensureAppSheets_();
  const profile = getProfile_(session.username);
  const assignments = getAssignedPlans_(session.username);
  // سیستم جدید برنامه‌ساز (TrainingModule.gs). اگر خطایی رخ دهد بقیه اپ سالم می‌ماند.
  // v13: همه‌ی برنامه‌ها از جدول‌های یکپارچه‌ی SF_ خوانده می‌شوند (کارت تکراری برنامه‌ساز حذف شد).
  const sfTraining = { plans: [], exercises: {}, today: {}, last: {}, date: '' };
  const resolved = resolveUserPlans_(session.username);

  const result = {
    user: { username: session.username, role: session.role, email: ((getUserRecord_(session.username) || {}).email || '') },
    profile,
    wellness: sfRefWellnessToday_(session.username,isValidDateStr_(clientToday)?clientToday:todayISO_()),
    profileHistory: getProfileHistory_(session.username),
    assignments,
    logs: getLogs_(session.username),
    streak: computeStreak_(session.username, clientToday),
    photos: getProgressPhotos_(session.username),
    planLibrary: listPlanNames_(),
    workouts: resolved.workout,
    sfTraining,
    diets: resolved.diet,
    supplements: resolved.supplement,
    water: getWater_(session.username, clientToday),
    meals: getMeals_(session.username, clientToday),
    activity: getActivityDays_(session.username),
    doneToday: getDoneToday_(session.username, clientToday),
    lastMessage: getLastMessage_(session.username),
    reminders: getRemindersInfo_(session.username),
    hasYouTubeKey: !!PropertiesService.getScriptProperties().getProperty('YT_KEY')
  };
  if (isCoach_(session)) { result.isCoach = true; result.athletes = getCoachAthletes_(session); }
  if (isAdmin_(session)) result.isAdmin = true;
  var __gate;
  try { __gate = sfGate_(session); } catch (eGate) { __gate = sfGateFallback_(); }
  if (!__gate || !__gate.features) __gate = sfGateFallback_();
  result.gate = __gate;
  if (!__gate.features.gif && !__gate.staff) {
    (result.workouts || []).forEach(function(plan) { (plan.days || []).forEach(function(day) { (day.exercises || []).forEach(function(ex) { if (ex.bank) { delete ex.bank.gif; delete ex.bank.frames; } }); }); });
  }
  return rpcSafe_(result);
}


/* ============================================================================
 * v12 — ادمین: دیدن داده‌های شاگرد + ورک‌شیت یکپارچه‌ی برنامه‌ها + گزارش/پاک‌سازی شیت‌ها
 * ========================================================================== */

/* برنامه‌ی مدرن (برنامه‌ساز) برای هر کاربر — آینه‌ی sfMyPlans ولی با نام کاربر */
function sfPlansForUser_(username, clientToday) {
  const u = normalize_(username).toLowerCase();
  if (!u) throw new Error('نام کاربری خالی است.');
  sfEnsure_();
  const mine = sfObjects_(sfRead_(SF.PLANS)).filter(function (p) {
    return normalize_(p.Username).toLowerCase() === u && sfIsTrue_(p.Active);
  });
  const built = sfBuildPlans_(mine, sfBankMap_());
  const today = sfClientToday_(clientToday);
  const prog = sfObjects_(sfRead_(SF.PROGRESS)).filter(function (o) {
    return normalize_(o.Username).toLowerCase() === u;
  });
  const todayMap = {};
  prog.filter(function (o) { return o.DateISO === today; }).forEach(function (o) {
    todayMap[sfProgressKey_(o.BlockID, Number(o.SetNo), Number(o.PosNo || 1), Number(o.StepNo || 0))] = {
      w: o.ActualWeightKg, r: o.ActualReps, done: sfIsTrue_(o.Completed)
    };
  });
  const lastByEx = {};
  prog.filter(function (o) { return o.DateISO !== today && o.ActualWeightKg !== '' && o.ExerciseID; }).forEach(function (o) {
    const cur = lastByEx[o.ExerciseID];
    if (!cur || o.DateISO > cur.date) lastByEx[o.ExerciseID] = { date: o.DateISO, sets: [] };
  });
  prog.filter(function (o) {
    return o.DateISO !== today && o.ExerciseID && lastByEx[o.ExerciseID] &&
      lastByEx[o.ExerciseID].date === o.DateISO && Number(o.StepNo || 0) === 0;
  }).forEach(function (o) {
    lastByEx[o.ExerciseID].sets.push({ setNo: Number(o.SetNo), w: o.ActualWeightKg, r: o.ActualReps });
  });
  Object.keys(lastByEx).forEach(function (k) { lastByEx[k].sets.sort(function (a, b) { return a.setNo - b.setNo; }); });
  return { plans: built.plans, exercises: built.exercises, today: todayMap, last: lastByEx, date: today };
}

/* همه‌ی داده‌های یک شاگرد برای نمایش در پنل ادمین */
function adminStudentPlans(token, username, clientToday) {
  requireAdmin_(token);
  const u = normalize_(username);
  if (!u) throw new Error('اول یک شاگرد را انتخاب کن.');
  const rec = getUserRecord_(u);
  if (!rec) throw new Error('این کاربر پیدا نشد.');
  ensureAppSheets_();
  const assignments = getAssignedPlans_(u);
  const sfTraining = { plans: [], exercises: {}, today: {}, last: {}, date: '' };
  const resolved = resolveUserPlans_(u);
  return rpcSafe_({
    user: { username: rec.username, role: rec.role || 'user' },
    profile: getProfile_(u),
    assignments: assignments,
    workouts: resolved.workout,
    sfTraining: sfTraining,
    diets: resolved.diet,
    supplements: resolved.supplement,
    doneToday: getDoneToday_(u, clientToday),
    water: getWater_(u, clientToday),
    logs: getLogs_(u),
    meals: getMeals_(u, clientToday),
    streak: computeStreak_(u, clientToday)
  });
}

/* فهرست شیت‌های سیستمی که هرگز نباید حذف/مخدوش شوند */
function appSystemSheets_() {
  return new Set([
    CONFIG.USERS_SHEET, CONFIG.DASHBOARD_SHEET, CONFIG.PROFILES_SHEET,
    CONFIG.PROFILE_HISTORY_SHEET, CONFIG.APP_LOGS_SHEET, CONFIG.WATER_LOGS_SHEET, CONFIG.MEAL_IMAGES_SHEET,
    CONFIG.MEDIA_CACHE_SHEET, CONFIG.MESSAGES_SHEET, CONFIG.PHOTOS_SHEET, CONFIG.COACH_NOTES_SHEET,
    CONFIG.EXERCISE_LOGS_SHEET, 'WorkoutDone', 'MelikaData',
    'SF_AssignedPlans'
  ].map(String));
}

/* شیت‌های آزمایشی/قدیمیِ بی‌استفاده که با تأیید صریح قابل حذف‌اند */
function sfExtraSheets_() {
  return ['SF_Probe', 'FoodLibrary', 'ExerciseLibrary', 'CheckIns', 'Notifications',
    'DailyLogs', 'WorkoutPlans', 'DietPlans', 'Supplements'];
}

function sheetIsEmpty_(sh) {
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 1 || lc < 1) return true;
  const v = sh.getRange(1, 1, Math.min(lr, 40), Math.min(lc, 8)).getDisplayValues();
  return !v.some(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
}

/* یک ورک‌شیت واحد: همه‌ی برنامه‌های تخصیص‌داده‌شده به همه‌ی شاگردها */

/* گزارش وضعیت همه‌ی ورک‌شیت‌ها + پیشنهاد حذف خالی‌ها */
function adminSheetReport(token) {
  requireAdmin_(token);
  const ss = getSS_();
  const system = appSystemSheets_();
  const label = { workout: 'برنامه تمرین', diet: 'برنامه غذا', supplement: 'مکمل' };
  const extras = sfExtraSheets_();
  const list = ss.getSheets().map(function (sh) {
    const name = sh.getName(), cols = sh.getLastColumn(), rows = Math.max(0, sh.getLastRow() - 1);
    const empty = sheetIsEmpty_(sh);
    let kind = 'سیستمی';
    if (extras.indexOf(name) >= 0) kind = (empty ? 'اضافی — خالی' : 'اضافی — قدیمی');
    else if (/^SF_/.test(name)) kind = 'برنامه‌ساز';
    else if (!system.has(name)) { try { kind = label[classifySheetContent_(name)] || 'دیگر'; } catch (e) { kind = 'دیگر'; } }
    return { name: name, rows: rows, cols: cols, kind: kind, empty: empty };
  });
  list.sort(function (a, b) { return a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind.localeCompare(b.kind); });
  const removable = list.filter(function (s) {
    return (s.empty && s.kind !== 'سیستمی' && s.kind !== 'برنامه‌ساز') || extras.indexOf(s.name) >= 0;
  }).map(function (s) { return s.name; });
  return {
    total: list.length,
    sheets: list.map(function (s) { return { name: s.name, rows: s.rows, cols: s.cols, kind: s.kind + (s.empty ? ' — خالی' : '') }; }),
    removable: removable
  };
}

/* حذف فقط ورک‌شیت‌های خالیِ غیرسیستمی (با محافظ) */
function adminDeleteSheets(token, names) {
  requireAdmin_(token);
  const ss = getSS_(), system = appSystemSheets_(), extras = sfExtraSheets_();
  const removed = [], skipped = [];
  (names || []).forEach(function (raw) {
    const n = String(raw || '').trim();
    if (!n) return;
    const sh = ss.getSheetByName(n);
    if (!sh) { skipped.push(n); return; }
    const nm = sh.getName();
    const isExtra = extras.indexOf(nm) >= 0;
    if (system.has(nm)) { skipped.push(nm); return; }
    if (/^SF_/.test(nm) && !isExtra) { skipped.push(nm); return; }
    if (ss.getSheets().length <= 1) { skipped.push(nm); return; }
    if (!isExtra && !sheetIsEmpty_(sh)) { skipped.push(nm + ' (خالی نیست)'); return; }
    ss.deleteSheet(sh); removed.push(nm);
  });
  return { removed: removed, skipped: skipped };
}


function adminNormalizeSheets(token) {
  requireAdmin_(token);
  return sf2NormalizeSheets_();
}

function sf2NormalizeSheets_() {
  var ss = getSS_();
  var norm = function (n) {
    return String(n == null ? '' : n).trim().replace(/\s+/g, ' ').replace(/تمیرنی/g, 'تمرینی').replace(/تمیرن/g, 'تمرین');
  };
  var report = { renamed: [], usersUpdated: 0, doneKeys: 0, trimmed: [] };
  var sheets = ss.getSheets();
  var names = sheets.map(function (s) { return s.getName(); });
  sheets.forEach(function (s) {
    var o = s.getName(); var n = norm(o);
    if (n !== o && names.indexOf(n) < 0) { s.setName(n); report.renamed.push(o + ' → ' + n); }
  });
  var us = ss.getSheetByName('Users');
  if (us) {
    var data = us.getDataRange().getValues();
    for (var r = 1; r < data.length; r++) {
      for (var c = 2; c <= 4; c++) {
        var raw = data[r][c]; var v = String(raw == null ? '' : raw);
        var nv = norm(v);
        if (nv !== v) { us.getRange(r + 1, c + 1).setValue(nv); report.usersUpdated++; }
      }
    }
  }
  var wd = ss.getSheetByName('WorkoutDone');
  if (wd) {
    var d2 = wd.getDataRange().getValues();
    for (var i = 1; i < d2.length; i++) {
      var k = String(d2[i][2] || ''); var n2 = norm(k);
      if (n2 !== k) { wd.getRange(i + 1, 3).setValue(n2); report.doneKeys++; }
    }
  }
  report.sheets = ss.getSheets().map(function (s) { return s.getName(); });
  report.total = report.sheets.length;
  return report;
}


/* ============================================================================
 * v13 — یکپارچه‌سازی: همه‌ی برنامه‌ها (تمرین/تغذیه/مکمل) در جدول‌های SF_ زندگی می‌کنند.
 * شیت‌های قدیمی برنامه‌ها بعد از مهاجرت با پیشوند «آرشیو — » کنار گذاشته می‌شوند
 * (محتوا پاک نمی‌شود؛ با adminRestoreArchivedSheets قابل بازگردانی است).
 * adminMigrateLegacyPlans(token, true) = فقط پیش‌نمایش، بدون هیچ نوشتنی.
 * ========================================================================== */

var SF_ARCHIVE_PREFIX_ = 'آرشیو — ';

function sfIsArchived_(name) { return String(normalize_(name)).indexOf('آرشیو') === 0; }
function sfSheetExists_(name) { return !!findSheet_(name); }
function sfIsFalseValue2_(v) { return String(normalize_(v)).toLowerCase() === 'false'; }

/* برآورد تعداد ست از متن شیت قدیمی (مثلاً "4" یا "3-4") */
function sfSetsCount_(ex, bankEx) {
  const nums = sfNumList_(ex && ex.sets).filter(function (n) { return n >= 1 && n <= 20; });
  if (nums.length) return Math.max.apply(null, nums);
  const b = bankEx ? Number(bankEx.SuggestedSets || bankEx.sets) : 0;
  if (b >= 1 && b <= 20) return b;
  return 4;
}
/* تکرار هر ست: اگر شیت «12-10-8» داده باشد به ترتیب ست‌ها می‌چرخد */
function sfRepsFor_(si, ex, bankEx) {
  const nums = sfNumList_(ex && ex.reps);
  if (nums.length) return String(nums[(si - 1) % nums.length]);
  const b = bankEx ? normalize_(bankEx.SuggestedReps || bankEx.reps) : '';
  return b || '10';
}

/* ----------------------------------------------------------------------------
 * خواندن یکپارچه‌ی برنامه‌های هر کاربر: جدول‌های SF_ اول، شیت‌های قدیمیِ مهاجرت‌نشده بعد
 * -------------------------------------------------------------------------- */
function resolveUserPlans_(username) {
  /* کش کوتاه‌مدت: برنامه‌های حل‌شده گران هستند و در یک نشست چند بار لازم می‌شوند. */
  const ck = 'rsv_ui3_' + normalize_(username).toLowerCase() + '_' + (typeof sf7PlanVer_ === 'function' ? sf7PlanVer_() : '1');
  try { const cc = CacheService.getScriptCache().get(ck); if (cc) return JSON.parse(cc); } catch (e) {}
  const a = getAssignedPlans_(username);
  const out = { workout: [], diet: [], supplement: [] };
  const sfW = [], sfD = [], sfS = [];
  try { sfW.push.apply(sfW, sfPlansAsLegacy_(username)); } catch (e) {}
  try { sfD.push.apply(sfD, sfDietsAsLegacy_(username)); } catch (e) {}
  try { sfS.push.apply(sfS, sfSuppsAsLegacy_(username)); } catch (e) {}
  const has = function (arr, name) { return arr.some(function (x) { return normalize_(x.name) === normalize_(name); }); };
  (a.workout || []).forEach(function (n) {
    if (has(sfW, n) || !sfSheetExists_(n)) return;
    try { sfW.push(sfAttachBank_(parseWorkoutSheet_(n))); } catch (e) {}
  });
  (a.diet || []).forEach(function (n) {
    if (has(sfD, n) || !sfSheetExists_(n)) return;
    try { sfD.push(parseDietSheet_(n)); } catch (e) {}
  });
  (a.supplement || []).forEach(function (n) {
    if (has(sfS, n) || !sfSheetExists_(n)) return;
    try { sfS.push(parseSupplementSheet_(n)); } catch (e) {}
  });
  out.workout = sfW; out.diet = sfD; out.supplement = sfS;
  try { const s = JSON.stringify(out); if (s.length < 95000) CacheService.getScriptCache().put(ck, s, 240); } catch (e) {}
  return out;
}

/* فهرست نام برنامه‌ها برای تخصیص در پنل ادمین: شیت‌های باقی‌مانده + جدول‌های SF_ */
function listPlanNames_() {
  const ckL = 'pln_' + (typeof sf7PlanVer_ === 'function' ? sf7PlanVer_() : '1');
  try { const c = CacheService.getScriptCache().get(ckL); if (c) return JSON.parse(c); } catch (e) {}
  const lib = listPlanSheets_();
  const sfW = {}, sfD = {}, sfS = {};
  try { sfObjects_(sfRead_(SF.PLANS)).forEach(function (p) { const n = normalize_(p.PlanName); if (n && sfIsTrue_(p.Active)) sfW[n] = 1; }); } catch (e) {}
  try { sfObjects_(sfRead_('SF_Diets')).forEach(function (r) { const n = normalize_(r.PlanName); if (n && !sfIsFalseValue2_(r.Active)) sfD[n] = 1; }); } catch (e) {}
  try { sfObjects_(sfRead_('SF_Supps')).forEach(function (r) { const n = normalize_(r.PlanName); if (n && !sfIsFalseValue2_(r.Active)) sfS[n] = 1; }); } catch (e) {}
  const merge = function (base, extra) {
    const out = (base || []).slice();
    Object.keys(extra).forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); });
    return out;
  };
  const res = { workout: merge(lib.workout, sfW), diet: merge(lib.diet, sfD), supplement: merge(lib.supplement, sfS) };
  try { CacheService.getScriptCache().put(ckL, JSON.stringify(res), 240); } catch (e) {}
  return res;
}

/* ----------------------------------------------------------------------------
 * مهاجرت: شیت‌های برنامه → جدول‌های SF_ (یک نسخه برای هر شاگردی که برنامه دارد)
 * dryRun=true → فقط گزارش، بدون هیچ تغییری در شیت‌ها.
 * -------------------------------------------------------------------------- */
/* ------------------------------------------------------------------
   حذف ردیف‌های یک ستون با مقدار مشخص (از پایین به بالا)
   ------------------------------------------------------------------ */
function sfDeleteBy_(sheetName, colName, value) {
  try {
    const rd = sfRead_(sheetName);
    const ci = rd.idx[colName];
    if (ci == null) return 0;
    const sh = rd.sh, rows = [];
    rd.rows.forEach(function (r, i) { if (normalize_(r[ci]) === normalize_(value)) rows.push(i + 2); });
    rows.sort(function (a, b) { return b - a; }).forEach(function (r) { try { sh.deleteRow(r); } catch (e) {} });
    return rows.length;
  } catch (e) { return 0; }
}

/* ------------------------------------------------------------------
   بازسازی برنامه‌ها از شیت‌های قدیمی (سوپرست «الف + ب» دیگر دو تا نمی‌شود)
   ------------------------------------------------------------------ */
function adminRebuildPlans(token, onlyPlan) {
  const session = requireAdmin_(token);
  sfEnsure_(); ensureAppSheets_();
  const out = { ok: true, rebuilt: [], errors: [] };
  const plans = sfObjects_(sfRead_(SF.PLANS));
  plans.forEach(function (p) {
    const pid = normalize_(p.PlanID);
    const planName = normalize_(p.PlanName);
    if (!pid) return;
    if (onlyPlan && normalize_(onlyPlan) !== planName) return;
    let srcName = "";
    const cands = ["آرشیو — " + planName, planName, "آرشیو —" + planName];
    for (let i = 0; i < cands.length; i++) { if (!srcName) { try { if (sfSheetExists_(cands[i])) srcName = cands[i]; } catch (e) {} } }
    if (!srcName) { out.errors.push(planName + ": شیت منبع پیدا نشد"); return; }
    try {
      const parsed = parseWorkoutSheet_(srcName);
      if (!parsed.days || !parsed.days.length) { out.errors.push(planName + ": برنامه‌ای خوانده نشد"); return; }
      const blockRows = [], itemRows = [], setRows = [], unmatched = {};
      let order = 0;
      parsed.days.forEach(function (day, di) {
        if (day.isRest) return;
        let inDay = 0;
        (day.exercises || []).forEach(function (ex) {
          const rawName = normalize_(ex.name);
          if (!rawName) return;
          let bankEx = sfBankByName_(rawName);
          if (!bankEx) {
            const parts = rawName.split("+").map(function (x) { return normalize_(x); }).filter(Boolean);
            for (let pi = 0; pi < parts.length; pi++) { const b = sfBankByName_(parts[pi]); if (b) { bankEx = b; break; } }
          }
          order++; inDay++;
          const blockId = pid + "-B" + order;
          const rest = bankEx && Number(bankEx.RestSec || bankEx.rest) > 0 ? Number(bankEx.RestSec || bankEx.rest) : 90;
          const nSets = sfSetsCount_(ex, bankEx);
          blockRows.push({
            BlockID: blockId, PlanID: pid, DayNo: String(di + 1), DayTitle: normalize_(day.title) || ("روز " + (di + 1)),
            OrderNo: String(inDay), Technique: "normal", BlockNotes: normalize_(ex.notes), RestBetweenSec: String(rest), Extra: ""
          });
          itemRows.push({
            ItemID: blockId + "-I1", BlockID: blockId, PlanID: pid, PosNo: "1",
            ExerciseID: bankEx ? normalize_(bankEx.ExerciseID) : "", ExerciseName: rawName,
            MuscleGroup: bankEx ? normalize_(bankEx.MuscleGroup) : "", Category: bankEx ? normalize_(bankEx.Category) : ""
          });
          for (let si = 1; si <= nSets; si++) {
            setRows.push({
              SetID: blockId + "-S" + si + "-1", BlockID: blockId, PlanID: pid, SetNo: String(si), PosNo: "1",
              ExerciseID: bankEx ? normalize_(bankEx.ExerciseID) : "", Reps: sfRepsFor_(si, ex, bankEx), TargetWeightKg: "",
              RestAfterSec: String(rest), Technique: "normal", Extra: ""
            });
          }
          if (!bankEx) unmatched[rawName] = (unmatched[rawName] || 0) + 1;
        });
      });
      if (!blockRows.length) { out.errors.push(planName + ": بلوکی ساخته نشد"); return; }
      sfDeleteBy_(SF.BLOCKS, "PlanID", pid);
      sfDeleteBy_(SF.ITEMS, "PlanID", pid);
      sfDeleteBy_(SF.SETS, "PlanID", pid);
      sfAppend_(SF.BLOCKS, blockRows);
      sfAppend_(SF.ITEMS, itemRows);
      sfAppend_(SF.SETS, setRows);
      out.rebuilt.push({ plan: planName, user: normalize_(p.Username), blocks: blockRows.length, sets: setRows.length, unmatched: unmatched });
    } catch (e) { out.errors.push(planName + ": " + (e && e.message)); }
  });
  try { if (typeof sf7BumpPlans_ === "function") sf7BumpPlans_(); } catch (e) {}
  return rpcSafe_(out);
}
function adminMigrateLegacyPlans(token, dryRun) {
  const session = requireAdmin_(token);
  const dry = !!dryRun;
  sfEnsure_();
  ensureAppSheets_();
  const now = new Date().toISOString();
  const who = (session && session.username) || 'admin';
  const users = sfObjects_(sfRead_(CONFIG.USERS_SHEET));
  const existingPlans = sfObjects_(sfRead_(SF.PLANS));
  const existingDiets = sfObjects_(sfRead_('SF_Diets'));
  const existingSupps = sfObjects_(sfRead_('SF_Supps'));
  const hasPlan = function (list, user, planName) {
    return list.some(function (p) {
      return normalize_(p.Username).toLowerCase() === normalize_(user).toLowerCase() && normalize_(p.PlanName) === normalize_(planName);
    });
  };
  const sum = { dryRun: dry, users: 0, workoutPlans: 0, workoutBlocks: 0, workoutSets: 0, dietPlans: 0, dietRows: 0,
    suppPlans: 0, suppRows: 0, unmatchedExercises: [], preview: [], errors: [] };
  const touched = {}, failed = {}, unmatched = {};

  users.forEach(function (u) {
    const name = normalize_(u.user || u.Username);
    if (!name || String(u.role || '').toLowerCase() === 'admin') return;
    const a = getAssignedPlans_(name);
    let any = false;

    (a.workout || []).forEach(function (sheetName) {
      const sName = normalize_(sheetName);
      if (!sfSheetExists_(sName)) { failed[sName] = 1; return; }
      if (hasPlan(existingPlans, name, sName)) { touched[sName] = 1; return; }
      try {
        const parsed = parseWorkoutSheet_(sName);
        if (!parsed.days || !parsed.days.length) { failed[sName] = 1; return; }
        const planId = sfNewPlanId_();
        const blockRows = [], itemRows = [], setRows = [];
        const noBank = [];
        let order = 0;
        parsed.days.forEach(function (day, di) {
          if (day.isRest) return;
          let inDay = 0;
          (day.exercises || []).forEach(function (ex) {
            const rawName = normalize_(ex.name);
            if (!rawName) return;
            /* «الف + ب» (سوپرست): اگر هر دو بخش در بانک حرکات پیدا شد به دو حرکت جدا
               شکسته می‌شود (هر کدام گیف خودش را می‌گیرد)، وگرنه متن کامل حفظ می‌شود. */
            /* سوپرست («الف + ب») یک حرکت می‌ماند و دو تا نمی‌شود؛ فقط تصویر از بخش اول برداشته می‌شود */
            let names = [rawName], banks = [sfBankByName_(rawName)];
            if (!banks[0]) {
              const parts = rawName.split('+').map(function (x) { return normalize_(x); }).filter(Boolean);
              for (let pi = 0; pi < parts.length; pi++) { const b = sfBankByName_(parts[pi]); if (b) { banks[0] = b; break; } }
            }

            names.forEach(function (exName, ni) {
              const bankEx = banks[ni];
              order++; inDay++;
              const blockId = planId + '-B' + order;
              if (!bankEx) { noBank.push(exName); unmatched[exName] = (unmatched[exName] || 0) + 1; }
              const rest = bankEx && Number(bankEx.RestSec || bankEx.rest) > 0 ? Number(bankEx.RestSec || bankEx.rest) : 90;
              const nSets = sfSetsCount_(ex, bankEx);
              blockRows.push({
                BlockID: blockId, PlanID: planId, DayNo: String(di + 1), DayTitle: normalize_(day.title) || ('روز ' + (di + 1)),
                OrderNo: String(inDay), Technique: 'normal', BlockNotes: normalize_(ex.notes), RestBetweenSec: String(rest), Extra: ''
              });
              itemRows.push({
                ItemID: blockId + '-I1', BlockID: blockId, PlanID: planId, PosNo: '1',
                ExerciseID: bankEx ? normalize_(bankEx.ExerciseID) : '', ExerciseName: exName,
                MuscleGroup: bankEx ? normalize_(bankEx.MuscleGroup) : '', Category: bankEx ? normalize_(bankEx.Category) : ''
              });
              for (let si = 1; si <= nSets; si++) {
                setRows.push({
                  SetID: blockId + '-S' + si + '-1', BlockID: blockId, PlanID: planId, SetNo: String(si), PosNo: '1',
                  ExerciseID: bankEx ? normalize_(bankEx.ExerciseID) : '', Reps: sfRepsFor_(si, ex, bankEx), TargetWeightKg: '',
                  RestAfterSec: String(rest), Technique: 'normal', Extra: ''
                });
              }
            });
          });
        });
        if (!blockRows.length) { failed[sName] = 1; return; }
        if (sum.preview.length < 40) sum.preview.push({ user: name, plan: sName, days: parsed.days.length, blocks: blockRows.length, sets: setRows.length, noBank: noBank });
        if (!dry) {
          sfAppend_(SF.PLANS, [{ PlanID: planId, Username: name, PlanName: sName, Goal: '', Level: '', Active: 'TRUE',
            CreatedAt: now, UpdatedAt: now, CreatedBy: who, CoachNotes: (parsed.notes || []).join(' | ') }]);
          sfAppend_(SF.BLOCKS, blockRows);
          sfAppend_(SF.ITEMS, itemRows);
          sfAppend_(SF.SETS, setRows);
        }
        existingPlans.push({ PlanID: planId, Username: name, PlanName: sName, Active: 'TRUE' });
        sum.workoutPlans++; sum.workoutBlocks += blockRows.length; sum.workoutSets += setRows.length;
        touched[sName] = 1; any = true;
      } catch (e) { failed[sName] = 1; sum.errors.push(name + ' / ' + sName + ': ' + (e && e.message)); }
    });

    (a.diet || []).forEach(function (sheetName) {
      const sName = normalize_(sheetName);
      if (!sfSheetExists_(sName)) { failed[sName] = 1; return; }
      if (hasPlan(existingDiets, name, sName)) { touched[sName] = 1; return; }
      try {
        const parsed = parseDietSheet_(sName);
        if (!parsed.sections || !parsed.sections.length) { failed[sName] = 1; return; }
        const dietId = 'D-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
        const rows = [];
        parsed.sections.forEach(function (sec, si) {
          (sec.items || []).forEach(function (it, ii) {
            rows.push({
              DietID: dietId, Username: name, PlanName: sName, SectionNo: String(si + 1), SectionTitle: normalize_(sec.title) || 'برنامه',
              ItemNo: String(ii + 1), ItemTitle: normalize_(it.title) || 'گزینه', Description: normalize_(it.description),
              Kcal: it.kcal == null ? '' : String(it.kcal), Active: 'TRUE', CreatedAt: now, UpdatedAt: now
            });
          });
        });
        if (!rows.length) { failed[sName] = 1; return; }
        if (!dry) { sfAppend_('SF_Diets', rows); }
        existingDiets.push({ Username: name, PlanName: sName });
        sum.dietPlans++; sum.dietRows += rows.length;
        touched[sName] = 1; any = true;
      } catch (e) { failed[sName] = 1; sum.errors.push(name + ' / ' + sName + ': ' + (e && e.message)); }
    });

    (a.supplement || []).forEach(function (sheetName) {
      const sName = normalize_(sheetName);
      if (!sfSheetExists_(sName)) { failed[sName] = 1; return; }
      if (hasPlan(existingSupps, name, sName)) { touched[sName] = 1; return; }
      try {
        const parsed = parseSupplementSheet_(sName);
        const suppId = 'S-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000);
        const rows = [];
        (parsed.schedule || []).forEach(function (b, bi) {
          (b.items || []).forEach(function (txt, ii) {
            rows.push({ SuppID: suppId, Username: name, PlanName: sName, Kind: 'schedule', SectionNo: String(bi + 1),
              SectionTitle: normalize_(b.timing) || 'نامشخص', ItemNo: String(ii + 1), Name: normalize_(txt), Detail: '', Timing: '', Extra: '',
              Active: 'TRUE', CreatedAt: now, UpdatedAt: now });
          });
        });
        (parsed.groups || []).forEach(function (g, gi) {
          (g.items || []).forEach(function (it, ii) {
            rows.push({ SuppID: suppId, Username: name, PlanName: sName, Kind: 'group', SectionNo: String(gi + 1),
              SectionTitle: normalize_(g.title) || 'مکمل‌های دیگر', ItemNo: String(ii + 1), Name: normalize_(it.name), Detail: '',
              Timing: (it.timings || []).join('، '), Extra: '', Active: 'TRUE', CreatedAt: now, UpdatedAt: now });
          });
        });
        (parsed.items || []).forEach(function (it, ii) {
          rows.push({ SuppID: suppId, Username: name, PlanName: sName, Kind: 'item', SectionNo: '1',
            SectionTitle: normalize_(it.category), ItemNo: String(ii + 1), Name: normalize_(it.name), Detail: normalize_(it.dosage),
            Timing: normalize_(it.timing), Extra: normalize_(it.instructions), Active: 'TRUE', CreatedAt: now, UpdatedAt: now });
        });
        if (!rows.length) { failed[sName] = 1; return; }
        if (!dry) { sfAppend_('SF_Supps', rows); }
        existingSupps.push({ Username: name, PlanName: sName });
        sum.suppPlans++; sum.suppRows += rows.length;
        touched[sName] = 1; any = true;
      } catch (e) { failed[sName] = 1; sum.errors.push(name + ' / ' + sName + ': ' + (e && e.message)); }
    });

    if (any) sum.users++;
  });

  /* آرشیو کردن شیت‌های قدیمیِ مهاجرت‌شده (فقط اگر خطایی نداشته باشند) */
  const ss = getSS_();
  const archived = [];
  if (!dry) {
    Object.keys(touched).forEach(function (n) {
      if (failed[n]) return;
      const sh = ss.getSheetByName(n);
      if (!sh) return;
      if (sfIsArchived_(sh.getName())) return;
      try { sh.setName(SF_ARCHIVE_PREFIX_ + sh.getName()); archived.push(n); } catch (e) { sum.errors.push('آرشیو ' + n + ': ' + (e && e.message)); }
    });
  }
  sum.archived = archived;
  sum.archivedPlanned = dry ? Object.keys(touched).filter(function (n) { return !failed[n]; }) : [];
  sum.failedSheets = Object.keys(failed);
  sum.unmatchedExercises = Object.keys(unmatched).map(function (n) { return n + ' (' + unmatched[n] + ')'; }).sort();
  return sum;
}

/* بازگردانی شیت‌های آرشیوشده (پشتیبان‌گیری — قبل از حذف احتمالی) */
function adminRestoreArchivedSheets(token) {
  requireAdmin_(token);
  const ss = getSS_();
  const back = [];
  ss.getSheets().forEach(function (sh) {
    const n = sh.getName();
    if (sfIsArchived_(n)) {
      const clean = n.replace(/^آرشیو\s*—\s*/, '').trim();
      if (clean && !ss.getSheetByName(clean)) { try { sh.setName(clean); back.push(clean); } catch (e) {} }
    }
  });
  return { restored: back };
}

/* مرتب‌کردن ترتیب تب‌ها: سیستم → برنامه‌ساز → برنامه‌های قدیمی → آرشیو */
function adminTidySheets(token) {
  requireAdmin_(token);
  const ss = getSS_();
  const first = ['Users', 'AppProfiles', 'ProfileHistory', 'WorkoutDone', 'ExerciseLogs', 'MealLogs', 'AppWaterLogs',
    'Messages', 'CoachNotes', 'ProgressPhotos', 'MealImages', 'MediaCache', 'Reminders', 'AppLogs', 'Dashboard'];
  const sfOrder = ['SF_ExerciseBank', 'SF_Plans', 'SF_Blocks', 'SF_BlockItems', 'SF_Sets', 'SF_Diets', 'SF_Supps', 'SF_Progress', 'SF_AssignedPlans'];
  const rank = function (sh) {
    const n = sh.getName();
    if (sfIsArchived_(n)) return 3;
    if (first.indexOf(n) >= 0) return 0;
    if (sfOrder.indexOf(n) >= 0 || /^SF_/.test(n)) return 1;
    return 2;
  };
  const pos = function (sh) {
    const n = sh.getName(); const r = rank(sh);
    if (r === 0) return first.indexOf(n);
    if (r === 1) { const j = sfOrder.indexOf(n); return j < 0 ? 50 : j; }
    return 0;
  };
  const ordered = ss.getSheets().slice().sort(function (a, b) {
    const ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra - rb;
    const pa = pos(a), pb = pos(b);
    if (pa !== pb) return pa - pb;
    return a.getName().localeCompare(b.getName());
  });
  ordered.forEach(function (sh, i) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); });
  ss.setActiveSheet(ordered[0]);
  return { order: ordered.map(function (s) { return s.getName(); }) };
}

/* گزارش یکپارچه‌ی برنامه‌های شاگردان — همه از یک منبع واحد */
function adminExportAssignedPlans(token) {
  requireAdmin_(token);
  ensureAppSheets_();
  sfEnsure_();
  const users = adminListUsers(token);
  const now = Utilities.formatDate(new Date(), tz_(), 'yyyy-MM-dd HH:mm');
  const rows = [['شاگرد', 'نقش', 'نوع برنامه', 'نام برنامه', 'جزئیات', 'منبع', 'وضعیت', 'بروزرسانی']];
  let cnt = 0;
  users.forEach(function (u) {
    const res = resolveUserPlans_(u.username);
    (res.workout || []).forEach(function (w) {
      const days = (w.days || []).length;
      const exs = (w.days || []).reduce(function (s, d) { return s + ((d.exercises || []).length); }, 0);
      rows.push([u.username, u.role || 'user', 'تمرین', w.name, days + ' روز / ' + exs + ' حرکت', 'یکپارچه (SF_)', 'فعال', now]); cnt++;
    });
    (res.diet || []).forEach(function (d) {
      rows.push([u.username, u.role || 'user', 'تغذیه', d.name, (d.sections || []).length + ' بخش', 'یکپارچه (SF_)', 'فعال', now]); cnt++;
    });
    (res.supplement || []).forEach(function (s) {
      const groups = (s.groups || []).length + (s.schedule || []).length + (s.items || []).length;
      rows.push([u.username, u.role || 'user', 'مکمل', s.name, groups + ' بخش', 'یکپارچه (SF_)', 'فعال', now]); cnt++;
    });
  });
  const ss = getSS_();
  let sh = ss.getSheetByName('SF_AssignedPlans');
  if (!sh) sh = ss.insertSheet('SF_AssignedPlans');
  sh.clear();
  sh.getRange(1, 1, rows.length, 8).setValues(rows);
  sh.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#1b2a41').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  try { sh.autoResizeColumns(1, 8); } catch (e) {}
  return { ok: true, sheet: 'SF_AssignedPlans', rows: cnt, users: users.length, url: ss.getUrl() + '#gid=' + sh.getSheetId() };
}

/* پیوند مجدد حرکاتِ برنامه‌ها به بانک حرکات (وقتی گیف/حرکت تازه اضافه می‌شود مفید است) */
function adminRematchPlans(token, dryRun) {
  requireAdmin_(token);
  sfEnsure_();
  const dry = !!dryRun;
  const itemsRd = sfRead_(SF.ITEMS);
  const iIdCol = itemsRd.idx['ExerciseID'], iNameCol = itemsRd.idx['ExerciseName'], iBlockCol = itemsRd.idx['BlockID'];
  const blockToId = {};
  const newVals = [], changes = [];
  let changed = 0, unmatched = 0, withMedia = 0;
  itemsRd.rows.forEach(function (row) {
    const first = normalize_(row[0]);
    if (!first) { newVals.push([row[iIdCol] == null ? '' : row[iIdCol]]); return; }
    const name = normalize_(row[iNameCol]);
    const b = sfBankByName_(name);
    const newId = b ? normalize_(b.ExerciseID) : '';
    const oldId = normalize_(row[iIdCol]);
    newVals.push([newId]);
    if (b && b.gif && b.gif.length) withMedia++;
    if (oldId !== newId) {
      changed++;
      if (!newId) unmatched++;
      if (changes.length < 60) changes.push({ name: name, from: oldId, to: newId, bank: b ? normalize_(b.PersianName) : '' });
    }
    const bid = normalize_(row[iBlockCol]);
    if (bid) blockToId[bid] = newId;
  });
  const setsRd = sfRead_(SF.SETS);
  const sIdCol = setsRd.idx['ExerciseID'], sBlockCol = setsRd.idx['BlockID'];
  const setVals = setsRd.rows.map(function (row) {
    if (!normalize_(row[0])) return [row[sIdCol] == null ? '' : row[sIdCol]];
    const bid = normalize_(row[sBlockCol]);
    return [blockToId[bid] !== undefined ? blockToId[bid] : normalize_(row[sIdCol])];
  });
  if (!dry) {
    if (newVals.length) itemsRd.sh.getRange(2, iIdCol + 1, newVals.length, 1).setValues(newVals);
    if (setVals.length) setsRd.sh.getRange(2, sIdCol + 1, setVals.length, 1).setValues(setVals);
  }
  return { dryRun: dry, items: itemsRd.rows.length, sets: setsRd.rows.length, changed: changed, unmatched: unmatched,
    withMedia: withMedia, changes: changes };
}


/* اصلاح ساختار شیت پروفایل‌ها: سرستون‌ها با PROFILE_HEADERS هم‌تراز و ردیف‌های قدیمی (بدون GoalWeightKg) جابه‌جا می‌شوند */
function isOldProfileRow_(row) {
  const g = function (i) { return row[i] == null ? '' : row[i]; };
  const n6 = Number(String(g(6)).replace(/[^0-9.\-]/g, ''));
  const n8 = Number(String(g(8)).replace(/[^0-9.\-]/g, ''));
  if (n8 > 600) return true;                                        /* BMR در جایگاه ۸ = چیدمان قدیمی */
  if (n6 >= 1 && n6 <= 2.5 && String(g(8)).length > 0) return true; /* activity در جایگاه ۶ */
  return false;
}
function adminRepairProfiles(token, dryRun) {
  requireAdmin_(token);
  const dry = !!dryRun;
  const sh = getSS_().getSheetByName(CONFIG.PROFILES_SHEET);
  if (!sh) throw new Error('شیت پروفایل‌ها پیدا نشد.');
  const values = sh.getDataRange().getValues();
  if (!values.length) return { headerOk: true, headerFixed: false, rows: 0, fixedRows: [], dryRun: dry };
  const head = values[0].map(function (v) { return normalize_(v); });
  const headerOk = head.length >= PROFILE_HEADERS.length && PROFILE_HEADERS.every(function (h, i) { return head[i] === h; });
  const out = values.map(function (r, i) { return i === 0 ? PROFILE_HEADERS.slice() : r.slice(); });
  const fixedRows = [];
  /* ردیف‌های قدیمی در هر حالت بررسی می‌شوند */
  {
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!normalize_(row[0])) continue;
      if (!isOldProfileRow_(row)) continue;
      const g = function (i) { return row[i] == null ? '' : row[i]; };
      out[r] = [
        g(0), g(1), g(2), Math.round(safeNumber_(g(3), 25)), safeNumber_(g(4), 175), safeNumber_(g(5), 75),
        safeNumber_(g(5), 75), safeNumber_(g(6), 1.55), normalize_(g(7)) || 'maintain',
        safeNumber_(g(8), 0), safeNumber_(g(9), 0), safeNumber_(g(10), 0), safeNumber_(g(11), 0),
        safeNumber_(g(12), 0), safeNumber_(g(13), 0), safeNumber_(g(14), 8), normalize_(g(15)), normalize_(g(16))
      ];
      fixedRows.push({ username: normalize_(g(0)), targetCalories: out[r][11] });
    }
  }
  if (!dry) {
    let width = PROFILE_HEADERS.length;
    out.forEach(function (r) { if (r.length > width) width = r.length; });
    const padded = out.map(function (r) { const c = r.slice(); while (c.length < width) c.push(''); return c; });
    sh.getRange(1, 1, padded.length, width).setValues(padded);
    ensureProfileAvatarHeader_();
  }
  return { headerOk: headerOk, headerFixed: !headerOk, rows: values.length - 1, fixedRows: fixedRows, dryRun: dry };
}




// ===== Added capabilities: Invite system =====

function sfAddDaysISO_(iso, n) {
  const d = new Date(String(iso || todayISO_()) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + (n || 0));
  return d.toISOString().slice(0, 10);
}

function sfUpdateSheet_(name, predicate, patch) {
  const rd = sfRead_(name);
  const sh = rd.sh;
  if (rd.rows.length === 0) return false;
  let updated = false;
  for (let i = 0; i < rd.rows.length; i++) {
    const obj = sfObj_(rd, rd.rows[i]);
    if (predicate(obj)) {
      const row = i + 2; // header is row 1
      const cur = sh.getRange(row, 1, 1, rd.headers.length).getValues()[0];
      rd.headers.forEach((h, c) => {
        if (patch[h] !== undefined) cur[c] = patch[h];
      });
      sh.getRange(row, 1, 1, rd.headers.length).setValues([cur]);
      updated = true;
    }
  }
  return updated;
}

function sfInviteCreate_(coach, packageId, expiresInDays) {
  const token = Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  const expires = sfAddDaysISO_(todayISO_(), expiresInDays || 7);
  sfAppend_('SF_Invites', [{
    Token: token, Coach: normalize_(coach), PackageID: normalize_(packageId) || '',
    ExpiresAt: expires, UsedBy: '', CreatedAt: new Date().toISOString(), Status: 'active'
  }]);
  return { ok: true, token: token };
}

function sfInviteInfo(token) {
  token = normalize_(token);
  if (!token) throw new Error('لینک دعوت نامعتبر است.');
  const rd = sfRead_('SF_Invites');
  const rows = sfObjects_(rd);
  const inv = rows.find(r => normalize_(r.Token) === token);
  if (!inv) throw new Error('این لینک دعوت وجود ندارد.');
  if (normalize_(inv.Status).toLowerCase() !== 'active') throw new Error('این لینک دعوت قبلاً استفاده شده است.');
  const exp = normalize_(inv.ExpiresAt);
  if (exp && exp < todayISO_()) throw new Error('این لینک دعوت منقضی شده است.');
  // package info
  const pkgRd = sfRead_('SF_Packages');
  const pkgs = sfObjects_(pkgRd);
  const pkg = pkgs.find(p => normalize_(p.PackageID) === normalize_(inv.PackageID));
  return {
    ok: true, token: token,
    coach: normalize_(inv.Coach),
    package: pkg ? { id: normalize_(pkg.PackageID), name: normalize_(pkg.Name), days: Number(pkg.Days) || 30, price: Number(pkg.Price) || 0 } : null
  };
}

function sfRegister(inviteToken, form) {
  form = form || {};
  const info = sfInviteInfo(inviteToken);
  const username = normalize_(form.username).toLowerCase();
  if (!username) throw new Error('نام کاربری الزامی است.');
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) throw new Error('نام کاربری باید ۳ تا ۴۰ کاراکتر لاتین/عدد باشد.');
  if (String(form.password || '').trim().length < 6) throw new Error('رمز عبور حداقل ۶ کاراکتر باشد.');
  if (!normalize_(form.name)) throw new Error('نام را وارد کنید.');
  // check unique username
  const sh = getSS_().getSheetByName('Users');
  const vals = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < vals.length; i++) {
    if (normalize_(vals[i][0]).toLowerCase() === username) throw new Error('این نام کاربری قبلاً گرفته شده است.');
  }
  const chatId = normalize_(form.telegramChatId);
  // append user
  const row = Math.max(sh.getLastRow() + 1, 2);
  const rowData = [username, makeSaltedHash_(String(form.password).trim()), '', '', '', 'user', chatId, normalize_(form.email), normalize_(info.coach)];
  sh.getRange(row, 1, 1, rowData.length).setValues([rowData]);
  // profile
  const profile = {
    Username: username, Name: normalize_(form.name), Gender: normalize_(form.gender) || 'male',
    Age: Number(form.age) || 0, HeightCm: Number(form.height) || 0, WeightKg: Number(form.weight) || 0,
    GoalWeightKg: Number(form.goalWeight) || 0, Activity: Number(form.activity) || 1.375,
    Goal: normalize_(form.goal), WaterGoal: 8, UpdatedAt: new Date().toISOString(), AvatarURL: ''
  };
  const m = calculateMetrics_({ gender: profile.Gender === 'female' ? 'f' : 'm', age: profile.Age,
    height: profile.HeightCm, weight: profile.WeightKg, activity: profile.Activity, goal: profile.Goal });
  Object.assign(profile, m);
  sfAppend_('AppProfiles', [profile]);
  if (Number(form.weight) > 0) {
    sfAppend_('ProfileHistory', [{ Username: username, DateISO: todayISO_(), WeightKg: Number(form.weight), BMI: m.bmi, TargetCalories: m.targetCalories, CreatedAt: new Date().toISOString() }]);
  }
  // mark invite used
  sfUpdateSheet_('SF_Invites', r => normalize_(r.Token) === inviteToken, { UsedBy: username, Status: 'used' });
  // create subscription if package
  if (info.package) {
    sfAppend_('SF_Subs', [{ SubID: Utilities.getUuid().slice(0,8), Username: username, PackageID: info.package.id, StartDate: todayISO_(), EndDate: sfAddDaysISO_(todayISO_(), info.package.days), Status: 'active', Source: 'invite', CreatedAt: new Date().toISOString() }]);
    sfAppend_('SF_Audit', [{ Time: new Date().toISOString(), Actor: username, Entity: 'sub', Id: username, Old: 'none', New: 'active', Reason: 'invite:' + inviteToken }]);
  }
  return { ok: true, username: username };
}


// ===== Added capabilities: PR tracking & Risk scoring =====

function sfEpley_(w, reps) {
  if (!w || !reps || reps > 12) return 0;
  return Math.round(w * (1 + reps / 30) * 10) / 10;
}

function sfDetectPR_(username, exerciseId, exerciseName, weight, reps) {
  if (!weight || !reps) return [];
  const u = normalize_(username).toLowerCase();
  const rd = sfRead_('SF_Progress');
  const rows = sfObjects_(rd).filter(r => normalize_(r.Username).toLowerCase() === u && normalize_(r.ExerciseID) === normalize_(exerciseId) && String(r.Completed).toLowerCase() === 'true');
  const prs = [];
  const maxW = Math.max.apply(null, rows.map(r => Number(r.ActualWeightKg) || 0).concat([0]));
  if (weight > maxW && maxW > 0) { prs.push({ type: 'weight', value: weight }); sfAppend_('SF_PRs', [{ Username: username, ExerciseID: exerciseId, Type: 'weight', Value: weight, Date: todayISO_() }]); }
  const sameW = rows.filter(r => Number(r.ActualWeightKg) === weight);
  const maxR = Math.max.apply(null, sameW.map(r => Number(r.ActualReps) || 0).concat([0]));
  if (reps > maxR && maxR > 0) { prs.push({ type: 'reps', value: reps }); sfAppend_('SF_PRs', [{ Username: username, ExerciseID: exerciseId, Type: 'reps', Value: reps, Date: todayISO_() }]); }
  // 1RM
  const est = sfEpley_(weight, reps);
  const max1RM = Math.max.apply(null, rows.map(r => sfEpley_(Number(r.ActualWeightKg), Number(r.ActualReps))).concat([0]));
  if (est > max1RM && max1RM > 0) { prs.push({ type: '1rm', value: est }); sfAppend_('SF_PRs', [{ Username: username, ExerciseID: exerciseId, Type: '1rm', Value: est, Date: todayISO_() }]); }
  return prs;
}

function sfRiskScore_(username) {
  const u = normalize_(username).toLowerCase();
  let score = 0;
  const reasons = [];
  // days since last log
  const logs = sfRead_('ExerciseLogs');
  const userLogs = sfObjects_(logs).filter(r => normalize_(r.Username).toLowerCase() === u);
  const lastLog = userLogs.length ? userLogs.map(r => r.DateISO).sort().pop() : null;
  const daysSince = lastLog ? Math.floor((new Date() - new Date(lastLog + 'T00:00:00Z')) / 86400000) : 99;
  if (daysSince >= 1) { const add = 15 * Math.min(daysSince, 4); score += add; if (daysSince >= 2) reasons.push('عدم ثبت تمرین ' + daysSince + ' روز'); }
  // missed workouts in 7 days
  const weekAgo = sfAddDaysISO_(todayISO_(), -7);
  const recentLogs = userLogs.filter(r => normalize_(r.DateISO) >= weekAgo);
  const missed = Math.max(0, 3 - recentLogs.length);
  if (missed > 0) { score += 10 * Math.min(missed, 3); if (missed >= 2) reasons.push(missed + ' جلسهٔ تمرین از دست رفته'); }
  // unanswered messages
  const msgs = sfRead_('Messages');
  const userMsgs = sfObjects_(msgs).filter(r => normalize_(r.Athlete).toLowerCase() === u && normalize_(r.Sender) === 'me' && !normalize_(r.ReadAt));
  if (userMsgs.length > 0) { score += 12 * Math.min(userMsgs.length > 2 ? 2 : 1, 2); if (userMsgs.length > 0) reasons.push('پیام بی‌پاسخ'); }
  // days to expiry
  const subs = sfRead_('SF_Subs');
  const sub = sfObjects_(subs).filter(r => normalize_(r.Username).toLowerCase() === u && normalize_(r.Status) === 'active').pop();
  if (sub) {
    const daysLeft = Math.floor((new Date(sub.EndDate + 'T00:00:00Z') - new Date()) / 86400000);
    if (daysLeft <= 7) { score += 10; reasons.push('اشتراک در حال اتمام (' + daysLeft + ' روز)'); }
  }
  score = Math.min(100, Math.max(0, score));
  // save to SF_Risk
  sfAppend_('SF_Risk', [{ Username: username, Score: score, Reasons: JSON.stringify(reasons), Date: todayISO_() }]);
  return { score: score, reasons: reasons };
}


// ===== Added capabilities: Audit, Settings, Templates =====

function sfAudit_(actor, entity, id, oldVal, newVal, reason) {
  sfAppend_('SF_Audit', [{ Time: new Date().toISOString(), Actor: normalize_(actor), Entity: normalize_(entity), Id: normalize_(id), Old: String(oldVal == null ? '' : oldVal), New: String(newVal == null ? '' : newVal), Reason: normalize_(reason) }]);
}

function sfGetSetting_(key) {
  const rd = sfRead_('SF_Settings');
  const rows = sfObjects_(rd);
  const r = rows.find(x => normalize_(x.Key) === normalize_(key));
  return r ? normalize_(r.Value) : '';
}

function sfSetSetting_(key, value) {
  const rd = sfRead_('SF_Settings');
  const rows = sfObjects_(rd);
  const exists = rows.find(x => normalize_(x.Key) === normalize_(key));
  if (exists) {
    // update
    const sh = rd.sh;
    for (let i = 0; i < rd.rows.length; i++) {
      if (normalize_(sfObj_(rd, rd.rows[i]).Key) === normalize_(key)) {
        const row = i + 2;
        const cur = sh.getRange(row, 1, 1, rd.headers.length).getValues()[0];
        rd.headers.forEach((h, c) => { if (h === 'Value') cur[c] = value; });
        sh.getRange(row, 1, 1, rd.headers.length).setValues([cur]);
        return true;
      }
    }
  }
  sfAppend_('SF_Settings', [{ Key: key, Value: value }]);
  return true;
}

function sfGetTemplate_(key) {
  const rd = sfRead_('SF_Templates');
  const rows = sfObjects_(rd);
  return rows.find(x => normalize_(x.Key) === normalize_(key)) || null;
}

function sfSaveTemplate_(key, title, body) {
  const rd = sfRead_('SF_Templates');
  const rows = sfObjects_(rd);
  const exists = rows.find(x => normalize_(x.Key) === normalize_(key));
  if (exists) {
    const sh = rd.sh;
    for (let i = 0; i < rd.rows.length; i++) {
      if (normalize_(sfObj_(rd, rd.rows[i]).Key) === normalize_(key)) {
        const row = i + 2;
        const cur = sh.getRange(row, 1, 1, rd.headers.length).getValues()[0];
        rd.headers.forEach((h, c) => {
          if (h === 'Title') cur[c] = title;
          if (h === 'Body') cur[c] = body;
          if (h === 'UpdatedAt') cur[c] = new Date().toISOString();
        });
        sh.getRange(row, 1, 1, rd.headers.length).setValues([cur]);
        return true;
      }
    }
  }
  sfAppend_('SF_Templates', [{ Key: key, Title: title, Body: body, UpdatedAt: new Date().toISOString() }]);
  return true;
}


// ===== Added capabilities: Subscriptions =====

function sfReadSheetSafe_(names) {
  var arr = Array.isArray(names) ? names : [names];
  for (var i = 0; i < arr.length; i++) {
    try {
      var rd = sfRead_(arr[i]);
      if (rd && rd.headers && rd.headers.length) return rd;
    } catch (e) {}
  }
  // fallback: try to open by getSheetByName directly if sfRead_ throws on missing
  try {
    var ss = (typeof getSS_ === 'function') ? getSS_() : SpreadsheetApp.getActive();
    for (var j = 0; j < arr.length; j++) {
      try {
        var sh = ss.getSheetByName(arr[j]);
        if (!sh) continue;
        var lr = sh.getLastRow(), lc = sh.getLastColumn();
        if (lr < 1 || lc < 1) continue;
        var vals = sh.getDataRange().getDisplayValues();
        var headers = vals.shift().map(function(h){ return normalize_(h); });
        var idx = {}; headers.forEach(function(h,k){ if(h) idx[h]=k; });
        return { sh: sh, headers: headers, idx: idx, rows: vals };
      } catch (e2) {}
    }
  } catch (e3) {}
  return { sh: null, headers: [], idx: {}, rows: [] };
}

function sfDateIso_(v) {
  if (v == null || v === '') return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    try { return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Tehran', 'yyyy-MM-dd'); } catch (e) {}
  }
  var s = normalize_(v);
  if (!s) return '';
  var m = s.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (m) return m[1] + '-' + ('0'+m[2]).slice(-2) + '-' + ('0'+m[3]).slice(-2);
  // try parsing
  try {
    var d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone() || 'Asia/Tehran', 'yyyy-MM-dd');
  } catch (e2) {}
  return s;
}

function sfGetRow_(r, keys) {
  if (!r) return '';
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (r[k] != null && normalize_(r[k]) !== '') return r[k];
  }
  return '';
}

/* SF_SUB_MEMO_ / sfJalaliToIso_ — تشخیص مطمئن‌تر اشتراک (تاریخ شمسی + میلادی) */
var SF_SUB_MEMO_ = {};
function sfJalaliToIso_(jy, jm, jd) {
  jy = Number(jy); jm = Number(jm); jd = Number(jd);
  if (!(jy >= 1200 && jy <= 1700) || !(jm >= 1 && jm <= 12) || !(jd >= 1 && jd <= 31)) return "";
  if (jy > 1600) return jy + "-" + ("0" + jm).slice(-2) + "-" + ("0" + jd).slice(-2);
  jy += 1595;
  var days = -355668 + (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + jd +
    ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30 + 186));
  var gy = 400 * Math.floor(days / 146097); days %= 146097;
  if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
  gy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  var gd = days + 1;
  var leap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  var sal = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var gm = 0;
  while (gm < 13 && gd > sal[gm]) { gd -= sal[gm]; gm++; }
  return gy + "-" + ("0" + gm).slice(-2) + "-" + ("0" + gd).slice(-2);
}
/* خواندنِ «فقط اگر شیت وجود دارد» — هرگز sfEnsure_ را اجرا نمی‌کند.
 * sfRead_/sfSheet_ برای شیت ناموجود کل شیت‌ها را بازسازی می‌کند و لود را
 * چند ثانیه معطل (یا کاملاً قطع) می‌کند؛ پس در مسیر لود از این‌ها استفاده نمی‌کنیم. */
function sfSheetMaybe_(name) {
  try { return getSS_().getSheetByName(name) || null; } catch (e) { return null; }
}
function sfReadMaybe_(name) {
  var sh = sfSheetMaybe_(name);
  if (!sh) return null;
  var lr, lc;
  try { lr = sh.getLastRow(); lc = sh.getLastColumn(); } catch (e) { return null; }
  if (lr < 1 || lc < 1) return null;
  var vals;
  try { vals = sh.getRange(1, 1, lr, lc).getDisplayValues(); } catch (e1) { return null; }
  if (!vals || !vals.length || !vals[0]) return null;
  var headers = vals.shift().map(function (h) { return normalize_(h); });
  var idx = {};
  headers.forEach(function (h, i) { if (h) idx[h] = i; });
  return { sh: sh, headers: headers, idx: idx, rows: vals };
}
var __SFC_PKG_CACHE = null;
function sfcPkgDays_() {
  if (__SFC_PKG_CACHE) return __SFC_PKG_CACHE;
  var out = {};
  try {
    var rd = sfReadMaybe_("SF_Packages");
    if (rd) {
      (sfObjects_(rd) || []).forEach(function (p) {
        var id = normalize_(p.PackageID || p.ID || p.PackageId).toLowerCase();
        if (id) out[id] = Number(String(p.Days || p.Duration || "").replace(/[^0-9]/g, "")) || 0;
      });
    }
  } catch (e) {}
  __SFC_PKG_CACHE = out;
  return out;
}
/* درِ پشتیبان: اگر محاسبهٔ اشتراک خطا داد، اپ هرگز نباید قفل شود */
function sfGateFallback_() {
  /* درِ پشتیبان فقط برای این است که اپ قفل نشود — هرگز اشتراک فعال دروغین نده.
     فقط بنر تعرفه نشان داده می‌شود و گیف/ربات طبق ماتریس قفل می‌مانند. */
  return {
    active: false, staff: false, tier: "none", tierName: "", status: "unknown",
    daysLeft: 0, endDate: "", packageId: "", packageName: "", renewSoon: false,
    features: { pdf: true, gif: false, bot: false, ai: 0, reports: false, support: true },
    limits: { pdf: true, gif: false, bot: false, ai: 0, reports: false }
  };
}
function sfActiveSubOf_(username) {
  var key = normalize_(username || "").toLowerCase();
  if (!key) return { status: "none", daysLeft: 0, endDate: "", packageId: "" };
  if (SF_SUB_MEMO_[key]) return SF_SUB_MEMO_[key];
  try {
    var __cc = CacheService.getScriptCache().get("sfsub_" + key);
    if (__cc) { var __cv = JSON.parse(__cc); SF_SUB_MEMO_[key] = __cv; return __cv; }
  } catch (eCache) {}
  var today = todayISO_();
  var best = null;

  function toIso(v) {
    var s = normalize_(v);
    if (!s) return "";
    s = String(s)
      .replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 1776); })
      .replace(/[٠-٩]/g, function (c) { return String(c.charCodeAt(0) - 1632); });
    var m = s.match(/(1[34]\d{2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
    if (m) return sfJalaliToIso_(m[1], m[2], m[3]);
    var g = s.match(/(20\d{2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/);
    if (g) return sfDateIso_(s); // تاریخ میلادی را جلالی تبدیل نکن — اشتراک نباید محو شود
    return sfDateIso_(v);
  }

  function diffDays(endIso) {
    try {
      var a = new Date(endIso + "T00:00:00Z").getTime();
      var b = new Date(today + "T00:00:00Z").getTime();
      if (isNaN(a) || isNaN(b)) return 0;
      return Math.round((a - b) / 86400000);
    } catch (e) { return 0; }
  }

  function consider(row, src) {
    var uname = normalize_(sfGetRow_(row, ["Username", "username", "User", "user", "Athlete", "Member", "نام کاربری", "شاگرد"])).toLowerCase();
    if (!uname) return;
    if (uname !== key) return;
    var st = normalize_(sfGetRow_(row, ["Status", "status", "وضعیت", "State", "state"])).toLowerCase();
    if (/cancel|reject|refund|لغو/.test(st)) return;
    var startIso = toIso(sfGetRow_(row, ["StartDate", "startDate", "Start", "From", "تاریخ شروع"]));
    var endIso = toIso(sfGetRow_(row, ["EndDate", "endDate", "End", "Expiry", "ExpireDate", "ExpiresAt", "ValidUntil", "تاریخ پایان", "انقضا"]));
    var pkgId = normalize_(sfGetRow_(row, ["PackageID", "packageId", "Package", "PackageId", "پکیج"]));
    var days = Number(String(sfGetRow_(row, ["Days", "Duration", "مدت"])).replace(/[^0-9]/g, "")) || 0;
    if (!days && pkgId) {
      try { var __d0 = sfcPkgDays_()[normalize_(pkgId).toLowerCase()]; if (__d0) days = Number(__d0) || 0; } catch (e0) {}
    }
    if (!endIso && startIso && days) {
      try { var d = new Date(startIso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); endIso = d.toISOString().slice(0, 10); } catch (e1) {}
    }
    var explicitExpired = /expired|منقضی/.test(st);
    if (!endIso && !startIso && !explicitExpired) return;
    var daysLeft = endIso ? diffDays(endIso) : 9999;
    var status = explicitExpired ? "expired" : "active";
    if (!explicitExpired && endIso && daysLeft < 0) status = (daysLeft >= -3) ? "grace" : "expired";
    var rank = (status === "expired" ? 0 : 2) * 100000000 + (endIso ? Number(endIso.replace(/[^0-9]/g, "")) : 99999999);
    if (best && rank <= best._rank) return;
    best = {
      status: status,
      daysLeft: Math.max(0, Math.min(9999, daysLeft)),
      endDate: endIso || "",
      startDate: startIso || "",
      packageId: pkgId || "",
      source: src || "",
      _rank: rank
    };
  }

  ["SF_Subs", "SF_Subscriptions", "Subscriptions", "Subs"].forEach(function (sheetName) {
    var rd = null;
    try { rd = sfReadMaybe_(sheetName); } catch (e) { rd = null; }
    if (!rd || !rd.headers || !rd.headers.length) return;
    var rows = [];
    try { rows = sfObjects_(rd) || []; } catch (e2) { return; }
    rows.forEach(function (r) { try { consider(r, sheetName); } catch (e3) {} });
  });

  /* پشتیبان: ستون‌های اشتراک داخل شیت کاربران */
  if (!best) {
    try {
      var urd = sfReadSheetSafe_([CONFIG.USERS_SHEET]);
      (sfObjects_(urd) || []).forEach(function (r) {
        var un = normalize_(r.user || r.Username || "").toLowerCase();
        if (un !== key) return;
        var flat = { Username: un, Status: "active" };
        Object.keys(r).forEach(function (k) {
          if (/(end|expir|انقضا|پایان)/i.test(k) && !flat.EndDate) flat.EndDate = r[k];
          if (/(start|شروع)/i.test(k) && !flat.StartDate) flat.StartDate = r[k];
          if (/(package|پکیج)/i.test(k) && !flat.PackageID) flat.PackageID = r[k];
          if (/(days|مدت)/i.test(k) && !flat.Days) flat.Days = r[k];
        });
        if (!flat.EndDate && !flat.StartDate) return;
        consider(flat, "users");
      });
    } catch (e4) {}
  }

  var out = best
    ? { status: best.status, daysLeft: best.daysLeft, endDate: best.endDate, startDate: best.startDate, packageId: best.packageId, source: best.source }
    : { status: "none", daysLeft: 0, endDate: "", packageId: "" };
  SF_SUB_MEMO_[key] = out;
  try { CacheService.getScriptCache().put("sfsub_" + key, JSON.stringify(out), 90); } catch (eCache2) {}
  return out;
}

function sfCreateSubscription_(username, packageId, source) {
  const pkgRd = sfRead_("SF_Packages");
  const pkgs = sfObjects_(pkgRd);
  const pkg = pkgs.find(function (p) { return normalize_(p.PackageID) === normalize_(packageId); });
  const days = pkg ? (Number(pkg.Days) || 30) : 30;
  const cur = sfActiveSubOf_(username);
  const start = (cur.endDate && cur.daysLeft > 0) ? cur.endDate : todayISO_();
  const d = new Date(start + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  const end = d.toISOString().slice(0, 10);
  sfAppend_("SF_Subs", [{ SubID: Utilities.getUuid().slice(0, 8), Username: username, PackageID: normalize_(packageId), StartDate: start, EndDate: end, Status: "active", Source: source || "manual", CreatedAt: new Date().toISOString() }]);
  try { delete SF_SUB_MEMO_[normalize_(username).toLowerCase()]; } catch (e0) {}
  sfAudit_(username, "sub", username, cur.status || "none", "active", source || "");
  return { ok: true, endDate: end };
}


// ===== Added capabilities: Payment (card-to-card) =====

function sfNotifyAdminTg_(text) {
  try {
    const t = (function(){ try { return (typeof sfTgToken_ === 'function') ? sfTgToken_() : null; } catch(e){ return null; } })();
    if (!t) return;
    const chat = (function(){ try { return PropertiesService.getScriptProperties().getProperty('COACH_TELEGRAM_CHAT_ID') || PropertiesService.getScriptProperties().getProperty('TG_ADMIN_CHAT') || ''; } catch(e){ return ''; } })();
    if (!chat) return;
    UrlFetchApp.fetch('https://api.telegram.org/bot' + t + '/sendMessage', { method: 'post', contentType: 'application/json', payload: JSON.stringify({ chat_id: chat, text: String(text).slice(0, 3500) }), muteHttpExceptions: true });
  } catch (e) {}
}

function sfCouponDiscount_(code, packageId, price) {
  if (!code) return 0;
  const rd = sfRead_('SF_Coupons');
  const rows = sfObjects_(rd);
  const c = rows.find(x => normalize_(x.Code).toUpperCase() === String(code).toUpperCase() && String(x.Active).toLowerCase() === 'true');
  if (!c) return 0;
  const exp = normalize_(c.ExpiresAt);
  if (exp && exp < todayISO_()) return 0;
  const max = Number(c.MaxUses) || 999999, used = Number(c.Used) || 0;
  if (used >= max) return 0;
  const allowed = normalize_(c.PackageIds);
  if (allowed && allowed.split(',').map(normalize_).indexOf(normalize_(packageId)) < 0) return 0;
  return normalize_(c.Type).toLowerCase() === 'percent'
    ? Math.round(price * (Number(c.Value) || 0) / 100)
    : Math.min(price, Number(c.Value) || 0);
}

function sfConsumeCoupon_(code) {
  const rd = sfRead_('SF_Coupons');
  const rows = sfObjects_(rd);
  const c = rows.find(x => normalize_(x.Code).toUpperCase() === String(code).toUpperCase());
  if (!c) return;
  const sh = rd.sh;
  for (let i = 0; i < rd.rows.length; i++) {
    if (normalize_(sfObj_(rd, rd.rows[i]).Code).toUpperCase() === String(code).toUpperCase()) {
      const row = i + 2;
      const cur = sh.getRange(row, 1, 1, rd.headers.length).getValues()[0];
      const usedIdx = rd.headers.indexOf('Used');
      if (usedIdx >= 0) cur[usedIdx] = (Number(cur[usedIdx]) || 0) + 1;
      sh.getRange(row, 1, 1, rd.headers.length).setValues([cur]);
      return;
    }
  }
}

function sfReceiptFolder_() {
  const name = 'SaeediFit_Receipts';
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function sfPayReceipt_(token, p, cid) {
  p = p || {};
  // session
  const s = (function(){ try { return requireSession_(token); } catch(e){ throw new Error('لطفاً دوباره وارد شوید.'); } })();
  const username = normalize_(s.username);
  const pkgRd = sfRead_('SF_Packages');
  const pkgs = sfObjects_(pkgRd);
  const pkg = pkgs.find(x => normalize_(x.PackageID) === normalize_(p.packageId));
  if (!pkg) throw new Error('پکیج انتخاب نشده است.');
  const price = Number(pkg.Price) || 0;
  const discount = sfCouponDiscount_(normalize_(p.coupon), normalize_(p.packageId), price);
  const final = Math.max(0, price - discount);
  if (final <= 0 && price !== 0) throw new Error('مبلغ نامعتبر است.');
  if (!p.receipt || !p.receipt.base64) throw new Error('تصویر رسید را بارگذاری کنید.');

  const payId = 'PAY-' + Utilities.getUuid().slice(0, 8).toUpperCase();
  let fileId = '', hash = '';
  try {
    const bytes = Utilities.base64Decode(p.receipt.base64);
    hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
    const payRd = sfRead_('SF_Payments');
    const dup = sfObjects_(payRd).find(x => normalize_(x.ReceiptHash) === hash && ['paid','pending_review'].indexOf(normalize_(x.Status).toLowerCase()) > -1);
    if (dup) throw new Error('این رسید قبلاً ارسال شده است.');
    const blob = Utilities.newBlob(bytes, p.receipt.mime || 'image/jpeg', payId + '.jpg');
    const file = sfReceiptFolder_().createFile(blob);
    try { file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE); } catch(e) {}
    fileId = file.getId();
  } catch (e) {
    throw new Error(String(e && e.message || e).indexOf('رسید') > -1 ? String(e.message || e) : 'آپلود رسید انجام نشد؛ پرداخت ثبت نشده است. دوباره تلاش کنید.');
  }
  if (!fileId) throw new Error('فایل رسید ذخیره نشد؛ پرداخت ثبت نشده است.');

  sfAppend_('SF_Payments', [{
    PayID: payId, Username: username, PackageID: normalize_(p.packageId),
    Amount: price, Discount: discount, Final: final, Method: 'card', Status: 'pending_review',
    Authority: '', RefId: '', ReceiptFileId: fileId, ReceiptHash: hash,
    ReviewedBy: '', ReviewedAt: '', RejectReason: '', CID: normalize_(cid), CreatedAt: new Date().toISOString()
  }]);
  if (normalize_(p.coupon)) sfConsumeCoupon_(normalize_(p.coupon));
  sfNotifyAdminTg_('🧾 رسید جدید\n' + username + ' · ' + normalize_(pkg.Name) + '\nمبلغ: ' + final + ' تومان\nشناسه: ' + payId);
  return { ok: true, payId: payId, amount: final };
}

function sfApprovePayment_(token, payId, reason) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const rd = sfRead_('SF_Payments');
  const rows = sfObjects_(rd);
  const pay = rows.find(r => normalize_(r.PayID) === normalize_(payId));
  if (!pay) throw new Error('پرداخت پیدا نشد.');
  if (normalize_(pay.Status).toLowerCase() !== 'pending_review') throw new Error('این پرداخت قابل تأیید نیست.');
  // update status
  const sh = rd.sh;
  for (let i = 0; i < rd.rows.length; i++) {
    if (normalize_(sfObj_(rd, rd.rows[i]).PayID) === normalize_(payId)) {
      const row = i + 2;
      const cur = sh.getRange(row, 1, 1, rd.headers.length).getValues()[0];
      rd.headers.forEach((h, c) => {
        if (h === 'Status') cur[c] = 'paid';
        if (h === 'ReviewedBy') cur[c] = s.username;
        if (h === 'ReviewedAt') cur[c] = new Date().toISOString();
        if (h === 'RejectReason') cur[c] = '';
      });
      sh.getRange(row, 1, 1, rd.headers.length).setValues([cur]);
    }
  }
  // create/extend subscription
  sfCreateSubscription_(normalize_(pay.Username), normalize_(pay.PackageID), 'card');
  sfAudit_(s.username, 'payment', payId, 'pending_review', 'paid', reason || '');
  return { ok: true };
}

function sfRejectPayment_(token, payId, reason) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const rd = sfRead_('SF_Payments');
  const rows = sfObjects_(rd);
  const pay = rows.find(r => normalize_(r.PayID) === normalize_(payId));
  if (!pay) throw new Error('پرداخت پیدا نشد.');
  const sh = rd.sh;
  for (let i = 0; i < rd.rows.length; i++) {
    if (normalize_(sfObj_(rd, rd.rows[i]).PayID) === normalize_(payId)) {
      const row = i + 2;
      const cur = sh.getRange(row, 1, 1, rd.headers.length).getValues()[0];
      rd.headers.forEach((h, c) => {
        if (h === 'Status') cur[c] = 'rejected';
        if (h === 'ReviewedBy') cur[c] = s.username;
        if (h === 'ReviewedAt') cur[c] = new Date().toISOString();
        if (h === 'RejectReason') cur[c] = normalize_(reason) || 'تأیید نشد';
      });
      sh.getRange(row, 1, 1, rd.headers.length).setValues([cur]);
    }
  }
  sfAudit_(s.username, 'payment', payId, normalize_(pay.Status), 'rejected', reason || '');
  return { ok: true };
}

function sfListPayments_(token, status) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const rd = sfRead_('SF_Payments');
  const rows = sfObjects_(rd);
  let filtered = rows;
  if (status) filtered = rows.filter(r => normalize_(r.Status).toLowerCase() === normalize_(status).toLowerCase());
  return filtered.map(r => ({ payId: normalize_(r.PayID), username: normalize_(r.Username), packageId: normalize_(r.PackageID), amount: Number(r.Amount)||0, final: Number(r.Final)||0, status: normalize_(r.Status), createdAt: normalize_(r.CreatedAt) }));
}


/* ============================================================================
 * v6 EXTRAS — API used by the client UI (invites / packages / payments)
 * Appended additively; nothing above this line was changed.
 * ========================================================================== */

function sfXConfig(token) {
  var s = requireSession_(token);
  var p = PropertiesService.getScriptProperties();
  var url = p.getProperty('WEB_APP_URL') || '';
  if (!url) { try { url = ScriptApp.getService().getUrl() || ''; } catch (e) {} }
  return {
    webAppUrl: url,
    botUsername: p.getProperty('BOT_USERNAME') || '',
    isCoach: !!isCoach_(s),
    username: s.username,
    role: s.role
  };
}

function sfXListPackages(token) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  return sfObjects_(sfRead_('SF_Packages')).map(function (r) {
    return {
      id: normalize_(r.PackageID), name: normalize_(r.Name),
      days: Number(r.Days) || 0, price: Number(r.Price) || 0,
      features: normalize_(r.Features), badge: normalize_(r.Badge),
      active: String(normalize_(r.Active)).toLowerCase() !== 'false',
      sort: Number(r.Sort) || 0
    };
  });
}

function sfXSavePackage(token, p) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  p = p || {};
  var id = normalize_(p.id);
  if (!id) throw new Error('کد پکیج لازم است.');
  var patch = {
    Name: normalize_(p.name) || id,
    Days: Number(p.days) || 30,
    Price: Number(p.price) || 0,
    Features: normalize_(p.features),
    Badge: normalize_(p.badge),
    Active: p.active === false ? 'false' : 'true',
    Sort: Number(p.sort) || 0
  };
  var found = sfObjects_(sfRead_('SF_Packages')).some(function (r) { return normalize_(r.PackageID) === id; });
  if (found) {
    sfUpdateSheet_('SF_Packages', function (r) { return normalize_(r.PackageID) === id; }, patch);
  } else {
    patch.PackageID = id;
    sfAppend_('SF_Packages', [patch]);
  }
  sfAudit_(s.username, 'package', id, found ? 'update' : 'create', JSON.stringify(patch), '');
  return { ok: true, created: !found };
}

function sfXSeedPackages(token) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  var existing = sfObjects_(sfRead_('SF_Packages')).map(function (r) { return normalize_(r.PackageID); });
  var seed = [
    { PackageID: 'P1', Name: '«نقره‌ای»', Days: 30, Price: 1500000, Features: 'برنامه تمرین + رژیم', Badge: '', Active: 'true', Sort: 1 },
    { PackageID: 'P3', Name: 'سه ماهه', Days: 90, Price: 3900000, Features: 'تمرین + رژیم + پشتیبانی', Badge: 'پرفروش', Active: 'true', Sort: 2 },
    { PackageID: 'P6', Name: '«طلایی»', Days: 180, Price: 6900000, Features: 'همه‌چیز + جلسات آنلاین', Badge: 'بهترین ارزش', Active: 'true', Sort: 3 }
  ].filter(function (x) { return existing.indexOf(x.PackageID) < 0; });
  if (seed.length) sfAppend_('SF_Packages', seed);
  return { ok: true, added: seed.length };
}

function sfXInviteNew(token, packageId, days) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  return sfInviteCreate_(s.username, packageId, days || 7);
}

function sfXInvites(token) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  return sfObjects_(sfRead_('SF_Invites')).slice(-80).reverse().map(function (r) {
    return {
      token: normalize_(r.Token), coach: normalize_(r.Coach),
      packageId: normalize_(r.PackageID), expiresAt: normalize_(r.ExpiresAt),
      usedBy: normalize_(r.UsedBy), status: normalize_(r.Status),
      createdAt: normalize_(r.CreatedAt)
    };
  });
}

function sfXRevokeInvite(token, invToken) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  sfUpdateSheet_('SF_Invites', function (r) { return normalize_(r.Token) === normalize_(invToken); }, { Status: 'revoked' });
  sfAudit_(s.username, 'invite', invToken, 'active', 'revoked', '');
  return { ok: true };
}

function sfXPayments(token, status) { return sfListPayments_(token, status || ''); }
function sfXApprovePayment(token, payId, reason) { return sfApprovePayment_(token, payId, reason); }
function sfXRejectPayment(token, payId, reason) { return sfRejectPayment_(token, payId, reason); }

function sfXMySub(token) {
  var s = requireSession_(token);
  var u = normalize_(s.username).toLowerCase();
  var hist = sfObjects_(sfRead_('SF_Subs')).filter(function (r) {
    return normalize_(r.Username).toLowerCase() === u;
  }).slice(-10).reverse().map(function (r) {
    return { id: normalize_(r.SubID), packageId: normalize_(r.PackageID), start: normalize_(r.StartDate), end: normalize_(r.EndDate), status: normalize_(r.Status) };
  });
  return { sub: sfActiveSubOf_(s.username), history: hist };
}

function sfXSubmitReceipt(token, payload) { return sfPayReceipt_(token, payload, payload && payload.cid); }

function sfXPublicPackages() {
  return sfObjects_(sfRead_('SF_Packages')).filter(function (r) {
    return String(normalize_(r.Active)).toLowerCase() !== 'false';
  }).map(function (r) {
    return { id: normalize_(r.PackageID), name: normalize_(r.Name), days: Number(r.Days) || 0, price: Number(r.Price) || 0, features: normalize_(r.Features), badge: normalize_(r.Badge) };
  });
}

/* Telegram deep-link: /start inv_<token>  ->  send the registration link */
function sfStartInvite_(t, chatId, payload) {
  try {
    var token = String(payload || '').trim().replace(/^inv_/i, '');
    var info = sfInviteInfo(token);
    var url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || '';
    var link = url.replace(/\/$/, '') + (url.indexOf('?') > -1 ? '&' : '?') + 'invite=' + token;
    var txt = '🎉 خوش آمدی!\n' + (info && info.package ? ('پکیج: ' + info.package.name + '\n') : '') + 'برای تکمیل ثبت‌نام روی دکمهٔ زیر بزن:';
    botCall_(t, 'sendMessage', {
      chat_id: chatId,
      text: txt,
      reply_markup: { inline_keyboard: [[{ text: 'تکمیل ثبت‌نام', url: link }]] }
    });
  } catch (e) {
    try { botCall_(t, 'sendMessage', { chat_id: chatId, text: '❌ ' + (e.message || 'لینک نامعتبر') }); } catch (e2) {}
  }
}


/**
 * AI Integration via Gemini API (Free Tier)
 */





/**
 * AI Coach (Disguised as Coach Saeedi)
 * Using Gemini API
 */


function getBankPlans_() {
  const sh = getSS_().getSheetByName('ProgramBank');
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  return data.slice(1).map(row => {
    let obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function saveToBank_(planName, type, content, tags) {
  const sh = getSS_().getSheetByName('ProgramBank') || getSS_().insertSheet('ProgramBank');
  if (sh.getLastRow() === 0) sh.appendRow(['PlanName', 'Type', 'Template', 'Tags', 'CreatedAt']);
  sh.appendRow([planName, type, content, tags, new Date().toISOString()]);
  return { ok: true };
}

function fixMealImages_() {
  const sh = getSS_().getSheetByName('MealImages');
  if (!sh) return;
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const urlIdx = headers.indexOf('ImageURL');
  if (urlIdx === -1) return;

  for (let i = 1; i < data.length; i++) {
    let url = data[i][urlIdx];
    if (url && url.indexOf('drive.google.com') !== -1) {
      const idMatch = url.match(/id=([\w-]{20,})/);
      if (idMatch) {
        const newUrl = 'https://lh3.googleusercontent.com/d/' + idMatch[1];
        sh.getRange(i + 1, urlIdx + 1).setValue(newUrl);
      }
    }
  }
}


var SF_TIERS_ = {
  silver: { key: 'silver', name: 'نقره‌ای', pdf: true, gif: false, bot: false, ai: 10, reports: false },
  gold:   { key: 'gold',   name: 'طلایی',  pdf: true, gif: true,  bot: true,  ai: -1, reports: true },
  none:   { key: 'none',   name: 'بدون اشتراک', pdf: true, gif: false, bot: false, ai: 0, reports: false }
};
function sfTierKeyOf_(sub, pkgName) {
  var n = String(pkgName || '');
  if (n.indexOf('طلایی') > -1 || n.indexOf('gold') > -1) return 'gold';
  if (n.indexOf('نقره') > -1 || n.indexOf('silver') > -1) return 'silver';
  var pid = String((sub && sub.packageId) || '');
  if (pid === 'P6' || pid === 'P3') return 'gold';
  return 'silver';
}
function sfPackageRow_(pid) {
  try {
    var rows = sfObjects_(sfRead_('SF_Packages'));
    for (var i = 0; i < rows.length; i++) { if (normalize_(rows[i].PackageID) === normalize_(pid)) return rows[i]; }
  } catch (e) {}
  return null;
}
function sfGate_(session) {
  var sub = null, pkg = null, tier = "none", active = false;
  try { sub = sfActiveSubOf_(session.username); } catch (e) { sub = null; }
  if (sub && (sub.status === "active" || sub.status === "grace")) {
    active = true;
    try { pkg = sfPackageRow_(sub.packageId); } catch (e2) { pkg = null; }
    tier = sfTierKeyOf_(sub, pkg && pkg.Name);
  }
  var f = SF_TIERS_[tier] || SF_TIERS_.none;
  var role = String(session.role || "").toLowerCase();
  var staff = role === "coach" || role === "admin";
  var features = staff ? SF_TIERS_.gold : f;
  return {
    active: active || staff,
    staff: staff,
    tier: staff ? "gold" : tier,
    tierName: staff ? "مربی" : (active ? (tier === "gold" ? "طلایی" : "نقره‌ای") : (sub && sub.status === "expired" ? "منقضی" : "بدون اشتراک")),
    status: staff ? "staff" : (sub ? sub.status : "none"),
    daysLeft: sub ? (Number(sub.daysLeft) || 0) : 0,
    endDate: sub ? (sub.endDate || "") : "",
    packageId: sub ? (sub.packageId || "") : "",
    packageName: pkg ? normalize_(pkg.Name) : "",
    renewSoon: !!(sub && sub.status !== "expired" && Number(sub.daysLeft) <= 7),
    features: features,
    limits: {
      pdf: true,
      gif: !!features.gif,
      bot: !!features.bot,
      ai: features.ai,
      reports: !!features.reports
    }
  };
}
function sfGateInfo(token) {
  var s = requireSession_(token);
  var out = { gate: sfGate_(s), packages: sfPublicPackages_() };
  try {
    if (typeof sfSubState === "function") {
      var sub = sfSubState(token);
      out.matrix = sub.matrix;
      out.card = sub.card;
      out.support = sub.support;
      out.marketing = sub.marketing;
      out.renewRemindDays = sub.renewRemindDays;
    }
  } catch (e) {}
  return out;
}
function sfRequireFeature_(session, feature) {
  var g = sfGate_(session);
  if (g.staff) return g;
  var ok = feature === 'pdf' ? true : (feature === 'gif' ? g.features.gif : (feature === 'bot' ? g.features.bot : (feature === 'ai' ? (Number(g.features.ai) > 0 || Number(g.features.ai) === -1) : g.features[feature])));
  if (!ok) {
    var err = new Error('این قابلیت برای اشتراک «' + g.tierName + '» فعال نیست. برای فعال‌سازی اشتراک نقره‌ای یا طلایی بگیر.');
    err.code = 'SUBSCRIPTION_REQUIRED';
    err.feature = feature;
    throw err;
  }
  return g;
}
function sfPublicPackages_() {
  try {
    sfEnsureTiers_();
    return sfObjects_(sfRead_('SF_Packages')).filter(function (r) { return String(normalize_(r.Active)).toLowerCase() !== 'false'; })
      .map(function (r) { return { id: normalize_(r.PackageID), name: normalize_(r.Name), days: Number(r.Days) || 0, price: Number(r.Price) || 0, features: normalize_(r.Features), badge: normalize_(r.Badge) }; })
      .sort(function (a, b) { return a.price - b.price; });
  } catch (e) { return []; }
}
function sfStripFrames_(v, depth) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if ((depth || 0) > 12) return v;
  if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) sfStripFrames_(v[i], (depth || 0) + 1); return v; }
  var isMedia = Object.prototype.hasOwnProperty.call(v, "frames") || Object.prototype.hasOwnProperty.call(v, "frames1");
  if (isMedia) { try { delete v.gif; } catch (e0) {} }
  if (v.frames) { try { delete v.frames; } catch (e) {} }
  if (v.frames1) { try { delete v.frames1; } catch (e2) {} }
  ["gifUrl", "gifSrc", "GifURL", "GifFileId", "GifSourceURL"].forEach(function (k) { try { if (v[k]) delete v[k]; } catch (e3) {} });
  Object.keys(v).forEach(function (k) { if (v[k] && typeof v[k] === "object") sfStripFrames_(v[k], (depth || 0) + 1); });
  return v;
}

function sfEnsureTiers_() {
  try {
    var P = PropertiesService.getScriptProperties();
    if (P.getProperty('TIERS_MIGRATED') === '1') return { ok: true, cached: true };
    var ss = getSS_();
    ensureSheetWithHeaders_(ss, 'SF_Packages', SF_PACKAGES_HEADERS);
    var rows = sfObjects_(sfRead_('SF_Packages'));
    var want = {
      P1: { Name: 'نقره‌ای', Days: 30, Price: 1500000, Features: 'برنامه تمرین + رژیم + دانلود PDF + ۱۰ سؤال هوش مصنوعی', Badge: '', Active: 'true', Sort: 1 },
      P6: { Name: 'طلایی', Days: 180, Price: 6900000, Features: 'گیف حرکات + ربات تلگرام + هوش مصنوعی نامحدود + تحلیل پیشرفت', Badge: 'بهترین ارزش', Active: 'true', Sort: 2 }
    };
    var ids = rows.map(function (r) { return normalize_(r.PackageID); });
    Object.keys(want).forEach(function (pid) {
      if (ids.indexOf(pid) < 0) {
        var row = {}; Object.keys(want[pid]).forEach(function (k) { row[k] = want[pid][k]; });
        row.PackageID = pid; sfAppend_('SF_Packages', [row]);
      } else {
        sfUpdateSheet_('SF_Packages', function (r) { return normalize_(r.PackageID) === pid; }, want[pid]);
      }
    });
    var others = ids.filter(function (id) { return id && id !== "P1" && id !== "P6"; });
    if (others.length) sfUpdateSheet_('SF_Packages', function (r) { return others.indexOf(normalize_(r.PackageID)) > -1; }, { Active: 'false' });
    P.setProperty('TIERS_MIGRATED', '1');
    return { ok: true, deactivated: others.length };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}

/* ===== HTTP bridge: allowlist of server functions the Sites front-end may call =====
   هر تابع در همین فهرست خودش با requireSession_/requireAdmin_ توکن را بررسی می‌کند. */
var SF_API_ALLOWED_ = ["sfGetAppJs", "sfGetAppPage", "addWater", "adminCreateUser", "adminDeleteSheets", "adminDeleteUser", "adminExportAssignedPlans", "adminListMealImages", "adminListUsers", "adminRematchPlans", "adminRepairProfiles", "adminResetPassword", "adminSaveMealImage", "adminSetRole", "adminSheetReport", "adminStudentPlans", "assignPlans", "copyYesterdayMeals", "deleteLog", "deleteMeal", "getBootstrap", "getBotLink", "getBotSettings", "getCoachNote", "getExerciseHistory", "getFoodByBarcode", "getLeaderboard", "getMessages", "logExerciseSet", "logMeal", "login", "logout", "resetWater", "saveBotSettings", "saveCoachNote", "saveLog", "saveProfile", "saveReminders", "sendBotTest", "sendMessage", "setExerciseDone", "sf7GetTelegramId", "sf7LibAssign", "sf7LibAssignFromStudent", "sf7LibDelete", "sf7LibList", "sf7LibSaveFrom", "sf7RemTest", "sf7SetTelegramId", "sfAdminApplyTargets", "sfAdminDeleteDiet", "sfAdminDeleteFood", "sfAdminDeleteSupp", "sfAdminDuplicatePlan", "sfAdminGetBody", "sfAdminGetDiet", "sfAdminGetPlan", "sfAdminGetSupp", "sfAdminListDiets", "sfAdminListPlans", "sfAdminListSupps", "sfAdminMediaDownload", "sfAdminMediaRetry", "sfAdminMediaStatus", "sfAdminMeta", "sfAdminParseProgram", "sfAdminImportProgram", "sfAdminGifStatus", "sfAdminGifSync", "sfAdminGifFolderSave", "sfSubState", "sfSubReceipt", "sfSubSaveSettings", "sfAdminProgress", "sfAdminReseedFoods", "sfAdminSaveDiet", "sfAdminSaveExercise", "sfAdminSaveFood", "sfAdminSavePlan", "sfAdminSaveSupp", "sfAdminSetPlanActive", "sfAdminSyncCatalog", "sfAdminYoutubeFill", "sfAiAsk", "sfAiLogs", "sfAiSaveConfig", "sfAiStatus", "sfAutoDiet", "sfCoachAlertsDismiss", "sfCoachBoard", "sfDayDetail", "sfDietModels", "sfExerciseHistory", "sfExportPlanPdf", "sfFoodBank", "sfFoodGet", "sfGateInfo", "sfLogFood", "sfLogSet", "sfPrevPlanExercises", "sfProgressBoard", "sfSendReminderTest", "unlinkBot", "updateMyAccount", "uploadProfileAvatar", "uploadProgressPhoto", "sfGetAdminPage", "adm_boot", "adm_dashboard", "adm_bankIdentityPreview", "adm_bankIdentityRepair", "adm_bankIdentityRestore", "adm_usersList", "adm_userSave", "sf3AdminAllPlans", "sfAdminDeletePlan", "adm_bankList", "adm_legacyBankPreview", "adm_legacyBankAudit", "adm_legacyBankRepair", "adm_legacyBankImport", "adm_mediaFill", "adm_mediaPreview", "adm_mediaQueue", "adm_mediaCurated", "adm_mediaReviewBatch", "adm_mediaCommit", "adm_bankGet", "adm_bankSetActive", "adm_bankDelete", "adm_bankSave", "adm_errorsList", "adm_activityBoard", "adm_sendActivityReminder", "sf3AdminOverview", "sf3AdminDecide", "sf3AdminSavePackage", "sf3AdminDeletePackage", "sf3AdminGrantSub", "sf3AdminSetCard", "sfCoachAlerts", "sf3AdminTgTest", "sfAdminTelegramHealth", "sfCatalogImageLookup", "sfPsPlanGet", "sfPsPlanSave", "sfPsPlanAnalysis", "sfPsBankList", "sfPsPlanToBank", "sfPsSmartGenerate", "sfPsVolumeBrief", "sfPsStyleProfile", "sfAdminLibStatus", "sfAdminLibImport", "sfAdminLibDownload", "sfAdminLibReshare", "sfAdminCatalogSeed", "sfCatStatus", "sfAdminLibSearch", "sfAdminLibFacets", "sfAdminLibAddToPlan", "sfAdminPlanDays", "sfErrorReport", "sfAdminErrorTest", "sfAdminRenamePlan", "sfAdminUpdatePlanItem", "sfAdminPlanItems", "sfAdminPlanAnatomy", "sfAdminAnatomyPlans", "sfCoachAiState", "sfCoachAiAsk", "sfCoachAiClear", "sfCoachAiSaveGoals", "sfAthleteExerciseGuide", "sfBarcodeFood", "sfMyPayments", "sfCouponPreview", "sfAthletePlanPdf", "sfAthleteWorkoutReceipt", "sfAthleteReminderState", "setWater", "sfAdminSetDietActive", "sfAdminSetSuppActive", "sfRefSessionState", "sfRefSessionStart", "sfRefSessionFinish", "sfPackList", "sfPackGet", "sfPackSave", "sfPackAssign", "sfPackShopping", "sfPackSuggest", "sfPackScaleDiet", "sfAssessmentGet", "sfAssessmentSave", "sfAssessmentQueue", "sfLeadAdminAccess"];

function sfApiJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
