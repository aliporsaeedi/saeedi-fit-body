/**
 * Saeedi Fit — Independent Admin Portal
 * Uses the existing Saeedi Fit Google Spreadsheet and Users sheet.
 * Keep this file in a SEPARATE Apps Script project from the athlete app.
 */
const AP_CONFIG = Object.freeze({
  SPREADSHEET_ID: '1rAyDXS6terUGkvWHV3ulHFUYq5knn5M9AByB31OhaoI',
  USERS_SHEET: 'Users',
  PROFILES_SHEET: 'AppProfiles',
  SESSION_TTL_SECONDS: 21600,
  LOGIN_LOCKOUT_SECONDS: 900,
  LOGIN_MAX_ATTEMPTS: 5,
  TIMEZONE: 'Asia/Tehran'
});

function apDoGet() {
  return HtmlService.createHtmlOutputFromFile('AdminPortal')
    .setTitle('Saeedi Fit | پنل مدیریت')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function ap_ss_() {
  return SpreadsheetApp.openById(AP_CONFIG.SPREADSHEET_ID);
}
function ap_sheet_(name) {
  const sheet = ap_ss_().getSheetByName(name);
  if (!sheet) throw new Error('شیت «' + name + '» در فایل اصلی پیدا نشد.');
  return sheet;
}
function ap_norm_(value) { return value == null ? '' : String(value).trim(); }
function ap_lower_(value) { return ap_norm_(value).toLowerCase(); }
function ap_splitPlans_(value) {
  return ap_norm_(value).split('|').map(function (item) { return item.trim(); }).filter(Boolean);
}
function ap_safeCell_(value) {
  const s = ap_norm_(value);
  return /^[=+@\-]/.test(s) ? "'" + s : s;
}
function ap_textCell_(range, value) {
  range.setNumberFormat('@');
  range.setValue(ap_safeCell_(value));
}

// Matches the password format used by the athlete app, including legacy plaintext.
function ap_toHex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function ap_hashPassword_(password, salt) {
  return ap_toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '::' + password));
}function ap_hashPassword_(password, salt) {
  return ap_toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '::' + password));
}

const AP_PASS_ROUNDS = 1200;
function ap_sha256Hex_(s) {
  return ap_toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s));
}
function ap_hashPasswordV2_(password, salt) {
  let h = salt + "::" + password;
  for (let i = 0; i < AP_PASS_ROUNDS; i++) h = ap_sha256Hex_(h);
  return "v2$" + salt + "$" + h;
}
function ap_isHashedPasswordV2_(stored) { return String(stored || "").indexOf("v2$") === 0; }

function ap_isHashedPassword_(stored) { return /^[0-9a-f]{16}\$[0-9a-f]{64}$/.test(String(stored || '')); }
function ap_passwordMatches_(candidate, stored) {
  const raw = String(candidate == null ? "" : candidate);
  const trimmed = raw.trim();
  if (ap_isHashedPasswordV2_(stored)) {
    const parts = String(stored).split("$");
    return ap_hashPasswordV2_(raw, parts[1]) === stored || ap_hashPasswordV2_(trimmed, parts[1]) === stored;
  }
  if (ap_isHashedPassword_(stored)) {
    const parts = String(stored).split("$");
    return ap_hashPassword_(raw, parts[0]) === parts[1] || ap_hashPassword_(trimmed, parts[0]) === parts[1];
  }
  return String(stored == null ? "" : stored) === trimmed || String(stored == null ? "" : stored) === raw;
}

function ap_findUser_(username) {
  const sh = ap_sheet_(AP_CONFIG.USERS_SHEET);
  const values = sh.getDataRange().getDisplayValues();
  const wanted = ap_lower_(username);
  for (let i = 1; i < values.length; i++) {
    if (ap_lower_(values[i][0]) === wanted && wanted) {
      return {
        row: i + 1,
        username: ap_norm_(values[i][0]),
        password: ap_norm_(values[i][1]),
        supplementPlan: ap_norm_(values[i][2]),
        workoutPlan: ap_norm_(values[i][3]),
        dietPlan: ap_norm_(values[i][4]),
        role: ap_lower_(values[i][5]) || 'user',
        telegramChatId: ap_norm_(values[i][6]),
        coachUsername: ap_norm_(values[i][7])
      };
    }
  }
  return null;
}
function ap_lockKey_(username) { return 'ap_login_fail_' + ap_lower_(username); }
function ap_checkLockout_(username) {
  if (CacheService.getScriptCache().get(ap_lockKey_(username) + '_lock')) {
    throw new Error('تلاش‌های ناموفق زیاد بوده است. ۱۵ دقیقه دیگر دوباره تلاش کنید.');
  }
}
function ap_recordFailure_(username) {
  const cache = CacheService.getScriptCache();
  const key = ap_lockKey_(username);
  const count = Number(cache.get(key) || '0') + 1;
  cache.put(key, String(count), AP_CONFIG.LOGIN_LOCKOUT_SECONDS);
  if (count >= AP_CONFIG.LOGIN_MAX_ATTEMPTS) cache.put(key + '_lock', '1', AP_CONFIG.LOGIN_LOCKOUT_SECONDS);
}
function ap_clearFailures_(username) {
  const cache = CacheService.getScriptCache();
  cache.remove(ap_lockKey_(username));
  cache.remove(ap_lockKey_(username) + '_lock');
}
function ap_login(username, password) {
  username = ap_norm_(username);
  ap_checkLockout_(username);
  const rec = ap_findUser_(username);
  if (!rec || !ap_passwordMatches_(password, rec.password)) {
    ap_recordFailure_(username);
    throw new Error('نام کاربری یا رمز عبور اشتباه است.');
  }
  if (rec.role !== 'admin') {
    throw new Error('این پنل فقط برای حسابی باز می‌شود که ستون F در شیت Users آن «admin» باشد. نقش فعلی این حساب: ' + rec.role);
  }
  ap_clearFailures_(username);
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('ap_session_' + token, JSON.stringify({ username: rec.username }), AP_CONFIG.SESSION_TTL_SECONDS);
  return { ok: true, token: token, username: rec.username };
}
function ap_requireAdmin_(token) {
  token = ap_norm_(token);
  if (!token) throw new Error('نشست پنل مدیریت پیدا نشد. خارج شوید و دوباره وارد شوید.');
  const cache = CacheService.getScriptCache();
  const raw = cache.get('ap_session_' + token);
  if (!raw) throw new Error('نشست پنل مدیریت منقضی شده است. دوباره وارد شوید.');
  let session;
  try { session = JSON.parse(raw); } catch (e) { cache.remove('ap_session_' + token); throw new Error('نشست نامعتبر است. دوباره وارد شوید.'); }
  const live = ap_findUser_(session.username);
  if (!live || live.role !== 'admin') {
    cache.remove('ap_session_' + token);
    throw new Error('دسترسی ادمین این حساب دیگر فعال نیست.');
  }
  return live;
}
function ap_logout(token) {
  token = ap_norm_(token);
  if (token) CacheService.getScriptCache().remove('ap_session_' + token);
  return { ok: true };
}

function ap_planOptions_() {
  const ss = ap_ss_();
  const system = new Set([
    'Users','Dashboard','DailyLogs','AppProfiles','ProfileHistory','AppLogs','AppWaterLogs','MealImages',
    'MediaCache','Messages','ProgressPhotos','CoachNotes','ExerciseLogs','MealLogs','ActivityLogs',
    'MelikaData','WorkoutPlans','DietPlans','Supplements'
  ]);
  const result = { workout: [], diet: [], supplement: [] };
  ss.getSheets().forEach(function (sh) {
    const name = sh.getName();
    if (system.has(name)) return;
    let kind = null;
    if (/تمرین|تمیرن|workout/i.test(name)) kind = 'workout';
    else if (/غذایی|رژیم|diet/i.test(name)) kind = 'diet';
    else if (/مکمل|ویتامین|قرص|supplement/i.test(name)) kind = 'supplement';
    else {
      const rows = sh.getRange(1, 1, Math.min(Math.max(sh.getLastRow(), 1), 40), Math.min(Math.max(sh.getLastColumn(), 1), 12)).getDisplayValues();
      const first = rows.map(function (r) { return ap_norm_(r[0]); });
      const joined = rows.map(function (r) { return r.map(ap_norm_).join(' '); }).join(' ');
      if (first.some(function (v) { return /^روز\s*\S+/.test(v) || /^جلسه\s*\S+/.test(v); })) kind = 'workout';
      else if (/صبحانه|ناهار|شام|میان\s?وعده|وعده غذایی/.test(joined)) kind = 'diet';
      else if (/دسته‌بندی|قرص|ویتامین|مکمل/.test(joined)) kind = 'supplement';
    }
    if (kind && result[kind].indexOf(name) < 0) result[kind].push(name);
  });
  Object.keys(result).forEach(function (key) { result[key].sort(function (a,b) { return a.localeCompare(b, 'fa'); }); });
  // Merge with Bank Plans
  var _bankPlans = ap_ss_().getSheetByName('ProgramBank')?.getDataRange().getValues() || [];
  _bankPlans.slice(1).forEach(r => { if(r[1] === 'workout') result.workout.push(r[0]); if(r[1] === 'diet') result.diet.push(r[0]); if(r[1] === 'supplement') result.supplement.push(r[0]); });
  // Merge with Bank Plans
  var _bankPlans = ap_ss_().getSheetByName('ProgramBank')?.getDataRange().getValues() || [];
  _bankPlans.slice(1).forEach(r => { if(r[1] === 'workout') result.workout.push(r[0]); if(r[1] === 'diet') result.diet.push(r[0]); if(r[1] === 'supplement') result.supplement.push(r[0]); });
  return result;
}
function ap_profileMap_() {
  const map = {};
  const sh = ap_ss_().getSheetByName(AP_CONFIG.PROFILES_SHEET);
  if (!sh || sh.getLastRow() < 2) return map;
  const values = sh.getDataRange().getDisplayValues();
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const username = ap_lower_(r[0]);
    if (!username) continue;
    map[username] = {
      name: ap_norm_(r[1]), gender: ap_norm_(r[2]), age: ap_norm_(r[3]), height: ap_norm_(r[4]),
      weight: ap_norm_(r[5]), goalWeight: ap_norm_(r[6]), activity: ap_norm_(r[7]), goal: ap_norm_(r[8]), avatar: ap_norm_(r[17])
    };
  }
  return map;
}
function ap_dashboard(token) {
  const admin = ap_requireAdmin_(token);
  const sh = ap_sheet_(AP_CONFIG.USERS_SHEET);
  const values = sh.getDataRange().getDisplayValues();
  const profiles = ap_profileMap_();
  const users = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i];
    const username = ap_norm_(r[0]);
    if (!username) continue;
    users.push({
      username: username,
      role: ap_lower_(r[5]) || 'user',
      supplementPlans: ap_splitPlans_(r[2]),
      workoutPlans: ap_splitPlans_(r[3]),
      dietPlans: ap_splitPlans_(r[4]),
      telegramChatId: ap_norm_(r[6]),
      coachUsername: ap_norm_(r[7]),
      profile: profiles[ap_lower_(username)] || null
    });
  }
  const plans = ap_planOptions_();
  return {
    ok: true,
    admin: admin.username,
    stats: {
      total: users.length,
      students: users.filter(function (u) { return u.role === 'user'; }).length,
      coaches: users.filter(function (u) { return u.role === 'coach'; }).length,
      admins: users.filter(function (u) { return u.role === 'admin'; }).length,
      workoutPlans: plans.workout.length, dietPlans: plans.diet.length, supplementPlans: plans.supplement.length
    },
    users: users,
    plans: plans
  };
}
function ap_validatePlanNames_(arr, allowed) {
  if (!Array.isArray(arr)) return [];
  return arr.map(function (v) { return ap_norm_(v); }).filter(function (v, index, all) {
    return v && allowed.indexOf(v) >= 0 && all.indexOf(v) === index;
  });
}
function ap_checkUniqueUsername_(username, exceptUsername) {
  const sh = ap_sheet_(AP_CONFIG.USERS_SHEET);
  const vals = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getDisplayValues();
  const wanted = ap_lower_(username), except = ap_lower_(exceptUsername);
  for (let i = 0; i < vals.length; i++) {
    const existing = ap_lower_(vals[i][0]);
    if (existing && existing === wanted && existing !== except) throw new Error('این نام کاربری قبلاً وجود دارد.');
  }
}
function ap_createUser(token, input) {
  const admin = ap_requireAdmin_(token);
  input = input || {};
  const username = ap_norm_(input.username);
  const password = String(input.password == null ? '' : input.password).trim();
  const role = ['user','coach','admin'].indexOf(ap_lower_(input.role)) >= 0 ? ap_lower_(input.role) : 'user';
  if (!username) throw new Error('نام کاربری الزامی است.');
  if (/[\r\n\t]/.test(username)) throw new Error('نام کاربری نمی‌تواند شامل خط جدید یا Tab باشد.');
  if (password.length < 6) throw new Error('رمز عبور باید حداقل ۶ کاراکتر باشد.');
  ap_checkUniqueUsername_(username, '');
  const options = ap_planOptions_();
  const workout = ap_validatePlanNames_(input.workoutPlans, options.workout);
  const diet = ap_validatePlanNames_(input.dietPlans, options.diet);
  const supplements = ap_validatePlanNames_(input.supplementPlans, options.supplement);
  const sh = ap_sheet_(AP_CONFIG.USERS_SHEET);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    ap_checkUniqueUsername_(username, '');
    const row = Math.max(sh.getLastRow() + 1, 2);
    const rowData = [ap_safeCell_(username), '', supplements.join('|'), workout.join('|'), diet.join('|'), role, ap_safeCell_(input.telegramChatId || ''), ap_safeCell_(input.coachUsername || '')];
    sh.getRange(row, 1, 1, 8).setValues([rowData]);
    ap_textCell_(sh.getRange(row, 2), password);
  } finally { lock.releaseLock(); }
  return { ok: true, message: 'کاربر ساخته شد.', data: ap_dashboard(token) };
}
function ap_updateUser(token, input) {
  ap_requireAdmin_(token);
  input = input || {};
  const targetName = ap_norm_(input.username);
  const target = ap_findUser_(targetName);
  if (!target) throw new Error('کاربر پیدا نشد.');
  const role = ap_lower_(input.role);
  if (['user','coach','admin'].indexOf(role) < 0) throw new Error('نقش انتخاب‌شده معتبر نیست.');
  if (target.role === 'admin' && role !== 'admin') {
    const admins = ap_ss_().getSheetByName(AP_CONFIG.USERS_SHEET).getDataRange().getDisplayValues().slice(1)
      .filter(function (r) { return ap_norm_(r[0]) && ap_lower_(r[5]) === 'admin'; }).length;
    if (admins <= 1) throw new Error('حداقل یک حساب ادمین باید باقی بماند.');
  }
  const options = ap_planOptions_();
  const workout = ap_validatePlanNames_(input.workoutPlans, options.workout);
  const diet = ap_validatePlanNames_(input.dietPlans, options.diet);
  const supplements = ap_validatePlanNames_(input.supplementPlans, options.supplement);
  const sh = ap_sheet_(AP_CONFIG.USERS_SHEET);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    sh.getRange(target.row, 3, 1, 4).setValues([[supplements.join('|'), workout.join('|'), diet.join('|'), role]]);
    ap_textCell_(sh.getRange(target.row, 7), input.telegramChatId || '');
    ap_textCell_(sh.getRange(target.row, 8), input.coachUsername || '');
  } finally { lock.releaseLock(); }
  return { ok: true, message: 'اطلاعات کاربر ذخیره شد.', data: ap_dashboard(token) };
}
function ap_resetPassword(token, username, newPassword) {
  ap_requireAdmin_(token);
  const target = ap_findUser_(username);
  if (!target) throw new Error('کاربر پیدا نشد.');
  const password = String(newPassword == null ? '' : newPassword).trim();
  if (password.length < 6) throw new Error('رمز جدید باید حداقل ۶ کاراکتر باشد.');
  const sh = ap_sheet_(AP_CONFIG.USERS_SHEET);
  ap_textCell_(sh.getRange(target.row, 2), password);
  return { ok: true, message: 'رمز جدید ذخیره شد. نشست‌های فعال برنامه اصلی ممکن است تا پایان زمان نشست فعلی باز بمانند.' };
}
function ap_deleteUser(token, username) {
  const admin = ap_requireAdmin_(token);
  const target = ap_findUser_(username);
  if (!target) throw new Error('کاربر پیدا نشد.');
  if (ap_lower_(target.username) === ap_lower_(admin.username)) throw new Error('نمی‌توانید حساب خودتان را حذف کنید.');
  if (target.role === 'admin') {
    const admins = ap_ss_().getSheetByName(AP_CONFIG.USERS_SHEET).getDataRange().getDisplayValues().slice(1)
      .filter(function (r) { return ap_norm_(r[0]) && ap_lower_(r[5]) === 'admin'; }).length;
    if (admins <= 1) throw new Error('حداقل یک حساب ادمین باید باقی بماند.');
  }
  ap_sheet_(AP_CONFIG.USERS_SHEET).deleteRow(target.row);
  return { ok: true, message: 'حساب از شیت Users حذف شد.', data: ap_dashboard(token) };
}


/* ---------------------------------------------------------------
 * Client app code. Sent to the browser with google.script.run
 * HtmlService strips JS comments from HTML output, which breaks
 * inline scripts (URLs and image/* inside strings). So the app
 * code lives here as plain text.
 * --------------------------------------------------------------- */

function ap_migratePasswordIfPlaintext_(row, storedPassword, candidatePassword) {
  if (String(storedPassword || "").indexOf("v2$") === 0 || String(storedPassword || "").indexOf("$") > -1) return;
  getSS_().getSheetByName(CONFIG.USERS_SHEET).getRange(row, 2).setValue(ap_hashPasswordV2_(candidatePassword, Utilities.getUuid().replace(/-/g, "").slice(0, 16)));
}
