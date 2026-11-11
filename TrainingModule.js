/**
 * TrainingModule.gs — سیستم بانک حرکات + برنامه‌ساز تمرینی Saeedi Fit
 *
 * افزودنی است و به شیت‌های قبلی (Users، برنامه‌های شیتی، ExerciseLogs ...) دست نمی‌زند.
 * شیت‌های جدید همه با پیشوند SF_ ساخته می‌شوند تا با شیت‌های قدیمی تداخل نکنند:
 *   SF_ExerciseBank  بانک حرکات (بدنسازی + هوازی + شکم و پهلو) با ستون‌های رسانه
 *   SF_Plans         برنامه‌ها (هر برنامه به یک شاگرد)
 *   SF_Blocks        بلوک‌های تمرینی هر روز (هر بلوک یک «روش تمرینی» دارد)
 *   SF_BlockItems    حرکت‌های داخل هر بلوک (سوپرست = ۲ حرکت، جاینت‌ست = ۴+ حرکت)
 *   SF_Sets          ست‌ها (برای هر ست و هر حرکت یک ردیف)
 *   SF_Progress      عملکرد واقعی شاگرد (وزنه/تکرار هر ست)
 *
 * وابستگی‌ها: Code.gs (getSS_, requireSession_, isAdmin_, normalize_, todayISO_, CONFIG)
 *            ExerciseData.gs (SF_BANK_HEADERS, SF_BANK_ROWS)
 */

const SF = {
  BANK: 'SF_ExerciseBank', PLANS: 'SF_Plans', BLOCKS: 'SF_Blocks', ITEMS: 'SF_BlockItems',
  SETS: 'SF_Sets', PROGRESS: 'SF_Progress',
  DRIVE_FOLDER: 'SaeediFit_Exercise_GIFs',
  READY_PROP: 'SF_READY_V2',
  MAX_BLOCKS: 80, MAX_SETS: 20, MAX_ITEMS: 6
};

const SF_HEADERS = {
  SF_ExerciseBank: SF_BANK_HEADERS,
  SF_Plans: ['PlanID', 'Username', 'PlanName', 'Goal', 'Level', 'Active', 'CreatedAt', 'UpdatedAt', 'CreatedBy', 'CoachNotes'],
  SF_Blocks: ['BlockID', 'PlanID', 'DayNo', 'DayTitle', 'OrderNo', 'Technique', 'BlockNotes', 'RestBetweenSec', 'Extra'],
  SF_BlockItems: ['ItemID', 'BlockID', 'PlanID', 'PosNo', 'ExerciseID', 'ExerciseName', 'MuscleGroup', 'Category'],
  SF_Sets: ['SetID', 'BlockID', 'PlanID', 'SetNo', 'PosNo', 'ExerciseID', 'Reps', 'TargetWeightKg', 'RestAfterSec', 'Technique', 'Extra'],
  SF_Diets: ['DietID', 'Username', 'PlanName', 'SectionNo', 'SectionTitle', 'ItemNo', 'ItemTitle', 'Description', 'Kcal', 'Active', 'CreatedAt', 'UpdatedAt'],
  SF_Supps: ['SuppID', 'Username', 'PlanName', 'Kind', 'SectionNo', 'SectionTitle', 'ItemNo', 'Name', 'Detail', 'Timing', 'Extra', 'Active', 'CreatedAt', 'UpdatedAt'],
  SF_Progress: ['ProgressID', 'Username', 'DateISO', 'PlanID', 'PlanName', 'DayNo', 'BlockID', 'ExerciseID', 'ExerciseName',
    'SetNo', 'PosNo', 'StepNo', 'Technique', 'PrescribedReps', 'ActualReps', 'ActualWeightKg', 'RPE', 'Completed', 'Notes', 'CreatedAt', 'UpdatedAt'],
  SF_Alerts: ['AlertID', 'Time', 'Coach', 'Username', 'PlanID', 'PlanName', 'Type', 'Message', 'Items', 'Seen']
};
// ستون‌هایی که باید «متن» بمانند (جلوگیری از تبدیل 10-12 به تاریخ توسط Google Sheets)
const SF_TEXT_COLS = {
  SF_ExerciseBank: null, // همه ستون‌ها
  SF_Plans: null, SF_Blocks: null, SF_BlockItems: null, SF_Sets: null,
  SF_Diets: null, SF_Supps: null, SF_Alerts: null,
  SF_Progress: ['ProgressID', 'Username', 'DateISO', 'PlanID', 'PlanName', 'BlockID', 'ExerciseID', 'ExerciseName', 'Technique', 'PrescribedReps', 'Notes', 'CreatedAt', 'UpdatedAt']
};

const SF_TECHNIQUES = [
  { key: 'normal', label: 'ست معمولی', min: 1, max: 1, desc: 'یک حرکت، چند ست با استراحت بین ست‌ها.' },
  { key: 'superset', label: 'سوپرست', min: 2, max: 2, desc: 'دو حرکت پشت سر هم بدون استراحت؛ سپس استراحت.' },
  { key: 'triset', label: 'تری‌ست', min: 3, max: 3, desc: 'سه حرکت پشت سر هم بدون استراحت.' },
  { key: 'giantset', label: 'جاینت‌ست', min: 4, max: 6, desc: 'چهار حرکت یا بیشتر پشت سر هم برای یک عضله.' },
  { key: 'dropset', label: 'دراپ‌ست', min: 1, max: 1, desc: 'بعد از رسیدن به ناتوانی، وزنه کم می‌شود و بدون استراحت ادامه می‌دهید.' },
  { key: 'pyramid', label: 'ست هرمی', min: 1, max: 1, desc: 'وزنه از ست‌ها بالا می‌رود و تکرار کم می‌شود.' },
  { key: 'reverse_pyramid', label: 'هرمی معکوس', min: 1, max: 1, desc: 'ست اول سنگین‌ترین، بعد وزنه کم و تکرار بیشتر.' },
  { key: 'restpause', label: 'رست‌پاز', min: 1, max: 1, desc: 'ست سنگین تا ناتوانی؛ چند ثانیه مکث و ادامه با تکرارهای کوتاه.' },
  { key: 'myoreps', label: 'مایو-رپس', min: 1, max: 1, desc: 'یک ست فعال‌سازی و بعد چند مینی‌ست کوتاه با مکث کم.' },
  { key: 'mechanical_drop', label: 'دراپ‌ست مکانیکی', min: 2, max: 3, desc: 'از سخت‌ترین فرم حرکت به آسان‌ترین، بدون کم کردن وزنه.' },
  { key: 'tempo', label: 'اسلو / تمپو', min: 1, max: 1, desc: 'اجرای کند با تمپوی مشخص (مثلاً ۳-۱-۱).' },
  { key: 'fst7', label: 'FST-7', min: 1, max: 1, desc: 'هفت ست پشت سر هم با استراحت کوتاه (۳۰ تا ۴۵ ثانیه).' },
  { key: 'cardio', label: 'هوازی', min: 1, max: 1, desc: 'فعالیت هوازی بر اساس مدت زمان و شدت.' }
];
function sfTechnique_(key) { return SF_TECHNIQUES.find(t => t.key === key) || null; }

// ---------------------------------------------------------------------------
// شیت‌ها
// ---------------------------------------------------------------------------

function sfEnsure_() {
  const props = PropertiesService.getScriptProperties();
  const ss = getSS_();
  if (props.getProperty(SF.READY_PROP) === '1' && Object.keys(SF_HEADERS).every(n => ss.getSheetByName(n))) return ss;
  Object.keys(SF_HEADERS).forEach(name => sfEnsureSheet_(ss, name));
  sfSeedBankIfEmpty_(ss);
  props.setProperty(SF.READY_PROP, '1');
  return ss;
}

function sfEnsureSheet_(ss, name) {
  const headers = SF_HEADERS[name];
  let sh = ss.getSheetByName(name);
  let created = false;
  if (!sh) { sh = ss.insertSheet(name); created = true; }
  const lastCol = Math.max(1, sh.getLastColumn());
  const current = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(normalize_);
  const empty = current.every(v => v === '');
  if (empty) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    created = true;
  } else {
    // ستون‌های جدید نسخه‌های بعدی را به انتها اضافه می‌کند؛ ستون‌های شما دست‌نخورده می‌مانند.
    const missing = headers.filter(h => current.indexOf(h) < 0);
    if (missing.length) sh.getRange(1, current.filter(Boolean).length + 1, 1, missing.length).setValues([missing]);
  }
  if (created) {
    const cols = SF_TEXT_COLS[name];
    const all = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normalize_);
    const rows = Math.max(2, sh.getMaxRows() - 1);
    if (cols === null) sh.getRange(2, 1, rows, all.length).setNumberFormat('@');
    else cols.forEach(c => { const i = all.indexOf(c); if (i >= 0) sh.getRange(2, i + 1, rows, 1).setNumberFormat('@'); });
  }
  sh.setFrozenRows(1);
  return sh;
}

var __SF_ENSURE_USED_ = false;
function sfSheet_(name) {
  const sh = getSS_().getSheetByName(name);
  if (sh) return sh;
  /* بازسازی شیت‌ها در هر اجرا فقط یک‌بار انجام می‌شود؛ قبلاً هر خواندنِ
     شیت ناموجود کل جدول را از نو می‌ساخت و لود اپ را ده‌ها ثانیه کند می‌کرد. */
  if (!__SF_ENSURE_USED_) {
    __SF_ENSURE_USED_ = true;
    try { PropertiesService.getScriptProperties().deleteProperty(SF.READY_PROP); } catch (e0) {}
    try { sfEnsure_(); } catch (e1) {}
  }
  return getSS_().getSheetByName(name);
}

function sfSeedBankIfEmpty_(ss) {
  const sh = ss.getSheetByName(SF.BANK);
  if (sh.getLastRow() > 1) return 0;
  return sfWriteBankRows_(sh, SF_BANK_ROWS);
}

// ردیف‌های کاتالوگ را بر اساس نام ستون‌های واقعی شیت (نه ترتیب) می‌نویسد.
function sfWriteBankRows_(sh, rows) {
  if (!rows.length) return 0;
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(normalize_);
  const map = head.map(h => SF_BANK_HEADERS.indexOf(h));
  const data = rows.map(r => map.map(i => i < 0 ? '' : (r[i] == null ? '' : String(r[i]))));
  const start = Math.max(2, sh.getLastRow() + 1);
  if (start + data.length - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), start + data.length - 1 - sh.getMaxRows());
  const rng = sh.getRange(start, 1, data.length, head.length);
  rng.setNumberFormat('@');
  rng.setValues(data);
  return data.length;
}

/* ---------------------------------------------------------------------------
 * کش خواندن در سطح یک اجرا
 * هر شیت در یک درخواست حداکثر یک‌بار خوانده می‌شود. این کار الگوی N+1 را حذف
 * می‌کند؛ مثلاً داشبورد مربی با ۸۰ ورزشکار قبلاً صدها بار AppLogs را می‌خواند.
 * هر نوشتن، کش همان شیت را باطل می‌کند تا داده کهنه نمایش داده نشود.
 * ------------------------------------------------------------------------- */
var __SF_RC = {};
function sfInvalidate_(name) {
  if (name) { delete __SF_RC[name]; return; }
  __SF_RC = {};
}

/* بانک غذا بین درخواست‌ها کش می‌شود.
   کلاینت برای هر کلید تایپ sfFoodBank را صدا می‌زند؛ بدون این کش هر
   کاراکتر یک خواندن کامل شیت هزینه داشت. TTL کوتاه تا افزودن غذای جدید
   دیرتر از چند دقیقه دیده نشود. */
function sfBumpFoodCache_() {
  try { CacheService.getScriptCache().remove('cat_foods_v2'); } catch (e) {}
}

function sfRead_(name) {
  const hit = __SF_RC[name];
  if (hit) return hit;
  const sh = sfSheet_(name);
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 1 || lastCol < 1) {
    const empty = { sh, headers: [], idx: {}, rows: [] };
    __SF_RC[name] = empty;
    return empty;
  }
  const values = sh.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const headers = values.shift().map(normalize_);
  const idx = {}; headers.forEach((h, i) => { if (h) idx[h] = i; });
  const out = { sh, headers, idx, rows: values };
  __SF_RC[name] = out;
  return out;
}
function sfObj_(rd, row) { const o = {}; Object.keys(rd.idx).forEach(k => { o[k] = row[rd.idx[k]]; }); return o; }
function sfObjects_(rd) { return rd.rows.filter(r => normalize_(r[0]) !== '').map(r => sfObj_(rd, r)); }

// ردیف‌ها را به انتهای شیت اضافه می‌کند؛ rows آرایه‌ی آبجکت‌هاست و بر اساس نام ستون چیده می‌شود.
function sfAppend_(name, objs) {
  if (!objs.length) return;
  const rd = sfRead_(name);
  const sh = rd.sh;
  const width = rd.headers.length;
  const data = objs.map(o => rd.headers.map(h => (o[h] == null ? '' : o[h])));
  const start = Math.max(2, sh.getLastRow() + 1);
  if (start + data.length - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), start + data.length - 1 - sh.getMaxRows());
  const cols = SF_TEXT_COLS[name];
  const rng = sh.getRange(start, 1, data.length, width);
  if (cols === null || typeof cols === 'undefined') rng.setNumberFormat('@');
  else if (Array.isArray(cols)) cols.forEach(c => { const i = rd.headers.indexOf(c); if (i >= 0) sh.getRange(start, i + 1, data.length, 1).setNumberFormat('@'); });
  rng.setValues(data);
  sfInvalidate_(name);
}

// همه ردیف‌هایی که keep(row)=false باشند حذف می‌شوند؛ سپس newObjs اضافه می‌شود.
function sfRewrite_(name, keepFn, newObjs) {
  const rd = sfRead_(name);
  const sh = rd.sh;
  const kept = rd.rows.filter(r => normalize_(r[0]) !== '' && keepFn(sfObj_(rd, r)));
  const all = kept.concat((newObjs || []).map(o => rd.headers.map(h => (o[h] == null ? '' : o[h]))));
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, rd.headers.length).clearContent();
  sfInvalidate_(name);
  if (!all.length) return;
  if (all.length + 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), all.length + 1 - sh.getMaxRows());
  const cols = SF_TEXT_COLS[name];
  const rng = sh.getRange(2, 1, all.length, rd.headers.length);
  if (cols === null || typeof cols === 'undefined') rng.setNumberFormat('@');
  else if (Array.isArray(cols)) cols.forEach(c => { const i = rd.headers.indexOf(c); if (i >= 0) sh.getRange(2, i + 1, all.length, 1).setNumberFormat('@'); });
  rng.setValues(all);
}

// ---------------------------------------------------------------------------
// دسترسی
// ---------------------------------------------------------------------------

function sfAdmin_(token) {
  const s = requireSession_(token);
  if (!isAdmin_(s)) throw new Error('فقط ادمین به این بخش دسترسی دارد.');
  return s;
}
function sfUser_(token) { return requireSession_(token); }
function sfWithLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { try { lock.releaseLock(); } catch (e) {} }
}
function sfNum_(v, def, min, max) {
  const n = Number(String(v == null ? '' : v).replace(/,/g, '.'));
  if (!isFinite(n) || String(v).trim() === '') return def;
  return Math.max(min, Math.min(max, n));
}
function sfText_(v, max) { return normalize_(v).slice(0, max || 500); }
function sfJson_(v) { try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; } }
function sfIsTrue_(v) { const s = normalize_(v).toLowerCase(); return !(s === 'false' || s === '0' || s === 'خیر' || s === 'no'); }

// ---------------------------------------------------------------------------
// رسانه (GIF / تصویر / یوتیوب)
// ---------------------------------------------------------------------------

function sfDriveIdFromUrl_(u) {
  const s = normalize_(u);
  let m = s.match(/drive\.google\.com\/file\/d\/([\w-]{20,})/); if (m) return m[1];
  m = s.match(/[?&]id=([\w-]{20,})/); if (m && /google\.com/.test(s)) return m[1];
  m = s.match(/googleusercontent\.com\/d\/([\w-]{20,})/); if (m) return m[1];
  return '';
}
// لیست آدرس‌های کاندید برای یک رسانه؛ مرورگر به ترتیب امتحان می‌کند تا یکی لود شود.
// اولویت رسانه: گیف جدید مربی ← گیف ذخیره‌شده در درایو ← گیف قدیمی.
// گیف قدیمی فقط وقتی نمایش داده می‌شود که گیف جدید همان حرکت موجود نباشد.
/* نگاشت شناسهٔ حرکت ← کلید رسانه روی آینه (muscle__slug)؛ یک‌بار ساخته و کش می‌شود */
var SF_LIB_KEY_MAP_ = null;
function sfLibKeyMap_() {
  if (SF_LIB_KEY_MAP_) return SF_LIB_KEY_MAP_;
  const map = {};
  try {
    (SF_LIB || []).forEach(function (it) {
      const key = String(it.i || '').split('/').join('__');
      if (!key) return;
      if (it.id) map[String(it.id)] = { key: key, url: String(it.gifSelf || '') };
    });
  } catch (e) {}
  SF_LIB_KEY_MAP_ = map;
  return map;
}
/* ایندکس شناسهٔ کتابخانه (EXL…) ← خودِ آیتم؛ برای حرکاتی که فقط در کتابخانه هستند */
var SF_LIB_IDX_ = null;
function sfLibIdx_() {
  if (SF_LIB_IDX_) return SF_LIB_IDX_;
  const map = {};
  try { (SF_LIB || []).forEach(function (it) { if (it && it.id) map[String(it.id)] = it; }); } catch (e) {}
  SF_LIB_IDX_ = map;
  return map;
}
function sfLibById_(id) {
  const k = normalize_(id || '');
  return (k && sfLibIdx_()[k]) || null;
}
/** اطلاعات حرکت از کتابخانه (برای حرکاتی که در بانک شیت ردیف ندارند) */
function sfLibInfo_(it) {
  const key = String(it.i || '').split('/').join('__');
  const gif = String(it.gifSelf || '');
  const name = normalize_(it.n) || normalize_(it.fa);
  return {
    id: it.id, fa: it.fa, en: it.n, cat: sfMoveCat_(it), group: it.g || '', sub: it.sub || '',
    sec: it.sec || '', equip: it.ef || '', level: it.lv || '', mech: it.mech || '', ins: '', tips: '',
    sets: it.sets, reps: it.reps, rest: it.rest, intensity: '', aliases: '',
    media: { gif: gif ? [gif] : [], frames: [], src: gif ? 'lib' : '', key: key },
    yt: { id: '', url: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' exercise proper form tutorial'), search: '' },
    gifUrl: '', gifSrc: '', cardio: it.c === 'cardio', lib: true
  };
}

/** رسانهٔ آینه برای یک ردیف بانک (اگر حرکت از کتابخانه آمده باشد) */
function sfLibMediaMeta_(ex) {
  try {
    const id = normalize_((ex && ex.ExerciseID) || '');
    return (id && sfLibKeyMap_()[id]) || null;
  } catch (e) { return null; }
}

function sfMediaOf_(ex) {
  const media = { gif: [], frames: [], src: '' };
  const libMeta = sfLibMediaMeta_(ex);
  media.key = libMeta ? libMeta.key : '';
  const newId = normalize_(ex.GifNewFileId);
  const newUrl = normalize_(ex.GifNewURL);
  const manual = normalize_(ex.GifURL);
  if (newId) { media.gif = sfDriveCands_(newId); media.src = 'new'; }
  else if (newUrl) { const nid = sfDriveIdFromUrl_(newUrl); media.gif = nid ? sfDriveCands_(nid) : [newUrl]; media.src = 'new'; }
  else if (normalize_(ex.GifFileId)) { media.gif = sfDriveCands_(normalize_(ex.GifFileId)); media.src = 'file'; }
  else if (manual) {
    const id = sfDriveIdFromUrl_(manual);
    media.gif = id ? sfDriveCands_(id) : [manual];
    media.src = 'old';
  }
  /* پشتیبان: اگر منبع اصلی (کتابخانه/گیف جدید) لود نشد، گیف قدیمی همان حرکت
     امتحان می‌شود؛ کلاینت آدرس‌ها را به ترتیب روی <img> می‌گذارد. */
  if (media.src === 'new') {
    const legacyId = normalize_(ex.GifFileId);
    const legacy = legacyId
      ? sfDriveCands_(legacyId)
      : (manual ? (sfDriveIdFromUrl_(manual) ? sfDriveCands_(sfDriveIdFromUrl_(manual)) : [manual]) : []);
    legacy.forEach(function (u) { if (u && media.gif.indexOf(u) < 0) media.gif.push(u); });
  }
  [0, 1].forEach(i => {
    const c = sfDriveCands_(normalize_(ex['ImgFileId' + i])).concat(normalize_(ex['ImgSrc' + i]) ? [normalize_(ex['ImgSrc' + i])] : []);
    if (c.length) media.frames.push(c);
  });
  /* رسانهٔ خودمان (WebP روی آینه) همیشه اول؛ اگر لود نشد، مرورگر آدرس بعدی را امتحان می‌کند */
  if (libMeta && libMeta.url && media.gif.indexOf(libMeta.url) < 0) media.gif.unshift(libMeta.url);
  return media;
}
function sfYoutubeOf_(ex) {
  const u = normalize_(ex.YouTubeURL);
  const m = u.match(/(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([\w-]{11})/);
  const search = 'https://www.youtube.com/results?search_query=' + encodeURIComponent((normalize_(ex.EnglishName) || normalize_(ex.PersianName)) + ' exercise proper form tutorial');
  return m ? { id: m[1], url: 'https://www.youtube.com/watch?v=' + m[1], search } : { id: '', url: u && /^https?:/.test(u) ? u : search, search };
}
function sfExInfo_(ex) {
  return {
    id: ex.ExerciseID, fa: ex.PersianName, en: ex.EnglishName, cat: ex.Category, group: ex.MuscleGroup, sub: ex.SubGroup,
    sec: ex.SecondaryMuscle, equip: ex.Equipment, level: ex.Level, mech: ex.MovementType, ins: ex.Instructions, tips: ex.Tips,
    sets: ex.SuggestedSets, reps: ex.SuggestedReps, rest: ex.RestSec, intensity: ex.Intensity, aliases: ex.Aliases,
    media: sfMediaOf_(ex), yt: sfYoutubeOf_(ex), gifUrl: ex.GifURL || '', gifSrc: ex.GifSourceURL || '', cardio: ex.Category === 'هوازی'
  };
}
function sfBankMap_() {
  const rd = sfRead_(SF.BANK);
  const map = {};
  sfObjects_(rd).forEach(o => { map[o.ExerciseID] = o; });
  return map;
}

// ---------------------------------------------------------------------------
// API ادمین: بانک حرکات
// ---------------------------------------------------------------------------

function sfAdminMeta(token) {
  sfAdmin_(token); sfEnsure_();
  const bank = sfObjects_(sfRead_(SF.BANK));
  const active = bank.filter(o => sfIsTrue_(o.Active));
  const groups = [], seen = {};
  active.forEach(o => { if (o.MuscleGroup && !seen[o.MuscleGroup]) { seen[o.MuscleGroup] = 1; groups.push(o.MuscleGroup); } });
  const users = sfObjects_(sfRead_(CONFIG.USERS_SHEET)).map(o => ({ username: o.user || o.Username || '', role: (o.role || 'user') }));
  return {
    techniques: SF_TECHNIQUES, groups,
    exercises: active.map(sfExInfo_),
    users: users.filter(u => u.username && String(u.role).toLowerCase() !== 'admin')
  };
}

function sfAdminSaveExercise(token, input) {
  sfAdmin_(token); sfEnsure_();
  if (!input) throw new Error('اطلاعات حرکت ارسال نشد.');
  return sfWithLock_(() => {
    const rd = sfRead_(SF.BANK);
    const sh = rd.sh;
    const id = sfText_(input.ExerciseID, 40);
    const editable = ['PersianName', 'EnglishName', 'Category', 'MuscleGroup', 'SubGroup', 'SecondaryMuscle', 'Equipment', 'Level', 'MovementType',
      'Instructions', 'Tips', 'SuggestedSets', 'SuggestedReps', 'RestSec', 'Intensity', 'Aliases', 'GifURL', 'GifSourceURL', 'YouTubeURL', 'Active'];
    const clean = {};
    editable.forEach(k => { if (input[k] !== undefined) clean[k] = sfText_(input[k], k === 'Instructions' || k === 'Tips' ? 1500 : 400); });
    ['GifURL', 'GifSourceURL', 'YouTubeURL'].forEach(k => { if (clean[k] && !/^https?:\/\//i.test(clean[k])) throw new Error('آدرس ' + k + ' باید با http یا https شروع شود.'); });
    if (clean.GifSourceURL !== undefined) clean.MediaStatus = clean.GifSourceURL ? 'pending' : '';
    const rowIdx = id ? rd.rows.findIndex(r => normalize_(r[rd.idx.ExerciseID]) === id) : -1;
    if (rowIdx >= 0) {
      Object.keys(clean).forEach(k => {
        if (rd.idx[k] === undefined) return;
        const cell = sh.getRange(rowIdx + 2, rd.idx[k] + 1);
        cell.setNumberFormat('@'); cell.setValue(clean[k]);
      });
      return { ok: true, id, updated: true };
    }
    if (!clean.PersianName) throw new Error('نام فارسی حرکت لازم است.');
    if (!clean.MuscleGroup) throw new Error('گروه عضلانی لازم است.');
    let max = 0; rd.rows.forEach(r => { const m = /^EXC(\d+)$/.exec(normalize_(r[0])); if (m) max = Math.max(max, Number(m[1])); });
    const newId = 'EXC' + ('0000' + (max + 1)).slice(-4);
    const obj = Object.assign({ Category: clean.MuscleGroup === 'هوازی' ? 'هوازی' : (clean.MuscleGroup === 'شکم' || clean.MuscleGroup === 'پهلو' ? 'شکم و پهلو' : 'بدنسازی'),
      SuggestedSets: '3', SuggestedReps: '10-12', RestSec: '60', Active: 'بله', SourceNote: 'افزوده‌شده توسط مربی' }, clean, { ExerciseID: newId });
    sfAppend_(SF.BANK, [obj]);
    return { ok: true, id: newId, created: true };
  });
}

// حرکات جدیدِ نسخه‌های بعدی کاتالوگ را (فقط ExerciseIDهای ناموجود) اضافه می‌کند.
function sfAdminSyncCatalog(token) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(() => {
    const rd = sfRead_(SF.BANK);
    const have = {}; rd.rows.forEach(r => { have[normalize_(r[0])] = 1; });
    const add = SF_BANK_ROWS.filter(r => !have[r[0]]);
    return { ok: true, added: sfWriteBankRows_(rd.sh, add), total: rd.rows.length + add.length };
  });
}

// ---------------------------------------------------------------------------
// دانلود تصاویر/GIF به Google Drive
// ---------------------------------------------------------------------------

function sfMediaSharing_() { return PropertiesService.getScriptProperties().getProperty('SF_MEDIA_SHARING') || 'ANYONE_WITH_LINK'; }
function sfDriveFolder_() {
  const it = DriveApp.getFoldersByName(SF.DRIVE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(SF.DRIVE_FOLDER);
}
function sfSlug_(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'exercise'; }

// یک فایل را دانلود و در پوشه ذخیره می‌کند. اگر قبلاً با همان نام ذخیره شده باشد، دوباره دانلود نمی‌کند.
function sfDownloadToDrive_(folder, url, baseName) {
  let resp = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true, headers: { 'User-Agent': 'Mozilla/5.0 (SaeediFit)' } }); } catch (e) { resp = null; }
    if (resp && resp.getResponseCode() === 200) break;
    Utilities.sleep(400);
  }
  if (!resp) throw new Error('دسترسی به آدرس ممکن نشد');
  const code = resp.getResponseCode();
  if (code !== 200) throw new Error('HTTP ' + code);
  const blob = resp.getBlob();
  const bytes = blob.getBytes();
  if (bytes.length < 200) throw new Error('فایل خالی/نامعتبر');
  if (bytes.length > 9 * 1024 * 1024) throw new Error('حجم فایل بیش از ۹ مگابایت');
  const head = String.fromCharCode(bytes[0] & 255, bytes[1] & 255, bytes[2] & 255, bytes[3] & 255);
  let ext = '', mime = '';
  if (head.indexOf('GIF8') === 0) { ext = 'gif'; mime = 'image/gif'; }
  else if ((bytes[0] & 255) === 0xFF && (bytes[1] & 255) === 0xD8) { ext = 'jpg'; mime = 'image/jpeg'; }
  else if ((bytes[0] & 255) === 0x89 && head.indexOf('PNG') === 1) { ext = 'png'; mime = 'image/png'; }
  else if (head === 'RIFF') { ext = 'webp'; mime = 'image/webp'; }
  else throw new Error('محتوا تصویر/GIF نیست');
  const fileName = baseName + '.' + ext;
  const existing = folder.getFilesByName(fileName);
  let file;
  if (existing.hasNext()) file = existing.next();
  else { file = folder.createFile(blob.setName(fileName).setContentType(mime)); }
  if (sfMediaSharing_() === 'ANYONE_WITH_LINK') {
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { /* ممکن است سیاست دامنه مانع شود */ }
  }
  return file.getId();
}

// یک مرحله دانلود (تا حدود ۴ دقیقه). چند بار فراخوانی شود تا remaining صفر شود.
function sfMediaBatch_(maxRows, budgetMs) {
  sfEnsure_();
  const rd = sfRead_(SF.BANK);
  const I = rd.idx, sh = rd.sh;
  const started = Date.now();
  const folder = sfDriveFolder_();
  const res = { processed: 0, downloaded: 0, failed: 0, remaining: 0, errors: [] };
  const needs = (r) => (normalize_(r[I.GifSourceURL]) && !normalize_(r[I.GifFileId]) && !/^error/.test(normalize_(r[I.MediaStatus]))) ||
    (normalize_(r[I.ImgSrc0]) && !normalize_(r[I.ImgFileId0]) && !/^error/.test(normalize_(r[I.MediaStatus]))) ||
    (normalize_(r[I.ImgSrc1]) && !normalize_(r[I.ImgFileId1]) && !/^error/.test(normalize_(r[I.MediaStatus])));
  const todo = []; rd.rows.forEach((r, i) => { if (normalize_(r[0]) && needs(r)) todo.push(i); });
  for (let t = 0; t < todo.length; t++) {
    if (res.processed >= maxRows || Date.now() - started > budgetMs) break;
    const i = todo[t], r = rd.rows[i], rowNo = i + 2;
    const slug = normalize_(r[I.ExerciseID]) + '_' + sfSlug_(r[I.EnglishName]);
    const set = (col, val) => { const c = sh.getRange(rowNo, I[col] + 1); c.setNumberFormat('@'); c.setValue(val); };
    let errMsg = '', okCount = 0;
    const jobs = [['GifSourceURL', 'GifFileId', slug + '_gif'], ['ImgSrc0', 'ImgFileId0', slug + '_0'], ['ImgSrc1', 'ImgFileId1', slug + '_1']];
    jobs.forEach(j => {
      const src = normalize_(r[I[j[0]]]);
      if (!src || normalize_(r[I[j[1]]])) return;
      try { set(j[1], sfDownloadToDrive_(folder, src, j[2])); okCount++; }
      catch (e) { errMsg = errMsg || (j[0] + ': ' + e.message); }
    });
    set('MediaStatus', errMsg ? 'error: ' + errMsg : 'ok');
    res.processed++;
    if (errMsg) { res.failed++; res.errors.push(normalize_(r[I.PersianName]) + ' — ' + errMsg); } else res.downloaded += okCount;
  }
  res.remaining = Math.max(0, todo.length - res.processed);
  return res;
}
function sfAdminMediaDownload(token) {
  sfAdmin_(token);
  return sfWithLock_(() => sfMediaBatch_(14, 200000));
}
// از ادیتور Apps Script هم می‌توان مستقیم اجرا کرد (Run > sfMediaDownloadRun). تا تمام شدن چند بار اجرا کنید.
function sfMediaDownloadRun() {
  const r = sfMediaBatch_(60, 270000);
  Logger.log('دانلود شد: %s | ناموفق: %s | باقی‌مانده: %s', r.downloaded, r.failed, r.remaining);
  r.errors.slice(0, 20).forEach(e => Logger.log(e));
  return r;
}
// ردیف‌های ناموفق را برای تلاش دوباره آماده می‌کند.
function sfAdminMediaRetry(token) {
  sfAdmin_(token);
  return sfWithLock_(() => {
    const rd = sfRead_(SF.BANK); let n = 0;
    rd.rows.forEach((r, i) => { if (/^error/.test(normalize_(r[rd.idx.MediaStatus]))) { rd.sh.getRange(i + 2, rd.idx.MediaStatus + 1).setValue('pending'); n++; } });
    return { ok: true, reset: n };
  });
}
function sfAdminMediaStatus(token) {
  sfAdmin_(token); sfEnsure_();
  const rows = sfObjects_(sfRead_(SF.BANK));
  const st = { total: rows.length, withImages: 0, downloaded: 0, pending: 0, failed: 0, withGif: 0, withVideo: 0, none: 0 };
  rows.forEach(o => {
    const hasSrc = o.ImgSrc0 || o.ImgSrc1 || o.GifSourceURL;
    if (o.GifURL || o.GifFileId) st.withGif++;
    if (sfYoutubeOf_(o).id) st.withVideo++;
    if (!hasSrc && !o.GifURL && !o.GifFileId) { st.none++; return; }
    st.withImages++;
    if (/^error/.test(o.MediaStatus)) st.failed++;
    else if ((o.GifSourceURL && !o.GifFileId) || (o.ImgSrc0 && !o.ImgFileId0) || (o.ImgSrc1 && !o.ImgFileId1)) st.pending++;
    else st.downloaded++;
  });
  st.sharing = sfMediaSharing_();
  st.hasYouTubeKey = !!PropertiesService.getScriptProperties().getProperty('YT_KEY');
  return st;
}

// پر کردن لینک ویدیوی یوتیوب با YouTube Data API (نیازمند YT_KEY در Script Properties).
// سهمیه رایگان تقریباً ۱۰۰ جست‌وجو در روز است؛ هر بار چند حرکت پر می‌شود.
function sfAdminYoutubeFill(token, limit) {
  sfAdmin_(token);
  const key = PropertiesService.getScriptProperties().getProperty('YT_KEY');
  if (!key) throw new Error('کلید YT_KEY در Script Properties تنظیم نشده است.');
  return sfWithLock_(() => {
    const rd = sfRead_(SF.BANK), I = rd.idx;
    const max = Math.min(40, Math.max(1, Number(limit) || 20));
    let done = 0, failed = 0, remaining = 0, quota = false;
    for (let i = 0; i < rd.rows.length; i++) {
      const r = rd.rows[i];
      if (!normalize_(r[0]) || !sfIsTrue_(r[I.Active])) continue;
      const ex = sfObj_(rd, r);
      if (sfYoutubeOf_(ex).id) continue;
      if (done + failed >= max || quota) { remaining++; continue; }
      const q = (ex.EnglishName || ex.PersianName) + ' exercise proper form tutorial';
      try {
        const resp = UrlFetchApp.fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=1&q=' + encodeURIComponent(q) + '&key=' + key, { muteHttpExceptions: true });
        if (resp.getResponseCode() === 403) { quota = true; remaining++; continue; }
        const json = JSON.parse(resp.getContentText());
        const first = json.items && json.items[0];
        if (!first) { failed++; continue; }
        const c = rd.sh.getRange(i + 2, I.YouTubeURL + 1); c.setNumberFormat('@'); c.setValue('https://www.youtube.com/watch?v=' + first.id.videoId);
        done++;
      } catch (e) { failed++; }
    }
    return { ok: true, filled: done, failed, remaining, quotaExceeded: quota };
  });
}

// ---------------------------------------------------------------------------
// برنامه‌ها (ادمین)
// ---------------------------------------------------------------------------

function sfNewPlanId_() { return 'SF-' + Utilities.formatDate(new Date(), tz_(), 'yyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000); }

function sfValidatePlan_(input, bank) {
  if (!input || typeof input !== 'object') throw new Error('اطلاعات برنامه ارسال نشد.');
  const planName = sfText_(input.planName, 120);
  if (!planName) throw new Error('نام برنامه را وارد کن.');
  const username = sfText_(input.username, 80);
  if (!username) throw new Error('شاگرد را انتخاب کن.');
  const users = sfObjects_(sfRead_(CONFIG.USERS_SHEET));
  const u = users.find(o => normalize_(o.user || o.Username).toLowerCase() === username.toLowerCase());
  if (!u) throw new Error('این شاگرد پیدا نشد.');
  if (!Array.isArray(input.blocks) || !input.blocks.length) throw new Error('حداقل یک حرکت به برنامه اضافه کن.');
  if (input.blocks.length > SF.MAX_BLOCKS) throw new Error('تعداد بلوک‌ها بیش از حد مجاز است.');
  const blocks = input.blocks.map((b, bi) => {
    const tech = sfTechnique_(normalize_(b.technique) || 'normal');
    if (!tech) throw new Error('روش تمرینی نامعتبر است (بلوک ' + (bi + 1) + ').');
    const items = (b.items || []).map(it => {
      const ex = bank[normalize_(it.exerciseId)];
      if (!ex) throw new Error('حرکت انتخاب‌شده در بانک پیدا نشد (بلوک ' + (bi + 1) + ').');
      return ex;
    });
    if (items.length < tech.min || items.length > Math.min(tech.max, SF.MAX_ITEMS))
      throw new Error('«' + tech.label + '» به ' + (tech.min === tech.max ? tech.min : tech.min + ' تا ' + tech.max) + ' حرکت نیاز دارد (بلوک ' + (bi + 1) + ').');
    if (tech.key === 'cardio' && items[0].Category !== 'هوازی') throw new Error('بلوک هوازی باید حرکت هوازی داشته باشد.');
    const sets = (b.sets || []).slice(0, SF.MAX_SETS).map((s, si) => ({
      setNo: si + 1,
      rest: sfNum_(s.restAfterSec, 60, 0, 600),
      cells: items.map((ex, pi) => {
        const c = (s.cells || [])[pi] || {};
        return { reps: sfText_(c.reps, 40) || sfText_(ex.SuggestedReps, 40) || '10', weight: sfText_(c.weight, 20) };
      }),
      extra: s.extra && typeof s.extra === 'object' ? s.extra : {}
    }));
    if (!sets.length) throw new Error('هر بلوک حداقل یک ست لازم دارد (بلوک ' + (bi + 1) + ').');
    const extra = b.extra && typeof b.extra === 'object' ? b.extra : {};
    if (JSON.stringify(extra).length > 4000) throw new Error('توضیحات روش تمرینی بیش از حد طولانی است.');
    return {
      dayNo: sfNum_(b.dayNo, 1, 1, 14), dayTitle: sfText_(b.dayTitle, 80), technique: tech.key, notes: sfText_(b.notes, 500),
      restBetweenSec: sfNum_(b.restBetweenSec, 90, 0, 600), extra, items, sets
    };
  });
  return {
    planName, username: normalize_(u.user || u.Username), goal: sfText_(input.goal, 80), level: sfText_(input.level, 40),
    coachNotes: sfText_(input.coachNotes, 1500), blocks
  };
}

function sfAdminSavePlan(token, input) {
  const session = sfAdmin_(token); sfEnsure_();
  return sfWithLock_(() => {
    const bank = sfBankMap_();
    const v = sfValidatePlan_(input, bank);
    const editing = sfText_(input.planId, 60);
    const planRd = sfRead_(SF.PLANS);
    let planId = editing, createdAt = new Date().toISOString(), createdBy = session.username;
    if (editing) {
      const row = planRd.rows.find(r => normalize_(r[planRd.idx.PlanID]) === editing);
      if (!row) throw new Error('برنامه برای ویرایش پیدا نشد.');
      createdAt = row[planRd.idx.CreatedAt] || createdAt; createdBy = row[planRd.idx.CreatedBy] || createdBy;
    } else planId = sfNewPlanId_();
    const now = new Date().toISOString();
    let prevInfo = null; try { prevInfo = sfPrevPlanInfo_(v.username, planId); } catch (ePrev) {}
    const repeated = sfRepeatedExercises_(v.blocks, prevInfo);
    const blockRows = [], itemRows = [], setRows = [];
    // ترتیب بلوک‌ها در هر روز
    const orderByDay = {};
    v.blocks.forEach((b, bi) => {
      const blockId = planId + '-B' + (bi + 1);
      orderByDay[b.dayNo] = (orderByDay[b.dayNo] || 0) + 1;
      blockRows.push({ BlockID: blockId, PlanID: planId, DayNo: String(b.dayNo), DayTitle: b.dayTitle || ('روز ' + b.dayNo), OrderNo: String(orderByDay[b.dayNo]),
        Technique: b.technique, BlockNotes: b.notes, RestBetweenSec: String(b.restBetweenSec), Extra: JSON.stringify(b.extra) });
      b.items.forEach((ex, pi) => itemRows.push({ ItemID: blockId + '-I' + (pi + 1), BlockID: blockId, PlanID: planId, PosNo: String(pi + 1),
        ExerciseID: ex.ExerciseID, ExerciseName: ex.PersianName, MuscleGroup: ex.MuscleGroup, Category: ex.Category }));
      b.sets.forEach(s => s.cells.forEach((c, pi) => setRows.push({ SetID: blockId + '-S' + s.setNo + '-' + (pi + 1), BlockID: blockId, PlanID: planId,
        SetNo: String(s.setNo), PosNo: String(pi + 1), ExerciseID: b.items[pi].ExerciseID, Reps: c.reps, TargetWeightKg: c.weight,
        RestAfterSec: String(s.rest), Technique: b.technique, Extra: pi === 0 ? JSON.stringify(s.extra) : '' })));
    });
    const planObj = { PlanID: planId, Username: v.username, PlanName: v.planName, Goal: v.goal, Level: v.level, Active: 'TRUE',
      CreatedAt: createdAt, UpdatedAt: now, CreatedBy: createdBy, CoachNotes: v.coachNotes };
    if (editing) {
      sfRewrite_(SF.PLANS, o => o.PlanID !== planId, [planObj]);
      sfRewrite_(SF.BLOCKS, o => o.PlanID !== planId, blockRows);
      sfRewrite_(SF.ITEMS, o => o.PlanID !== planId, itemRows);
      sfRewrite_(SF.SETS, o => o.PlanID !== planId, setRows);
    } else {
      sfAppend_(SF.PLANS, [planObj]); sfAppend_(SF.BLOCKS, blockRows); sfAppend_(SF.ITEMS, itemRows); sfAppend_(SF.SETS, setRows);
    }
    try {
      const alertRows = repeated.length ? [{
        AlertID: 'AL-' + Utilities.formatDate(new Date(), tz_(), 'yyMMddHHmmss') + '-' + Math.floor(100 + Math.random() * 900),
        Time: now, Coach: session.username, Username: v.username, PlanID: planId, PlanName: v.planName, Type: 'repeat',
        Message: repeated.length + ' حرکت از برنامهٔ قبلی «' + (prevInfo ? prevInfo.planName : '') + '» در برنامهٔ جدید «' + v.planName + '» تکرار شده: ' + repeated.map(x => x.name).join('، '),
        Items: JSON.stringify(repeated).slice(0, 3000), Seen: 'FALSE'
      }] : [];
      sfRewrite_('SF_Alerts', o => !(normalize_(o.PlanID) === planId && o.Type === 'repeat'), alertRows);
    } catch (eAl) {}
    return { ok: true, planId, blocks: blockRows.length, sets: setRows.length, edited: !!editing, repeated: repeated, prevPlanName: prevInfo ? prevInfo.planName : '' };
  });
}

function sfBuildPlans_(planObjs, bank) {
  if (!planObjs.length) return { plans: [], exercises: {} };
  const ids = {}; planObjs.forEach(p => { ids[p.PlanID] = 1; });
  const blocks = sfObjects_(sfRead_(SF.BLOCKS)).filter(o => ids[o.PlanID]);
  const items = sfObjects_(sfRead_(SF.ITEMS)).filter(o => ids[o.PlanID]);
  const sets = sfObjects_(sfRead_(SF.SETS)).filter(o => ids[o.PlanID]);
  const exercises = {};
  const plans = planObjs.map(p => {
    const days = {};
    blocks.filter(b => b.PlanID === p.PlanID).sort((a, b) => Number(a.DayNo) - Number(b.DayNo) || Number(a.OrderNo) - Number(b.OrderNo)).forEach(b => {
      const day = days[b.DayNo] || (days[b.DayNo] = { dayNo: Number(b.DayNo), title: b.DayTitle, blocks: [] });
      const tech = sfTechnique_(b.Technique) || { key: b.Technique, label: b.Technique };
      const its = items.filter(i => i.BlockID === b.BlockID).sort((a, c) => Number(a.PosNo) - Number(c.PosNo)).map(i => {
        const ex = bank[i.ExerciseID];
        if (ex && !exercises[i.ExerciseID]) exercises[i.ExerciseID] = sfExInfo_(ex);
        else if (!ex && !exercises[i.ExerciseID]) {
          /* حرکت از کتابخانه به برنامه اضافه شده و ردیفی در بانک شیت ندارد */
          const lib = sfLibById_(i.ExerciseID);
          if (lib) exercises[i.ExerciseID] = sfLibInfo_(lib);
        }
        return { pos: Number(i.PosNo), exerciseId: i.ExerciseID, name: i.ExerciseName, group: i.MuscleGroup, category: i.Category };
      });
      const bs = sets.filter(s => s.BlockID === b.BlockID);
      const byNo = {};
      bs.forEach(s => {
        const o = byNo[s.SetNo] || (byNo[s.SetNo] = { setNo: Number(s.SetNo), rest: Number(s.RestAfterSec) || 0, cells: [], extra: {} });
        o.cells.push({ pos: Number(s.PosNo), reps: s.Reps, weight: s.TargetWeightKg });
        if (s.Extra) o.extra = sfJson_(s.Extra);
      });
      const setList = Object.keys(byNo).map(k => byNo[k]).sort((a, c) => a.setNo - c.setNo);
      setList.forEach(s => s.cells.sort((a, c) => a.pos - c.pos));
      day.blocks.push({ blockId: b.BlockID, order: Number(b.OrderNo), technique: tech.key, techniqueLabel: tech.label, notes: b.BlockNotes,
        restBetweenSec: Number(b.RestBetweenSec) || 0, extra: sfJson_(b.Extra), items: its, sets: setList });
    });
    return { planId: p.PlanID, username: p.Username, planName: p.PlanName, goal: p.Goal, level: p.Level, active: sfIsTrue_(p.Active),
      createdAt: p.CreatedAt, updatedAt: p.UpdatedAt, coachNotes: p.CoachNotes,
      days: Object.keys(days).map(k => days[k]).sort((a, b) => a.dayNo - b.dayNo) };
  });
  return { plans, exercises };
}

function sfAdminListPlans(token, username) {
  sfAdmin_(token); sfEnsure_();
  const plans = sfObjects_(sfRead_(SF.PLANS)).filter(p => !username || normalize_(p.Username).toLowerCase() === normalize_(username).toLowerCase());
  const blocks = sfObjects_(sfRead_(SF.BLOCKS));
  return plans.reverse().map(p => ({
    planId: p.PlanID, username: p.Username, planName: p.PlanName, active: sfIsTrue_(p.Active), createdAt: p.CreatedAt, updatedAt: p.UpdatedAt,
    blocks: blocks.filter(b => b.PlanID === p.PlanID).length,
    days: Object.keys(blocks.filter(b => b.PlanID === p.PlanID).reduce((m, b) => { m[b.DayNo] = 1; return m; }, {})).length
  }));
}

function sfAdminGetPlan(token, planId) {
  sfAdmin_(token); sfEnsure_();
  const p = sfObjects_(sfRead_(SF.PLANS)).find(o => o.PlanID === normalize_(planId));
  if (!p) throw new Error('برنامه پیدا نشد.');
  return sfBuildPlans_([p], sfBankMap_());
}

function sfAdminSetPlanActive(token, planId, active) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(() => {
    const rd = sfRead_(SF.PLANS);
    const i = rd.rows.findIndex(r => normalize_(r[rd.idx.PlanID]) === normalize_(planId));
    if (i < 0) throw new Error('برنامه پیدا نشد.');
    rd.sh.getRange(i + 2, rd.idx.Active + 1).setValue(active ? 'TRUE' : 'FALSE');
    rd.sh.getRange(i + 2, rd.idx.UpdatedAt + 1).setValue(new Date().toISOString());
    return { ok: true };
  });
}

function sfAdminDuplicatePlan(token, planId, toUsername, newName) {
  const session = sfAdmin_(token); sfEnsure_();
  return sfWithLock_(() => {
    const plans = sfObjects_(sfRead_(SF.PLANS));
    const src = plans.find(o => o.PlanID === normalize_(planId));
    if (!src) throw new Error('برنامه پیدا نشد.');
    const users = sfObjects_(sfRead_(CONFIG.USERS_SHEET));
    const u = users.find(o => normalize_(o.user || o.Username).toLowerCase() === normalize_(toUsername).toLowerCase());
    if (!u) throw new Error('شاگرد مقصد پیدا نشد.');
    const newId = sfNewPlanId_(), now = new Date().toISOString();
    const mapB = id => id.replace(src.PlanID, newId);
    const blocks = sfObjects_(sfRead_(SF.BLOCKS)).filter(o => o.PlanID === src.PlanID).map(o => Object.assign({}, o, { BlockID: mapB(o.BlockID), PlanID: newId }));
    const items = sfObjects_(sfRead_(SF.ITEMS)).filter(o => o.PlanID === src.PlanID).map(o => Object.assign({}, o, { ItemID: mapB(o.ItemID), BlockID: mapB(o.BlockID), PlanID: newId }));
    const sets = sfObjects_(sfRead_(SF.SETS)).filter(o => o.PlanID === src.PlanID).map(o => Object.assign({}, o, { SetID: mapB(o.SetID), BlockID: mapB(o.BlockID), PlanID: newId }));
    sfAppend_(SF.PLANS, [Object.assign({}, src, { PlanID: newId, Username: normalize_(u.user || u.Username), PlanName: sfText_(newName, 120) || (src.PlanName + ' (کپی)'),
      Active: 'TRUE', CreatedAt: now, UpdatedAt: now, CreatedBy: session.username })]);
    sfAppend_(SF.BLOCKS, blocks); sfAppend_(SF.ITEMS, items); sfAppend_(SF.SETS, sets);
    return { ok: true, planId: newId };
  });
}

function sfAdminProgress(token, username, planId) {
  sfAdmin_(token); sfEnsure_();
  const rows = sfObjects_(sfRead_(SF.PROGRESS)).filter(o => (!username || normalize_(o.Username).toLowerCase() === normalize_(username).toLowerCase()) && (!planId || o.PlanID === planId));
  rows.sort((a, b) => (b.UpdatedAt || b.CreatedAt || '').localeCompare(a.UpdatedAt || a.CreatedAt || ''));
  return rows.slice(0, 300);
}

// ---------------------------------------------------------------------------
// API شاگرد
// ---------------------------------------------------------------------------

function sfClientToday_(clientToday) {
  const s = normalize_(clientToday), server = todayISO_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return server;
  const diff = Math.abs(new Date(s + 'T12:00:00Z').getTime() - new Date(server + 'T12:00:00Z').getTime());
  return diff <= 36 * 3600 * 1000 ? s : server;
}
function sfProgressKey_(blockId, setNo, posNo, stepNo) { return [blockId, setNo, posNo, stepNo || 0].join('|'); }

function sfMyPlans(token, clientToday) {
  const session = sfUser_(token); sfEnsure_();
  const mine = sfObjects_(sfRead_(SF.PLANS)).filter(p => normalize_(p.Username).toLowerCase() === session.username.toLowerCase() && sfIsTrue_(p.Active));
  const built = sfBuildPlans_(mine, sfBankMap_());
  const today = sfClientToday_(clientToday);
  const prog = sfObjects_(sfRead_(SF.PROGRESS)).filter(o => normalize_(o.Username).toLowerCase() === session.username.toLowerCase());
  const todayMap = {};
  prog.filter(o => o.DateISO === today).forEach(o => {
    todayMap[sfProgressKey_(o.BlockID, Number(o.SetNo), Number(o.PosNo || 1), Number(o.StepNo || 0))] = { w: o.ActualWeightKg, r: o.ActualReps, done: sfIsTrue_(o.Completed) };
  });
  // آخرین جلسه‌ی قبلی هر حرکت (برای نمایش «دفعه قبل»)
  const lastByEx = {};
  prog.filter(o => o.DateISO !== today && o.ActualWeightKg !== '' && o.ExerciseID).forEach(o => {
    const cur = lastByEx[o.ExerciseID];
    if (!cur || o.DateISO > cur.date) lastByEx[o.ExerciseID] = { date: o.DateISO, sets: [] };
  });
  prog.filter(o => o.DateISO !== today && o.ExerciseID && lastByEx[o.ExerciseID] && lastByEx[o.ExerciseID].date === o.DateISO && Number(o.StepNo || 0) === 0)
    .forEach(o => lastByEx[o.ExerciseID].sets.push({ setNo: Number(o.SetNo), w: o.ActualWeightKg, r: o.ActualReps }));
  Object.keys(lastByEx).forEach(k => lastByEx[k].sets.sort((a, b) => a.setNo - b.setNo));
  return { plans: built.plans, exercises: built.exercises, today: todayMap, last: lastByEx, date: today };
}

function sfLogSet(token, input) {
  const session = sfUser_(token); sfEnsure_();
  if (!input || !input.planId || !input.blockId) throw new Error('اطلاعات ست ناقص است.');
  return sfWithLock_(() => {
    const plan = sfObjects_(sfRead_(SF.PLANS)).find(p => p.PlanID === normalize_(input.planId));
    if (!plan || normalize_(plan.Username).toLowerCase() !== session.username.toLowerCase() || !sfIsTrue_(plan.Active)) throw new Error('این برنامه برای شما تعریف نشده است.');
    const block = sfObjects_(sfRead_(SF.BLOCKS)).find(b => b.BlockID === normalize_(input.blockId) && b.PlanID === plan.PlanID);
    if (!block) throw new Error('بلوک تمرینی پیدا نشد.');
    const pos = sfNum_(input.posNo, 1, 1, SF.MAX_ITEMS), setNo = sfNum_(input.setNo, 1, 1, SF.MAX_SETS), step = sfNum_(input.stepNo, 0, 0, 10);
    const item = sfObjects_(sfRead_(SF.ITEMS)).find(i => i.BlockID === block.BlockID && Number(i.PosNo) === pos);
    if (!item) throw new Error('حرکت پیدا نشد.');
    const setRow = sfObjects_(sfRead_(SF.SETS)).find(s => s.BlockID === block.BlockID && Number(s.SetNo) === setNo && Number(s.PosNo) === pos);
    if (!setRow) throw new Error('ست پیدا نشد.');
    const w = input.weightKg === '' || input.weightKg == null ? '' : sfNum_(input.weightKg, '', 0, 1000);
    const r = input.reps === '' || input.reps == null ? '' : sfNum_(input.reps, '', 0, 1000);
    const rpe = input.rpe === '' || input.rpe == null ? '' : sfNum_(input.rpe, '', 1, 10);
    const completed = input.completed === false ? 'FALSE' : 'TRUE';
    const date = sfClientToday_(input.clientToday), now = new Date().toISOString();
    const rd = sfRead_(SF.PROGRESS), I = rd.idx;
    let found = -1;
    for (let i = rd.rows.length - 1; i >= 0; i--) {
      const x = rd.rows[i];
      if (normalize_(x[I.Username]).toLowerCase() === session.username.toLowerCase() && x[I.DateISO] === date && x[I.BlockID] === block.BlockID &&
        Number(x[I.SetNo]) === setNo && Number(x[I.PosNo] || 1) === pos && Number(x[I.StepNo] || 0) === step) { found = i; break; }
    }
    const rec = { Username: session.username, DateISO: date, PlanID: plan.PlanID, PlanName: plan.PlanName, DayNo: block.DayNo, BlockID: block.BlockID,
      ExerciseID: item.ExerciseID, ExerciseName: item.ExerciseName, SetNo: String(setNo), PosNo: String(pos), StepNo: String(step), Technique: block.Technique,
      PrescribedReps: setRow.Reps, ActualReps: r, ActualWeightKg: w, RPE: rpe, Completed: completed, Notes: sfText_(input.notes, 300), UpdatedAt: now };
    if (found >= 0) {
      const rowNo = found + 2;
      ['PrescribedReps', 'ActualReps', 'ActualWeightKg', 'RPE', 'Completed', 'Notes', 'UpdatedAt'].forEach(k => rd.sh.getRange(rowNo, I[k] + 1).setValue(rec[k]));
      return { ok: true, updated: true };
    }
    rec.ProgressID = 'P-' + Date.now() + '-' + Math.floor(Math.random() * 10000);
    rec.CreatedAt = now;
    sfAppend_(SF.PROGRESS, [rec]);
    return { ok: true, updated: false };
  });
}

// تاریخچه‌ی یک حرکت برای شاگرد (آخرین ۸ جلسه)
function sfExerciseHistory(token, exerciseId) {
  const session = sfUser_(token); sfEnsure_();
  const rows = sfObjects_(sfRead_(SF.PROGRESS)).filter(o => normalize_(o.Username).toLowerCase() === session.username.toLowerCase() && o.ExerciseID === normalize_(exerciseId) && Number(o.StepNo || 0) === 0);
  const byDate = {};
  rows.forEach(o => { (byDate[o.DateISO] = byDate[o.DateISO] || []).push({ setNo: Number(o.SetNo), w: o.ActualWeightKg, r: o.ActualReps }); });
  return Object.keys(byDate).sort().reverse().slice(0, 8).map(d => ({ date: d, sets: byDate[d].sort((a, b) => a.setNo - b.setNo) }));
}

// ---------------------------------------------------------------------------
// v11 — وصل کردن حرکات برنامه‌های قدیمی (بر پایه شیت) به بانک حرکات
// برای هر حرکت: تصویر/گیف + تعداد ست و تکرار پیشنهادی بانک
// ---------------------------------------------------------------------------
function sfKeyNorm_(s) {
  const t = String(s == null ? '' : s).toLowerCase();
  let out = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t.charAt(i);
    if (ch === 'ي') { out += 'ی'; continue; }
    if (ch === 'ك') { out += 'ک'; continue; }
    const c = t.charCodeAt(i);
    if ((c >= 0x0621 && c <= 0x06D3) || (c >= 0x06F0 && c <= 0x06F9) || (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x7A)) out += ch;
  }
  return out;
}
function sfEachName_(n, fn) {
  const t = String(n == null ? '' : n);
  let buf = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t.charAt(i);
    if (ch === '،' || ch === ',' || ch === '/' || ch === '|' || ch === ';') { if (buf) fn(buf); buf = ''; }
    else buf += ch;
  }
  if (buf) fn(buf);
}
/* مثل sfKeyNorm_ ولی فاصله/نیم‌فاصله را نگه می‌دارد تا تطبیق کلمه‌ای ممکن شود */
function sfNormKeepSpaces_(s) {
  const t = String(s == null ? '' : s).toLowerCase();
  let out = '', lastSpace = true;
  for (let i = 0; i < t.length; i++) {
    const ch = t.charAt(i);
    if (ch === 'ي') { out += 'ی'; lastSpace = false; continue; }
    if (ch === 'ك') { out += 'ک'; lastSpace = false; continue; }
    if (ch === ' ' || ch === '\u200c' || ch === '\t' || ch === '-' || ch === '_' || ch === '\n') {
      if (!lastSpace) { out += ' '; lastSpace = true; }
      continue;
    }
    const c = t.charCodeAt(i);
    if ((c >= 0x0621 && c <= 0x06D3) || (c >= 0x06F0 && c <= 0x06F9) || (c >= 0x30 && c <= 0x39) || (c >= 0x61 && c <= 0x7A)) { out += ch; lastSpace = false; }
  }
  return sfSyn_(out.trim());
}
function sfSyn_(s) {
  var out = s;
  SF_SYN_LIST_.forEach(function (p) { out = (' ' + out + ' ').split(' ' + p[0] + ' ').join(' ' + p[1] + ' ').trim(); });
  return out;
}
var SF_BANK_MEMO_ = null;
/* واژه‌های تجهیزاتی که در ستون Aliases ارزش تطبیق ندارند (باعث خطای «دمبل» = همه حرکات می‌شوند) */
var SF_ALIAS_SKIP_ = { 'دمبل': 1, 'هالتر': 1, 'دستگاه': 1, 'سیمکش': 1, 'طناب': 1, 'میله': 1, 'صفحه': 1, 'کابل': 1, 'سیم': 1, 'کش': 1, 'ماشین': 1, 'بدنسازی': 1, 'تک': 1 };
var SF_SYN_LIST_ = [['پلاور', 'پول اور'], ['پولاوور', 'پول اور'], ['سیم کش', 'سیمکش'], ['اسکات', 'اسکوات'], ['کابل', 'سیمکش'], ['پرسی', 'پرس']];
var SF_BANK_STOP_ = { 'با': 1, 'و': 1, 'در': 1, 'به': 1, 'از': 1, 'روی': 1, 'برای': 1, 'بر': 1, 'ها': 1, 'های': 1, 'یک': 1, 'یا': 1, 'عدد': 1 };
function sfTokensOf_(s) {
  const out = [];
  sfNormKeepSpaces_(s).split(' ').forEach(function (w) {
    if (w.length < 2 || SF_BANK_STOP_[w]) return;
    if (out.indexOf(w) < 0) out.push(w);
  });
  return out;
}
function sfTokScore_(a, b) {
  if (a === b) return 3;
  if (a.length >= 3 && b.length >= 3 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) return 2;
  if (a.length >= 5 && b.length >= 5 && Math.abs(a.length - b.length) <= 1 && sfEdit1_(a, b)) return 2;
  return 0;
}
function sfEdit1_(a, b) {
  if (a === b) return true;
  const n = a.length, m = b.length;
  if (Math.abs(n - m) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < n && j < m) {
    if (a.charAt(i) === b.charAt(j)) { i++; j++; continue; }
    diff++;
    if (diff > 1) return false;
    if (n > m) i++; else if (m > n) j++; else { i++; j++; }
  }
  if (i < n || j < m) diff++;
  return diff <= 1;
}
function sfBankMemo_() {
  if (SF_BANK_MEMO_) return SF_BANK_MEMO_;
  const map = {}, list = [];
  try {
    const rows = sfObjects_(sfRead_(SF.BANK)).filter(o => sfIsTrue_(o.Active));
    rows.forEach(o => {
      const media = sfMediaOf_(o);
      const item = Object.assign({}, o, { sets: o.SuggestedSets, reps: o.SuggestedReps, rest: o.RestSec,
        gif: media.gif, frames: media.frames, tokens: [], core: [] });
      const i = list.push(item) - 1;
      /* کلیدهای دقیق فقط از نام‌های اصلی (فارسی/انگلیسی) ساخته می‌شوند؛
         ستون Aliases این بانک کلیدواژه‌های عمومی دارد (مثل «دمبل») و اگر کلید شود
         باعث تطبیق‌های اشتباه می‌گردد. */
      [o.PersianName, o.EnglishName].forEach(n => sfEachName_(n, p => {
        const k = sfKeyNorm_(p);
        if (k.length > 2 && map[k] === undefined) map[k] = i;
        sfTokensOf_(p).forEach(t => { if (item.tokens.indexOf(t) < 0) item.tokens.push(t); });
      }));
      sfTokensOf_(o.PersianName).forEach(t => { if (item.core.indexOf(t) < 0) item.core.push(t); });
      /* نام‌های جایگزین فقط برای غنی‌کردن توکن‌ها (بدون واژه‌های تجهیزاتی) */
      sfEachName_(o.Aliases, p => {
        sfTokensOf_(p).forEach(t => {
          if (SF_ALIAS_SKIP_[t]) return;
          if (item.tokens.indexOf(t) < 0) item.tokens.push(t);
        });
      });
    });
  } catch (e) {}
  SF_BANK_MEMO_ = { map: map, list: list };
  return SF_BANK_MEMO_;
}
function sfBankByName_(name) {
  const memo = sfBankMemo_();
  const k = sfKeyNorm_(name);
  if (!k) return null;
  if (memo.map[k] !== undefined) return memo.list[memo.map[k]];
  if (k.length >= 4) {
    const keys = Object.keys(memo.map);
    let best = -1, bestLen = 0;
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (key.length < 6 || key.length < k.length * 0.5) continue;
      if (key.indexOf(k) === -1 && k.indexOf(key) === -1) continue;
      if (key.length > bestLen) { bestLen = key.length; best = memo.map[key]; }
    }
    if (best >= 0) return memo.list[best];
  }
  /* تطبیق کلمه‌به‌کلمه: ترتیب/شکل کلمات مهم نیست («سرشانه دمبل پرسی» = «پرس سرشانه دمبل») */
  const qt = sfTokensOf_(name);
  if (!qt.length || qt.length > 14) return null;
  let bestIdx = -1, bestKey = 0, bestScore = 0, bestGap = 99;
  memo.list.forEach(function (item, idx) {
    const B = item.tokens;
    if (!B || !B.length) return;
    let hitQ = 0, score = 0, weakest = 9, hitB = 0, hitC = 0;
    qt.forEach(function (t) {
      let s = 0;
      for (let i = 0; i < B.length; i++) { const x = sfTokScore_(t, B[i]); if (x > s) s = x; if (s === 3) break; }
      if (s) { hitQ++; score += s; if (s < weakest) weakest = s; }
    });
    B.forEach(function (bt) {
      let s = 0;
      for (let i = 0; i < qt.length; i++) { const x = sfTokScore_(qt[i], bt); if (x > s) s = x; if (s === 3) break; }
      if (s) hitB++;
    });
    (item.core || []).forEach(function (bt) {
      let s = 0;
      for (let i = 0; i < qt.length; i++) { const x = sfTokScore_(qt[i], bt); if (x > s) s = x; if (s === 3) break; }
      if (s) hitC++;
    });
    if (!hitQ) return;
    let ok;
    if (qt.length === 1) ok = weakest >= (qt[0].length >= 5 ? 2 : 3);
    else ok = hitQ >= Math.max(2, Math.ceil(qt.length * 0.5));
    const C = item.core || [];
    if (!ok && C.length >= 2 && hitC >= 2 && (hitC / C.length) >= 0.6) ok = true;
    if (!ok && B.length >= 2 && hitQ >= 2 && (hitB / B.length) >= 0.6) ok = true;
    if (!ok) return;
    const key = hitQ + hitC + hitB;
    const gap = Math.abs(B.length - qt.length);
    if (key > bestKey || (key === bestKey && score > bestScore) || (key === bestKey && score === bestScore && gap < bestGap)) {
      bestIdx = idx; bestKey = key; bestScore = score; bestGap = gap;
    }
  });
  return bestIdx < 0 ? null : memo.list[bestIdx];
}
function sfAttachBank_(parsed) {
  try {
    if (!parsed || !parsed.days) return parsed;
    const cache = {};
    parsed.days.forEach(day => (day.exercises || []).forEach(ex => {
      const k = String(ex.name == null ? '' : ex.name);
      if (!(k in cache)) cache[k] = sfBankByName_(k);
      const b = cache[k];
      if (b) ex.bank = { sets: b.sets, reps: b.reps, rest: b.rest, gif: b.gif, frames: b.frames };
    }));
  } catch (e) {}
  return parsed;
}


/* ============================================================================
 * v13 — پل یکپارچه‌سازی: خواندن برنامه‌ها از جدول‌های SF_ و تبدیل به شکل «برنامه‌های قدیمی»
 * (تغذیه و مکمل هم به همان جدول‌های SF_ منتقل شده‌اند: SF_Diets و SF_Supps)
 * ========================================================================== */

/* همه اعداد موجود در یک متن (فارسی/عربی/انگلیسی) */
function sfNumList_(s) {
  const out = [];
  String(s == null ? '' : s).replace(/[0-9۰-۹٠-٩]+/g, function (d) {
    const n = Number(toEnglishDigits_(d));
    if (isFinite(n)) out.push(n);
    return d;
  });
  return out;
}

function sfBankLegacyInfo_(bankEx) {
  if (!bankEx) return null;
  const info = sfExInfo_(bankEx);
  return { sets: info.sets, reps: info.reps, rest: info.rest, gif: info.media.gif, frames: info.media.frames, fa: info.fa };
}

/* برنامه‌های تمرین ثبت‌شده در SF_Plans/SF_Blocks/... → شکل قدیمی workouts */
function sfPlansAsLegacy_(username) {
  const u = normalize_(username).toLowerCase();
  if (!u) return [];
  sfEnsure_();
  const bank = sfBankMap_();
  const plans = sfObjects_(sfRead_(SF.PLANS)).filter(function (p) {
    return normalize_(p.Username).toLowerCase() === u && sfIsTrue_(p.Active);
  });
  if (!plans.length) return [];
  const built = sfBuildPlans_(plans, bank);
  return built.plans.map(function (p) {
    const days = (p.days || []).map(function (d) {
      const exercises = [];
      (d.blocks || []).forEach(function (b) {
        const sets = b.sets || [];
        const nSets = sets.length;
        const repsList = [];
        sets.forEach(function (s) {
          const cell = (s.cells || [])[0] || {};
          const r = normalize_(cell.reps);
          if (r && repsList.indexOf(r) < 0) repsList.push(r);
        });
        const repsTxt = repsList.length > 1 ? repsList.join('-') : (repsList[0] || '');
        (b.items || []).forEach(function (it) {
          const bankInfo = sfBankLegacyInfo_(bank[it.exerciseId]);
          let one = null;
          if (bankInfo) {
            one = { sets: bankInfo.sets, reps: bankInfo.reps, rest: bankInfo.rest, gif: bankInfo.gif, frames: bankInfo.frames };
            if (Number(b.restBetweenSec) > 0) one.rest = Number(b.restBetweenSec);
          }
          exercises.push({
            name: normalize_(it.name),
            sets: nSets ? String(nSets) : '',
            reps: repsTxt,
            notes: normalize_(b.notes),
            bank: one
          });
        });
      });
      return { title: normalize_(d.title) || ('روز ' + d.dayNo), isRest: false, exercises: exercises };
    });
    const notes = [];
    if (normalize_(p.coachNotes)) notes.push(normalize_(p.coachNotes));
    return { name: normalize_(p.planName), days: days, notes: notes, sfPlanId: p.planId, fromSF: true };
  });
}

/* برنامه‌های غذایی ثبت‌شده در SF_Diets → شکل قدیمی diets */

/* برنامه‌های مکمل ثبت‌شده در SF_Supps → شکل قدیمی supplements */
function sfSuppsAsLegacy_(username) {
  const u = normalize_(username).toLowerCase();
  if (!u) return [];
  sfEnsure_();
  const rows = sfObjects_(sfRead_('SF_Supps')).filter(function (r) {
    return normalize_(r.Username).toLowerCase() === u && !sfIsFalseValue_(r.Active);
  });
  const order = [], byPlan = {};
  rows.forEach(function (r) {
    const name = normalize_(r.PlanName);
    if (!name) return;
    if (!byPlan[name]) { byPlan[name] = { name: name, schedule: [], groups: [], items: [], _sch: {}, _grp: {} }; order.push(name); }
    const p = byPlan[name];
    const kind = normalize_(r.Kind) || 'schedule';
    const title = normalize_(r.SectionTitle);
    if (kind === 'schedule') {
      const t = title || 'نامشخص';
      if (!p._sch[t]) { p._sch[t] = { timing: t, items: [] }; p.schedule.push(p._sch[t]); }
      const txt = normalize_(r.Name);
      if (txt && p._sch[t].items.indexOf(txt) < 0) p._sch[t].items.push(txt);
    } else if (kind === 'group') {
      const g = title || 'مکمل‌های دیگر';
      if (!p._grp[g]) { p._grp[g] = { title: g, items: [] }; p.groups.push(p._grp[g]); }
      const nm = normalize_(r.Name);
      if (nm) {
        const ts = normalize_(r.Timing).split(/[،,|]/).map(function (x) { return x.trim(); }).filter(Boolean);
        p._grp[g].items.push({ name: nm, timings: ts });
      }
    } else {
      p.items.push({ category: title, name: normalize_(r.Name), dosage: normalize_(r.Detail), timing: normalize_(r.Timing), instructions: normalize_(r.Extra) });
    }
  });
  return order.map(function (n) {
    const p = byPlan[n];
    delete p._sch; delete p._grp;
    return p;
  });
}
function sfIsFalseValue_(v) { return String(normalize_(v)).toLowerCase() === 'false'; }

/* تکمیل تصاویر حرکاتِ بانک از مخزن free-exercise-db (فقط حرکت‌هایی که تصویر ندارند) */
function adminApplyBankMedia(token, map) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    const rd = sfRead_(SF.BANK), sh = rd.sh, I = rd.idx;
    const rowOf = {};
    rd.rows.forEach(function (r, i) { const id = normalize_(r[I.ExerciseID]); if (id) rowOf[id] = i + 2; });
    const base = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
    const updated = [], skipped = [];
    Object.keys(map || {}).forEach(function (id) {
      const rowNo = rowOf[id], folder = String(map[id] || '').trim();
      if (!rowNo || !folder) { skipped.push(id); return; }
      [['ImgSrc0', base + folder + '/0.jpg'], ['ImgSrc1', base + folder + '/1.jpg']].forEach(function (p) {
        const c = sh.getRange(rowNo, I[p[0]] + 1);
        c.setNumberFormat('@');
        c.setValue(p[1]);
      });
      sh.getRange(rowNo, I.MediaStatus + 1).setValue('source');
      updated.push(id);
    });
    return { updated: updated.length, ids: updated, skipped: skipped, rows: rd.rows.length };
  });
}


/* ============================================================================
 * v14 — برنامهٔ غذایی و مکمل: ساخت/ویرایش/حذف در جدول‌های SF_Diets و SF_Supps
 * شکل ذخیره دقیقاً همان چیزی است که sfDietsAsLegacy_ / sfSuppsAsLegacy_ می‌خوانند.
 * ========================================================================== */

/* ---------------------------------------------------------------- تغذیه ---- */


function sfAdminListDiets(token, username) {
  sfAdmin_(token); sfEnsure_();
  const uWant = normalize_(username).toLowerCase();
  const rows = sfObjects_(sfRead_('SF_Diets'));
  const map = {};
  rows.forEach(function (r) {
    const u = normalize_(r.Username), n = normalize_(r.PlanName);
    if (!u || !n) return;
    if (uWant && u.toLowerCase() !== uWant) return;
    const k = u + '||' + n;
    const o = map[k] || (map[k] = { planId: normalize_(r.DietID), username: u, planName: n, sections: {}, active: !sfIsFalseValue2_(r.Active), rows: 0, kcal: 0 });
    o.rows++;
    o.kcal += Number(normalize_(r.Kcal)) || 0;
    if (normalize_(r.DietID)) o.planId = normalize_(r.DietID);
    o.sections[normalize_(r.SectionTitle) || 'برنامه'] = 1;
  });
  return Object.keys(map).map(function (k) {
    const o = map[k];
    return { planId: o.planId, username: o.username, planName: o.planName, active: o.active, rows: o.rows, sections: Object.keys(o.sections).length, kcal: o.kcal };
  }).sort(function (a, b) { return a.planName.localeCompare(b.planName); });
}


function sfAdminSetDietActive(token, username, planName, active) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    const u = normalize_(username).toLowerCase(), n = normalize_(planName);
    const objs = sfObjects_(sfRead_('SF_Diets')).map(function (o) {
      if (normalize_(o.Username).toLowerCase() === u && normalize_(o.PlanName) === n) o.Active = active ? 'TRUE' : 'FALSE';
      return o;
    });
    sfRewrite_('SF_Diets', function () { return false; }, objs);
    return { ok: true, active: !!active };
  });
}

function sfAdminDeleteDiet(token, username, planName) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    const u = normalize_(username).toLowerCase(), n = normalize_(planName);
    let removed = 0;
    const kept = sfObjects_(sfRead_('SF_Diets')).filter(function (o) {
      const same = normalize_(o.Username).toLowerCase() === u && normalize_(o.PlanName) === n;
      if (same) removed++;
      return !same;
    });
    sfRewrite_('SF_Diets', function () { return false; }, kept);
    return { ok: true, removed: removed };
  });
}

/* ---------------------------------------------------------------- مکمل ----- */
function sfSuppDoc_(input) {
  if (!input || typeof input !== 'object') throw new Error('اطلاعات برنامه مکمل ارسال نشد.');
  const planName = sfText_(input.planName, 120);
  if (!planName) throw new Error('نام برنامه مکمل را وارد کن.');
  const username = sfText_(input.username, 80);
  if (!username) throw new Error('شاگرد را انتخاب کن.');
  const users = sfObjects_(sfRead_(CONFIG.USERS_SHEET));
  const u = users.find(o => normalize_(o.user || o.Username).toLowerCase() === username.toLowerCase());
  if (!u) throw new Error('این شاگرد پیدا نشد.');
  const schedule = (input.schedule || []).map(function (b) {
    return {
      timing: sfText_(b.timing, 60) || 'نامشخص',
      items: (b.items || []).map(function (x) { return sfText_(x, 120); }).filter(Boolean)
    };
  }).filter(function (b) { return b.items.length; });
  const groups = (input.groups || []).map(function (g) {
    return {
      title: sfText_(g.title, 80) || 'مکمل‌های دیگر',
      items: (g.items || []).filter(function (it) { return sfText_(it.name, 120); }).map(function (it) {
        return { name: sfText_(it.name, 120), timings: (it.timings || []).map(function (t) { return sfText_(t, 40); }).filter(Boolean) };
      })
    };
  }).filter(function (g) { return g.items.length; });
  if (!schedule.length && !groups.length) throw new Error('حداقل یک مکمل اضافه کن.');
  return { planName, username: normalize_(u.user || u.Username), schedule, groups };
}

function sfAdminSaveSupp(token, input) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    const v = sfSuppDoc_(input);
    const editing = sfText_(input.planId, 60);
    const now = new Date().toISOString();
    const suppId = editing || ('S-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000));
    const rows = [];
    v.schedule.forEach(function (b, bi) {
      b.items.forEach(function (txt, ii) {
        rows.push({ SuppID: suppId, Username: v.username, PlanName: v.planName, Kind: 'schedule', SectionNo: String(bi + 1),
          SectionTitle: b.timing, ItemNo: String(ii + 1), Name: txt, Detail: '', Timing: '', Extra: '', Active: 'TRUE', CreatedAt: now, UpdatedAt: now });
      });
    });
    v.groups.forEach(function (g, gi) {
      g.items.forEach(function (it, ii) {
        rows.push({ SuppID: suppId, Username: v.username, PlanName: v.planName, Kind: 'group', SectionNo: String(gi + 1),
          SectionTitle: g.title, ItemNo: String(ii + 1), Name: it.name, Detail: '', Timing: (it.timings || []).join('، '), Extra: '', Active: 'TRUE', CreatedAt: now, UpdatedAt: now });
      });
    });
    const u = v.username.toLowerCase();
    sfRewrite_('SF_Supps', function (o) {
      return !(normalize_(o.Username).toLowerCase() === u && normalize_(o.PlanName) === v.planName);
    }, rows);
    return { ok: true, planId: suppId, rows: rows.length, edited: !!editing };
  });
}

function sfAdminListSupps(token, username) {
  sfAdmin_(token); sfEnsure_();
  const uWant = normalize_(username).toLowerCase();
  const rows = sfObjects_(sfRead_('SF_Supps'));
  const map = {};
  rows.forEach(function (r) {
    const u = normalize_(r.Username), n = normalize_(r.PlanName);
    if (!u || !n) return;
    if (uWant && u.toLowerCase() !== uWant) return;
    const k = u + '||' + n;
    const o = map[k] || (map[k] = { planId: normalize_(r.SuppID), username: u, planName: n, blocks: {}, items: 0, active: !sfIsFalseValue2_(r.Active) });
    o.items++;
    if (normalize_(r.SuppID)) o.planId = normalize_(r.SuppID);
    o.blocks[normalize_(r.Kind) + '|' + (normalize_(r.SectionTitle) || '؟')] = 1;
  });
  return Object.keys(map).map(function (k) {
    const o = map[k];
    return { planId: o.planId, username: o.username, planName: o.planName, active: o.active, blocks: Object.keys(o.blocks).length, items: o.items };
  }).sort(function (a, b) { return a.planName.localeCompare(b.planName); });
}

function sfAdminGetSupp(token, username, planName) {
  sfAdmin_(token); sfEnsure_();
  const u = normalize_(username).toLowerCase(), n = normalize_(planName);
  const rows = sfObjects_(sfRead_('SF_Supps')).filter(function (r) {
    return normalize_(r.Username).toLowerCase() === u && normalize_(r.PlanName) === n;
  });
  if (!rows.length) throw new Error('برنامه مکمل پیدا نشد.');
  rows.sort(function (a, b) {
    return (Number(normalize_(a.SectionNo)) || 0) - (Number(normalize_(b.SectionNo)) || 0) || (Number(normalize_(a.ItemNo)) || 0) - (Number(normalize_(b.ItemNo)) || 0);
  });
  const schOrder = [], sch = {}, grpOrder = [], grp = {};
  rows.forEach(function (r) {
    const kind = normalize_(r.Kind) || 'schedule';
    const t = normalize_(r.SectionTitle);
    if (kind === 'schedule') {
      const key = t || 'نامشخص';
      if (!sch[key]) { sch[key] = { timing: key, items: [] }; schOrder.push(key); }
      const txt = normalize_(r.Name);
      if (txt && sch[key].items.indexOf(txt) < 0) sch[key].items.push(txt);
    } else if (kind === 'group') {
      const key = t || 'مکمل‌های دیگر';
      if (!grp[key]) { grp[key] = { title: key, items: [] }; grpOrder.push(key); }
      const nm = normalize_(r.Name);
      if (nm) {
        const ts = normalize_(r.Timing).split(/[،,|]/).map(function (x) { return x.trim(); }).filter(Boolean);
        grp[key].items.push({ name: nm, timings: ts });
      }
    }
  });
  return { planId: normalize_(rows[0].SuppID), username: normalize_(rows[0].Username), planName: normalize_(rows[0].PlanName),
    schedule: schOrder.map(function (k) { return sch[k]; }), groups: grpOrder.map(function (k) { return grp[k]; }) };
}

function sfAdminSetSuppActive(token, username, planName, active) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    const u = normalize_(username).toLowerCase(), n = normalize_(planName);
    const objs = sfObjects_(sfRead_('SF_Supps')).map(function (o) {
      if (normalize_(o.Username).toLowerCase() === u && normalize_(o.PlanName) === n) o.Active = active ? 'TRUE' : 'FALSE';
      return o;
    });
    sfRewrite_('SF_Supps', function () { return false; }, objs);
    return { ok: true, active: !!active };
  });
}

function sfAdminDeleteSupp(token, username, planName) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    const u = normalize_(username).toLowerCase(), n = normalize_(planName);
    let removed = 0;
    const kept = sfObjects_(sfRead_('SF_Supps')).filter(function (o) {
      const same = normalize_(o.Username).toLowerCase() === u && normalize_(o.PlanName) === n;
      if (same) removed++;
      return !same;
    });
    sfRewrite_('SF_Supps', function () { return false; }, kept);
    return { ok: true, removed: removed };
  });
}


/* ============================================================================
 * v15 — داشبورد مربی، خروجی PDF، یادآور وب، اصلاح آدرس عکس‌های پیشرفت
 * ---------------------------------------------------------------------------
 * این بخش به TrainingModule.gs (file_5) اضافه می‌شود. هیچ تابع قدیمی بازنویسی
 * نمی‌شود؛ فقط توابع تازه اضافه می‌شوند.
 * ========================================================================== */

function sfNumOrNull_(v) {
  const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) && String(v).trim() !== '' ? n : null;
}

function sfDaysAgoISO_(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
}

function sfUserRecords_() {
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getDataRange().getValues().slice(1).filter(function (r) { return normalize_(r[0]); }).map(function (r, i) {
    return { row: i + 2, username: normalize_(r[0]), supplementPlans: splitPlans_(r[2]), workoutPlans: splitPlans_(r[3]), dietPlans: splitPlans_(r[4]), role: normalize_(r[5]).toLowerCase(), telegramChatId: normalize_(r[6]), coachUsername: normalize_(r[7]) };
  });
}

/* ---------------------------------------------------------------------------
 * ۱) داشبورد مربی — آخرین فعالیت از همهٔ منابع، پایبندی، روند وزن
 * ------------------------------------------------------------------------- */
function sfCoachBoard(token) {
  const session = requireSession_(token);
  if (!isCoach_(session)) throw new Error('دسترسی مربی لازم است.');
  sfEnsure_();
  const users = sfUserRecords_();
  const lm = lastMessagesMap_();
  const from7 = sfDaysAgoISO_(7), from30 = sfDaysAgoISO_(30);

  const athletes = [];
  users.forEach(function (u) {
    if (u.role === 'admin' || u.role === 'coach') return; // کارکنان در فهرست شاگردان نمی‌آیند
    const profile = getProfile_(u.username);
    let act = {};
    try { act = getActivityDays_(u.username) || {}; } catch (e) { act = {}; }
    const days = Object.keys(act).sort();
    const lastActive = days.length ? days[days.length - 1] : '';
    const active7 = days.filter(function (d) { return d >= from7; }).length;
    const active30 = days.filter(function (d) { return d >= from30; }).length;

    const logs = getLogs_(u.username) || [];
    let wStart = null, wNow = null;
    if (logs.length) {
      const sorted = logs.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
      wStart = sfNumOrNull_(sorted[0].weight);
      wNow = sfNumOrNull_(sorted[sorted.length - 1].weight);
    }
    const lmRec = lm[u.username.toLowerCase()] || {};
    athletes.push({
      username: u.username,
      name: profile.name || u.username,
      avatarUrl: fixImgUrl_(profile.avatarUrl || ''),
      weight: profile.weight, goalWeight: profile.goalWeight,
      targetCalories: profile.targetCalories, waterGoal: profile.waterGoal,
      workoutPlans: u.workoutPlans, dietPlans: u.dietPlans, supplementPlans: u.supplementPlans,
      lastActive: lastActive,
      missedDays: lastActive ? daysSince_(lastActive) : 9999,
      active7: active7, active30: active30, totalDays: days.length,
      adherence: Math.round(active7 / 7 * 100),
      weightStart: wStart, weightNow: wNow,
      weightDelta: (wStart != null && wNow != null) ? Math.round((wNow - wStart) * 10) / 10 : 0,
      logCount: logs.length,
      lastMsgFrom: lmRec.sender || '', lastMsgAt: lmRec.at || '',
      unread: String(lmRec.sender || '').toLowerCase() === u.username.toLowerCase()
    });
  });
  athletes.sort(function (a, b) { return String(b.lastActive || '').localeCompare(String(a.lastActive || '')); });

  const totalActiveToday = athletes.filter(function (a) { return a.lastActive === todayISO_(); }).length;
  const needFollowUp = athletes.filter(function (a) { return a.missedDays >= CONFIG.MISSED_LOG_ALERT_DAYS; }).length;
  return {
    ok: true, today: todayISO_(), athletes: athletes,
    stats: {
      count: athletes.length, activeToday: totalActiveToday, needFollowUp: needFollowUp,
      avgAdherence: athletes.length ? Math.round(athletes.reduce(function (s, a) { return s + a.adherence; }, 0) / athletes.length) : 0
    },
    bot: getRemindersInfo_(session.username),
    alerts: (function () { try { return sfAlertsList_().concat(sfWeightAlerts_(athletes)); } catch (e) { return []; } })()
  };
}

/* ---------------------------------------------------------------------------
 * ۲) اصلاح آدرس عکس‌های پیشرفت (uc?export=view در مرورگر باز نمی‌شود)
 * ------------------------------------------------------------------------- */
function sfFixPhotoUrls(token) {
  sfAdmin_(token);
  return sfWithLock_(function () {
    const sh = getSS_().getSheetByName(CONFIG.PHOTOS_SHEET);
    if (!sh || sh.getLastRow() < 2) return { ok: true, fixed: 0, total: 0 };
    const rng = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(5, sh.getLastColumn()));
    const v = rng.getValues();
    let fixed = 0;
    for (let r = 0; r < v.length; r++) {
      const id = normalize_(v[r][3]);
      const cur = normalize_(v[r][4]);
      const fixedUrl = id ? ('https://lh3.googleusercontent.com/d/' + id) : fixImgUrl_(cur);
      if (fixedUrl && fixedUrl !== cur) { v[r][4] = fixedUrl; fixed++; }
    }
    rng.setValues(v);
    sh.getRange(2, 5, v.length, 1).setNumberFormat('@');
    return { ok: true, fixed: fixed, total: v.length };
  });
}

/* ---------------------------------------------------------------------------
 * ۳) یادآور وب — نصب تریگر بدون getUi (در وب‌اپ getUi کار نمی‌کند)
 * ------------------------------------------------------------------------- */
function sfReminderAdmin_(token) {
  const session = requireSession_(token);
  if (!isCoach_(session)) throw new Error('دسترسی مربی/ادمین لازم است.');
  return session;
}

function sfReminderTriggers_() {
  const out = [];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const fn = t.getHandlerFunction();
    if (fn === 'sendDailyReminders' || fn === 'sendWeeklyReport') out.push({ fn: fn, id: t.getUniqueId() });
  });
  return out;
}

/* تیک دستی ربات برای عیب‌یابی — فقط ادمین */
function sfBotTickDiag(token) {
  requireAdmin_(requireSession_(token));
  const props = PropertiesService.getScriptProperties();
  const bt = props.getProperty('TELEGRAM_BOT_TOKEN');
  if (!bt) throw new Error('توکن ربات تنظیم نشده است.');
  const res = pollBotUpdates_(bt);
  let hook = '';
  try {
    const r = botCall_(bt, 'getWebhookInfo', {});
    if (r && r.result) hook = String(r.result.pending_update_count) + ' @ ' + JSON.stringify(r.result.allowed_updates || []);
    else hook = 'ERR:' + String((r && (r.description || r.error)) || r).slice(0, 100);
  } catch (eH0) { hook = 'ERR:' + String(eH0 && eH0.message); }
  return {
    poll: res,
    hook: hook,
    offset: props.getProperty('BOT_OFFSET') || '',
    last: props.getProperty('BOT_LAST_UPD') || '',
    lastErr: props.getProperty('BOT_LAST_ERR') || ''
  };
}

function sfReminderStatus(token) {
  const session = sfReminderAdmin_(token);
  const props = PropertiesService.getScriptProperties();
  const info = getRemindersInfo_(session.username);
  const triggers = sfReminderTriggers_();
  return {
    ok: true,
    bot: info,
    botTokenSet: !!props.getProperty('TELEGRAM_BOT_TOKEN'),
    botUsername: props.getProperty('BOT_USERNAME') || '',
    coachChatId: props.getProperty('COACH_TELEGRAM_CHAT_ID') || '',
    coachEmail: props.getProperty('COACH_EMAIL') || '',
    dailyInstalled: triggers.some(function (t) { return t.fn === 'sendDailyReminders'; }),
    weeklyInstalled: triggers.some(function (t) { return t.fn === 'sendWeeklyReport'; }),
    /* وضعیت داخلی صف ربات (بدون افشای توکن) */

    botHealth: {
      offset: props.getProperty('BOT_OFFSET') || '',
      last: props.getProperty('BOT_LAST_UPD') || '',
      coachChat: props.getProperty('COACH_TELEGRAM_CHAT_ID') || '',
      lastErr: (function(){ try { return props.getProperty('BOT_LAST_ERR') || ''; } catch (eH) { return 'no-access'; } })()
    },
    /* تعداد پیام‌های در صف ربات — برای پایش سلامت ربات در پنل مربی */
    pendingUpdates: (function () {
      try {
        var _tk = props.getProperty('TELEGRAM_BOT_TOKEN');
        if (!_tk) return -1;
        var _r = UrlFetchApp.fetch('https://api.telegram.org/bot' + _tk + '/getWebhookInfo', { muteHttpExceptions: true });
        var _j = JSON.parse(_r.getContentText());
        return (_j && _j.ok) ? (Number(_j.result.pending_update_count) || 0) : -1;
      } catch (e) { return -1; }
    })(),
    
    triggers: triggers
  };
}

function sfInstallReminderTrigger(token, hour) {
  sfReminderAdmin_(token);
  const h = Math.max(0, Math.min(23, Number(hour)));
  const hourToUse = isFinite(h) ? h : 9;
  return sfWithLock_(function () {
    const installed = [];
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'sendDailyReminders') ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger('sendDailyReminders').timeBased().everyDays(1).atHour(hourToUse).create();
    installed.push('sendDailyReminders@' + hourToUse);
    const hasWeekly = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'sendWeeklyReport'; });
    return { ok: true, installed: installed, hour: hourToUse, weeklyInstalled: hasWeekly };
  });
}

function sfRemoveReminderTrigger(token) {
  sfReminderAdmin_(token);
  let removed = 0;
  ScriptApp.getProjectTriggers().slice().forEach(function (t) {
    if (t.getHandlerFunction() === 'sendDailyReminders') { ScriptApp.deleteTrigger(t); removed++; }
  });
  return { ok: true, removed: removed };
}

// ارسال آزمایشی یادآور (فقط برای خودِ تماس‌گیرنده) تا مربی مطمئن شود کار می‌کند.
function sfSendReminderTest(token) {
  const session = sfReminderAdmin_(token);
  const props = PropertiesService.getScriptProperties();
  const botToken = props.getProperty('TELEGRAM_BOT_TOKEN');
  const rec = getUserRecord_(session.username);
  const chatId = rec && rec.telegramChatId;
  if (!botToken) throw new Error('توکن ربات تلگرام تنظیم نشده است.');
  if (!chatId) throw new Error('حساب تلگرام شما به ربات وصل نیست. اول «اتصال به تلگرام» را بزن.');
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
    method: 'post', muteHttpExceptions: true,
    payload: { chat_id: chatId, text: 'این یک پیام آزمایشی از Saeedi Fit Body است ✅' }
  });
  const code = res.getResponseCode();
  return { ok: code === 200, code: code, body: String(res.getContentText()).slice(0, 200) };
}

/* ---------------------------------------------------------------------------
 * ۴) خروجی PDF — HTML راست‌به‌چپ → PDF در درایو
 * ------------------------------------------------------------------------- */
function sfPdfFolder_() {
  const name = 'SaeediFit_Plans_PDF';
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function sfEsc_(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sfPdfCss_() {
  return 'body{font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right;padding:18px;color:#111}' +
    'h1{font-size:20px;margin:0 0 2px}h2{font-size:15px;margin:16px 0 6px;border-bottom:1px solid #999;padding-bottom:4px}' +
    '.sub{color:#555;font-size:11px;margin:0 0 12px}' +
    'table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:10px}' +
    'th,td{border:1px solid #bbb;padding:5px 7px;text-align:right;vertical-align:top}' +
    'th{background:#eef3f0;font-weight:bold}' +
    '.day{margin-bottom:6px;font-weight:bold;background:#f5f7f6;font-size:12px}' +
    '.muted{color:#666}';
}

function sfPdfHeader_(title, sub) {
  return '<h1>' + sfEsc_(title) + '</h1><p class="sub">' + sfEsc_(sub || '') + '</p>';
}

function sfPlanPdfHtml_(username, planName) {
  const plans = sfPlansAsLegacy_(username);
  const plan = planName ? plans.filter(function (p) { return p.name === planName; })[0] : plans[0];
  if (!plan) throw new Error('برنامه تمرینی پیدا نشد.');
  const prof = getProfile_(username);
  let h = sfPdfHeader_('برنامه تمرینی: ' + plan.name, 'ورزشکار: ' + (prof.name || username) + ' — وزن هدف: ' + (prof.goalWeight || '-') + ' kg');
  (plan.days || []).forEach(function (day) {
    h += '<h2>' + sfEsc_(day.title) + '</h2>';
    if (!day.exercises || !day.exercises.length) { h += '<p class="muted">روز استراحت</p>'; return; }
    h += '<table><tr><th style="width:44%">حرکت</th><th>ست</th><th>تکرار</th><th>استراحت</th></tr>';
    day.exercises.forEach(function (ex) {
      h += '<tr><td>' + sfEsc_(ex.name) + '</td><td>' + sfEsc_(ex.sets || '-') + '</td><td>' + sfEsc_(ex.reps || '-') + '</td><td>' + sfEsc_((ex.rest ? ex.rest + ' ثانیه' : '-')) + '</td></tr>';
    });
    h += '</table>';
  });
  if (plan.notes && plan.notes.length) h += '<h2>توصیه‌های مربی</h2><p>' + plan.notes.map(sfEsc_).join('<br>') + '</p>';
  return h;
}

function sfDietPdfHtml_(username, planName) {
  const plans = sfDietsAsLegacy_(username);
  const plan = planName ? plans.filter(function (p) { return p.name === planName; })[0] : plans[0];
  if (!plan) throw new Error('برنامهٔ غذایی پیدا نشد.');
  const prof = getProfile_(username);
  let total = 0;
  (plan.sections || []).forEach(function (s) { (s.items || []).forEach(function (i) { if (i.kcal) total += Number(i.kcal); }); });
  let h = sfPdfHeader_('برنامهٔ غذایی: ' + plan.name, 'ورزشکار: ' + (prof.name || username) + ' — کالری هدف: ' + (prof.targetCalories || '-') + ' kcal — جمع اقلام: ' + total + ' kcal');
  (plan.sections || []).forEach(function (s) {
    h += '<h2>' + sfEsc_(s.title) + '</h2>';
    h += '<table><tr><th style="width:38%">قلم</th><th>توضیح</th><th style="width:14%">کالری</th></tr>';
    (s.items || []).forEach(function (i) {
      h += '<tr><td>' + sfEsc_(i.title) + '</td><td>' + sfEsc_(i.description || '') + '</td><td>' + sfEsc_(i.kcal == null ? '-' : i.kcal) + '</td></tr>';
    });
    h += '</table>';
  });
  return h;
}

function sfSuppPdfHtml_(username, planName) {
  const plans = sfSuppsAsLegacy_(username);
  const plan = planName ? plans.filter(function (p) { return p.name === planName; })[0] : plans[0];
  if (!plan) throw new Error('برنامهٔ مکمل پیدا نشد.');
  const prof = getProfile_(username);
  let h = sfPdfHeader_('برنامهٔ مکمل: ' + plan.name, 'ورزشکار: ' + (prof.name || username));
  (plan.schedule || []).forEach(function (s) {
    h += '<h2>' + sfEsc_(s.timing || 'زمان') + '</h2><table><tr><th>مکمل</th></tr>';
    (s.items || []).forEach(function (i) { h += '<tr><td>' + sfEsc_(i) + '</td></tr>'; });
    h += '</table>';
  });
  (plan.groups || []).forEach(function (g) {
    h += '<h2>' + sfEsc_(g.title || 'مکمل‌ها') + '</h2><table><tr><th style="width:32%">مکمل</th><th>زمان مصرف</th></tr>';
    (g.items || []).forEach(function (i) { h += '<tr><td>' + sfEsc_(i.name) + '</td><td>' + sfEsc_((i.timings || []).join('، ')) + '</td></tr>'; });
    h += '</table>';
  });
  if (plan.items && plan.items.length) {
    h += '<h2>سایر مکمل‌ها</h2><table><tr><th>نام</th><th>دوز</th><th>زمان</th></tr>';
    plan.items.forEach(function (i) { h += '<tr><td>' + sfEsc_(i.name) + '</td><td>' + sfEsc_(i.dosage || '') + '</td><td>' + sfEsc_(i.timing || '') + '</td></tr>'; });
    h += '</table>';
  }
  return h;
}

/**
 * خروجی PDF یک برنامه. kind = workout | diet | supplement
 * username خالی = خودِ کاربر. فقط مربی/ادمین می‌تواند برای دیگری بگیرد.
 */
function sfExportPlanPdf(token, kind, planName, username) {
  const session = requireSession_(token);
  sfEnsure_();
  let target = normalize_(username) || session.username;
  if (target.toLowerCase() !== session.username.toLowerCase() && !isCoach_(session)) {
    throw new Error('فقط مربی می‌تواند برای دیگران خروجی بگیرد.');
  }
  kind = normalize_(kind).toLowerCase();
  let inner;
  if (kind === 'diet') { try { inner = sfDietPdfHtml2_(target, planName, true); } catch (e1) { inner = sfDietPdfHtml_(target, planName); } }
  else if (kind === 'supplement') inner = sfSuppPdfHtml_(target, planName);
  else { try { inner = sfWorkoutPdfHtml2_(target, planName, true); } catch (e2) { inner = sfPlanPdfHtml_(target, planName); } }

  const prof = getProfile_(target);
  const html = '<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8">' +
    '<style>' + sfPdfCss_() + sfPdfCss2_() + '</style></head><body>' + inner +
    '<p class="sub">Saeedi Fit Body — ' + sfEsc_(todayISO_()) + ' — ' + sfEsc_(prof.name || target) + '</p></body></html>';

  const base = 'SaeediFit_' + kind + '_' + target.replace(/[^A-Za-z0-9._-]/g, '_') + '_' + todayISO_();
  const pdf = Utilities.newBlob(html, 'text/html', base + '.html').getAs('application/pdf').setName(base + '.pdf');
  const file = sfPdfFolder_().createFile(pdf);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    ok: true, name: base + '.pdf', id: file.getId(),
    url: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    view: 'https://drive.google.com/file/d/' + file.getId() + '/view'
  };
}

/* ============================================================================
 * v16 — بانک غذا (SF_Foods) + مدل‌های رژیم (SF_DietModels)
 *        + ماکرو در برنامهٔ غذایی + ثبت غذا با پروتئین/کربو/چربی
 * ---------------------------------------------------------------------------
 * این کد به انتهای TrainingModule.gs (file_5) اضافه می‌شود. چون در یک فایل،
 * تعریف تابع بعدی جای قبلی را می‌گیرد، بازنویسی تابع‌های زیر امن است:
 *   sfDietsAsLegacy_ , sfDietDoc_ , sfAdminSaveDiet , sfAdminGetDiet
 * ========================================================================== */

SF.FOODS = 'SF_Foods';
SF.MODELS = 'SF_DietModels';

SF_HEADERS.SF_Foods = [
  'FoodID', 'PersianName', 'EnglishName', 'Category', 'DietType', 'ServingName', 'ServingGrams',
  'Kcal100', 'Protein100', 'Carb100', 'Fat100', 'Fiber100',
  'KcalServing', 'ProteinServing', 'CarbServing', 'FatServing',
  'Recipe', 'VideoURL', 'ImageURL', 'Tags', 'Active', 'SourceNote'
];
SF_HEADERS.SF_DietModels = [
  'ModelID', 'Title', 'Kind', 'ProteinPct', 'CarbPct', 'FatPct', 'FastingWindow',
  'Description', 'Rules', 'AllowedFoods', 'ForbiddenFoods', 'SampleDay', 'Tags', 'Active'
];
/* ستون‌های ماکرو برای هر آیتم برنامهٔ غذایی (به انتهای SF_Diets اضافه می‌شوند) */
SF_HEADERS.SF_Diets = SF_HEADERS.SF_Diets.concat(['FoodID', 'Grams', 'Protein', 'Carbs', 'Fat']);

SF_TEXT_COLS.SF_Foods = ['FoodID', 'PersianName', 'EnglishName', 'Category', 'DietType', 'ServingName', 'Recipe', 'VideoURL', 'ImageURL', 'Tags', 'SourceNote'];
SF_TEXT_COLS.SF_DietModels = ['ModelID', 'Title', 'Kind', 'FastingWindow', 'Description', 'Rules', 'AllowedFoods', 'ForbiddenFoods', 'SampleDay', 'Tags'];
SF_TEXT_COLS.SF_Diets = null; /* همه ستون‌ها متنی → SF_Diets از قبل همین‌طور بوده */

/* ------------------------------------------------------------------ داده --- */
/* [فارسی، انگلیسی، گروه، نوع رژیم، واحد، گرم در واحد، kcal100، پروتئین100، کربو100، چربی100، فیبر100، دستور پخت] */
function sfFoodRows_() {
  return [
    ['سینه مرغ پخته', 'Chicken breast, cooked', 'پروتئین حیوانی', 'عمومی', 'فیله', 100, 165, 31, 0, 3.6, 0, 'با ادویه و کمی روغن زیتون گریل کن.'],
    ['ران مرغ بدون پوست پخته', 'Chicken thigh, cooked', 'پروتئین حیوانی', 'عمومی', 'ران', 100, 209, 26, 0, 10.9, 0, 'بدون پوست بپز تا چربی کمتر شود.'],
    ['بوقلمون سینه پخته', 'Turkey breast, cooked', 'پروتئین حیوانی', 'کم‌کالری', 'فیله', 100, 135, 30, 0, 1, 0, 'گریل یا فر با ادویه.'],
    ['گوشت گوساله کم‌چرب پخته', 'Lean beef, cooked', 'پروتئین حیوانی', 'عمومی', 'استیک', 100, 250, 26, 0, 15, 0, 'راسته یا فیله را کبابی کن.'],
    ['گوشت گوسفندی کم‌چرب', 'Lamb, lean', 'پروتئین حیوانی', 'عمومی', 'خورشی', 100, 294, 25, 0, 21, 0, 'چربی‌های اضافه را جدا کن.'],
    ['استیک راسته گاو', 'Sirloin steak', 'پروتئین حیوانی', 'کتو', 'استیک', 100, 271, 25, 0, 19, 0, 'با نمک و فلفل، ۳ دقیقه هر طرف.'],
    ['ماهی سالمون', 'Salmon', 'پروتئین حیوانی', 'کتو', 'فیله', 100, 208, 20, 0, 13, 0, 'فر ۲۰۰ درجه، ۱۵ دقیقه با لیمو.'],
    ['ماهی قزل‌آلا', 'Trout', 'پروتئین حیوانی', 'عمومی', 'فیله', 100, 172, 24, 0, 7, 0, 'گریل با سبزیجات.'],
    ['ماهی سفید', 'White fish', 'پروتئین حیوانی', 'کم‌کالری', 'فیله', 100, 140, 21, 0, 6, 0, 'سرخ‌کردن با آرد را حذف کن.'],
    ['تن ماهی در آب', 'Tuna in water', 'پروتئین حیوانی', 'کم‌کالری', 'قوطی', 100, 116, 26, 0, 1, 0, 'آب قوطی را کامل خالی کن.'],
    ['میگو پخته', 'Shrimp, cooked', 'پروتئین حیوانی', 'کم‌کالری', 'پیمانه', 100, 99, 24, 0.2, 0.3, 0, 'با سیر و لیمو تفت بده.'],
    ['تخم‌مرغ آب‌پز', 'Boiled egg', 'پروتئین حیوانی', 'عمومی', 'عدد', 50, 155, 13, 1.1, 11, 0, '۷ دقیقه در آب جوش.'],
    ['سفیده تخم‌مرغ', 'Egg white', 'پروتئین حیوانی', 'کم‌کالری', 'عدد', 33, 52, 11, 0.7, 0.2, 0, 'املت سفیده با سبزیجات.'],
    ['جگر مرغ', 'Chicken liver', 'پروتئین حیوانی', 'عمومی', 'پیمانه', 100, 167, 25, 1, 7, 0, 'کاملاً بپز؛ هفته‌ای یک بار.'],
    ['عدس پخته', 'Lentils, cooked', 'حبوبات', 'گیاهی', 'پیمانه', 150, 116, 9, 20, 0.4, 8, 'با پیاز و ادویه بپز.'],
    ['نخود پخته', 'Chickpeas, cooked', 'حبوبات', 'گیاهی', 'پیمانه', 150, 164, 8.9, 27, 2.6, 7.6, 'شب قبل خیس کن.'],
    ['لوبیا چیتی پخته', 'Pinto beans, cooked', 'حبوبات', 'گیاهی', 'پیمانه', 150, 127, 8.7, 23, 0.5, 6.4, 'با آب‌لیمو بخور تا آهن جذب شود.'],
    ['لوبیا قرمز پخته', 'Kidney beans, cooked', 'حبوبات', 'گیاهی', 'پیمانه', 150, 127, 8.7, 22.8, 0.5, 6.4, 'مناسب خوراک لوبیا.'],
    ['توفو', 'Tofu', 'پروتئین گیاهی', 'گیاهی', 'برش', 100, 76, 8, 1.9, 4.8, 0.3, 'با سس سویا تفت بده.'],
    ['دانه سویا', 'Soybean', 'پروتئین گیاهی', 'گیاهی', 'پیمانه', 100, 446, 36, 30, 20, 9, 'حداکثر ۲ بار در هفته.'],
    ['ماست کم‌چرب', 'Low-fat yogurt', 'لبنیات', 'عمومی', 'کاسه', 150, 61, 3.5, 4.7, 3.3, 0, 'با خیار و نعنا.'],
    ['ماست یونانی ۲٪', 'Greek yogurt 2%', 'لبنیات', 'کم‌کالری', 'کاسه', 150, 73, 10, 3.6, 2, 0, 'پروتئین بالاتر از ماست معمولی.'],
    ['ماست پرچرب', 'Whole yogurt', 'لبنیات', 'کتو', 'کاسه', 150, 97, 3.5, 4.7, 7, 0, 'برای رژیم کتو مناسب‌تر است.'],
    ['شیر کم‌چرب', 'Low-fat milk', 'لبنیات', 'عمومی', 'لیوان', 200, 42, 3.4, 5, 1, 0, 'بدون شکر بخور.'],
    ['شیر پرچرب', 'Whole milk', 'لبنیات', 'عمومی', 'لیوان', 200, 61, 3.2, 4.8, 3.3, 0, 'برای شیک پروتئین.'],
    ['پنیر سفید ایرانی', 'Iranian white cheese', 'لبنیات', 'عمومی', 'برش', 30, 264, 14, 4, 21, 0, 'کم‌نمک، همراه گردو.'],
    ['پنیر کم‌چرب', 'Low-fat cheese', 'لبنیات', 'کم‌کالری', 'برش', 30, 98, 11, 3.4, 4.3, 0, 'کوارک یا پنیر کم‌چرب.'],
    ['پنیر موزارلا', 'Mozzarella', 'لبنیات', 'کتو', 'برش', 30, 280, 22, 3, 17, 0, 'برای پیتزای خانگی.'],
    ['دوغ بدون گاز', 'Doogh', 'لبنیات', 'عمومی', 'لیوان', 250, 40, 3.3, 4.5, 1, 0, 'بدون نمک زیاد.'],
    ['کشک', 'Kashk', 'لبنیات', 'عمومی', 'قاشق', 30, 160, 20, 10, 4, 0, 'روی کشک بادمجان.'],
    ['خامه صبحانه', 'Cream', 'لبنیات', 'کتو', 'قاشق', 20, 292, 2.5, 3, 30, 0, 'مصرف کم.'],
    ['بستنی سنتی', 'Ice cream', 'لبنیات', 'عمومی', 'اسکوپ', 60, 207, 3.5, 24, 11, 0.7, 'به‌عنوان وعدهٔ آزاد.'],
    ['نان سنگک', 'Sangak bread', 'غلات و نان', 'عمومی', 'برش', 50, 250, 8.5, 50, 1.2, 2.5, 'بهترین نان برای ورزشکاران.'],
    ['نان لواش', 'Lavash bread', 'غلات و نان', 'عمومی', 'برش', 40, 275, 9, 56, 1.2, 2, 'کربوهیدرات سریع.'],
    ['نان بربری', 'Barbari bread', 'غلات و نان', 'عمومی', 'برش', 50, 270, 9, 54, 1.5, 2, 'پرنمک؛ کم بخور.'],
    ['نان جو', 'Barley bread', 'غلات و نان', 'دیابتی', 'برش', 40, 240, 9, 45, 3, 6, 'شاخص گلیسمی پایین‌تر.'],
    ['نان تست سبوس‌دار', 'Whole wheat toast', 'غلات و نان', 'عمومی', 'برش', 30, 250, 9, 43, 3.5, 6, 'برای ساندویچ رژیمی.'],
    ['جو دوسر (اوتمیل)', 'Oats', 'غلات و نان', 'عمومی', 'پیمانه', 40, 389, 17, 66, 7, 10, 'با شیر و دارچین بپز.'],
    ['برنج سفید پخته', 'White rice, cooked', 'برنج و ماکارونی', 'عمومی', 'پیمانه', 150, 130, 2.7, 28, 0.3, 0.4, 'هر پیمانه حدود ۱۵۰ گرم پخته.'],
    ['برنج قهوه‌ای پخته', 'Brown rice, cooked', 'برنج و ماکارونی', 'دیابتی', 'پیمانه', 150, 123, 2.7, 26, 1, 1.6, 'فیبر بیشتر، گوارش کندتر.'],
    ['ماکارونی پخته', 'Pasta, cooked', 'برنج و ماکارونی', 'عمومی', 'پیمانه', 150, 158, 5.8, 31, 0.9, 1.8, 'آل‌دنته بپز.'],
    ['رشته آش', 'Reshteh', 'برنج و ماکارونی', 'عمومی', 'پیمانه', 100, 138, 4.5, 27, 1, 1.5, 'برای آش رشته.'],
    ['بلغور گندم پخته', 'Bulgur, cooked', 'برنج و ماکارونی', 'دیابتی', 'پیمانه', 150, 83, 3.1, 19, 0.2, 3, 'جای برنج در سالاد.'],
    ['کینوا پخته', 'Quinoa, cooked', 'برنج و ماکارونی', 'گیاهی', 'پیمانه', 150, 120, 4.4, 21, 1.9, 2.8, 'پروتئین کامل گیاهی.'],
    ['ذرت پخته', 'Corn, cooked', 'برنج و ماکارونی', 'عمومی', 'پیمانه', 120, 96, 3.4, 21, 1.5, 2.4, 'کنار سالاد.'],
    ['خیار', 'Cucumber', 'سبزیجات', 'کم‌کالری', 'عدد', 100, 15, 0.7, 3.6, 0.1, 0.5, 'میان‌وعدهٔ بدون کالری.'],
    ['گوجه‌فرنگی', 'Tomato', 'سبزیجات', 'کم‌کالری', 'عدد', 100, 18, 0.9, 3.9, 0.2, 1.2, 'سالاد یا کنار غذا.'],
    ['کاهو', 'Lettuce', 'سبزیجات', 'کم‌کالری', 'کاسه', 100, 15, 1.4, 2.9, 0.2, 1.3, 'پایهٔ سالاد.'],
    ['اسفناج', 'Spinach', 'سبزیجات', 'کم‌کالری', 'کاسه', 100, 23, 2.9, 3.6, 0.4, 2.2, 'بخارپز یا خام.'],
    ['کلم بروکلی', 'Broccoli', 'سبزیجات', 'کم‌کالری', 'کاسه', 100, 34, 2.8, 7, 0.4, 2.6, 'بخارپز ۵ دقیقه.'],
    ['گل کلم', 'Cauliflower', 'سبزیجات', 'کتو', 'کاسه', 100, 25, 1.9, 5, 0.3, 2, 'جای برنج در کتو.'],
    ['هویج', 'Carrot', 'سبزیجات', 'عمومی', 'عدد', 100, 41, 0.9, 10, 0.2, 2.8, 'خام یا بخارپز.'],
    ['کدو سبز', 'Zucchini', 'سبزیجات', 'کم‌کالری', 'عدد', 100, 17, 1.2, 3.1, 0.3, 1, 'کبابی یا در خورش.'],
    ['بادمجان', 'Eggplant', 'سبزیجات', 'عمومی', 'عدد', 100, 25, 1, 6, 0.2, 3, 'در فر بپز تا روغن کمتر بخورد.'],
    ['فلفل دلمه‌ای', 'Bell pepper', 'سبزیجات', 'کم‌کالری', 'عدد', 100, 31, 1, 6, 0.3, 2, 'ویتامین C بالا.'],
    ['پیاز', 'Onion', 'سبزیجات', 'عمومی', 'عدد', 100, 40, 1.1, 9, 0.1, 1.7, 'پایهٔ اکثر خوراک‌ها.'],
    ['سیر', 'Garlic', 'سبزیجات', 'عمومی', 'حبه', 3, 149, 6.4, 33, 0.5, 2.1, 'ضد التهاب طبیعی.'],
    ['قارچ', 'Mushroom', 'سبزیجات', 'کم‌کالری', 'کاسه', 100, 22, 3.1, 3.3, 0.3, 1, 'با تخم‌مرغ عالی است.'],
    ['لوبیا سبز', 'Green beans', 'سبزیجات', 'کم‌کالری', 'کاسه', 100, 31, 1.8, 7, 0.1, 3.4, 'بخارپز.'],
    ['نخود فرنگی', 'Green peas', 'سبزیجات', 'عمومی', 'کاسه', 100, 81, 5.4, 14, 0.4, 5, 'منبع پروتئین گیاهی.'],
    ['سیب‌زمینی آب‌پز', 'Boiled potato', 'سبزیجات', 'عمومی', 'عدد', 150, 87, 1.9, 20, 0.1, 1.8, 'سرد شده نشاستهٔ مقاوم بیشتری دارد.'],
    ['سیب‌زمینی شیرین', 'Sweet potato', 'سبزیجات', 'عمومی', 'عدد', 150, 86, 1.6, 20, 0.1, 3, 'گلیسمی پایین‌تر از سیب‌زمینی.'],
    ['چغندر پخته', 'Beetroot, cooked', 'سبزیجات', 'عمومی', 'عدد', 100, 44, 1.7, 10, 0.2, 2, 'به‌خاطر نیترات، قبل تمرین مفید است.'],
    ['کرفس', 'Celery', 'سبزیجات', 'کم‌کالری', 'ساقه', 100, 16, 0.7, 3, 0.2, 1.6, 'میان‌وعدهٔ کم‌کالری.'],
    ['سبزی خوردن', 'Fresh herbs', 'سبزیجات', 'کم‌کالری', 'کاسه', 100, 25, 2, 4, 0.3, 2.5, 'سر سفره همیشه باشد.'],
    ['سیب', 'Apple', 'میوه‌ها', 'عمومی', 'عدد', 150, 52, 0.3, 14, 0.2, 2.4, 'با پوست بخور.'],
    ['موز', 'Banana', 'میوه‌ها', 'عمومی', 'عدد', 120, 89, 1.1, 23, 0.3, 2.6, 'قبل یا بعد تمرین.'],
    ['پرتقال', 'Orange', 'میوه‌ها', 'عمومی', 'عدد', 150, 47, 0.9, 12, 0.1, 2.4, 'خودِ میوه بهتر از آب آن.'],
    ['نارنگی', 'Tangerine', 'میوه‌ها', 'عمومی', 'عدد', 100, 53, 0.8, 13, 0.3, 1.8, 'میان‌وعدهٔ عالی.'],
    ['انگور', 'Grapes', 'میوه‌ها', 'عمومی', 'کاسه', 100, 69, 0.7, 18, 0.2, 0.9, 'قندش بالاست؛ اندازه را رعایت کن.'],
    ['هندوانه', 'Watermelon', 'میوه‌ها', 'کم‌کالری', 'برش', 200, 30, 0.6, 8, 0.2, 0.4, 'آب‌دار و کم‌کالری.'],
    ['خربزه', 'Melon', 'میوه‌ها', 'کم‌کالری', 'برش', 200, 34, 0.8, 8, 0.2, 0.9, 'میوهٔ تابستان.'],
    ['توت‌فرنگی', 'Strawberry', 'میوه‌ها', 'کم‌کالری', 'کاسه', 100, 32, 0.7, 7.7, 0.3, 2, 'قند پایین؛ مناسب رژیم.'],
    ['کیوی', 'Kiwi', 'میوه‌ها', 'عمومی', 'عدد', 100, 61, 1.1, 15, 0.5, 3, 'ویتامین C بالا.'],
    ['انار', 'Pomegranate', 'میوه‌ها', 'عمومی', 'عدد', 150, 83, 1.7, 19, 1.2, 4, 'آنتی‌اکسیدان زیاد.'],
    ['آناناس', 'Pineapple', 'میوه‌ها', 'عمومی', 'برش', 150, 50, 0.5, 13, 0.1, 1.4, 'بعد از غذا هضم را کمک می‌کند.'],
    ['هلو', 'Peach', 'میوه‌ها', 'کم‌کالری', 'عدد', 150, 39, 0.9, 10, 0.3, 1.5, 'کم‌کالری و خوشمزه.'],
    ['گیلاس', 'Cherry', 'میوه‌ها', 'عمومی', 'کاسه', 100, 63, 1.1, 16, 0.2, 2.1, 'میوهٔ فصل.'],
    ['آووکادو', 'Avocado', 'میوه‌ها', 'کتو', 'عدد', 150, 160, 2, 8.5, 15, 6.7, 'چربی سالم؛ اندازه را رعایت کن.'],
    ['خرما', 'Date', 'میوه‌ها', 'عمومی', 'عدد', 20, 282, 2.5, 75, 0.4, 8, 'قند بالا؛ ۱ تا ۲ عدد.'],
    ['انجیر تازه', 'Fresh fig', 'میوه‌ها', 'عمومی', 'عدد', 60, 74, 0.8, 19, 0.3, 2.9, 'فیبر خوب.'],
    ['کشمش', 'Raisin', 'میوه‌ها', 'عمومی', 'قاشق', 20, 299, 3.1, 79, 0.5, 3.7, 'قند متمرکز؛ کم بخور.'],
    ['بادام', 'Almond', 'مغزها و دانه‌ها', 'عمومی', 'مشت', 25, 579, 21, 22, 50, 12.5, 'حدود ۱۰ تا ۱۵ عدد.'],
    ['گردو', 'Walnut', 'مغزها و دانه‌ها', 'کتو', 'مشت', 20, 654, 15, 14, 65, 6.7, 'منبع امگا۳ گیاهی.'],
    ['پسته', 'Pistachio', 'مغزها و دانه‌ها', 'عمومی', 'مشت', 25, 560, 20, 28, 45, 10, 'بی‌نمک بهتر است.'],
    ['فندق', 'Hazelnut', 'مغزها و دانه‌ها', 'عمومی', 'مشت', 25, 628, 15, 17, 61, 9.7, 'همراه شکلات تلخ.'],
    ['تخمه آفتابگردان', 'Sunflower seeds', 'مغزها و دانه‌ها', 'عمومی', 'قاشق', 20, 584, 21, 20, 51, 8.6, 'روی سالاد بپاش.'],
    ['تخمه کدو', 'Pumpkin seeds', 'مغزها و دانه‌ها', 'عمومی', 'قاشق', 20, 559, 30, 11, 49, 6, 'منبع منیزیم.'],
    ['کنجد', 'Sesame', 'مغزها و دانه‌ها', 'عمومی', 'قاشق', 15, 573, 17, 23, 50, 11.8, 'منبع کلسیم گیاهی.'],
    ['کره بادام‌زمینی', 'Peanut butter', 'مغزها و دانه‌ها', 'عمومی', 'قاشق', 20, 588, 25, 20, 50, 6, 'بدون شکر اضافه بخر.'],
    ['کره بادام', 'Almond butter', 'مغزها و دانه‌ها', 'عمومی', 'قاشق', 20, 614, 21, 19, 56, 10.3, 'گران‌تر ولی سالم‌تر.'],
    ['دانه چیا', 'Chia seeds', 'مغزها و دانه‌ها', 'گیاهی', 'قاشق', 15, 486, 17, 42, 31, 34, 'در آب بگذار تا ژل شود.'],
    ['تخم کتان', 'Flaxseed', 'مغزها و دانه‌ها', 'عمومی', 'قاشق', 15, 534, 18, 29, 42, 27, 'آسیاب‌شده بهتر جذب می‌شود.'],
    ['روغن زیتون', 'Olive oil', 'روغن و چربی', 'عمومی', 'قاشق', 10, 884, 0, 0, 100, 0, 'سرد روی سالاد.'],
    ['روغن کنجد', 'Sesame oil', 'روغن و چربی', 'عمومی', 'قاشق', 10, 884, 0, 0, 100, 0, 'برای تفت دادن.'],
    ['کره حیوانی', 'Butter', 'روغن و چربی', 'کتو', 'قاشق', 10, 717, 0.9, 0.1, 81, 0, 'مصرف کم.'],
    ['ارده کنجد', 'Tahini', 'روغن و چربی', 'گیاهی', 'قاشق', 20, 595, 17, 21, 54, 9.3, 'برای سالاد و حلوا.'],
    ['زیتون سبز', 'Green olive', 'روغن و چربی', 'عمومی', 'مشت', 20, 145, 1, 3.8, 15, 3.3, 'پرنمک؛ کم بخور.'],
    ['آب پرتقال طبیعی', 'Orange juice', 'نوشیدنی', 'عمومی', 'لیوان', 200, 45, 0.7, 10, 0.2, 0.2, 'بدون شکر اضافه.'],
    ['چای بدون شکر', 'Tea', 'نوشیدنی', 'کم‌کالری', 'لیوان', 200, 1, 0, 0.2, 0, 0, 'بدون قند و شیرینی.'],
    ['قهوه بدون شکر', 'Coffee', 'نوشیدنی', 'کم‌کالری', 'فنجان', 150, 2, 0.1, 0, 0, 0, 'قبل تمرین مفید است.'],
    ['نوشابه', 'Soda', 'نوشیدنی', 'ممنوع', 'قوطی', 330, 42, 0, 10.6, 0, 0, 'در برنامه‌های رژیمی نگذار.'],
    ['شیر بادام بدون شکر', 'Unsweetened almond milk', 'نوشیدنی', 'کم‌کالری', 'لیوان', 200, 15, 0.6, 0.6, 1.2, 0.3, 'جانشین شیر در رژیم کم‌کالری.'],
    ['شکلات تلخ ۷۰٪', 'Dark chocolate 70%', 'تنقلات و قند', 'عمومی', 'قطعه', 15, 598, 7.8, 46, 43, 11, 'حداکثر ۱ تا ۲ قطعه.'],
    ['عسل', 'Honey', 'تنقلات و قند', 'عمومی', 'قاشق', 15, 304, 0.3, 82, 0, 0.2, 'قند ساده؛ قبل تمرین.'],
    ['کیک خانگی', 'Cake', 'تنقلات و قند', 'ممنوع', 'برش', 60, 350, 5, 50, 15, 1, 'وعدهٔ آزاد.'],
    ['بیسکویت سبوس‌دار', 'Whole wheat biscuit', 'تنقلات و قند', 'عمومی', 'عدد', 15, 450, 7, 70, 15, 4, 'به‌عنوان میان‌وعده.'],
    ['چیپس', 'Potato chips', 'تنقلات و قند', 'ممنوع', 'بسته', 30, 536, 7, 53, 35, 4.8, 'حذف کن.'],
    ['پیتزا پنیر', 'Cheese pizza', 'غذای آماده', 'ممنوع', 'برش', 100, 266, 11, 33, 10, 2.3, 'وعدهٔ آزاد؛ حداکثر یک وعده.'],
    ['کباب کوبیده', 'Koobideh kebab', 'غذای آماده', 'عمومی', 'سیخ', 100, 280, 17, 5, 21, 0.5, 'با برنج یا نان سنگک.'],
    ['جوجه‌کباب', 'Joojeh kebab', 'غذای آماده', 'کم‌کالری', 'سیخ', 150, 190, 27, 3, 8, 0.3, 'بدون کره.'],
    ['قورمه‌سبزی', 'Ghormeh sabzi', 'غذای آماده', 'عمومی', 'پیمانه', 200, 150, 8, 7, 10, 2, 'روغن را کم کن.'],
    ['آبگوشت', 'Abgoosht', 'غذای آماده', 'عمومی', 'کاسه', 250, 120, 9, 7, 6, 1.5, 'نان را محدود کن.'],
    ['آش رشته', 'Ash reshteh', 'غذای آماده', 'گیاهی', 'کاسه', 250, 110, 5, 15, 3, 2, 'کشک کم.'],
    ['عدسی', 'Adasi', 'غذای آماده', 'گیاهی', 'کاسه', 250, 90, 5, 13, 2, 3, 'صبحانهٔ پروتئینی.'],
    ['حلیم گندم', 'Halim', 'غذای آماده', 'عمومی', 'کاسه', 200, 140, 6, 14, 6, 1.5, 'با دارچین.'],
    ['میرزاقاسمی', 'Mirza ghasemi', 'غذای آماده', 'عمومی', 'کاسه', 200, 180, 6, 8, 14, 1.5, 'بادمجان و تخم‌مرغ.'],
    ['سالاد الویه', 'Olivier salad', 'غذای آماده', 'عمومی', 'کاسه', 150, 250, 7, 12, 19, 1.5, 'سس مایونز را کم کن.'],
    ['کوکوی سبزی', 'Kuku sabzi', 'غذای آماده', 'عمومی', 'برش', 100, 180, 6, 6, 14, 2, 'در فر بپز.'],
    ['سوپ جو', 'Barley soup', 'غذای آماده', 'کم‌کالری', 'کاسه', 250, 60, 2.5, 9, 1.5, 1, 'شروع غذا.'],
    ['سالاد فصل', 'Green salad', 'غذای آماده', 'کم‌کالری', 'کاسه', 150, 50, 1.5, 7, 2, 2, 'با آب‌لیمو و روغن زیتون.'],
    ['ماست و خیار', 'Yogurt and cucumber', 'غذای آماده', 'کم‌کالری', 'کاسه', 200, 60, 3.5, 5, 3, 0.5, 'کنار غذا.'],
    ['پودر پروتئین وی', 'Whey protein', 'مکمل غذایی', 'عمومی', 'اسکوپ', 30, 380, 80, 7, 4, 1, 'با آب یا شیر بعد تمرین.'],
    ['کازیین', 'Casein', 'مکمل غذایی', 'عمومی', 'اسکوپ', 30, 360, 78, 6, 3, 1, 'قبل خواب.'],
    ['گینر', 'Mass gainer', 'مکمل غذایی', 'حجیم', 'اسکوپ', 100, 380, 15, 70, 5, 2, 'برای افزایش وزن.'],
    ['بار پروتئینی', 'Protein bar', 'مکمل غذایی', 'عمومی', 'عدد', 60, 350, 30, 35, 10, 5, 'میان‌وعدهٔ اضطراری.'],
    ['کراتین مونوهیدرات', 'Creatine monohydrate', 'مکمل غذایی', 'عمومی', 'قاشق', 5, 0, 0, 0, 0, 0, 'روزانه ۵ گرم؛ زمانش مهم نیست.']
  ];
}

/* [شناسه، عنوان، نوع، پروتئین٪، کربو٪، چربی٪، پنجرهٔ فستینگ، توضیح، قواعد، مجاز، ممنوع، یک روز نمونه، برچسب‌ها] */
function sfDietModelRows_() {
  return [
    ['MDL01', 'کتوژنیک استاندارد', 'کتو', 25, 5, 70, '', 'کاهش چربی با محدود کردن شدید کربوهیدرات و ورود بدن به حالت کتوز.', 'کربوهیدرات زیر ۵۰ گرم در روز؛ پروتئین متوسط؛ چربی منبع اصلی انرژی؛ آب و الکترولیت کافی.', 'گوشت، مرغ، ماهی، تخم‌مرغ، پنیر پرچرب، آووکادو، مغزها، روغن زیتون، سبزیجات کم‌کربوهیدرات', 'نان، برنج، ماکارونی، شکر، شیرینی، نوشابه، میوه‌های پرقند، حبوبات (محدود)', 'صبحانه: املت ۳ تخم‌مرغ با پنیر و آووکادو | ناهار: سالاد با مرغ و روغن زیتون | شام: سالمون با کلم بروکلی بخارپز', 'کتو,چربی‌سوزی,کم‌کربوهیدرات'],
    ['MDL02', 'کتو + فستینگ ۱۶:۸', 'کتو', 25, 5, 70, '12:00-20:00', 'ترکیب کتوز با پنجرهٔ غذایی ۸ ساعته برای چربی‌سوزی سریع‌تر.', 'در پنجرهٔ ۸ ساعته دو وعدهٔ چرب‌پروتئینی؛ بیرون پنجره فقط آب، چای و قهوهٔ بدون شکر.', 'تخم‌مرغ، گوشت، ماهی، آووکادو، مغزها، پنیر، سبزیجات کم‌کربوهیدرات', 'همهٔ غلات، شکر، میوه‌های شیرین، نوشیدنی شیرین', 'وعده ۱: تخم‌مرغ و پنیر و گردو | وعده ۲: استیک با سالاد روغن زیتون', 'کتو,فستینگ,۱۶:۸'],
    ['MDL03', 'فستینگ متناوب ۱۶:۸', 'فستینگ', 30, 40, 30, '12:00-20:00', 'نخوردن غذا در ۱۶ ساعت و خوردن در پنجرهٔ ۸ ساعته؛ ساده‌ترین و پایدارترین روش.', 'صبح فقط آب/چای/قهوه؛ دو وعدهٔ متعادل در پنجره؛ پروتئین هر وعده حداقل ۳۰ گرم.', 'همهٔ گروه‌ها با تعادل ماکرو', 'نوشیدنی شیرین، پرخوری در پایان پنجره', '۱۳:۰۰: مرغ و برنج و سالاد | ۱۸:۳۰: ماهی و سیب‌زمینی و سبزیجات', 'فستینگ,۱۶:۸'],
    ['MDL04', 'فستینگ ۵:۲', 'فستینگ', 30, 40, 30, 'دو روز کم‌کالری', 'پنج روز عادی و دو روز غیرمتوالی با ۵۰۰ تا ۶۰۰ کالری.', 'روزهای کم‌کالری پروتئین بالا و حجم زیاد سبزیجات؛ روزهای عادی بدون پرخوری.', 'مرغ، ماهی، تخم‌مرغ، سبزیجات، ماست کم‌چرب، میوه', 'شکر، سرخ‌کردنی، نوشابه در همهٔ روزها', 'روز کم‌کالری: سوپ جو + سالاد مرغ | روز عادی: رژیم معمول', 'فستینگ,۵:۲'],
    ['MDL05', 'کم‌کالری (کات)', 'کم‌کالری', 35, 40, 25, '', 'کاهش چربی با کسری کالری ملایم و حفظ عضله.', 'کسری ۳۰۰ تا ۵۰۰ کالری؛ پروتئین ۱.۸ تا ۲.۲ گرم بر کیلوگرم؛ تمرین قدرتی حفظ شود.', 'سینه مرغ، ماهی، سفیده تخم‌مرغ، ماست یونانی، برنج قهوه‌ای، سبزیجات', 'قند، نوشابه، فست‌فود، شیرینی، سرخ‌کردنی', 'صبحانه: اوتمیل و ماست یونانی | ناهار: مرغ و برنج قهوه‌ای و سالاد | شام: ماهی و سبزیجات بخارپز', 'کات,چربی‌سوزی,کم‌کالری'],
    ['MDL06', 'حجیم‌سازی (بولک)', 'حجیم', 25, 50, 25, '', 'افزایش وزن و عضله با مازاد کالری کنترل‌شده.', 'مازاد ۳۰۰ تا ۵۰۰ کالری؛ ۵ تا ۶ وعده؛ کربوهیدرات قبل و بعد تمرین.', 'برنج، نان، جو دوسر، سیب‌زمینی، مرغ، گوشت، لبنیات، مغزها، خرما', 'غذاهای بسیار پرچرب و بی‌ارزش', 'صبحانه: نان و پنیر و گردو و عسل | میان‌وعده: شیر و موز و کره بادام‌زمینی | ناهار: برنج و مرغ | بعد تمرین: شیک وی و خرما', 'حجیم,افزایش وزن'],
    ['MDL07', 'مدیترانه‌ای', 'عمومی', 25, 45, 30, '', 'رژیم متعادل و پایدار با تأکید بر چربی‌های سالم.', 'روغن زیتون جای روغن جامد؛ ماهی دو بار در هفته؛ سبزیجات و حبوبات فراوان.', 'ماهی، روغن زیتون، سبزیجات، حبوبات، غلات کامل، مغزها', 'گوشت قرمز فرآوری‌شده، شکر', 'صبحانه: نان سبوس‌دار و پنیر و گردو | ناهار: ماهی و سالاد و بلغور | شام: عدسی و سبزیجات', 'مدیترانه,قلب سالم'],
    ['MDL08', 'کم‌کربوهیدرات (لوکرب)', 'کم‌کربوهیدرات', 35, 25, 40, '', 'کاهش کربوهیدرات بدون ورود کامل به کتوز.', 'کربوهیدرات ۸۰ تا ۱۲۰ گرم؛ فقط از غلات کامل و سبزیجات.', 'مرغ، ماهی، تخم‌مرغ، سبزیجات، حبوبات محدود، مغزها', 'نان سفید، برنج سفید، شکر، شیرینی', 'صبحانه: املت و پنیر | ناهار: مرغ و سالاد | شام: ماهی و کدو', 'کم‌کربوهیدرات,لوکرب'],
    ['MDL09', 'دیابتی (گلیسمی پایین)', 'دیابتی', 30, 40, 30, '', 'کنترل قند خون با کربوهیدرات کم‌گلیسمی و فیبر بالا.', 'سه وعدهٔ اصلی و دو میان‌وعده؛ کربوهیدرات همراه پروتئین و فیبر؛ شمارش کربوهیدرات.', 'نان جو، برنج قهوه‌ای، بلغور، حبوبات، سبزیجات، ماست کم‌چرب', 'شکر، خرما و کشمش زیاد، آبمیوهٔ صنعتی، برنج سفید زیاد', 'صبحانه: نان جو و پنیر و گردو | میان‌وعده: ماست و خیار | ناهار: مرغ و بلغور و سبزیجات', 'دیابتی,قند خون'],
    ['MDL10', 'گیاهی (وگان)', 'گیاهی', 25, 50, 25, '', 'بدون هیچ فرآوردهٔ حیوانی، با پروتئین گیاهی کافی.', 'ترکیب حبوبات و غلات در هر وعده؛ مکمل B12 ضروری.', 'عدس، نخود، لوبیا، توفو، کینوا، مغزها، سبزیجات، میوه', 'گوشت، مرغ، ماهی، لبنیات، تخم‌مرغ، عسل', 'صبحانه: اوتمیل با شیر بادام و چیا | ناهار: خوراک نخود و برنج قهوه‌ای | شام: توفو و سبزیجات', 'گیاهی,وگان'],
    ['MDL11', 'بدون گلوتن', 'بدون گلوتن', 25, 45, 30, '', 'برای افراد با حساسیت یا بیماری سلیاک.', 'حذف کامل گندم، جو و چاودار؛ برچسب مواد غذایی را بخوان.', 'برنج، ذرت، کینوا، سیب‌زمینی، حبوبات، گوشت، ماهی، میوه و سبزیجات', 'گندم، جو، چاودار، نان و ماکارونی معمولی، برخی سس‌ها', 'صبحانه: تخم‌مرغ و سیب‌زمینی | ناهار: مرغ و برنج | شام: سالاد با کینوا', 'بدون گلوتن,سلیاک'],
    ['MDL12', 'کالری‌شمار ساده', 'عمومی', 25, 45, 30, '', 'بدون محدودیت غذایی؛ فقط کالری و ماکرو شمرده می‌شود.', 'هدف کالری را از پروفایل بردار؛ همهٔ غذاها مجازند تا سقف کالری.', 'هر غذایی که در بانک غذا هست', 'هیچ (فقط محدودیت کالری)', 'آزاد — هر وعده را در بانک غذا جست‌وجو کن و کالری‌اش را ثبت کن', 'کالری‌شمار,انعطاف‌پذیر']
  ];
}

function sfFoodServing_(gram, kcal100, p100, c100, f100) {
  const k = (Number(gram) || 100) / 100;
  return {
    k: Math.round((Number(kcal100) || 0) * k), p: Math.round((Number(p100) || 0) * k),
    c: Math.round((Number(c100) || 0) * k), f: Math.round((Number(f100) || 0) * k)
  };
}

function sfSeedFoodsIfEmpty_() {
  const sh = sfSheet_(SF.FOODS);
  if (sh.getLastRow() > 1) return 0;
  const rows = sfFoodRows_().map(function (r, i) {
    const s = sfFoodServing_(r[5], r[6], r[7], r[8], r[9]);
    const name = r[0];
    return {
      FoodID: 'FD' + String(i + 1).padStart(4, '0'), PersianName: name, EnglishName: r[1], Category: r[2],
      DietType: r[3] || 'عمومی', ServingName: r[4] || 'واحد', ServingGrams: r[5] || 100,
      Kcal100: r[6] || 0, Protein100: r[7] || 0, Carb100: r[8] || 0, Fat100: r[9] || 0, Fiber100: r[10] || 0,
      KcalServing: s.k, ProteinServing: s.p, CarbServing: s.c, FatServing: s.f,
      Recipe: r[11] || '',
      VideoURL: 'https://www.youtube.com/results?search_query=' + encodeURIComponent(name + ' طرز تهیه'),
      ImageURL: '',
      Tags: [r[2], r[3] || 'عمومی', name].join('، '), Active: 'TRUE', SourceNote: 'seed-v16'
    };
  });
  sfAppend_(SF.FOODS, rows);
  return rows.length;
}

function sfSeedModelsIfEmpty_() {
  const sh = sfSheet_(SF.MODELS);
  if (sh.getLastRow() > 1) return 0;
  const rows = sfDietModelRows_().map(function (r) {
    return {
      ModelID: r[0], Title: r[1], Kind: r[2], ProteinPct: r[3], CarbPct: r[4], FatPct: r[5], FastingWindow: r[6],
      Description: r[7], Rules: r[8], AllowedFoods: r[9], ForbiddenFoods: r[10], SampleDay: r[11], Tags: r[12], Active: 'TRUE'
    };
  });
  sfAppend_(SF.MODELS, rows);
  return rows.length;
}

/** یک‌بار: ساخت شیت‌ها، افزودن ستون‌های تازه به SF_Diets و پر کردن بانک غذا. */
function sfBootstrapV16() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SF_V16_READY') === '1') return { ok: true, cached: true };
  return sfWithLock_(function () {
    if (props.getProperty('SF_V16_READY') === '1') return { ok: true, cached: true };
    props.deleteProperty(SF.READY_PROP);   // باعث می‌شود SF_HEADERS کامل دوباره اعمال شود
    sfEnsure_();
    const foods = sfSeedFoodsIfEmpty_();
    const models = sfSeedModelsIfEmpty_();
    props.setProperty('SF_V16_READY', '1');
    return { ok: true, foods: foods, models: models };
  });
}

/* ------------------------------------------------------------------ API ---- */
function sfFoodObj_(r) {
  const g = function (k) { return Number(normalize_(r[k])) || 0; };
  return {
    id: normalize_(r.FoodID), name: normalize_(r.PersianName), en: normalize_(r.EnglishName),
    category: normalize_(r.Category), dietType: normalize_(r.DietType),
    servingName: normalize_(r.ServingName), servingGrams: g('ServingGrams'),
    kcal100: g('Kcal100'), protein100: g('Protein100'), carb100: g('Carb100'), fat100: g('Fat100'), fiber100: g('Fiber100'),
    kcal: g('KcalServing'), protein: g('ProteinServing'), carb: g('CarbServing'), fat: g('FatServing'),
    recipe: normalize_(r.Recipe), video: normalize_(r.VideoURL), image: normalize_(r.ImageURL),
    tags: normalize_(r.Tags), note: normalize_(r.SourceNote), active: sfIsTrue_(r.Active)
  };
}

/* افزوده‌شده در v2: ردیف‌های واقعی بانک غذا از شیت (sfFoodRows_ فقط آرایهٔ دادهٔ اولیهٔ seed را برمی‌گرداند و برای جستجو مناسب نبود). */
function sfFoodSheetRows_() { return sfObjects_(sfRead_(SF.FOODS)); }

function sfFoodBank(token, opts) {
  requireSession_(token);
  sfEnsure_(); sfEnsureV16_();
  opts = opts || {};
  const q = normalize_(opts.q).toLowerCase();
  const cat = normalize_(opts.category);
  const diet = normalize_(opts.dietType);
  const limit = Math.max(1, Math.min(400, Number(opts.limit) || 200));
  const all = sfFoodSheetRows_();
  const cats = {}, diets = {};
  all.forEach(function (r) {
    if (!sfIsTrue_(r.Active)) return;
    const c = normalize_(r.Category); if (c) cats[c] = 1;
    const d = normalize_(r.DietType); if (d) diets[d] = 1;
  });
  let rows = all.filter(function (r) { return sfIsTrue_(r.Active); });
  if (cat) rows = rows.filter(function (r) { return normalize_(r.Category) === cat; });
  if (diet) rows = rows.filter(function (r) { return normalize_(r.DietType) === diet; });
  if (q) rows = rows.filter(function (r) {
    return (normalize_(r.PersianName) + ' ' + normalize_(r.EnglishName) + ' ' + normalize_(r.Tags)).toLowerCase().indexOf(q) >= 0;
  });
  return { foods: rows.slice(0, limit).map(sfFoodObj_), total: rows.length, categories: Object.keys(cats), dietTypes: Object.keys(diets) };
}

function sfFoodGet(token, foodId) {
  requireSession_(token);
  sfEnsure_(); sfEnsureV16_();
  const id = normalize_(foodId);
  const r = sfFoodSheetRows_().filter(function (o) { return normalize_(o.FoodID) === id; })[0];
  if (!r) throw new Error('این غذا در بانک پیدا نشد.');
  return sfFoodObj_(r);
}

function sfDietModels(token) {
  requireSession_(token);
  sfEnsure_(); sfEnsureV16_();
  return sfObjects_(sfRead_(SF.MODELS)).filter(function (r) { return sfIsTrue_(r.Active); }).map(function (r) {
    return {
      id: normalize_(r.ModelID), title: normalize_(r.Title), kind: normalize_(r.Kind),
      proteinPct: Number(normalize_(r.ProteinPct)) || 0, carbPct: Number(normalize_(r.CarbPct)) || 0, fatPct: Number(normalize_(r.FatPct)) || 0,
      fastingWindow: normalize_(r.FastingWindow), description: normalize_(r.Description), rules: normalize_(r.Rules),
      allowed: normalize_(r.AllowedFoods), forbidden: normalize_(r.ForbiddenFoods), sampleDay: normalize_(r.SampleDay), tags: normalize_(r.Tags)
    };
  });
}

function sfAdminSaveFood(token, food) {
  sfAdmin_(token); sfEnsure_(); sfEnsureV16_();
  return sfWithLock_(function () {
    food = food || {};
    const name = sfText_(food.name, 120);
    if (!name) throw new Error('نام غذا را وارد کن.');
    const id = sfText_(food.id, 40) || ('FD-' + Date.now().toString(36).toUpperCase());
    const gram = sfNum_(food.servingGrams, 100, 1, 2000);
    const s = sfFoodServing_(gram, food.kcal100, food.protein100, food.carb100, food.fat100);
    const obj = {
      PersianName: name, EnglishName: sfText_(food.en, 120), Category: sfText_(food.category, 60) || 'سایر',
      DietType: sfText_(food.dietType, 60) || 'عمومی', ServingName: sfText_(food.servingName, 40) || 'واحد', ServingGrams: gram,
      Kcal100: sfNum_(food.kcal100, 0, 0, 2000), Protein100: sfNum_(food.protein100, 0, 0, 200), Carb100: sfNum_(food.carb100, 0, 0, 300),
      Fat100: sfNum_(food.fat100, 0, 0, 200), Fiber100: sfNum_(food.fiber100, 0, 0, 100),
      KcalServing: s.k, ProteinServing: s.p, CarbServing: s.c, FatServing: s.f,
      Recipe: sfText_(food.recipe, 900), VideoURL: sfText_(food.video, 300),
      ImageURL: sfText_(food.image, 300), Tags: sfText_(food.tags, 300), Active: 'TRUE', SourceNote: 'manual'
    };
    const all = sfObjects_(sfRead_(SF.FOODS));
    let found = false;
    all.forEach(function (o) { if (normalize_(o.FoodID) === id) { found = true; Object.keys(obj).forEach(function (k) { o[k] = obj[k]; }); } });
    if (!found) { obj.FoodID = id; all.push(obj); }
    sfRewrite_(SF.FOODS, function () { return false; }, all);
    return { ok: true, id: id, edited: found };
  });
}

function sfAdminDeleteFood(token, foodId) {
  sfAdmin_(token); sfEnsure_(); sfEnsureV16_();
  return sfWithLock_(function () {
    const id = normalize_(foodId);
    let removed = 0;
    const kept = sfObjects_(sfRead_(SF.FOODS)).filter(function (o) {
      if (normalize_(o.FoodID) === id) { removed++; return false; }
      return true;
    });
    sfRewrite_(SF.FOODS, function () { return false; }, kept);
    return { ok: true, removed: removed };
  });
}

function sfAdminReseedFoods(token) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    ['SF_Foods', 'SF_DietModels'].forEach(function (n) {
      const sh = sfSheet_(n);
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getMaxColumns()).clearContent();
    });
    return { ok: true, foods: sfSeedFoodsIfEmpty_(), models: sfSeedModelsIfEmpty_() };
  });
}

/* ------------------------------------------- ثبت غذا با ماکرو (شاگرد) ---- */
/**
 * ثبت یک غذا برای شاگرد.
 *  - اگر foodId بدهی و گرم هم بدهی: کالری و سه ماکرو از بانک غذا محاسبه می‌شود.
 *  - اگر مقدار دستی بدهی: همان ذخیره می‌شود.
 * نتیجه در شیت MealLogs (ستون‌های Kcal/Protein/Carbs/Fat) ثبت می‌شود.
 */
function sfLogFood(token, input, clientToday) {
  const session = requireSession_(token);
  sfEnsure_(); sfEnsureV16_();
  input = input || {};
  let grams = sfNum_(input.grams, 0, 0, 3000);
  let title = sfText_(input.title, 80);
  let kcal = Math.round(safeNumber_(input.kcal, 0)), protein = Math.round(safeNumber_(input.protein, 0));
  let carbs = Math.round(safeNumber_(input.carbs, 0)), fat = Math.round(safeNumber_(input.fat, 0));
  let foodId = sfText_(input.foodId, 40);
  let fromBank = false;

  if (foodId) {
    const r = sfObjects_(sfRead_(SF.FOODS)).filter(function (o) { return normalize_(o.FoodID) === foodId; })[0];
    if (!r) throw new Error('این غذا در بانک پیدا نشد.');
    if (!grams) grams = Number(normalize_(r.ServingGrams)) || 100;
    const k = grams / 100;
    title = title || normalize_(r.PersianName);
    kcal = Math.round((Number(normalize_(r.Kcal100)) || 0) * k);
    protein = Math.round((Number(normalize_(r.Protein100)) || 0) * k);
    carbs = Math.round((Number(normalize_(r.Carb100)) || 0) * k);
    fat = Math.round((Number(normalize_(r.Fat100)) || 0) * k);
    foodId = normalize_(r.FoodID);
    fromBank = true;
  }
  if (!title) throw new Error('نام غذا را وارد کن.');
  if (kcal > 6000 || protein > 600 || carbs > 1500 || fat > 500) throw new Error('مقدار وارد شده معتبر نیست.');
  if (!kcal && !protein && !carbs && !fat) throw new Error('کالری یا ماکرو را وارد کن.');

  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const slot = sfText_(input.slot, 40);
  let full = slot ? (slot + ' — ' + title) : title;
  if (grams > 0) full = full + ' (' + grams + ' گرم)';
  const sh = getMealSheet_();
  const id = new Date().toISOString() + '_' + Math.floor(Math.random() * 100000);
  sh.appendRow([session.username, today, full.slice(0, 120), kcal, protein, id, carbs, fat]);
  sh.getRange(sh.getLastRow(), 2).setNumberFormat('@').setValue(today);
  return {
    ok: true, fromBank: fromBank,
    logged: { title: full, kcal: kcal, protein: protein, carbs: carbs, fat: fat, foodId: foodId, grams: grams },
    meals: getMeals_(session.username, today)
  };
}

function sfDeleteMeal(token, mealId, clientToday) {
  const session = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.MEAL_LOGS_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: true, meals: getMeals_(session.username, clientToday) };
  const values = sh.getDataRange().getValues();
  const me = session.username.toLowerCase();
  for (let r = values.length - 1; r >= 1; r--) {
    if (normalize_(values[r][0]).toLowerCase() !== me) continue;
    if (normalize_(values[r][5]) === normalize_(mealId)) { sh.deleteRow(r + 1); break; }
  }
  return { ok: true, meals: getMeals_(session.username, clientToday) };
}

/* ------------------------------- برنامهٔ غذایی با ماکرو (بازنویسی‌ها) ---- */
function sfDietDoc_(input) {
  if (!input || typeof input !== 'object') throw new Error('اطلاعات برنامه غذایی ارسال نشد.');
  const planName = sfText_(input.planName, 120);
  if (!planName) throw new Error('نام برنامه غذایی را وارد کن.');
  const username = sfText_(input.username, 80);
  if (!username) throw new Error('شاگرد را انتخاب کن.');
  const users = sfObjects_(sfRead_(CONFIG.USERS_SHEET));
  const u = users.find(o => normalize_(o.user || o.Username).toLowerCase() === username.toLowerCase());
  if (!u) throw new Error('این شاگرد پیدا نشد.');
  const sections = (input.sections || []).map(s => ({
    title: sfText_(s.title, 80) || 'وعده',
    items: (s.items || []).filter(it => sfText_(it.title, 160) || sfText_(it.description, 400) || sfText_(it.foodId, 40)).map(it => ({
      title: sfText_(it.title, 160) || 'گزینه',
      description: sfText_(it.description, 400),
      kcal: sfText_(it.kcal, 12),
      foodId: sfText_(it.foodId, 40),
      grams: sfText_(it.grams, 12),
      protein: sfText_(it.protein, 12),
      carbs: sfText_(it.carbs, 12),
      fat: sfText_(it.fat, 12)
    }))
  })).filter(s => s.items.length);
  if (!sections.length) throw new Error('حداقل یک وعده با یک گزینه اضافه کن.');
  return { planName, username: normalize_(u.user || u.Username), sections };
}

function sfAdminSaveDiet(token, input) {
  sfAdmin_(token); sfEnsure_(); sfEnsureV16_();
  return sfWithLock_(function () {
    const v = sfDietDoc_(input);
    const editing = sfText_(input.planId, 60);
    const now = new Date().toISOString();
    const dietId = editing || ('D-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000));
    const rows = [];
    v.sections.forEach(function (sec, si) {
      sec.items.forEach(function (it, ii) {
        rows.push({
          DietID: dietId, Username: v.username, PlanName: v.planName, SectionNo: String(si + 1), SectionTitle: sec.title,
          ItemNo: String(ii + 1), ItemTitle: it.title, Description: it.description, Kcal: it.kcal, Active: 'TRUE',
          CreatedAt: now, UpdatedAt: now,
          FoodID: it.foodId, Grams: it.grams, Protein: it.protein, Carbs: it.carbs, Fat: it.fat
        });
      });
    });
    const u = v.username.toLowerCase();
    sfRewrite_('SF_Diets', function (o) {
      return !(normalize_(o.Username).toLowerCase() === u && normalize_(o.PlanName) === v.planName);
    }, rows);
    return { ok: true, planId: dietId, rows: rows.length, edited: !!editing };
  });
}

function sfAdminGetDiet(token, username, planName) {
  sfAdmin_(token); sfEnsure_(); sfEnsureV16_();
  const u = normalize_(username).toLowerCase(), n = normalize_(planName);
  const rows = sfObjects_(sfRead_('SF_Diets')).filter(function (r) {
    return normalize_(r.Username).toLowerCase() === u && normalize_(r.PlanName) === n;
  });
  if (!rows.length) throw new Error('برنامه غذایی پیدا نشد.');
  rows.sort(function (a, b) {
    return (Number(normalize_(a.SectionNo)) || 0) - (Number(normalize_(b.SectionNo)) || 0) || (Number(normalize_(a.ItemNo)) || 0) - (Number(normalize_(b.ItemNo)) || 0);
  });
  const order = [], secs = {};
  rows.forEach(function (r) {
    const t = normalize_(r.SectionTitle) || 'وعده';
    if (!secs[t]) { secs[t] = { title: t, items: [] }; order.push(t); }
    secs[t].items.push({
      title: normalize_(r.ItemTitle) || 'گزینه', description: normalize_(r.Description), kcal: normalize_(r.Kcal),
      foodId: normalize_(r.FoodID), grams: normalize_(r.Grams),
      protein: normalize_(r.Protein), carbs: normalize_(r.Carbs), fat: normalize_(r.Fat)
    });
  });
  return { planId: normalize_(rows[0].DietID), username: normalize_(rows[0].Username), planName: normalize_(rows[0].PlanName), sections: order.map(function (t) { return secs[t]; }) };
}

/** همان خروجی قبلی + ماکرو هر آیتم برای شاگرد */
function sfDietsAsLegacy_(username) {
  const u = normalize_(username).toLowerCase();
  if (!u) return [];
  sfEnsure_(); sfEnsureV16_();
  const rows = sfObjects_(sfRead_('SF_Diets')).filter(function (r) {
    return normalize_(r.Username).toLowerCase() === u && !sfIsFalseValue_(r.Active);
  });
  const order = [], byPlan = {};
  rows.forEach(function (r) {
    const name = normalize_(r.PlanName);
    if (!name) return;
    if (!byPlan[name]) { byPlan[name] = { name: name, sections: [] }; order.push(name); }
    const p = byPlan[name];
    const st = normalize_(r.SectionTitle) || 'برنامه';
    let sec = null;
    for (let i = 0; i < p.sections.length; i++) if (p.sections[i].title === st) sec = p.sections[i];
    if (!sec) { sec = { title: st, items: [] }; p.sections.push(sec); }
    const title = normalize_(r.ItemTitle) || 'گزینه';
    const desc = normalize_(r.Description);
    const kRaw = normalize_(r.Kcal);
    const num = function (v) { const s = normalize_(v); return s === '' ? null : Number(s); };
    sec.items.push({
      title: title, description: desc,
      kcal: kRaw === '' ? null : Number(kRaw),
      foodId: normalize_(r.FoodID), grams: num(r.Grams),
      protein: num(r.Protein), carbs: num(r.Carbs), fat: num(r.Fat)
    });
  });
  return order.map(function (n) { return byPlan[n]; });
}

/* ------------------------------------------------- پیشرفت حرفه‌ای ---- */
/** یک داشبورد کامل از داده‌های واقعی شیت‌ها برای صفحهٔ پیشرفت. */
function sfProgressBoard(token, clientToday) {
  const session = requireSession_(token);
  sfEnsure_();
  const username = session.username;
  const today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  const out = {
    username: username, today: today,
    weight: { points: [], latest: null, first: null, change: null },
    workouts: { done: 0, last30: 0, streak: 0, days: [], perDay: {} },
    sets: { total: 0, last30: 0, volume: 0, byExercise: [], prs: [], recent: [] },
    meals: { days: [], today: null, avgKcal: 0, loggedDays: 0 },
    water: { days: [], today: 0, avg: 0, goal: 8 },
    photos: [],
    reminders: [],
    notes: []
  };
  const me = username.toLowerCase();
  const num = function (v) { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const dayOf = function (v) { return dateKey_(v); };
  const daysAgo = function (n) { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - n); return Utilities.formatDate(d, tz_(), 'yyyy-MM-dd'); };
  const activity = {};
  const mark = function (d) { if (d) activity[d] = (activity[d] || 0) + 1; };

  /* وزن / دور کمر / چربی — از DailyLogs */
  try {
    const rd = sfRead_(CONFIG.DAILY_LOGS_SHEET);
    const ix = function (n) { return rd.idx[n] != null ? rd.idx[n] : -1; };
    const iW = ix('WeightKg'), iWa = ix('WaistCm'), iBf = ix('BodyFat'), iC = ix('Calories'), iN = ix('Notes'), iD = ix('DateISO');
    const rows = rd.rows.filter(function (r) { return normalize_(r[0]).toLowerCase() === me; })
      .filter(function (r) { return num(r[iW]) > 0 || num(r[iWa]) > 0 || num(r[iBf]) > 0; });
    rows.sort(function (a, b) { return dayOf(a[iD]) < dayOf(b[iD]) ? -1 : 1; });
    out.weight.points = rows.map(function (r) {
      const d = dayOf(r[iD]);
      mark(d);
      return { date: d, weight: num(r[iW]) || null, waist: num(r[iWa]) || null, bodyFat: num(r[iBf]) || null, kcal: num(r[iC]) || null, note: normalize_(r[iN]) };
    });
    const withW = out.weight.points.filter(function (p) { return p.weight; });
    if (withW.length) {
      out.weight.first = withW[0].weight;
      out.weight.latest = withW[withW.length - 1].weight;
      out.weight.change = Math.round((withW[withW.length - 1].weight - withW[0].weight) * 10) / 10;
    }
    const withWaist = out.weight.points.filter(function (p) { return p.waist; });
    if (withWaist.length) { out.weight.waistFirst = withWaist[0].waist; out.weight.waistLatest = withWaist[withWaist.length - 1].waist; }
  } catch (e) {}

  /* ست‌ها و رکوردها — از ExerciseLogs */
  try {
    const rd = sfRead_('ExerciseLogs');
    const ix = function (n) { return rd.idx[n] != null ? rd.idx[n] : -1; };
    const iD = ix('DateISO'), iW = ix('WeightKg'), iR = ix('Reps'), iE = ix('ExerciseName'), iWo = ix('WorkoutName');
    const rows = rd.rows.filter(function (r) { return normalize_(r[0]).toLowerCase() === me; });
    const byEx = {}, recent = [];
    let vol = 0, total = 0, last30 = 0;
    rows.forEach(function (r) {
      const w = num(r[iW]), reps = num(r[iR]);
      const ex = normalize_(r[iE]) || 'حرکت';
      const d = dayOf(r[iD]);
      total++;
      if (d >= daysAgo(30)) last30++;
      vol += w * reps;
      if (d) mark(d);
      const b = byEx[ex] || (byEx[ex] = { name: ex, sets: 0, volume: 0, best: 0, bestReps: 0, last: d });
      b.sets++; b.volume += w * reps;
      if (w > b.best) { b.best = w; b.bestReps = reps; }
      if (d > b.last) b.last = d;
      recent.push({ date: d, exercise: ex, workout: normalize_(r[iWo]), weight: w, reps: reps, volume: Math.round(w * reps) });
    });
    recent.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    out.sets.total = total; out.sets.last30 = last30; out.sets.volume = Math.round(vol);
    out.sets.byExercise = Object.keys(byEx).map(function (k) { return byEx[k]; }).sort(function (a, b) { return b.volume - a.volume; }).slice(0, 12);
    out.sets.prs = Object.keys(byEx).map(function (k) { return byEx[k]; }).sort(function (a, b) { return b.best - a.best; }).slice(0, 10)
      .map(function (b) { return { name: b.name, weight: b.best, reps: b.bestReps, volume: Math.round(b.volume), sets: b.sets }; });
    out.sets.recent = recent.slice(0, 50);
  } catch (e) {}

  /* تمرین‌های انجام‌شده — از WorkoutDone (اگر باشد) */
  try {
    const sh = getSS_().getSheetByName('WorkoutDone');
    if (sh && sh.getLastRow() > 1) {
      const values = sh.getDataRange().getDisplayValues();
      const h = values[0].map(normalize_);
      const col = function (n) { const i = h.indexOf(n); return i < 0 ? -1 : i; };
      const iD = col('DateISO') >= 0 ? col('DateISO') : 1;
      for (let r = 1; r < values.length; r++) {
        if (normalize_(values[r][0]).toLowerCase() !== me) continue;
        const d = dayOf(values[r][iD]);
        if (!d) continue;
        out.workouts.done++;
        out.workouts.perDay[d] = (out.workouts.perDay[d] || 0) + 1;
        mark(d);
      }
      out.workouts.last30 = Object.keys(out.workouts.perDay).filter(function (d) { return d >= daysAgo(30); }).length;
      let streak = 0;
      for (let i = 0; i < 400; i++) {
        const d = daysAgo(i);
        if (out.workouts.perDay[d]) streak++;
        else if (i > 0) break;
      }
      out.workouts.streak = streak;
    }
  } catch (e) {}

  /* غذا */
  try {
    const m = getMeals_(username, today);
    const days = Object.keys(m.days).sort().slice(-30).map(function (d) {
      return { date: d, kcal: Math.round(m.days[d].kcal), protein: Math.round(m.days[d].protein), carbs: Math.round(m.days[d].carbs), fat: Math.round(m.days[d].fat) };
    });
    out.meals.days = days;
    out.meals.loggedDays = days.length;
    out.meals.avgKcal = days.length ? Math.round(days.reduce(function (a, b) { return a + b.kcal; }, 0) / days.length) : 0;
    const t = m.days[today];
    out.meals.today = t ? { kcal: Math.round(t.kcal), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat) } : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  } catch (e) {}

  /* آب */
  try {
    const rd = sfRead_(CONFIG.WATER_LOGS_SHEET);
    const ix = function (n) { return rd.idx[n] != null ? rd.idx[n] : -1; };
    const iD = ix('DateISO') >= 0 ? ix('DateISO') : 1;
    const iG = ix('Glasses') >= 0 ? ix('Glasses') : 2;
    const rows = rd.rows.filter(function (r) { return normalize_(r[0]).toLowerCase() === me; });
    const perDay = {};
    rows.forEach(function (r) {
      const d = dayOf(r[iD]);
      const v = num(r[iG]) || 0;
      if (!d) return;
      perDay[d] = Math.max(perDay[d] || 0, v);
      mark(d);
    });
    const days = Object.keys(perDay).sort().slice(-14).map(function (d) { return { date: d, cups: Math.round(perDay[d]) }; });
    out.water.days = days;
    out.water.today = Math.round(perDay[today] || 0);
    out.water.avg = days.length ? Math.round(days.reduce(function (a, b) { return a + b.cups; }, 0) / days.length) : 0;
    out.water.goal = 8;
  } catch (e) {}

  /* عکس‌ها */
  try {
    const rd = sfRead_(CONFIG.PHOTOS_SHEET);
    const ix = function (n) { return rd.idx[n] != null ? rd.idx[n] : -1; };
    const iD = ix('DateISO') >= 0 ? ix('DateISO') : 1;
    const iL = ix('Label'), iF = ix('DriveFileId'), iU = ix('Url');
    out.photos = rd.rows.filter(function (r) { return normalize_(r[0]).toLowerCase() === me; }).map(function (r) {
      const fid = iF >= 0 ? normalize_(r[iF]) : '';
      const raw = iU >= 0 ? normalize_(r[iU]) : '';
      const url = fid ? ('https://lh3.googleusercontent.com/d/' + fid) : (raw ? fixImgUrl_(raw) : '');
      return { date: dayOf(r[iD]), label: iL >= 0 ? normalize_(r[iL]) : '', url: url };
    }).filter(function (p) { return p.url; });
  } catch (e) {}

  /* جدول فعالیت ۸۴ روز گذشته */
  out.activity = activity;
  const heat = [];
  for (let i = 83; i >= 0; i--) { const d = daysAgo(i); heat.push({ date: d, count: activity[d] || 0 }); }
  out.heat = heat;
  out.streakAny = (function () {
    let s = 0;
    for (let i = 0; i < 400; i++) { if (activity[daysAgo(i)]) s++; else if (i > 0) break; }
    return s;
  })();

  return out;
}

function sfEnsureV16_() {
  return sfBootstrapV16();
}










/* =====================================================================
 * server v17 — بخش ۷: جزئیات روز (تقویم/کنسول مربی) + متن یادآورها
 * ===================================================================== */

/** متن پیام یادآور برای انواع جدید (قرص/مکمل/تغذیه) — از sendDueReminders_ صدا زده می‌شود. */
function sf7ReminderText_(it, username, today) {
  if (!it || !it.type) return '';
  const label = String(it.label == null ? '' : it.label).trim();
  if (it.type === 'pill') return '💊 ' + (label || 'وقت خوردن قرصت رسیده.');
  if (it.type === 'supplement') return '🥛 ' + (label || 'وقت مصرف مکملت رسیده.');
  if (it.type === 'nutrition') return '🍽️ ' + (label || 'وعدهٔ غذاییت رو توی اپ ثبت کن تا کالری امروزت دقیق بمونه.');
  return '';
}

/**
 * جزئیات یک روز برای شاگرد (یا خود مربی):
 * وعده‌های غذایی، ست‌های تمرین انجام‌شده، آب، وزن.
 */
function sfDayDetail(token, username, dateISO) {
  const s = requireSession_(token);
  const target = normalize_(username) || s.username;
  const u = target.toLowerCase();
  if (u !== s.username.toLowerCase() && !isCoach_(s)) throw new Error('دسترسی به این کاربر مجاز نیست.');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(dateISO || '')) ? String(dateISO) : todayISO_();
  const out = { date: day, username: target, meals: [], workout: [], water: 0, weight: null, kcal: 0, protein: 0, carbs: 0, fat: 0 };

  const mealSh = getSS_().getSheetByName(CONFIG.MEAL_LOGS_SHEET);
  if (mealSh && mealSh.getLastRow() > 1) {
    const v = mealSh.getDataRange().getValues();
    for (let r = 1; r < v.length; r++) {
      if (normalize_(v[r][0]).toLowerCase() !== u) continue;
      if (dateKey_(v[r][1]) !== day) continue;
      const m = {
        id: normalize_(v[r][5]), title: normalize_(v[r][2]),
        kcal: safeNumber_(v[r][3], 0), protein: safeNumber_(v[r][4], 0),
        carbs: safeNumber_(v[r][6], 0), fat: safeNumber_(v[r][7], 0), slot: ''
      };
      out.meals.push(m);
      out.kcal += m.kcal; out.protein += m.protein; out.carbs += m.carbs; out.fat += m.fat;
    }
  }

  const exSh = getSS_().getSheetByName(CONFIG.EXERCISE_LOGS_SHEET);
  if (exSh && exSh.getLastRow() > 1) {
    const v = exSh.getDataRange().getValues(), agg = {};
    for (let r = 1; r < v.length; r++) {
      if (normalize_(v[r][0]).toLowerCase() !== u) continue;
      if (dateKey_(v[r][1]) !== day) continue;
      const name = normalize_(v[r][3]) || normalize_(v[r][2]) || 'حرکت';
      const a = agg[name] || (agg[name] = { name: name, sets: 0, volume: 0 });
      a.sets++;
      a.volume += (Number(v[r][4]) || 0) * (Number(v[r][5]) || 0);
    }
    out.workout = Object.keys(agg).map(function (k) { return agg[k]; });
  }

  try {
    const w = getWater_(target, day);
    out.water = w && w.glasses ? Number(w.glasses) : 0;
  } catch (e) {}

  try {
    const logs = getLogs_(target);
    for (let i = 0; i < logs.length; i++) {
      if (String(logs[i].date || '').slice(0, 10) === day) { out.weight = logs[i].weight; break; }
    }
  } catch (e) {}

  return rpcSafe_(out);
}

/* =====================================================================
 * کتابخانهٔ برنامه‌ها (مربی): ذخیره، اختصاص، کپی بین شاگردها
 *   ردیف‌های کتابخانه با Username = '__LIB__' در همان شیت‌های برنامه
 *   نگه داشته می‌شوند؛ پس هیچ شاگردی آن‌ها را نمی‌بیند.
 * ===================================================================== */
const SF7_LIB = '__LIB__';
const SF7_KINDS = {
  workout: { sheet: null, idCol: 'PlanID' },
  diet: { sheet: 'SF_Diets', idCol: 'DietID' },
  supp: { sheet: 'SF_Supps', idCol: 'SuppID' }
};
function sf7Coach_(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('دسترسی مربی لازم است.');
  sfEnsure_();
  return s;
}
function sf7Kind_(kind) {
  const k = normalize_(kind).toLowerCase();
  if (!SF7_KINDS[k]) throw new Error('نوع برنامه نامعتبر است.');
  return k;
}
function sf7NewId_() { return sfNewPlanId_(); }

/** کپی کامل یک برنامهٔ تمرینی (پلن + بلوک + آیتم + ست) به کاربر مقصد. */
function sf7CopyWorkoutTo_(srcPlanId, toUsername, newName, createdBy) {
  const plans = sfObjects_(sfRead_(SF.PLANS));
  const src = plans.find(function (o) { return o.PlanID === normalize_(srcPlanId); });
  if (!src) throw new Error('برنامهٔ تمرینی پیدا نشد.');
  const newId = sf7NewId_(), now = new Date().toISOString();
  const mapB = function (id) { return String(id).split(src.PlanID).join(newId); };
  const blocks = sfObjects_(sfRead_(SF.BLOCKS)).filter(function (o) { return o.PlanID === src.PlanID; })
    .map(function (o) { return Object.assign({}, o, { BlockID: mapB(o.BlockID), PlanID: newId }); });
  const items = sfObjects_(sfRead_(SF.ITEMS)).filter(function (o) { return o.PlanID === src.PlanID; })
    .map(function (o) { return Object.assign({}, o, { ItemID: mapB(o.ItemID), BlockID: mapB(o.BlockID), PlanID: newId }); });
  const sets = sfObjects_(sfRead_(SF.SETS)).filter(function (o) { return o.PlanID === src.PlanID; })
    .map(function (o) { return Object.assign({}, o, { SetID: mapB(o.SetID), BlockID: mapB(o.BlockID), PlanID: newId }); });
  sfAppend_(SF.PLANS, [Object.assign({}, src, {
    PlanID: newId, Username: toUsername, PlanName: sfText_(newName, 120) || src.PlanName,
    Active: 'TRUE', CreatedAt: now, UpdatedAt: now, CreatedBy: createdBy || toUsername
  })]);
  if (blocks.length) sfAppend_(SF.BLOCKS, blocks);
  if (items.length) sfAppend_(SF.ITEMS, items);
  if (sets.length) sfAppend_(SF.SETS, sets);
  return newId;
}

/** کپی ردیف‌های ساده (تغذیه/مکمل) از یک برنامه به مقصد. */
function sf7CopySimpleTo_(kind, sheetName, idCol, srcUser, srcName, toUser, newName) {
  const rows = sfObjects_(sfRead_(sheetName)).filter(function (o) {
    return normalize_(o.Username).toLowerCase() === String(srcUser).toLowerCase() && normalize_(o.PlanName) === srcName;
  });
  if (!rows.length) throw new Error('برنامه پیدا نشد.');
  const newId = sf7NewId_(), now = new Date().toISOString();
  const copies = rows.map(function (o) {
    const c = Object.assign({}, o);
    c[idCol] = newId; c.Username = toUser; c.PlanName = sfText_(newName, 120) || srcName;
    c.CreatedAt = now; c.UpdatedAt = now;
    return c;
  });
  sfAppend_(sheetName, copies);
  return newId;
}

/** همهٔ برنامه‌های کتابخانه (تمرین/تغذیه/مکمل). */
function sf7LibList(token) {
  sf7Coach_(token);
  const items = [];
  const add = function (kind, rows, idCol) {
    const map = {};
    rows.forEach(function (o) {
      if (normalize_(o.Username) !== SF7_LIB) return;
      const name = normalize_(o.PlanName);
      if (!name) return;
      const it = map[name] || (map[name] = { kind: kind, name: name, ids: {}, count: 0, updatedAt: '' });
      const id = normalize_(o[idCol]);
      if (id) it.ids[id] = 1;
      it.count++;
      const u = normalize_(o.UpdatedAt) || normalize_(o.CreatedAt);
      if (u > it.updatedAt) it.updatedAt = u;
    });
    Object.keys(map).forEach(function (k) {
      const it = map[k];
      it.count = Object.keys(it.ids).length || it.count;
      delete it.ids;
      items.push(it);
    });
  };
  add('workout', sfObjects_(sfRead_(SF.PLANS)), 'PlanID');
  add('diet', sfObjects_(sfRead_('SF_Diets')), 'DietID');
  add('supp', sfObjects_(sfRead_('SF_Supps')), 'SuppID');
  items.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
  return rpcSafe_({ ok: true, items: items });
}

/** ذخیرهٔ یک برنامهٔ موجود (از پروندهٔ شاگرد) در کتابخانه. */
function sf7LibSaveFrom(token, kind, username, planName, libName) {
  const s = sf7Coach_(token); kind = sf7Kind_(kind);
  const name = sfText_(libName, 120) || sfText_(planName, 120);
  if (!name) throw new Error('نام برنامه لازم است.');
  return sfWithLock_(function () {
    if (kind === 'workout') {
      const src = sfObjects_(sfRead_(SF.PLANS)).find(function (o) {
        return normalize_(o.Username).toLowerCase() === String(username).toLowerCase() && normalize_(o.PlanName) === normalize_(planName);
      });
      if (!src) throw new Error('برنامه پیدا نشد.');
      sf7CopyWorkoutTo_(src.PlanID, SF7_LIB, name, s.username);
    } else {
      const cfg = SF7_KINDS[kind];
      sf7CopySimpleTo_(kind, cfg.sheet, cfg.idCol, username, normalize_(planName), SF7_LIB, name);
    }
    return rpcSafe_({ ok: true, name: name });
  });
}

/** اختصاص برنامهٔ کتابخانه به یک شاگرد. */
function sf7LibAssign(token, kind, libName, toUsername, newName) {
  const s = sf7Coach_(token); kind = sf7Kind_(kind);
  const to = sfText_(toUsername, 80);
  if (!to) throw new Error('شاگرد مقصد را انتخاب کن.');
  return sfWithLock_(function () {
    if (kind === 'workout') {
      const src = sfObjects_(sfRead_(SF.PLANS)).find(function (o) {
        return normalize_(o.Username) === SF7_LIB && normalize_(o.PlanName) === normalize_(libName);
      });
      if (!src) throw new Error('برنامه در کتابخانه پیدا نشد.');
      sf7CopyWorkoutTo_(src.PlanID, to, sfText_(newName, 120) || src.PlanName, s.username);
    } else {
      const cfg = SF7_KINDS[kind];
      sf7CopySimpleTo_(kind, cfg.sheet, cfg.idCol, SF7_LIB, normalize_(libName), to, sfText_(newName, 120) || normalize_(libName));
    }
    return rpcSafe_({ ok: true });
  });
}

/** کپی مستقیم یک برنامه از پروندهٔ یک شاگرد به شاگرد دیگر. */
function sf7LibAssignFromStudent(token, kind, fromUsername, planName, toUsername, newName) {
  const s = sf7Coach_(token); kind = sf7Kind_(kind);
  const to = sfText_(toUsername, 80);
  if (!to) throw new Error('شاگرد مقصد را انتخاب کن.');
  return sfWithLock_(function () {
    if (kind === 'workout') {
      const src = sfObjects_(sfRead_(SF.PLANS)).find(function (o) {
        return normalize_(o.Username).toLowerCase() === String(fromUsername).toLowerCase() && normalize_(o.PlanName) === normalize_(planName);
      });
      if (!src) throw new Error('برنامه پیدا نشد.');
      sf7CopyWorkoutTo_(src.PlanID, to, sfText_(newName, 120) || src.PlanName, s.username);
    } else {
      const cfg = SF7_KINDS[kind];
      sf7CopySimpleTo_(kind, cfg.sheet, cfg.idCol, fromUsername, normalize_(planName), to, sfText_(newName, 120) || normalize_(planName));
    }
    return rpcSafe_({ ok: true });
  });
}

/** حذف یک برنامه از کتابخانه. */
function sf7LibDelete(token, kind, libName) {
  sf7Coach_(token); kind = sf7Kind_(kind);
  const nm = normalize_(libName);
  return sfWithLock_(function () {
    if (kind === 'workout') {
      const rd = sfRead_(SF.PLANS);
      const hit = rd.rows.filter(function (r) { return normalize_(r[rd.idx.Username]) === SF7_LIB && normalize_(r[rd.idx.PlanName]) === nm; });
      if (!hit.length) throw new Error('برنامه در کتابخانه پیدا نشد.');
      const ids = hit.map(function (r) { return normalize_(r[rd.idx.PlanID]); });
      sfRewrite_(SF.PLANS, function (o) {
        return !(ids.indexOf(normalize_(o.PlanID)) >= 0 && normalize_(o.Username) === SF7_LIB);
      });
      [SF.BLOCKS, SF.ITEMS, SF.SETS].forEach(function (sh) {
        sfRewrite_(sh, function (o) { return ids.indexOf(normalize_(o.PlanID)) < 0; });
      });
    } else {
      const cfg = SF7_KINDS[kind];
      sfRewrite_(cfg.sheet, function (o) {
        return !(normalize_(o.Username) === SF7_LIB && normalize_(o.PlanName) === nm);
      });
    }
    return rpcSafe_({ ok: true });
  });
}

/** دیباگ ربات: آخرین آپدیت‌ها + ارسال آزمایشی به یک چت.
 *  reset = true  ⇒ آفست ربات صفر می‌شود تا پیام‌های اخیر دوباره خوانده شوند. */
function sf7BotDebug(token, sendToChatId, reset) {
  sf7Coach_(token);
  const p = botProps_(), t = p.getProperty('TELEGRAM_BOT_TOKEN') || '';
  const base = botBase_();
  const out = { ok: true, hasToken: !!t, updates: [], sent: null, offsetBefore: p.getProperty('BOT_OFFSET') || '' };
  if (!t) return rpcSafe_(out);
  if (reset) { p.setProperty('BOT_OFFSET', '0'); out.reset = true; }
  const off = reset ? '0' : (p.getProperty('BOT_OFFSET') || '0');
  try {
    const rr = UrlFetchApp.fetch(base + '/bot' + t + '/getUpdates?limit=20&offset=' + off, { muteHttpExceptions: true });
    const r = JSON.parse(rr.getContentText());
    out.apiOk = !!r.ok;
    if (!r.ok) out.apiError = r.description || ('HTTP ' + rr.getResponseCode());
    out.updates = (r.result || []).map(function (u) {
      const m = u.message || u.edited_message || {};
      return { id: u.update_id, chatId: m.chat && m.chat.id, from: m.from && (m.from.username || m.from.first_name), text: m.text || '' };
    });
  } catch (e) { out.updatesError = String(e.message || e); }
  if (sendToChatId) {
    const res = botCall_(t, 'sendMessage', { chat_id: String(sendToChatId), text: '✅ پیام آزمایشی از اپ Saeedi Fit Body — اتصال تلگرام درست کار می‌کند.' });
    out.sent = !!(res && res.ok);
    if (!out.sent) out.sentError = (res && res.description) || 'ارسال نشد';
  }
  return rpcSafe_(out);
}

/** وضعیت ارسال خودکار یادآورها (کش روزانه + وضعیت تریگر). */
function sf7RemStatus(token, forUser) {
  const s = requireSession_(token);
  let target = normalize_(forUser) || s.username;
  if (target.toLowerCase() !== s.username.toLowerCase() && !isCoach_(s)) throw new Error('دسترسی ندارید.');
  const rem = getSS_().getSheetByName('Reminders');
  let items = [];
  if (rem && rem.getLastRow() >= 2) {
    rem.getDataRange().getValues().slice(1).forEach(function (row) {
      if (normalize_(row[0]).toLowerCase() !== target.toLowerCase()) return;
      try { items = JSON.parse(row[1]) || []; } catch (e) { items = []; }
    });
  }
  const today = todayISO_(), cache = CacheService.getScriptCache();
  const out = { ok: true, user: target, today: today, trigger: false, items: [] };
  try { out.trigger = ScriptApp.getProjectTriggers().some(function (x) { return x.getHandlerFunction() === 'botTick'; }); } catch (e) {}
  items.forEach(function (it) {
    const key = 'rm_' + target + '_' + it.type + '_' + it.time + '_' + today;
    out.items.push({ type: it.type, time: it.time, label: it.label || '', sent: !!cache.get(key) });
  });
  return rpcSafe_(out);
}

/** آیدی عددی تلگرام ذخیره‌شدهٔ کاربر (مربی می‌تواند آیدی شاگرد را هم ببیند). */
function sf7GetTelegramId(token, forUser) {
  const s = requireSession_(token);
  let target = s.username;
  const fu = normalize_(forUser);
  if (fu && fu.toLowerCase() !== s.username.toLowerCase()) {
    if (!isCoach_(s)) throw new Error('فقط مربی می‌تواند اطلاعات شاگرد را ببیند.');
    target = fu;
  }
  const rec = getUserRecord_(target);
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  const cur = rec ? normalize_(sh.getRange(rec.row, 7).getValue()) : '';
  const p = botProps_();
  return rpcSafe_({ ok: true, telegramId: cur, target: target, botUsername: p.getProperty('BOT_USERNAME') || '', configured: !!p.getProperty('TELEGRAM_BOT_TOKEN') });
}

/** ذخیره و تست آیدی عددی تلگرام (ربات یک پیام آزمایشی می‌فرستد).
 *  مربی می‌تواند آیدی را برای شاگرد هم ثبت کند: forUser. */
function sf7SetTelegramId(token, chatId, forUser) {
  const s = requireSession_(token);
  let target = normalize_(forUser);
  if (target && target.toLowerCase() !== s.username.toLowerCase()) {
    if (!isCoach_(s)) throw new Error('فقط مربی می‌تواند برای شاگرد ثبت کند.');
  } else target = s.username;
  const raw = normalize_(String(chatId == null ? '' : chatId)).replace(/\s/g, '');
  const p = botProps_(), t = p.getProperty('TELEGRAM_BOT_TOKEN') || '';
  if (!t) throw new Error('ربات هنوز تنظیم نشده.');
  let id = '', resolved = null;
  if (/^-?\d{5,16}$/.test(raw)) {
    id = raw;
  } else {
    /* یوزرنیم: با getChat به آیدی عددی تبدیل و صحتش بررسی می‌شود */
    const uname = raw.replace(/^@/, '');
    if (!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(uname)) {
      throw new Error('آیدی تلگرام باید عدد باشد (مثل 123456789) یا یوزرنیم (مثل @alii_saeedi).');
    }
    const gc = botCall_(t, 'getChat', { chat_id: '@' + uname });
    if (!gc || !gc.ok || !gc.result || !gc.result.id) {
      throw new Error('این یوزرنیم شناسایی نشد (' + ((gc && gc.description) || 'پاسخی نرسید') + '). یا یوزرنیم اشتباه است، یا آن کاربر هنوز به ربات پیام نداده.');
    }
    id = String(gc.result.id);
    resolved = { id: id, username: gc.result.username || '', name: gc.result.first_name || '' };
  }
  const res = botCall_(t, 'sendMessage', {
    chat_id: id,
    text: '✅ آیدی تلگرام برای ' + target + ' ثبت شد. از این به بعد یادآورهای تمرین، آب، قرص، مکمل و تغذیه همین‌جا برایت می‌آید.'
  });
  if (!res || !res.ok) throw new Error('ارسال آزمایشی ناموفق بود: ' + ((res && res.description) || 'آیدی درست نیست یا کاربر ربات را استارت نکرده.'));
  const rec = getUserRecord_(target);
  if (!rec) throw new Error('این کاربر پیدا نشد.');
  getSS_().getSheetByName(CONFIG.USERS_SHEET).getRange(rec.row, 7).setValue(id);
  return rpcSafe_({ ok: true, telegramId: id, target: target, testSent: true, resolved: resolved });
}

/** تست واقعی یادآورها: پیام‌های سررسیدهٔ کاربر را همین حالا می‌فرستد و نتیجه را برمی‌گرداند. */
function sf7RemTest(token, forUser) {
  const s = requireSession_(token);
  let target = normalize_(forUser);
  if (target && target.toLowerCase() !== s.username.toLowerCase() && !isCoach_(s)) throw new Error('دسترسی ندارید.');
  if (!target) target = s.username;
  const p = botProps_(), t = p.getProperty('TELEGRAM_BOT_TOKEN') || '';
  const out = { ok: true, user: target, chatId: '', sent: [], errors: [] };
  if (!t) throw new Error('ربات تنظیم نشده.');
  const users = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1);
  for (let r = 0; r < users.length; r++) {
    if (normalize_(users[r][0]).toLowerCase() === target.toLowerCase()) { out.chatId = normalize_(users[r][6]); break; }
  }
  if (!out.chatId) throw new Error('برای این کاربر آیدی تلگرام ثبت نشده. اول در پروفایل → «یادآور تلگرام» آیدی عددی را ثبت کن.');
  /* همیشه اول یک پیام تأیید اتصال می‌فرستیم تا کاربر نتیجه را ببیند */
  const head = botCall_(t, 'sendMessage', { chat_id: out.chatId, text: '🔔 تست اتصال — اگر این پیام را می‌بینی، یادآورهای Saeedi Fit Body به تلگرام تو وصل است ✅' });
  if (head && head.ok) out.sent.push({ type: 'ping', time: '', text: 'تست اتصال' });
  else out.errors.push({ type: 'ping', time: '', error: (head && head.description) || 'ناموفق' });
  const rem = getSS_().getSheetByName('Reminders');
  let items = [];
  if (rem && rem.getLastRow() >= 2) {
    rem.getDataRange().getValues().slice(1).forEach(function (row) {
      if (normalize_(row[0]).toLowerCase() !== target.toLowerCase()) return;
      try { items = JSON.parse(row[1]) || []; } catch (e) { items = []; }
    });
  }
  const today = todayISO_();
  items.forEach(function (it) {
    if (it.on === false) return;
    let text = '';
    try { text = sf7ReminderText_(it, target, today) || ''; } catch (e) {}
    if (!text) {
      if (it.type === 'workout') text = '🏋️ وقت تمرینه! بریم که امروز رو کامل کنیم.';
      else if (it.type === 'water') text = '💧 یه لیوان آب بخور!';
      else if (it.type === 'meal' || it.type === 'nutrition') text = '🍽️ وعدهٔ غذاییت رو ثبت کن.';
      else if (it.type === 'weight') text = '⚖️ وقت وزن‌کشیه!';
      else if (it.type === 'pill') text = '💊 وقت قرص/دارو' + (it.label ? ' (' + it.label + ')' : '') + ' است.';
      else if (it.type === 'supplement') text = '🧴 وقت مکمل' + (it.label ? ' (' + it.label + ')' : '') + ' است.';
      else text = 'یادآور: وقت کارهای برنامه‌ات است.';
    }
    text = '⏰ یادآور ' + (it.time || '') + ' — ' + text;
    const res = botCall_(t, 'sendMessage', { chat_id: out.chatId, text: text });
    if (res && res.ok) out.sent.push({ type: it.type, time: it.time, text: text });
    else out.errors.push({ type: it.type, time: it.time, error: (res && res.description) || 'ناموفق' });
  });
  return rpcSafe_(out);
}

/* =====================================================================
 *  نسخهٔ برنامه‌ها (برای باطل‌کردن کش) + همگام‌سازی تخصیص‌ها
 * ===================================================================== */
function sf7PlanVer_() {
  try { return PropertiesService.getScriptProperties().getProperty('PLANS_VER') || '1'; } catch (e) { return '1'; }
}
function sf7BumpPlans_() {
  try {
    const p = PropertiesService.getScriptProperties();
    p.setProperty('PLANS_VER', String(Number(sf7PlanVer_() || '1') + 1) + '-' + Date.now().toString(36));
  } catch (e) {}
}

/** ارسال پیام شاگرد به تلگرام همهٔ مربی‌ها/ادمین‌ها (از sendMessage صدا زده می‌شود). */
/** فهرست آیدی‌هایی که باید اعلان پیام شاگردها به آن‌ها برسد:
 *  @ALII_SAEEDI (اگر ربات را استارت کرده باشد) + آیدی‌های عددی ثبت‌شده + هر حسابی که
 *  در TG_DIR با نام alii_saeedi دیده شده + همهٔ مربی‌ها/ادمین‌های شیت کاربران */
function sf7AdminChats_() {
  const props = botProps_();
  const chats = [];
  const push = function (c) { const v = normalize_(c); if (v && chats.indexOf(v) < 0) chats.push(v); };
  push('@ALII_SAEEDI');
  try {
    String(props.getProperty('ADMIN_CHATS') || '').split(',').filter(Boolean).forEach(push);
  } catch (e) {}
  try {
    const dir = JSON.parse(props.getProperty('TG_DIR') || '{}') || {};
    Object.keys(dir).forEach(function (u) {
      const lu = String(u).toLowerCase();
      if (lu === 'alii_saeedi' || lu.indexOf('alii_saeedi') >= 0) push(dir[u]);
    });
  } catch (e) {}
  try {
    getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1).forEach(function (r) {
      const role = normalize_(r[5]).toLowerCase();
      if (role === 'coach' || role === 'admin') push(r[6]);
    });
  } catch (e) {}
  return chats;
}

function sf7NotifyCoaches_(fromUser, text) {
  const t = botProps_().getProperty('TELEGRAM_BOT_TOKEN');
  if (!t) return false;
  const chats = sf7AdminChats_();
  if (!chats.length) return false;
  const body = '✉️ پیام تازه از ' + fromUser + ':\n' + String(text == null ? '' : text).slice(0, 1200) +
    '\n\n' + '↩️ برای پاسخ: روی همین پیام ریپلای کن و متنت را بنویس؛ مستقیم برای ' + fromUser + ' می‌رود.';
  /* راست‌چین کردن خطوط فارسی */
  const msg = body.split('\n').map(function (ln) { return ln.trim() ? '\u200F' + ln : ln; }).join('\n');
  /* ارسال یکی‌یکی تا message_id هر پیام دربیاید → برای پاسخ با ریپلای از MSG_MAP استفاده شود */
  const props = botProps_();
  let map = {};
  try { map = JSON.parse(props.getProperty('MSG_MAP') || '{}') || {}; } catch (e) { map = {}; }
  chats.forEach(function (c) {
    try {
      const r = botCall_(t, 'sendMessage', { chat_id: c, text: msg, disable_web_page_preview: true });
      if (r && r.ok && r.result && r.result.message_id) {
        map[String(c) + ':' + r.result.message_id] = normalize_(fromUser);
      }
    } catch (e) {}
  });
  const keys = Object.keys(map);
  if (keys.length > 400) keys.slice(0, keys.length - 400).forEach(function (k) { delete map[k]; });
  try { props.setProperty('MSG_MAP', JSON.stringify(map)); } catch (e) {}
  return true;
}

/** پاسخ مربی با ریپلای روی پیام شاگرد: پیام شاگرد را پیدا کن و به او بفرست */
function sf7CoachReply_(chat, replyToMsgId, text, fromUsername) {
  const props = botProps_();
  let map = {};
  try { map = JSON.parse(props.getProperty('MSG_MAP') || '{}') || {}; } catch (e) { map = {}; }
  const key = String(chat) + ':' + String(replyToMsgId == null ? '' : replyToMsgId);
  const student = String(map[key] || '');
  if (!student) return { ok: false, error: 'no_map' };
  const rows = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1);
  let to = '';
  for (let i = 0; i < rows.length; i++) {
    if (normalize_(rows[i][0]).toLowerCase() === student.toLowerCase()) { to = normalize_(rows[i][6]); break; }
  }
  if (!to) return { ok: false, error: 'no_chat' };
  const t = props.getProperty('TELEGRAM_BOT_TOKEN');
  if (!t) return { ok: false, error: 'no_token' };
  const body = '↩️ [b]پاسخ مربی به پیام تو[/b]\n━━━━━━━━━━━━━━\n' +
    String(text == null ? '' : text).slice(0, 1200).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .split('\n').map(function (ln) { return ln.trim() ? '\u200F' + ln : ln; }).join('\n');
  let sent = false;
  try {
    const r = botCall_(t, 'sendMessage', { chat_id: to, text: body, parse_mode: 'HTML', disable_web_page_preview: true });
    sent = !!(r && r.ok);
  } catch (e) { sent = false; }
  if (!sent) return { ok: false, error: 'send_fail' };
  /* ثبت پاسخ در شیت پیام‌ها تا در اپ هم دیده شود */
  try {
    getSS_().getSheetByName(CONFIG.MESSAGES_SHEET).appendRow([student, normalize_(fromUsername || ''), String(text == null ? '' : text).slice(0, 1200), new Date().toISOString()]);
  } catch (e) {}
  return { ok: true, to: to, student: student };
}

/** هر اسم برنامه‌ای که در پروفایل شاگرد ثبت شده ولی ردیف‌هایش برای او کپی نشده را از
 *  کتابخانه (یا از شاگردی که همان برنامه را دارد) کپی می‌کند. */
function sf7SyncAssignedPlans(token, onlyUser) {
  sf7Coach_(token);
  const out = { ok: true, fixed: [], missing: [], users: 0 };
  const users = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1)
    .filter(function (r) { return normalize_(r[0]); })
    .map(function (r) {
      return { username: normalize_(r[0]), supp: splitPlans_(r[2]), workout: splitPlans_(r[3]), diet: splitPlans_(r[4]) };
    });
  const want = normalize_(onlyUser).toLowerCase();
  const plans = sfObjects_(sfRead_(SF.PLANS));
  const diets = sfObjects_(sfRead_('SF_Diets'));
  const supps = sfObjects_(sfRead_('SF_Supps'));
  const has = function (rows, user, name) {
    return rows.some(function (o) {
      return normalize_(o.Username).toLowerCase() === String(user).toLowerCase() && normalize_(o.PlanName) === normalize_(name);
    });
  };
  const pickSource = function (rows, name) {
    const same = rows.filter(function (o) { return normalize_(o.PlanName) === normalize_(name); });
    if (!same.length) return null;
    const lib = same.filter(function (o) { return normalize_(o.Username) === SF7_LIB; })[0];
    return lib || same[0];
  };
  users.forEach(function (u) {
    if (want && u.username.toLowerCase() !== want) return;
    out.users++;
    u.workout.forEach(function (name) {
      if (!name || has(plans, u.username, name)) return;
      const src = pickSource(plans, name);
      if (!src) { out.missing.push({ user: u.username, kind: 'workout', name: name }); return; }
      try { sf7CopyWorkoutTo_(src.PlanID, u.username, name, 'sync'); out.fixed.push({ user: u.username, kind: 'workout', name: name }); } catch (e) { out.missing.push({ user: u.username, kind: 'workout', name: name, error: e.message }); }
    });
    [['diet', diets, 'SF_Diets'], ['supp', supps, 'SF_Supps']].forEach(function (cfg) {
      (u[cfg[0]] || []).forEach(function (name) {
        if (!name || has(cfg[1], u.username, name)) return;
        const src = pickSource(cfg[1], name);
        if (!src) { out.missing.push({ user: u.username, kind: cfg[0], name: name }); return; }
        try { sf7CopySimpleTo_(cfg[0], cfg[2], cfg[0] === 'diet' ? 'DietID' : 'SuppID', normalize_(src.Username), normalize_(name), u.username, name); out.fixed.push({ user: u.username, kind: cfg[0], name: name }); }
        catch (e) { out.missing.push({ user: u.username, kind: cfg[0], name: name, error: e.message }); }
      });
    });
  });
  if (out.fixed.length) sf7BumpPlans_();
  return rpcSafe_(out);
}

/* =====================================================================
 *  ماکروها: تخمین پروتئین/کربوهیدرات/چربی از متن غذا + پُرکردن برنامه‌ها
 * ===================================================================== */
var SF7_FOOD_DB = [
  { re: /سفیده\s*تخم|سفیده\s*مرغ|egg\s*white/i, grams: 33, p: 3.6, c: 0.2, f: 0, k: 17 },
  { re: /تخم\s*مرغ|تخممرغ|egg/i, grams: 50, p: 6.3, c: 0.5, f: 5, k: 72 },
  { re: /نان\s*سنگک|نان\s*بربری|نان\s*لواش|نان\s*تافتون|نان/i, grams: 30, p: 2.4, c: 15, f: 0.4, k: 78 },
  { re: /برنج|پلو|rice/i, grams: 100, p: 2.7, c: 28, f: 0.3, k: 130 },
  { re: /جوجه|مرغ|chicken/i, grams: 100, p: 27, c: 0, f: 3.6, k: 165 },
  { re: /گوشت|گوساله|استیک|beef/i, grams: 100, p: 26, c: 0, f: 15, k: 250 },
  { re: /ماهی|قزل|سالمون|fish|salmon/i, grams: 100, p: 20, c: 0, f: 13, k: 208 },
  { re: /تن\s*ماهی|tuna/i, grams: 100, p: 25, c: 0, f: 8, k: 180 },
  { re: /میگو|shrimp/i, grams: 100, p: 24, c: 0.2, f: 0.3, k: 99 },
  { re: /ماست|yogurt/i, grams: 100, p: 3.5, c: 4.7, f: 3.3, k: 61 },
  { re: /شیر|milk/i, grams: 240, p: 8, c: 12, f: 8, k: 150 },
  { re: /پنیر|cheese/i, grams: 30, p: 6, c: 0.5, f: 8, k: 100 },
  { re: /اوتمیل|جو\s*دوسر|oat/i, grams: 40, p: 5, c: 27, f: 3.5, k: 155 },
  { re: /عدس|lentil/i, grams: 100, p: 9, c: 20, f: 0.4, k: 116 },
  { re: /لوبیا|bean/i, grams: 100, p: 9, c: 23, f: 0.5, k: 127 },
  { re: /نخود|chickpea|حمص/i, grams: 100, p: 9, c: 27, f: 2.6, k: 164 },
  { re: /سیب\s*زمینی|potato/i, grams: 100, p: 2, c: 17, f: 0.1, k: 77 },
  { re: /ماکارونی|پاستا|pasta/i, grams: 100, p: 5, c: 25, f: 1, k: 131 },
  { re: /سیب|apple/i, grams: 180, p: 0.5, c: 25, f: 0.3, k: 95 },
  { re: /موز|banana/i, grams: 120, p: 1.3, c: 27, f: 0.4, k: 105 },
  { re: /کیوی|kiwi/i, grams: 75, p: 1, c: 15, f: 0.5, k: 61 },
  { re: /پرتقال|نارنگی|orange/i, grams: 140, p: 1, c: 15, f: 0.2, k: 62 },
  { re: /خرما|date/i, grams: 8, p: 0.2, c: 6, f: 0, k: 20 },
  { re: /عسل|honey/i, grams: 21, p: 0, c: 17, f: 0, k: 64 },
  { re: /گردو|walnut/i, grams: 30, p: 4.5, c: 4, f: 19, k: 200 },
  { re: /بادام|almond/i, grams: 30, p: 6, c: 6, f: 15, k: 170 },
  { re: /کره\s*بادام|peanut/i, grams: 16, p: 4, c: 3, f: 8, k: 95 },
  { re: /روغن\s*زیتون|olive\s*oil/i, grams: 14, p: 0, c: 0, f: 14, k: 120 },
  { re: /کره|butter/i, grams: 14, p: 0.1, c: 0, f: 11, k: 100 },
  { re: /سبزی|سالاد|کاهو|خیار|گوجه|vegetable|salad/i, grams: 100, p: 1.5, c: 5, f: 0.3, k: 30 },
  { re: /پروتئین\s*وی|وی\s*پروتئین|whey|ایزوله/i, grams: 30, p: 24, c: 3, f: 2, k: 120 },
  { re: /شکلات\s*تلخ|dark\s*choc/i, grams: 20, p: 2, c: 9, f: 7, k: 110 },
  { re: /بستنی|ice\s*cream/i, grams: 100, p: 3.5, c: 24, f: 11, k: 207 },
  { re: /جو\s*پرک|بلغور|barley/i, grams: 100, p: 2, c: 28, f: 0.4, k: 123 },
  { re: /قارچ|mushroom/i, grams: 100, p: 3, c: 3, f: 0.3, k: 28 },
  { re: /ذرت|corn/i, grams: 100, p: 3, c: 19, f: 1, k: 96 }
];
var SF7_ZERO_RE = /چای|دمنوش|قهوه|آب\b|آب\s*لیمو|دارچین|زردچوبه|نمک|فلفل|ادویه|سرکه/;

function sf7FaToEn_(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
    .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
}

/** تخمین ماکرو از متن آزاد. خروجی null یعنی چیزی تشخیص داده نشد. */
function sf7EstimateMacros(text) {
  var t = sf7FaToEn_(normalize_(text)).toLowerCase();
  if (!t) return null;
  var used = [], p = 0, c = 0, f = 0, k = 0, hits = 0;
  SF7_FOOD_DB.forEach(function (fd) {
    var m = t.match(fd.re);
    if (!m) return;
    var at = m.index;
    for (var i = 0; i < used.length; i++) { if (at >= used[i][0] && at <= used[i][1]) return; }
    used.push([at, at + m[0].length]);
    var before = t.slice(Math.max(0, at - 20), at);
    var mm = before.match(/(\d+(?:[.,]\d+)?)\s*(گرم|گرمی|g|عدد|لیوان|قاشق|کفگیر|برش|واحد|اسکوپ|کن|قوطی)?\s*$/);
    var qty = mm && mm[1] ? parseFloat(String(mm[1]).replace(',', '.')) : 1;
    var unit = (mm && mm[2]) ? mm[2] : '';
    var mult;
    if (/گرم|g/.test(unit)) mult = qty / (fd.grams || 100);
    else mult = qty;
    if (!isFinite(mult) || mult <= 0) mult = 1;
    if (mult > 20) mult = 1;
    p += fd.p * mult; c += fd.c * mult; f += fd.f * mult; k += fd.k * mult;
    hits++;
  });
  if (!hits) {
    if (SF7_ZERO_RE.test(t)) return { protein: 0, carbs: 0, fat: 0, kcal: 0, hits: 0 };
    return null;
  }
  return { protein: Math.round(p), carbs: Math.round(c), fat: Math.round(f), kcal: Math.round(k), hits: hits };
}

/** وضعیت ماکروی برنامه‌های غذایی. */
function sf7MacroStatus(token) {
  sf7Coach_(token);
  const rows = sfObjects_(sfRead_('SF_Diets'));
  const map = {};
  rows.forEach(function (r) {
    const key = normalize_(r.Username) + '||' + normalize_(r.PlanName);
    const o = map[key] || (map[key] = { user: normalize_(r.Username), plan: normalize_(r.PlanName), total: 0, withMacros: 0, missing: [] });
    o.total++;
    const hasAll = normalize_(r.Protein) !== '' && normalize_(r.Carbs) !== '' && normalize_(r.Fat) !== '';
    if (hasAll) o.withMacros++;
    else if (o.missing.length < 5) o.missing.push(normalize_(r.Description).slice(0, 50));
  });
  return rpcSafe_({ ok: true, plans: Object.keys(map).map(function (k) { return map[k]; }) });
}

/** پرکردن ماکروهای خالی برنامه‌های غذایی با تخمین از متن. */
function sf7FillDietMacros(token) {
  sf7Coach_(token);
  return sfWithLock_(function () {
    const out = { ok: true, filled: 0, skipped: [], plans: 0, total: 0 };
    const seen = {};
    const rd = sfRead_('SF_Diets');
    const objs = sfObjects_(rd);
    out.total = objs.length;
    objs.forEach(function (o) {
      const u = normalize_(o.Username);
      const key = u + '||' + normalize_(o.PlanName);
      if (!seen[key]) { seen[key] = 1; out.plans++; }
      const hasAll = normalize_(o.Protein) !== '' && normalize_(o.Carbs) !== '' && normalize_(o.Fat) !== '';
      if (hasAll) return;
      const est = sf7EstimateMacros((normalize_(o.ItemTitle) || '') + ' ' + (normalize_(o.Description) || ''));
      if (!est) {
        if (out.skipped.length < 40) out.skipped.push({ user: u, plan: normalize_(o.PlanName), text: normalize_(o.Description).slice(0, 60) });
        return;
      }
      o.Protein = String(est.protein);
      o.Carbs = String(est.carbs);
      o.Fat = String(est.fat);
      if (normalize_(o.Kcal) === '') o.Kcal = String(est.kcal);
      out.filled++;
    });
    if (out.filled) {
      sfRewrite_('SF_Diets', function () { return false; }, objs);
      sf7BumpPlans_();
    }
    return rpcSafe_(out);
  });
}

/* حذف ردیف‌های تکراری «✉️ پیام به مربی» از شیت Messages (فقط مربی/ادمین) */
function adminPurgeMsgSpam(token) {
  try {
    const s = requireSession_(token);
    if (!isCoach_(s)) throw new Error('فقط مربی یا ادمین.');
    const sh = getSS_().getSheetByName('Messages');
    if (!sh || sh.getLastRow() < 2) return rpcSafe_({ ok: true, removed: 0, left: 0 });
    const v = sh.getDataRange().getValues();
    let removed = 0;
    for (let r = v.length - 1; r >= 1; r--) {
      const txt = String(v[r][2] || '').trim();
      if (txt === '✉️ پیام به مربی') { sh.deleteRow(r + 1); removed++; }
    }
    return rpcSafe_({ ok: true, removed: removed, left: Math.max(0, sh.getLastRow() - 1) });
  } catch (e) { return rpcSafe_({ error: String((e && e.message) || e) }); }
}

/* اجرای یک‌بارهٔ پاک‌سازی از داخل ادیتور (بدون نیاز به توکن) */
function sf7PurgeSpamNow() {
  const sh = getSS_().getSheetByName('Messages');
  if (!sh || sh.getLastRow() < 2) return 0;
  const v = sh.getDataRange().getValues();
  let removed = 0;
  for (let r = v.length - 1; r >= 1; r--) {
    if (String(v[r][2] || '').trim() === '✉️ پیام به مربی') { sh.deleteRow(r + 1); removed++; }
  }
  return removed;
}

/* =========================================================
   لینک مینی‌اپ برای هر کاربر (مربی) — برای تست و ارسال دستی
   ========================================================= */
function sfMiniLinkFor(token, username) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const un = normalize_(username || '');
  if (!un) throw new Error('نام کاربری را بده.');
  const v = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1);
  let chat = '';
  for (let r = 0; r < v.length; r++) {
    if (normalize_(v[r][0]) === un) { chat = normalize_(v[r][6]); break; }
  }
  if (!chat) throw new Error('این کاربر آیدی تلگرام ثبت‌شده ندارد.');
  const key = sfMiniKey_(chat);
  if (!key) throw new Error('ساخت لینک ناموفق بود.');
  return rpcSafe_({ ok: true, username: un, chatId: chat, url: sfMiniUrl_() + '&k=' + key });
}
/* لینک مینی‌اپ برای خودِ کاربر (هر نقشی) */
function sfMiniSelfLink(token) {
  const s = requireSession_(token);
  const v = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1);
  let chat = '';
  for (let r = 0; r < v.length; r++) {
    if (normalize_(v[r][0]) === normalize_(s.username)) { chat = normalize_(v[r][6]); break; }
  }
  if (!chat) throw new Error('اول آیدی تلگرامت را از داخل ربات وصل کن.');
  const key = sfMiniKey_(chat);
  if (!key) throw new Error('ساخت لینک ناموفق بود.');
  return rpcSafe_({ ok: true, url: sfMiniUrl_() + '&k=' + key });
}

/* آدرس‌های رسانه: نسخهٔ اصلی (گیف متحرک) اول، بعد نسخهٔ جایگزین */
function sfDriveCands_(id) {
  if (!id) return [];
  return ['https://lh3.googleusercontent.com/d/' + id,
    'https://drive.google.com/uc?export=view&id=' + id,
    'https://drive.google.com/thumbnail?id=' + id + '&sz=w720'];
}
/* =====================================================================
 *  ربات تلگرام — همهٔ قابلیت‌های اپ داخل گفتگوی تلگرام
 *  (برنامهٔ تمرینی/غذایی/مکمل، وزن، آب، یادآور، گزارش، پیشرفت،
 *   یادداشت مربی، پیام به مربی، ثبت غذا/وزن/آب)
 * ===================================================================== */

/* ---------- ابزارهای کوچک ---------- */
function sfTgNorm_(s) {
  return String(s == null ? '' : s)
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[^\p{L}\p{N}\s\u200c]/gu, ' ')
    .replace(/\s+/g, ' ').trim().toLowerCase();
}
function sfTgDigits_(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
    .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); });
}
function sfTgFa_(n) {
  const d = '۰۱۲۳۴۵۶۷۸۹';
  return String(n == null ? '' : n).replace(/[0-9]/g, function (c) { return d[Number(c)]; });
}
/* آخرین عدد متن (با پشتیبانی از اعشار و ارقام فارسی) */
function sfTgLastNumber_(txt) {
  const t = sfTgDigits_(txt);
  const m = t.match(/(-?\d+(?:\.\d+)?)\s*$/);
  return m ? parseFloat(m[1]) : null;
}
function sfTgToken_() { return botProps_().getProperty('TELEGRAM_BOT_TOKEN') || ''; }
function sfTgRowByChat_(chatId) {
  const want = normalize_(chatId);
  const cache = CacheService.getScriptCache();
  const hit = cache.get('tgrow_' + want);
  if (hit) { try { const o = JSON.parse(hit); return o.none ? null : o; } catch (e) {} }
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  const last = sh.getLastRow();
  let out = null;
  if (last >= 2) {
    const cell = sh.getRange(2, 7, last - 1, 1).createTextFinder(want).matchEntireCell(true).findNext();
    if (cell) {
      const r = sh.getRange(cell.getRow(), 1, 1, 7).getValues()[0];
      out = { username: normalize_(r[0]), role: normalize_(r[5]).toLowerCase() || 'user', chatId: want };
    }
  }
  try { cache.put('tgrow_' + want, JSON.stringify(out || { none: true }), out ? 21600 : 300); } catch (e) {}
  return out;
}
function sfTgSessionOf_(row) {
  const c = CacheService.getScriptCache();
  const k = 'tgsess_' + row.username;
  const t = c.get(k);
  if (t) return t;
  const tok = (function(){ try { return createSession_(row.username, row.role || 'user'); } catch (e) { return ''; } })();
  if (tok) c.put(k, tok, 1800);
  return tok;
}
function sfTgBumpRows_() { try { CacheService.getScriptCache().remove('tgrow_' + (arguments[0] || '')); } catch (e) {} }
function sfTgKeyboard_(chat) {
  const rows = [
    [{ text: '🏋️ برنامه تمرینی', callback_data: 'cmd:workout' }, { text: '🍽️ برنامه غذایی', callback_data: 'cmd:diet' }],
    [{ text: '💊 مکمل‌ها', callback_data: 'cmd:supp' }, { text: '⚖️ وزن من', callback_data: 'cmd:weight' }],
    [{ text: '💧 آب امروز', callback_data: 'cmd:water' }, { text: '📅 یادآورها', callback_data: 'cmd:reminders' }],
    [{ text: '📊 گزارش امروز', callback_data: 'cmd:report' }, { text: '📈 پیشرفت', callback_data: 'cmd:progress' }],
    [{ text: '✉️ پیام به مربی', callback_data: 'cmd:coach' }, { text: '📝 یادداشت مربی', callback_data: 'cmd:note' }],
    [{ text: '☰ منو', callback_data: 'cmd:menu' }, { text: 'ℹ️ راهنما', callback_data: 'cmd:help' }]
  ];
  /* دکمهٔ مینی‌اپ: web_app داخل نوار دکمه‌ها (روی موبایل اپ را باز می‌کند) */
  try {
    const mk = chat ? sfTgMiniKb_(chat) : null;
    if (mk && mk.web_app && mk.web_app.url) rows.unshift([{ text: '🚀 باز کردن اپ', web_app: { url: mk.web_app.url } }]);
  } catch (e) {}
  return { inline_keyboard: rows };
}

/* دکمهٔ شیشه‌ای «باز کردن اپ» → مینی‌اپ تلگرام با کلید شخصی هر کاربر */
function sfTgMiniKb_(chat) {
  try {
    const base = (typeof sfMiniUrl_ === 'function') ? sfMiniUrl_() : '';
    if (!base) return null;
    let url = base;
    if (typeof sfMiniKey_ === 'function') {
      const key = sfMiniKey_(chat);
      if (key) url = base + '&k=' + key;
    }
    return { text: '🚀 باز کردن اپ (مینی‌اپ)', web_app: { url: url } };
  } catch (e) { return null; }
}
/* قالب‌بندی حرفه‌ای: HTML + راست‌چین‌کردن خطوط فارسی + ایمن‌سازی کاراکترها */
function sfTgFmt_(text) {
  let s = String(text == null ? '' : text).slice(0, 3500);
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  /* نشانه‌های امن برای تگ‌های تلگرام (بعد از ایمن‌سازی جایگزین می‌شوند) */
  s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<b>$1</b>')
       .replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<i>$1</i>')
       .replace(/\[c\]([\s\S]*?)\[\/c\]/g, '<code>$1</code>');
  s = s.split('\n').map(function (ln) {
    if (!ln.trim()) return ln;
    /* خط فارسی یا خطی که با متن لاتین/لینک شروع نمی‌شود → راست‌چین (RLM) */
    const lat = /^[A-Za-z0-9@#/]/.test(ln.trim());
    return (lat && !/[\u0600-\u06FF]/.test(ln) ? '\u200E' : '\u200F') + ln;
  }).join('\n');
  return s;
}
function sfTgSend_(chat, text, keyboard) {
  const t = sfTgToken_();
  if (!t) return { ok: false, description: 'توکن ربات تنظیم نشده' };
  const body = sfTgFmt_(text);
  /* ضدتکرار: همان متن برای همان چت در ۹۰ ثانیه فقط یک‌بار فرستاده می‌شود
     (این لایه جلوی هر نوع تکرار/رلهٔ دوبارهٔ آپدیت را می‌گیرد) */
  try {
    const cache = CacheService.getScriptCache();
    const dig = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, body).map(function (b) { return ((b < 0 ? b + 256 : b) + 256).toString(16).slice(1); }).join('');
    const dk = 'tgsend_' + chat + '_' + dig;
    if (cache.get(dk)) return { ok: true, deduped: true };
    cache.put(dk, '1', 8);
  } catch (e) {}
  const payload = { chat_id: String(chat), text: body, parse_mode: 'HTML', disable_web_page_preview: true };
  /* نوار دکمه‌ها باید به‌صورت JSON ارسال شود وگرنه تلگرام آن را نمی‌پذیرد */
  if (keyboard) payload.reply_markup = JSON.stringify(keyboard);
  try { botCall_(t, 'sendChatAction', { chat_id: String(chat), action: 'typing' }); } catch (eT) {}
  return botCall_(t, 'sendMessage', payload);
}
/* دکمه‌های شیشه‌ای میان‌بر (گرافیکی‌تر از تایپ دستور) */
function sfTgInline_() {
  return { inline_keyboard: [
    [{ text: '🏋️ تمرین', callback_data: 'cmd:workout' }, { text: '🍽️ تغذیه', callback_data: 'cmd:diet' }],
    [{ text: '💧 آب', callback_data: 'cmd:water' }, { text: '⚖️ وزن', callback_data: 'cmd:weight' }],
    [{ text: '📊 گزارش', callback_data: 'cmd:report' }, { text: '🚀 اپ کامل', callback_data: 'cmd:app' }]
  ] };
}
/* جلوگیری از پیام‌های تکراری (اسپم) */
function sfTgThrottle_(key, seconds) {
  const cache = CacheService.getScriptCache();
  if (cache.get(key)) return false;
  cache.put(key, '1', seconds);
  return true;
}

/* ---------- ساخت متن‌ها ---------- */
function sfTgMenuText_(row) {
  return '🏋️ [b]سعیدی فیت بادی[/b]\n' +
    '━━━━━━━━━━━━━━\n' +
    'سلام [b]' + (row.username || '') + '[/b] 👋\n' +
    'دستیار تلگرامی اپ هستم؛ دکمه‌های پایین یا دستورها را بزن:\n\n' +
    '🏋️ /برنامه — برنامهٔ تمرینی\n' +
    '🍽️ /غذا — برنامهٔ غذایی\n' +
    '💊 /مکمل — مکمل‌ها\n' +
    '⚖️ /وزن — وزن (ثبت: /وزن ۸۲.۵)\n' +
    '💧 /آب — آب امروز (افزودن: /آب +۱)\n' +
    '⏰ /یادآور — یادآورها\n' +
    '🍱 /غذا ثبت نان ۲۵۰ — ثبت وعده\n' +
    '📊 /گزارش — گزارش امروز\n' +
    '📈 /پیشرفت — روند وزن\n' +
    '✉️ /پیام متن… — پیام به مربی\n\n' +
    '🆔 آیدی تلگرام تو: [c]' + (row.chatId || '') + '[/c]';
}
function sfTgHelpText_() {
  return 'ℹ️ [b]راهنمای ربات[/b]\n' +
    '━━━━━━━━━━━━━━\n' +
    '🏋️ [b]تمرین[/b]\n' +
    '• /برنامه — کل برنامه\n' +
    '• /برنامه ۲ — جزئیات روز دوم\n' +
    '• /انجام ۲ ۱ — ثبت حرکت (روز ۲، حرکت ۱)\n\n' +
    '🍽️ [b]تغذیه[/b]\n' +
    '• /غذا — برنامهٔ غذایی\n' +
    '• /غذا ثبت نان و پنیر ۲۵۰ — ثبت وعده\n\n' +
    '💊 /مکمل — مکمل‌ها\n' +
    '⚖️ /وزن — وزن | /وزن ۸۲.۵ — ثبت\n' +
    '💧 /آب — آب امروز | /آب +۱ — افزودن | /آب ۰ — صفر\n\n' +
    '⏰ [b]یادآورها[/b]\n' +
    '• /یادآور — لیست\n' +
    '• /یادآور ۲۱:۳۰ قرص — افزودن\n' +
    '• /حذف یادآور ۲۱:۳۰ — حذف\n\n' +
    '📊 /گزارش — گزارش امروز\n' +
    '📈 /پیشرفت — روند وزن\n' +
    '🏆 /جدول — رتبه‌بندی\n' +
    '📋 /چکاین ۴ ۳ ۴ ۴ — چک‌این هفتگی\n' +
    '📝 /یادداشت — یادداشت مربی\n' +
    '✉️ /پیام متن… — پیام به مربی\n' +
    '🔌 /قطع — قطع اتصال\n\n' +
    'همهٔ دستورها را می‌توانی بدون «/» هم بنویسی.';
}
function sfTgWorkoutPlan_(username) {
  const plans = sfPlansAsLegacy_(username);
  if (!plans.length) return '📋 هنوز برنامهٔ تمرینی به تو اختصاص نیافته. از پنل مربی بخواه برنامه بسازد.';
  const p = plans[0], days = p.days || [];
  const out = ['🏋️ برنامهٔ تمرینی: ' + (p.name || ''), ''];
  days.forEach(function (d, i) {
    out.push('روز ' + sfTgFa_(i + 1) + ' — ' + (d.title || '') + (d.isRest ? ' (استراحت)' : ''));
    if (!d.isRest) (d.exercises || []).forEach(function (ex) {
      const s = ex.sets ? sfTgFa_(ex.sets) + '×' : '';
      const rp = ex.reps ? ex.reps : '';
      out.push('   • ' + ex.name + (s || rp ? ' — ' + (s ? s + ' ' + rp : rp) : ''));
    });
  });
  out.push('');
  out.push('جزئیات یک روز: /برنامه ۱');
  const txt = out.join('\n');
  return txt.length > 3600 ? txt.slice(0, 3500) + '\n… برای بقیه: /برنامه ۲' : txt;
}
function sfTgWorkoutDay_(username, n) {
  const plans = sfPlansAsLegacy_(username);
  if (!plans.length) return '📋 هنوز برنامهٔ تمرینی به تو اختصاص نیافته.';
  const p = plans[0], days = p.days || [];
  if (!days.length) return '📋 برنامهٔ تمرینی خالی است.';
  const i = Math.min(Math.max(1, n || 1), days.length) - 1, d = days[i];
  const out = ['🏋️ ' + (p.name || '') + ' — روز ' + sfTgFa_(i + 1) + ' (' + (d.title || '') + ')'];
  if (d.isRest) { out.push('😴 روز استراحت و ریکاوری'); return out.join('\n'); }
  (d.exercises || []).forEach(function (ex, k) {
    const s = ex.sets ? sfTgFa_(ex.sets) + ' ست' : '';
    const rp = ex.reps ? '× ' + ex.reps : '';
    out.push('• ' + sfTgFa_(k + 1) + ') ' + ex.name + (s || rp ? ' — ' + (s ? s + ' ' + rp : rp) : ''));
    if (ex.notes) out.push('    ↳ ' + ex.notes);
  });
  if ((p.notes || []).length) {
    out.push('');
    out.push('💡 توصیه‌های تمرینی:');
    (p.notes || []).forEach(function (n2) { out.push('— ' + n2); });
  }
  return out.join('\n');
}
function sfTgDiet_(username) {
  const diets = sfDietsAsLegacy_(username);
  if (!diets.length) return '🍽️ هنوز برنامهٔ غذایی به تو اختصاص نیافته. از پنل مربی بخواه برنامه بسازد.';
  const p = diets[0], out = ['🍽️ برنامهٔ غذایی: ' + (p.name || ''), ''];
  const tips = [];
  (p.sections || []).forEach(function (s) {
    const title = s.title || 'بخش';
    if (title.indexOf('توصیه') >= 0) {
      (s.items || []).forEach(function (it) {
        const t = (it.title && it.title !== 'گزینه') ? it.title : '';
        const line = (t ? t + ' — ' : '') + (it.description || '');
        if (line.trim()) tips.push(line.trim());
      });
      return;
    }
    out.push('▸ ' + title);
    (s.items || []).forEach(function (it) {
      const kcal = it.kcal ? ' — ' + sfTgFa_(it.kcal) + ' کالری' : '';
      out.push('   • ' + (it.title || '') + (it.description ? ' (' + it.description + ')' : '') + kcal);
    });
  });
  if (tips.length) {
    out.push('');
    out.push('💡 توصیه‌های غذایی:');
    tips.forEach(function (t) { out.push('— ' + t); });
  }
  return out.join('\n');
}
function sfTgSupp_(username) {
  const supps = sfSuppsAsLegacy_(username);
  if (!supps.length) return '💊 هنوز برنامهٔ مکمل به تو اختصاص نیافته. از پنل مربی بخواه برنامه بسازد.';
  const p = supps[0], out = ['💊 مکمل‌ها: ' + (p.name || ''), ''];
  (p.schedule || []).forEach(function (s) {
    out.push('▸ ' + (s.timing || ''));
    (s.items || []).forEach(function (i) { out.push('   • ' + i); });
  });
  (p.groups || []).forEach(function (g) {
    out.push('▸ ' + (g.title || ''));
    (g.items || []).forEach(function (it) {
      out.push('   • ' + it.name + (it.timings && it.timings.length ? ' (' + it.timings.join('، ') + ')' : ''));
    });
  });
  (p.items || []).forEach(function (it) {
    out.push('▸ ' + (it.name || '') + (it.dosage ? ' — ' + it.dosage : '') + (it.timing ? ' — ' + it.timing : ''));
  });
  return out.join('\n');
}
function sfTgWeight_(username) {
  const p = getProfile_(username), logs = getLogs_(username), last = logs[0] || {};
  const out = ['⚖️ وزن'];
  out.push('آخرین وزن: ' + (last.weight ? sfTgFa_(last.weight) + ' کیلوگرم' : '—'));
  out.push('وزن هدف: ' + (p.goalWeight ? sfTgFa_(p.goalWeight) + ' کیلوگرم' : '—'));
  if (last.date) out.push('تاریخ آخرین ثبت: ' + last.date);
  out.push('');
  out.push('ثبت وزن جدید: /وزن ۸۲.۵');
  return out.join('\n');
}
function sfTgWater_(username) {
  const w = getWater_(username, todayISO_());
  const left = Math.max(0, (w.goal || 8) - (w.glasses || 0));
  return '💧 آب امروز: ' + sfTgFa_(w.glasses || 0) + ' از ' + sfTgFa_(w.goal || 8) + ' لیوان\n' +
    (left ? 'برای رسیدن به هدف ' + sfTgFa_(left) + ' لیوان دیگر بنوش.' : '✅ به هدف امروز رسیدی!') +
    '\nافزودن: /آب +۱';
}
function sfTgReport_(username) {
  const today = todayISO_(), meals = getMeals_(username, today), p = getProfile_(username);
  const w = getWater_(username, today), done = getDoneToday_(username, today);
  const d = (meals.days || {})[today] || { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const out = ['📊 گزارش امروز (' + today + ')', ''];
  out.push('🍽️ کالری: ' + sfTgFa_(Math.round(d.kcal || 0)) + (p.targetCalories ? ' از ' + sfTgFa_(p.targetCalories) : ''));
  out.push('🥩 پروتئین: ' + sfTgFa_(Math.round(d.protein || 0)) + ' گرم' + (p.targetProtein ? ' (هدف ' + sfTgFa_(p.targetProtein) + ')' : ''));
  out.push('🍚 کربوهیدرات: ' + sfTgFa_(Math.round(d.carbs || 0)) + ' گرم');
  out.push('🥑 چربی: ' + sfTgFa_(Math.round(d.fat || 0)) + ' گرم');
  out.push('💧 آب: ' + sfTgFa_(w.glasses || 0) + '/' + sfTgFa_(w.goal || 8) + ' لیوان');
  out.push('🏋️ تمرین: ' + (done.length ? '✅ ثبت شد (' + sfTgFa_(done.length) + ' حرکت)' : 'هنوز ثبت نشده'));
  return out.join('\n');
}
function sfTgProgress_(username) {
  const logs = getLogs_(username), p = getProfile_(username);
  const out = ['📈 پیشرفت', ''];
  if (logs.length) {
    const first = logs[logs.length - 1], last = logs[0];
    out.push('وزن شروع: ' + (first.weight ? sfTgFa_(first.weight) : '—') + '  →  الان: ' + (last.weight ? sfTgFa_(last.weight) : '—'));
    if (first.weight && last.weight) {
      const diff = Number(last.weight) - Number(first.weight);
      out.push('تغییر: ' + (diff > 0 ? '+' : '') + sfTgFa_(Math.round(diff * 10) / 10) + ' کیلوگرم');
    }
    out.push('وزن هدف: ' + (p.goalWeight ? sfTgFa_(p.goalWeight) : '—') + ' کیلوگرم');
    out.push('تعداد ثبت‌ها: ' + sfTgFa_(logs.length));
  } else out.push('هنوز ثبت وزنی نداری.');
  out.push('');
  out.push('ثبت وزن: /وزن ۸۲.۵');
  return out.join('\n');
}
function sfTgNote_(username) {
  const sh = getSS_().getSheetByName(CONFIG.COACH_NOTES_SHEET);
  let note = '';
  if (sh && sh.getLastRow() >= 2) {
    const v = sh.getDataRange().getValues();
    for (let r = 1; r < v.length; r++) {
      if (normalize_(v[r][0]).toLowerCase() === normalize_(username).toLowerCase()) { note = normalize_(v[r][1]); break; }
    }
  }
  return '📝 یادداشت مربی برای تو:\n' + (note ? note : '— هنوز یادداشتی ثبت نشده —');
}
function sfTgRemItems_(username) {
  const sh = getSS_().getSheetByName('Reminders');
  if (!sh || sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues();
  for (let r = 1; r < v.length; r++) {
    if (normalize_(v[r][0]).toLowerCase() !== normalize_(username).toLowerCase()) continue;
    try { return JSON.parse(v[r][1]) || []; } catch (e) { return []; }
  }
  return [];
}
function sfTgRemLabel_(it) {
  const names = { workout: '🏋️ تمرین', water: '💧 آب', meal: '🍽️ غذا', nutrition: '🍽️ تغذیه', weight: '⚖️ وزن', pill: '💊 قرص', supplement: '🥛 مکمل' };
  return (names[it.type] || '⏰ یادآور') + (it.label ? ' — ' + it.label : '');
}
function sfTgReminders_(username) {
  const items = sfTgRemItems_(username);
  if (!items.length) return '📅 هنوز یادآوری ثبت نکردی.\nافزودن: /یادآور ۲۱:۳۰ قرص';
  const out = ['📅 یادآورهای تو:'];
  items.forEach(function (it) { out.push('• ' + (it.time || '') + ' — ' + sfTgRemLabel_(it)); });
  out.push('');
  out.push('افزودن: /یادآور ۲۱:۳۰ قرص');
  out.push('حذف: /حذف یادآور ۲۱:۳۰');
  return out.join('\n');
}

/* ---------- دستورها ---------- */
function sfTgCommandId_(cmd) {
  const c = sfTgNorm_(cmd);
  if (!c) return '';
  const has = function (list) { return list.some(function (k) { return c.indexOf(k) >= 0; }); };
  if (has(['منو', 'menu', 'فهرست'])) return 'menu';
  if (has(['راهنما', 'help', 'کمک'])) return 'help';
  if (c === 'start' || c === 'شروع') return 'menu';
  if (c === 'app' || c === 'mini' || c === 'miniapp' || c === 'اپ' || has(['مینی اپ', 'مینی‌اپ', 'مینیاپ', 'اپ کامل', 'برنامه کامل'])) return 'app';
  if (has(['ثبت غذا', 'خوردنی', 'food', 'غذا ثبت'])) return 'food';
  if (has(['انجام', 'ثبت تمرین', 'done'])) return 'done';
  if (has(['غذا', 'تغذیه', 'رژیم', 'diet'])) return 'diet';
  if (has(['مکمل', 'supp', 'ویتامین'])) return 'supp';
  if (has(['تمرین', 'ورزش', 'workout', 'برنامه', 'program'])) return 'workout';
  if (has(['وزن', 'weight'])) return 'weight';
  if (has(['آب', 'water'])) return 'water';
  if (has(['حذف یاداور', 'حذف یاد آور', 'حذف یادآور'])) return 'remdel';
  if (has(['یاداور', 'یاد آور', 'یادآور', 'reminder'])) return 'reminders';
  if (has(['گزارش', 'report'])) return 'report';
  if (has(['جدول', 'رتبه', 'لیدربورد', 'leaderboard', 'rank'])) return 'rank';
  if (has(['چک ?این', 'چکاین', 'checkin'])) return 'checkin';
  if (has(['پیشرفت', 'progress', 'روند'])) return 'progress';
  if (has(['یادداشت', 'note'])) return 'note';
  if (has(['پیام', 'coach'])) return 'coach';
  if (c === 'id' || has(['شناسه من', 'آیدی من'])) return 'id';
  if (has(['قطع', 'stop', 'لغو اتصال'])) return 'stop';
  return '';
}
/* زمان «۲۱:۳۰» یا «21.30» */
function sfTgParseTime_(txt) {
  const t = sfTgDigits_(txt);
  const m = t.match(/(\d{1,2})\s*[:：.،]\s*(\d{1,2})/);
  if (!m) return null;
  const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (isNaN(hh) || isNaN(mm) || hh > 23 || mm > 59) return null;
  return (hh < 10 ? '0' + hh : String(hh)) + ':' + (mm < 10 ? '0' + mm : String(mm));
}

/* ---------- مسیریاب اصلی ---------- */
/* نام عمومی (بدون _) تا از سمت اپ و تست هم قابل فراخوانی باشد */
/* حذف شد — پوشش عمومی `sfTelegramCommand(chat, text, fromName)` بدون هیچ
 * توکنی جلسه می‌ساخت و اجازه می‌داد هر بازدیدکنندهٔ ناشناس برای هر chat id
 * دستور بفرستد (خواندن برنامه، نوشتن وزن جعلی، قطع اتصال کاربر دیگر).
 *
 * مسیرهای مجاز باقی‌مانده، همگی سمت سرور هستند و از sfTelegramCommand_ استفاده می‌کنند:
 *   - sfTgWebhookUpdate_  (آپدیت تلگرام، پس از اعتبارسنجی کلید در doPost)
 *   - botTick             (پولینگ زمان‌بندی‌شده)
 */

/* خواندن وضعیت فعلی تنظیمات ربات */
function sfBotInfo(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین می‌تواند وضعیت ربات را ببیند.');
  const t = sfTgToken_();
  if (!t) throw new Error('توکن ربات تنظیم نشده.');
  const me = botCall_(t, 'getMe');
  const d = botCall_(t, 'getMyDescription');
  const sh = botCall_(t, 'getMyShortDescription');
  const cm = botCall_(t, 'getMyCommands');
  const p = botProps_();
  let trig = false;
  try { trig = ScriptApp.getProjectTriggers().some(function (x) { return x.getHandlerFunction() === 'botTick'; }); } catch (e) {}
  return rpcSafe_({
    ok: true,
    bot: (me && me.result) ? { id: me.result.id, username: me.result.username, firstName: me.result.first_name } : null,
    about: (sh && sh.result) || '',
    description: (d && d.result) || '',
    commands: (cm && cm.result) || [],
    trigger: trig,
    linkedUsers: (function () {
      const v = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1);
      return v.filter(function (r) { return normalize_(r[6]); }).map(function (r) { return normalize_(r[0]) + ' → ' + normalize_(r[6]); });
    })()
  });
}

/* تست دکمه‌های ربات (نوار پایین + دکمهٔ مینی‌اپ) برای مربی */
function sfBotKeyboardTest(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const rec = getUserRecord_(s.username);
  const chat = rec && rec.telegramChatId ? String(rec.telegramChatId) : '';
  if (!chat) throw new Error('اول آیدی عددی تلگرامت را در پروفایل ثبت کن.');
  const mk = sfTgMiniKb_(chat);
  const kb = sfTgKeyboard_(chat);
  const r = sfTgSend_(chat, '✅ تست دکمه‌ها\nاگر نوار دکمه‌های پایین صفحه را می‌بینی، همه‌چیز درست است.', kb);
  return rpcSafe_({
    ok: !!(r && r.ok),
    sent: (r && r.ok) ? 'ok' : ((r && r.description) || 'fail'),
    keyboard: !!(r && r.result && r.result.reply_markup),
    inline: !!(r && r.result && r.result.reply_markup && r.result.reply_markup.inline_keyboard),
    keys: (r && r.result) ? Object.keys(r.result) : [],
    markupType: (r && r.result && r.result.reply_markup) ? Object.keys(r.result.reply_markup) : []
  });
}

/* ---------- صفحهٔ حریم خصوصی (برای BotFather) ---------- */function sfPolicyPage_() {
  const html = '<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>حریم خصوصی — Saeedi Fit Body</title>' +
    '<style>body{font-family:system-ui,Tahoma,sans-serif;background:#0f1412;color:#e8f0ea;margin:0;padding:24px;line-height:2}' +
    '.w{max-width:720px;margin:auto}h1{font-size:22px}h2{font-size:17px;margin-top:26px;color:#8ee3b0}' +
    'p,li{font-size:14.5px;color:#cfdcd3}a{color:#8ee3b0}.box{background:#16201b;border:1px solid #22332a;border-radius:14px;padding:18px}' +
    '</style></head><body><div class="w"><div class="box">' +
    '<h1>حریم خصوصی — Saeedi Fit Body</h1>' +
    '<h2>۱) چه داده‌ای جمع می‌شود؟</h2>' +
    '<p>نام کاربری، رمز عبور (به‌صورت هش‌شده)، اطلاعات پروفایل (قد، وزن، هدف، کالری و…) و ثبت‌های تمرین، غذا، آب و وزن در Google Sheets مربوط به همین پروژه ذخیره می‌شود.</p>' +
    '<h2>۲) تلگرام</h2>' +
    '<p>برای ارسال یادآورها، «آیدی عددی» گفتگوی تلگرام شما ذخیره می‌شود (مثلاً <span dir="ltr">123456789</span>) تا پیام‌های یادآور به همان گفتگو برسد. این آیدی فقط برای همین ربات استفاده می‌شود و در اختیار شخص دیگری قرار نمی‌گیرد. با دستور <span dir="ltr">/قطع</span> اتصال حذف می‌شود.</p>' +
    '<h2>۳) محتوای ارسالی</h2>' +
    '<p>در گفتگوی ربات فقط فرمان‌ها و گزارش‌های شخصی خودتان (برنامهٔ تمرینی، غذایی، مکمل، وزن، آب و یادآورها) رد و بدل می‌شود.</p>' +
    '<h2>۴) حذف داده</h2>' +
    '<p>با درخواست به مربی، حساب و ثبت‌های شما حذف می‌شود. همچنین می‌توانید از بخش «پروفایل» درخواست حذف آیدی تلگرام بدهید.</p>' +
    '<h2>۵) تماس</h2>' +
    '<p>برای هر سوالی دربارهٔ داده‌های خود، از داخل اپ پیام بدهید یا با مربی در بخش «گفتگو با مربی» در تماس باشید.</p>' +
    '</div></div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('حریم خصوصی — Saeedi Fit Body');
}

/* ---------- همهٔ تنظیمات ربات (About/Description/Commands/Inline/Webhook) ---------- */
function sfBotSetup(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین می‌تواند تنظیمات ربات را انجام دهد.');
  const t = sfTgToken_();
  if (!t) throw new Error('توکن ربات تنظیم نشده. اول توکن را در «تنظیم ربات» وارد کن.');
  const out = { ok: true, steps: {} };
  const call = function (label, method, payload) {
    const r = botCall_(t, method, payload || {});
    out.steps[label] = r && r.ok ? 'ok' : ('خطا: ' + ((r && r.description) || 'ناموفق'));
    return r;
  };
  call('webhook', 'deleteWebhook', { drop_pending_updates: false });
  call('about', 'setMyShortDescription', { short_description: 'اپ فیت‌بادی: برنامه تمرینی و غذایی، مکمل، وزن و یادآورها' });
  call('description', 'setMyDescription', {
    description: 'ربات اپ Saeedi Fit Body ✨\n\n' +
      'از همین‌جا اپ را کنترل کن:\n' +
      '• برنامهٔ تمرینی و ثبت تمرین انجام‌شده\n' +
      '• برنامهٔ غذایی و توصیه‌های غذایی\n' +
      '• مکمل‌ها و زمان مصرف\n' +
      '• ثبت وزن و پیشرفت\n' +
      '• آب روزانه، گزارش کالری و ماکرو\n' +
      '• یادآورها، چک‌این هفتگی و پیام به مربی\n\n' +
      'با /menu منو را ببین. دستورها را می‌توانی فارسی هم بنویسی (مثلاً: غذا، وزن ۸۲.۵، آب +۱).'
  });
  const cmds = [
    ['app', '🚀 باز کردن اپ (مینی‌اپ)'], ['start', 'شروع و منوی ربات'], ['menu', 'منوی اصلی'], ['help', 'راهنمای دستورها'],
    ['workout', 'برنامه تمرینی'], ['done', 'ثبت تمرین انجام‌شده'], ['diet', 'برنامه غذایی'],
    ['supp', 'مکمل‌ها'], ['weight', 'وزن (weight 82.5 = ثبت)'], ['water', 'آب امروز (water +1)'],
    ['food', 'ثبت غذا (food نان 250)'], ['reminders', 'یادآورها'], ['report', 'گزارش امروز'],
    ['progress', 'روند پیشرفت'], ['rank', 'جدول رتبه‌بندی'], ['checkin', 'چک‌این هفتگی'],
    ['note', 'یادداشت مربی'], ['coach', 'پیام به مربی'], ['id', 'آیدی عددی تلگرام'], ['stop', 'قطع اتصال']
  ];
  call('commands', 'setMyCommands', {
    commands: JSON.stringify(cmds.map(function (c) { return { command: c[0], description: c[1] }; }))
  });
  /* نام متد جای‌گذاری داخلی تلگرام بین نسخه‌ها فرق دارد؛ اولین‌که پذیرفته شود */
  ['setMyInlineQueryPlaceholder', 'setMyInlineQueryPlaceHolder', 'setMyInlineQuery'].some(function (m) {
    const r = botCall_(t, m, { placeholder: 'مثلاً: برنامهٔ تمرینی من' });
    if (r && r.ok) { out.steps.inline = 'ok (' + m + ')'; return true; }
    return false;
  });
  if (out.steps.inline === undefined) out.steps.inline = 'خطا: متد شناخته نشد';
  /* دکمهٔ «باز کردن اپ» روی گفتگو → مینی‌اپ گرافیکی */
  try {
    const miniUrl = (typeof sfMiniUrl_ === 'function') ? sfMiniUrl_() : '';
    if (miniUrl) {
      const mb = botCall_(t, 'setChatMenuButton', {
        menu_button: JSON.stringify({ type: 'web_app', text: 'باز کردن اپ', web_app: { url: miniUrl } })
      });
      out.steps.menubutton = (mb && mb.ok) ? 'ok' : ('خطا: ' + ((mb && mb.description) || 'ناموفق'));
      out.miniUrl = miniUrl;
    }
  } catch (e) { out.steps.menubutton = 'خطا: ' + (e.message || ''); }
  try { installBotTrigger_(); out.steps.trigger = 'ok'; } catch (e) { out.steps.trigger = 'خطا: ' + (e.message || ''); }
  const p = botProps_();
  out.username = p.getProperty('BOT_USERNAME') || '';
  out.offset = p.getProperty('BOT_OFFSET') || '0';
  out.ok = Object.keys(out.steps).every(function (k) { return out.steps[k] === 'ok'; });
  return rpcSafe_(out);
}

/** اطمینان از ثبت دستورهای ربات در منوی «/» تلگرام + دکمهٔ مینی‌اپ
 *  هر ۶ ساعت یک‌بار بررسی می‌شود تا اگر منو خالی بود دوباره ثبت شود. */
function sfTgEnsureCommands_(token) {
  try {
    const t = token || sfTgToken_();
    if (!t) return false;
    const cache = CacheService.getScriptCache();
    if (cache.get('TG_CMDS_OK')) return true;
    const cmds = [
      ['app', '🚀 باز کردن اپ (مینی‌اپ)'],
      ['menu', 'منوی اصلی'],
      ['help', 'راهنمای دستورها'],
      ['workout', 'برنامه تمرینی'],
      ['done', 'ثبت تمرین انجام‌شده'],
      ['diet', 'برنامه غذایی'],
      ['food', 'ثبت غذا'],
      ['supp', 'مکمل‌ها'],
      ['weight', 'وزن (weight 82.5 برای ثبت)'],
      ['water', 'آب امروز (water +1)'],
      ['reminders', 'یادآورها'],
      ['report', 'گزارش امروز'],
      ['progress', 'روند پیشرفت'],
      ['rank', 'جدول رتبه‌بندی'],
      ['checkin', 'چک‌این هفتگی'],
      ['note', 'یادداشت مربی'],
      ['coach', 'پیام به مربی'],
      ['id', 'آیدی عددی تلگرام من'],
      ['stop', 'قطع اتصال']
    ];
    const r = botCall_(t, 'setMyCommands', {
      commands: JSON.stringify(cmds.map(function (c) { return { command: c[0], description: c[1] }; }))
    });
    try {
      if (typeof sfMiniUrl_ === 'function') {
        const u = sfMiniUrl_();
        if (u) botCall_(t, 'setChatMenuButton', { menu_button: JSON.stringify({ type: 'web_app', text: 'باز کردن اپ', web_app: { url: u } }) });
      }
    } catch (e) {}
    if (r && r.ok) { try { cache.put('TG_CMDS_OK', '1', 21600); } catch (e) {} return true; }
    return false;
  } catch (e) { return false; }
}

/* فراخوانی دستی پولینگ ربات (برای تست فوری) */
function sfBotPollNow() {
  const t = sfTgToken_();
  if (!t) return { ok: false, error: 'توکن ربات تنظیم نشده' };
  const before = Number(botProps_().getProperty('BOT_OFFSET') || 0);
  let pr = null;
  try { pr = pollBotUpdates_(t); } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  return { ok: true, offsetBefore: before, offsetAfter: Number(botProps_().getProperty('BOT_OFFSET') || 0), poll: pr };
}

function sfTelegramCommand_(chat, text, fromName) {
  const raw = String(text == null ? '' : text).trim();
  const row = sfTgRowByChat_(chat);
  if (!row) {
    if (sfTgThrottle_('tg_nolink_' + chat, 60)) {
      sfTgSend_(chat, 'این گفتگو هنوز به هیچ حسابی وصل نیست.\n' +
        'اگر صاحب اپ هستی: «پروفایل → یادآور تلگرام» آیدی عددی‌ات را ثبت کن (یا از مربی بخواه).\n\n' +
        'آیدی عددی تلگرام تو: ' + chat);
    }
    return { ok: false, error: 'not_linked' };
  }
  const body = raw.replace(/^\//, '');
  const cmd = sfTgNorm_(body);
  const id = sfTgCommandId_(cmd);  /* حالت ادمین ربات - فقط برای چت ادمین */
  const _adminChat = (function(){ try { return String(PropertiesService.getScriptProperties().getProperty('COACH_TELEGRAM_CHAT_ID') || ''); } catch(e){ return ''; } })();
  if (_adminChat && String(chat) === _adminChat) {
    const _admCmd = raw.replace(/^\/+/, '').trim().toLowerCase();
    if (_admCmd === 'admin' || _admCmd === 'ادمین' || _admCmd === 'status' || _admCmd === 'وضعیت' || _admCmd === 'pending' || _admCmd === 'err' || _admCmd === 'log') {
      let _admOut = '';
      const _props = PropertiesService.getScriptProperties();
      if (_admCmd === 'admin' || _admCmd === 'ادمین') {
        _admOut = '🛡️ [b]حالت ادمین ربات[/b]\n━━━━━━━━━━━━━━\n' +
          'دستورها:\n' +
          '• /status — وضعیت ربات و صف\n' +
          '• /pending — شمارندهٔ pending\n' +
          '• /err — آخرین خطای ثبت‌شده\n' +
          '• /log — لینک شیت دیتا\n\n' +
          'آیدی ادمین: ' + chat;
      } else if (_admCmd === 'status' || _admCmd === 'وضعیت') {
        _admOut = '📊 [b]وضعیت ربات[/b]\n━━━━━━━━━━━━━━\n' +
          'Offset: ' + (_props.getProperty('BOT_OFFSET') || '-') + '\n' +
          'Last: ' + (_props.getProperty('BOT_LAST_UPD') || '-') + '\n' +
          'LastErr: ' + (_props.getProperty('BOT_LAST_ERR') || '—') + '\n' +
          'Admin chat: ' + _adminChat + '\n\n' +
          '📊 شیت دیتا:\nhttps://docs.google.com/spreadsheets/d/1LMQPydjxPR_bnY8aORu5KhDeIZHu5j7DjaYce4B3o5s/edit?gid=1984210169#gid=1984210169';
      } else if (_admCmd === 'pending') {
        _admOut = '⏳ شمارندهٔ pending را از پنل ادمین بررسی کنید.\n' +
          '📊 شیت: https://docs.google.com/spreadsheets/d/1LMQPydjxPR_bnY8aORu5KhDeIZHu5j7DjaYce4B3o5s/edit?gid=1984210169#gid=1984210169';
      } else if (_admCmd === 'err') {
        _admOut = '⚠️ [b]آخرین خطا[/b]\n━━━━━━━━━━━━━━\n' + (_props.getProperty('BOT_LAST_ERR') || '— بدون خطا —');
      } else if (_admCmd === 'log') {
        _admOut = '📋 لاگ‌ها در شیت AppLogs ثبت می‌شوند.\n' +
          '📊 شیت دیتا: https://docs.google.com/spreadsheets/d/1LMQPydjxPR_bnY8aORu5KhDeIZHu5j7DjaYce4B3o5s/edit?gid=1984210169#gid=1984210169';
      }
      if (_admOut) { sfTgSend_(chat, _admOut); return { ok: true, cmd: 'admin_' + _admCmd }; }
    }
  }

  /* اگر کاربر دستور دیگری زد، حالت انتظار پیام لغو می‌شود */
  if (id) { try { CacheService.getScriptCache().remove('pend_msg_' + chat); } catch (e) {} }
  /* حالت «در انتظار متن پیام برای مربی» */
  if (!id) {
    try {
      const cc = CacheService.getScriptCache();
      if (cc.get('pend_msg_' + chat)) {
        cc.remove('pend_msg_' + chat);
        const msg = raw.replace(/^\/+/, '').trim();
        if (/^(لغو|cancel)$/i.test(sfTgNorm_(msg))) {
          sfTgSend_(chat, '❌ ارسال پیام لغو شد.');
          return { ok: true, cmd: 'coach_cancel' };
        }
        if (msg) {
          try {
            sendMessage(sfTgSessionOf_(row), '', msg);
            sfTgSend_(chat, '✅ [b]پیامت برای مربی ارسال شد[/b]\n━━━━━━━━━━━━━━\n📨 متن: ' + msg.slice(0, 400) + '\n\nمربی همین حالا در تلگرام باخبر می‌شود.');
          } catch (e) { sfTgSend_(chat, '⚠️ ' + (e.message || '')); }
          return { ok: true, cmd: 'coach_send' };
        }
      }
    } catch (e) {}
  }
  const tok = sfTgSessionOf_(row);
  const kb = sfTgKeyboard_(chat);
  let out = '';

  if (id === 'menu') {
    const sent = sfTgSend_(chat, sfTgMenuText_(row), sfTgInline_());
    return { ok: !!(sent && sent.ok), cmd: id, sent: (sent && sent.ok) ? 'ok' : ((sent && sent.description) || 'fail'), keyboard: !!(sent && sent.result && sent.result.reply_markup) };
  }
  if (id === 'app') {
    const mk = sfTgMiniKb_(chat);
    if (mk) {
      /* فقط inline_keyboard (تلگرام اجازهٔ ترکیب با نوار دکمه‌ها را نمی‌دهد) */
      const sent = sfTgSend_(chat, '🚀 اپ کامل Saeedi Fit Body\n' +
        'با دکمهٔ زیر اپ را داخل تلگرام باز کن: برنامهٔ تمرینی، غذایی، مکمل‌ها، ثبت وزن و آب، یادآورها و گزارش‌ها — همه در یک صفحهٔ گرافیکی.\n\n' +
        'دکمهٔ «🚀 باز کردن اپ» هم همیشه در نوار پایین صفحه هست.', { inline_keyboard: [[mk]] });
      return { ok: !!(sent && sent.ok), cmd: id, mini: true, inline: !!(sent && sent.result && sent.result.reply_markup) };
    }
    out = '🚀 مینی‌اپ هنوز آماده نیست. از «☰ منو» استفاده کن.';
  }
  if (id === 'help') out = sfTgHelpText_();
  else if (id === 'workout') {
    const n = sfTgLastNumber_(body.replace(/برنامه|تمرین|workout|روز/g, ''));
    out = n ? sfTgWorkoutDay_(row.username, Math.round(n)) : sfTgWorkoutPlan_(row.username);
  }
  else if (id === 'done') {
    const plans = sfPlansAsLegacy_(row.username);
    if (!plans.length) out = '📋 هنوز برنامهٔ تمرینی به تو اختصاص نیافته.';
    else {
      const p = plans[0], days = p.days || [];
      const nums = (sfTgDigits_(body).match(/\d+/g) || []).map(Number).filter(function (n) { return n > 0; });
      if (!nums.length) {
        const doneList = getDoneToday_(row.username, todayISO_());
        out = '✅ تمرین‌های ثبت‌شدهٔ امروز: ' + (doneList.length ? '\n• ' + doneList.join('\n• ') : 'هنوز چیزی ثبت نشده');
        out += '\nثبت حرکت: /انجام ۲ ۱  (روز ۲، حرکت ۱)';
      } else {
        const di = nums.length >= 2 ? nums[0] - 1 : 0;
        const xi = nums.length >= 2 ? nums[1] - 1 : nums[0] - 1;
        const d = days[di];
        if (!d || !d.exercises || !d.exercises[xi]) out = '❌ شماره درست نیست. مثال: /انجام ۲ ۱';
        else {
          const key = (p.name || '') + '_' + di + '_' + xi;
          try { setExerciseDone(tok, key, true, todayISO_()); out = '✅ ثبت شد: ' + d.exercises[xi].name; }
          catch (e) { out = '⚠️ ' + (e.message || ''); }
        }
      }
    }
  }
  else if (id === 'diet') out = sfTgDiet_(row.username);
  else if (id === 'supp') out = sfTgSupp_(row.username);
  else if (id === 'weight') {
    const n = sfTgLastNumber_(body.replace(/وزن|weight/g, ''));
    if (n !== null && n >= 20 && n <= 300) {
      try {
        saveLog(tok, { date: todayISO_(), weight: n }, todayISO_());
        out = '✅ وزن ' + sfTgFa_(n) + ' کیلوگرم ثبت شد.\n' + sfTgWeight_(row.username);
      } catch (e) { out = '⚠️ ثبت وزن ناموفق بود: ' + (e.message || ''); }
    } else out = sfTgWeight_(row.username);
  }
  else if (id === 'water') {
    /* دکمه‌های + و − برای آب: /آب+1 ، /آب-1 ، /آب0 یا دکمه‌های شیشه‌ای */
    const rawW = String(body == null ? "" : body).trim();
    const mm = rawW.match(/^water\s*([+-])s*([0-9]+)$/i) || rawW.match(/^water\s*0$/i);
    let delta = null;
    if (mm) {
      if (mm[1]) delta = (mm[1] === "+" ? 1 : -1) * (Number(mm[2]) || 1);
      else delta = 0;
    } else {
      const n = sfTgLastNumber_(rawW.replace(/آب|water/g, ""));
      delta = (n === 0) ? 0 : ((n !== null && n > 0) ? Math.round(n) : 1);
    }
    try {
      if (delta === 0) { resetWater(tok, todayISO_()); }
      else { addWater(tok, delta, todayISO_()); }
      const kbW = { inline_keyboard: [
        [{ text: "➖ یک لیوان کم", callback_data: "cmd:water-1" }, { text: "➕ یک لیوان اضافه", callback_data: "cmd:water+1" }],
        [{ text: "🔄 ریست آب امروز", callback_data: "cmd:water0" }, { text: "🏠 منو", callback_data: "cmd:menu" }]
      ] };
      const sentW = sfTgSend_(chat, sfTgWater_(row.username), kbW);
      return { ok: !!(sentW && sentW.ok), cmd: id, sent: (sentW && sentW.ok) ? "ok" : "fail" };
    } catch (e) { out = "⚠️ " + (e.message || ""); }
  }
  else if (id === 'food') {
    const rest = body.replace(/^\/?\s*(ثبت غذا|خوردنی|food|غذا ثبت)\s*/i, '').trim();
    const parts = rest.split(' ').filter(function (x) { return x; });
    let kcal = 0;
    if (parts.length && /^[0-9۰-۹٠-٩.,]+$/.test(parts[parts.length - 1])) {
      kcal = Math.round(parseFloat(sfTgDigits_(parts[parts.length - 1]).replace(',', '.')) || 0);
      parts.pop();
    }
    const title = parts.join(' ').trim();
    if (!title || !kcal) out = 'مثال: /غذا ثبت نان و پنیر ۲۵۰';
    else {
      try {
        logMeal(tok, { title: title, kcal: kcal }, todayISO_());
        out = '✅ ثبت شد: ' + title + ' — ' + sfTgFa_(kcal) + ' کالری';
      } catch (e) { out = '⚠️ ثبت نشد: ' + (e.message || ''); }
    }
  }
  else if (id === 'reminders') {
    const rest = body.replace(/یاد ?اور|reminder/gi, '').trim();
    const time = sfTgParseTime_(rest);
    if (time) {
      const label = rest.replace(/([0-9۰-۹٠-٩]{1,2}\s*[:：.،]\s*[0-9۰-۹٠-٩]{1,2})/, '').trim();
      const items = sfTgRemItems_(row.username);
      if (items.length >= 8) out = '⚠️ حداکثر ۸ یادآور می‌توانی داشته باشی.';
      else {
        items.push({ type: label ? 'pill' : 'workout', time: time, on: true, label: label });
        try { saveReminders(tok, items); out = '✅ یادآور ساخته شد: ' + time + ' — ' + sfTgRemLabel_(items[items.length - 1]); }
        catch (e) { out = '⚠️ ' + (e.message || ''); }
      }
    } else out = sfTgReminders_(row.username);
  }
  else if (id === 'remdel') {
    const rest = body.replace(/حذف|یاد ?اور|reminder/gi, '').trim();
    const time = sfTgParseTime_(rest);
    const items = sfTgRemItems_(row.username);
    const before = items.length;
    const kept = items.filter(function (it) { return !(time && it.time === time); });
    if (kept.length === before) out = 'یادآوری با این ساعت پیدا نشد.';
    else { saveReminders(tok, kept); out = '✅ یادآور ' + time + ' حذف شد.'; }
  }
  else if (id === 'report') out = sfTgReport_(row.username);
  else if (id === 'rank') {
    try {
      const lb = getLeaderboard(tok);
      if (lb && lb.mode === 'coach' && lb.list && lb.list.length) {
        out = '🏆 جدول استریک:';
        lb.list.forEach(function (x, i) { out += '\n' + sfTgFa_(i + 1) + ') ' + (x.name || x.username) + ' — ' + sfTgFa_(x.streak || 0) + ' روز'; });
      } else if (lb && lb.rank) {
        out = '🏆 رتبهٔ تو: ' + sfTgFa_(lb.rank) + ' از ' + sfTgFa_(lb.total || 0) + '\nاستریک: ' + sfTgFa_(lb.streak || 0) + ' روز';
      } else out = '🏆 جدول رتبه‌بندی خالی است.';
    } catch (e) { out = '⚠️ ' + (e.message || ''); }
  }
  else if (id === 'checkin') {
    const rest = body.replace(/چک ?این|checkin/gi, '').trim();
    const nums = (sfTgDigits_(rest).match(/\d+/g) || []).map(Number).filter(function (n) { return n >= 1 && n <= 5; });
    if (nums.length < 4) {
      out = '📋 چک‌این هفتگی\nفرمت: /چکاین ۴ ۳ ۴ ۴ [توضیح]\n(انرژی، خواب، رژیم، خستگی — هرکدام از ۱ تا ۵)';
    } else {
      const note = rest.replace(/[0-9۰-۹٠-٩.\\s]+/g, ' ').trim();
      let days = 0;
      for (let k = 0; k < 7; k++) {
        const d = new Date(); d.setDate(d.getDate() - k);
        const iso = Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
        if (getDoneToday_(row.username, iso).length) days++;
      }
      const txt = 'چک‌این هفتگی\nانرژی: ' + nums[0] + '/5 | خواب: ' + nums[1] + '/5 | رژیم: ' + nums[2] + '/5 | خستگی: ' + nums[3] + '/5 | تمرین این هفته: ' + days + ' روز' + (note ? '\nتوضیح: ' + note : '');
      try { sendMessage(tok, '', txt); out = '✅ چک‌این برای مربی ارسال شد.'; }
      catch (e) { out = '⚠️ ' + (e.message || ''); }
    }
  }
  else if (id === 'progress') out = sfTgProgress_(row.username);
  else if (id === 'note') out = sfTgNote_(row.username);
  else if (id === 'coach') {
    let rest = body.replace(/^پیام|^coach|\/پیام/gi, '').trim();
    /* اگر کاربر فقط دکمهٔ «✉️ پیام به مربی» را زده باشد، متن دکمه نباید برای مربی ارسال شود */
    rest = rest.replace(/^[\s✉️📝📩💬🚀🏋️🍽️💊⚖️💧📅📊📈☰ℹ️🔔✅❌🤖]+/g, '').trim();
    if (!rest || /^(پیام\s*به\s*مربی|یادداشت\s*مربی|فرستادن\s*پیام)/.test(rest)) {
      /* ربات منتظر می‌ماند تا کاربر متن را خودش تایپ کند */
      try { CacheService.getScriptCache().put('pend_msg_' + chat, '1', 900); } catch (e) {}
      out = '✉️ [b]پیام به مربی[/b]\n━━━━━━━━━━━━━━\nحالا متن پیامت را بنویس و بفرست؛ مستقیم برای مربی می‌رود.\n\nبرای انصراف: /لغو';
    } else {
      try { sendMessage(tok, '', rest); out = '✅ [b]پیامت برای مربی ارسال شد[/b]\n━━━━━━━━━━━━━━\n📨 متن: ' + rest.slice(0, 400) + '\n\nمربی همین حالا در تلگرام باخبر می‌شود.'; }
      catch (e) { out = '⚠️ ' + (e.message || ''); }
    }
  }
  else if (id === 'id') out = '🆔 آیدی عددی تلگرام تو: ' + row.chatId;
  else if (id === 'stop') {
    const rec = getUserRecord_(row.username);
    if (rec) getSS_().getSheetByName(CONFIG.USERS_SHEET).getRange(rec.row, 7).setValue('');
    out = 'اتصال قطع شد. برای وصل دوباره از اپ «پروفایل → یادآور تلگرام» استفاده کن.';
  }
  else {
    const greet = /^(سلام|درود|هلو|های|خوبی|hi|hello|slm)\s*[!.،؟]*$/i.test(raw);
    if (!sfTgThrottle_('tg_unknown_' + chat, greet ? 8 : 30)) return { ok: true, cmd: '' };
    out = greet
      ? 'سلام 👋 خوش برگشتی!\nهمه‌چیز با دکمهٔ «☰ منو» یکجاست، یا /راهنما را بزن.\n• تمرین: /برنامه  •  غذای امروز: /غذا  •  آب: /آب'
      : 'متوجه نشدم 🤔 از دکمه‌های پایین استفاده کن یا /راهنما را بزن.';
  }
  if (out) sfTgSend_(chat, out, kb);
  return { ok: true, cmd: id };
}

/* =====================================================================
 *  مینی‌اپ تلگرام (Telegram Mini App) — نسخهٔ گرافیکی اپ داخل گفتگوی ربات
 *  سرو می‌شود از doGet با  ?mini=1  به‌صورت یک سند مستقل (بدون iframe)
 * ===================================================================== */

/* نشانی مینی‌اپ */
function sfMiniUrl_() {
  try { return ScriptApp.getService().getUrl() + '?mini=1'; } catch (e) { return ''; }
}

/* ---------- کلید شخصی ورود به مینی‌اپ (چون Apps Script داخل iframe سرو می‌شود و initData تلگرام به آن نمی‌رسد) ---------- */
function sfMiniKey_(chatId) {
  const id = String(chatId || '');
  if (!id) return '';
  try {
    const key = Utilities.getUuid().replace(/-/g, '');
    CacheService.getScriptCache().put('mk_' + key, id, 21600);
    return key;
  } catch (e) { return ''; }
}
function sfMiniKeyRead_(key) {
  const k = String(key || '');
  if (!/^[a-z0-9]{16,}$/i.test(k)) return '';
  try { return CacheService.getScriptCache().get('mk_' + k) || ''; } catch (e) { return ''; }
}
/* ورود خودکار مینی‌اپ با کلید شخصی */
function sfMiniAuthKey(key) {
  const chat = sfMiniKeyRead_(key);
  if (!chat) throw new Error('این لینک منقضی شده است. در ربات دستور /app را بزن تا لینک تازه بگیری.');
  const row = sfTgRowByChat_(chat);
  const out = { ok: true, chatId: chat, linked: !!row };
  if (row) { out.appUser = row.username; out.token = createSession_(row.username, row.role || 'user'); }
  return rpcSafe_(out);
}
/* اتصال حساب واردشده به آیدی تلگرامِ همان کلید */function sfMiniLinkKey(token, key) {
  const chat = sfMiniKeyRead_(key);
  if (!chat) throw new Error('لینک منقضی شده است. در ربات دوباره /app را بزن.');
  const s = requireSession_(token);
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  const vals = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < vals.length; r++) if (normalize_(vals[r][0]).toLowerCase() === s.username.toLowerCase()) { row = r + 1; break; }
  if (row < 0) throw new Error('کاربر پیدا نشد.');
  sh.getRange(row, 7).setValue(chat);
  return rpcSafe_({ ok: true, chatId: chat, reminders: getRemindersInfo_(s.username) });
}

/* لینک تست مینی‌اپ برای مربی (کنسول → تست) */
function sfMiniTestLink(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  const rec = getUserRecord_(s.username);
  const chat = rec && rec.telegramChatId ? String(rec.telegramChatId) : '';
  if (!chat) throw new Error('اول آیدی عددی تلگرامت را در پروفایل ثبت کن.');
  const key = sfMiniKey_(chat);
  if (!key) throw new Error('ساخت لینک ناموفق بود.');
  return rpcSafe_({ ok: true, chatId: chat, url: sfMiniUrl_() + '&k=' + key });
}

/* ---------- اعتبارسنجی initData تلگرام ---------- */
function sfMiniVerify_(initData) {
  const t = sfTgToken_();
  if (!t) throw new Error('ربات هنوز تنظیم نشده.');
  const raw = String(initData || '');
  if (!raw) throw new Error('اطلاعات ورود تلگرام دریافت نشد. مینی‌اپ را از داخل گفتگوی ربات باز کن.');
  const params = {};
  raw.split('&').forEach(function (kv) {
    const i = kv.indexOf('=');
    if (i < 0) return;
    try { params[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) {}
  });
  const hash = params.hash || '';
  delete params.hash;
  const check = Object.keys(params).sort().map(function (k) { return k + '=' + params[k]; }).join('\n');
  const secret = Utilities.computeHmacSha256Signature(Utilities.newBlob(t).getBytes(), Utilities.newBlob('WebAppData').getBytes());
  const calc = Utilities.computeHmacSha256Signature(Utilities.newBlob(check).getBytes(), secret);
  const hex = calc.map(function (b) { const v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
  if (!hash || hex !== hash) throw new Error('اعتبارسنجی تلگرام ناموفق بود. مینی‌اپ را دوباره از ربات باز کن.');
  /* جلوگیری از Replay: امضای معتبر اما قدیمی پذیرفته نمی‌شود.
     تلگرام initData را در هر بار باز کردن مینی‌اپ تازه صادر می‌کند. */
  const ad = Number(params.auth_date || 0);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!ad || !isFinite(ad) || (nowSec - ad) > 86400 || (ad - nowSec) > 300) {
    throw new Error('اعتبار ورود تلگرام منقضی شده است. مینی‌اپ را دوباره از ربات باز کن.');
  }
  let user = {};
  try { user = JSON.parse(params.user || '{}'); } catch (e) {}
  return { chatId: String(user.id || ''), user: user, authDate: params.auth_date || '' };
}

/* ---------- ورود خودکار با تلگرام ---------- */
function sfMiniAuth(initData) {
  const v = sfMiniVerify_(initData);
  const row = v.chatId ? sfTgRowByChat_(v.chatId) : null;
  const out = { ok: true, chatId: v.chatId, name: [v.user.first_name, v.user.last_name].filter(Boolean).join(' '), username: v.user.username || '', linked: !!row };
  if (row) { out.appUser = row.username; out.token = createSession_(row.username, row.role || 'user'); }
  return rpcSafe_(out);
}

/* ---------- اتصال آیدی تلگرام به حساب واردشده ---------- */
function sfMiniLink(token, initData) {
  const s = requireSession_(token);
  const v = sfMiniVerify_(initData);
  if (!v.chatId) throw new Error('آیدی تلگرام پیدا نشد.');
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  const vals = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < vals.length; r++) if (normalize_(vals[r][0]).toLowerCase() === s.username.toLowerCase()) { row = r + 1; break; }
  if (row < 0) throw new Error('کاربر پیدا نشد.');
  sh.getRange(row, 7).setValue(v.chatId);
  return rpcSafe_({ ok: true, chatId: v.chatId, reminders: getRemindersInfo_(s.username) });
}

/* ---------- ذخیرهٔ یادآورها (با پشتیبانی انواع مکمل/قرص/تغذیه) ---------- */
function sfMiniSaveReminders(token, items) {
  const s = requireSession_(token);
  const types = { workout: 1, water: 1, meal: 1, weight: 1, pill: 1, supplement: 1, nutrition: 1 };
  const clean = (Array.isArray(items) ? items : []).slice(0, 12).filter(function (i) {
    return i && types[i.type] && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(i.time));
  }).map(function (i) {
    return { type: String(i.type), time: String(i.time), on: i.on !== false, label: String(i.label || '').slice(0, 60) };
  });
  const sh = getRemSheet_();
  const v = sh.getDataRange().getValues();
  const me = s.username.toLowerCase();
  let row = -1;
  for (let r = 1; r < v.length; r++) if (normalize_(v[r][0]).toLowerCase() === me) { row = r + 1; break; }
  const vals = [[s.username, JSON.stringify(clean), new Date().toISOString()]];
  if (row > 0) sh.getRange(row, 1, 1, 3).setValues(vals); else sh.appendRow(vals[0]);
  return rpcSafe_({ ok: true, reminders: getRemindersInfo_(s.username) });
}

/* ---------- ارسال متن به گفتگو از داخل مینی‌اپ ---------- */
/* حذف شد — `sfMiniSendTo(chat, text)` بدون requireSession_ و بدون allow-list
 * اجازه می‌داد هر فراخوان، پیام دلخواه به هر چتی که با ربات صحبت کرده بفرستد
 * (فیشینگ با هویت ربات مربی).
 *
 * برای ارسال پیام از سمت سرور، botCall_ در دسترس است اما فقط از مسیرهای
 * احرازشده (مثل sendDailyReminders یا sfSendReminderTest) صدا زده می‌شود.
 */

/* ---------- صفحهٔ مینی‌اپ ---------- */
var SF7_LOGO_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjMyMSAxNTAgNDM4IDUwMCIgd2lkdGg9IjQzOCIgaGVpZ2h0PSI1MDAiPgogIDxkZWZzPgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJsaW1lIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2I1ZTg0YSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjAuNTUiIHN0b3AtY29sb3I9IiM0ZmI4NDgiLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMGY3YTQ1Ii8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogICAgPGxpbmVhckdyYWRpZW50IGlkPSJuYXZ5IiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iIzFmMmQzZCIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwYTE2MjQiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bGluZWFyR3JhZGllbnQgaWQ9InB1bHNlIiB4MT0iMCIgeTE9IjAiIHgyPSIxIiB5Mj0iMCI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCIgc3RvcC1jb2xvcj0iI2I1ZTg0YSIvPgogICAgICA8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMyZmFlNWEiLz4KICAgIDwvbGluZWFyR3JhZGllbnQ+CiAgICA8bWFzayBpZD0iZ2FwTWFzayIgbWFza1VuaXRzPSJ1c2VyU3BhY2VPblVzZSIgeD0iMCIgeT0iMCIgd2lkdGg9IjEwODAiIGhlaWdodD0iMTA4MCI+CiAgICAgIDxyZWN0IHdpZHRoPSIxMDgwIiBoZWlnaHQ9IjEwODAiIGZpbGw9IiNmZmYiLz4KICAgICAgPHBvbHlnb24gcG9pbnRzPSI1NDAsMTkwIDcyMiwyOTUgNzIyLDUwNSA1NDAsNjEwIDM1OCw1MDUgMzU4LDI5NSIgZmlsbD0iIzAwMCIvPgogICAgPC9tYXNrPgogICAgPGNsaXBQYXRoIGlkPSJpbm5lckNsaXAiPgogICAgICA8cG9seWdvbiBwb2ludHM9IjU0MCwyMDIgNzExLDMwMSA3MTEsNDk5IDU0MCw1OTggMzY5LDQ5OSAzNjksMzAxIi8+CiAgICA8L2NsaXBQYXRoPgogIDwvZGVmcz4KCgogIDwhLS0gSGV4YWdvbiBiYWRnZTogb3V0ZXIgZ3JlZW4gcmluZywgd2hpdGUgZ2FwLCBuYXZ5IGNvcmUgLS0+CiAgPGcgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+CiAgICA8cG9seWdvbiBwb2ludHM9IjU0MCwxNzAgNzM5LDI4NSA3MzksNTE1IDU0MCw2MzAgMzQxLDUxNSAzNDEsMjg1IiBmaWxsPSJ1cmwoI2xpbWUpIiBzdHJva2U9InVybCgjbGltZSkiIHN0cm9rZS13aWR0aD0iMTYiIG1hc2s9InVybCgjZ2FwTWFzaykiLz4KICAgIDxwb2x5Z29uIHBvaW50cz0iNTQwLDIwMiA3MTEsMzAxIDcxMSw0OTkgNTQwLDU5OCAzNjksNDk5IDM2OSwzMDEiIGZpbGw9InVybCgjbmF2eSkiLz4KICA8L2c+CgogIDwhLS0gU3VidGxlIHNpeC1wYWNrIHBhdHRlcm4gLS0+CiAgPGcgY2xpcC1wYXRoPSJ1cmwoI2lubmVyQ2xpcCkiIGZpbGw9IiNiNWU4NGEiIG9wYWNpdHk9IjAuMTAiPgogICAgPHJlY3QgeD0iNDQ1IiB5PSI0NDAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0NiIgcng9IjE0Ii8+CiAgICA8cmVjdCB4PSI1NTUiIHk9IjQ0MCIgd2lkdGg9IjgwIiBoZWlnaHQ9IjQ2IiByeD0iMTQiLz4KICAgIDxyZWN0IHg9IjQ0NSIgeT0iNDk4IiB3aWR0aD0iODAiIGhlaWdodD0iNDYiIHJ4PSIxNCIvPgogICAgPHJlY3QgeD0iNTU1IiB5PSI0OTgiIHdpZHRoPSI4MCIgaGVpZ2h0PSI0NiIgcng9IjE0Ii8+CiAgICA8cmVjdCB4PSI0NTAiIHk9IjU1NiIgd2lkdGg9Ijc1IiBoZWlnaHQ9IjQwIiByeD0iMTQiLz4KICAgIDxyZWN0IHg9IjU1NSIgeT0iNTU2IiB3aWR0aD0iNzUiIGhlaWdodD0iNDAiIHJ4PSIxNCIvPgogIDwvZz4KCiAgPCEtLSBEeW5hbWljIFMgbW9ub2dyYW0gLS0+CiAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoNjYgLTYpIHNrZXdYKC0xMCkiPgogICAgPHBhdGggZD0iTSA2MTggMzQyIEggNDkyIFEgNDY0IDM0MiA0NjQgMzY4IFEgNDY0IDM5NCA0OTIgMzk3IEwgNTkwIDQxMyBRIDYxOCA0MTggNjE4IDQ0NCBRIDYxOCA0NzAgNTkwIDQ3MCBIIDQ1OCIKICAgICAgICAgIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSI0MCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLWxpbmVjYXA9ImJ1dHQiLz4KICAgIDxwYXRoIGQ9Ik0gNjE4IDQ3MCBIIDQ1OCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjYjVlODRhIiBzdHJva2Utd2lkdGg9IjAiLz4KICA8L2c+CgogIDwhLS0gSGVhcnRiZWF0IC8gcHVsc2UgbGluZSAtLT4KICA8cGF0aCBkPSJNIDQyMCA1NDAgSCA0ODggTCA1MDggNTA4IEwgNTM3IDU2OCBMIDU2MiA1MjAgTCA1NzggNTQwIEggNjYwIgogICAgICAgIGZpbGw9Im5vbmUiIHN0cm9rZT0idXJsKCNwdWxzZSkiIHN0cm9rZS13aWR0aD0iMTIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgoKICA8IS0tIEJyYW5kIG5hbWUgLS0+CiAgPHRleHQgeD0iNTQwIiB5PSI4MDAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJNb250c2VycmF0LCAnQXJpYWwgQmxhY2snLCBJbXBhY3QsIHNhbnMtc2VyaWYiCiAgICAgICAgZm9udC13ZWlnaHQ9IjkwMCIgZm9udC1zaXplPSIxMjgiIGxldHRlci1zcGFjaW5nPSI4IiBmaWxsPSIjMGYxYzJiIj5TQUVFREk8L3RleHQ+CgogIDxnPgogICAgPHJlY3QgeD0iMjYyIiB5PSI4NTMiIHdpZHRoPSIxMjAiIGhlaWdodD0iNiIgcng9IjMiIGZpbGw9InVybCgjbGltZSkiLz4KICAgIDxyZWN0IHg9IjY5OCIgeT0iODUzIiB3aWR0aD0iMTIwIiBoZWlnaHQ9IjYiIHJ4PSIzIiBmaWxsPSJ1cmwoI2xpbWUpIi8+CiAgICA8dGV4dCB4PSI1NDAiIHk9Ijg3MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9Ik1vbnRzZXJyYXQsIEFyaWFsLCBzYW5zLXNlcmlmIgogICAgICAgICAgZm9udC13ZWlnaHQ9IjcwMCIgZm9udC1zaXplPSI0NCIgbGV0dGVyLXNwYWNpbmc9IjE2IiBmaWxsPSIjMWM4YTRhIj5GSVQgQk9EWTwvdGV4dD4KICA8L2c+Cjwvc3ZnPgo=';
function sfMiniPage_(key) {
  const k = String(key || '').replace(/[^a-z0-9]/gi, '');
  const html = sfMiniHtml_().replace('%%MINIKEY%%', k).replace('%%LOGO%%', SF7_LOGO_URI);
  return HtmlService.createHtmlOutput(html)
    .setTitle('Saeedi Fit Body')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/* ---------- بوت‌استرپ سبک مینی‌اپ: فقط داده‌های لازم، بدون خواندن‌های سنگین ---------- */
function getMiniBootstrap(token, clientToday) {
  const session = requireSession_(token);
  const resolved = resolveUserPlans_(session.username);
  return rpcSafe_({
    user: { username: session.username, role: session.role },
    profile: getProfile_(session.username),
    logs: getLogs_(session.username),
    streak: computeStreak_(session.username, clientToday),
    workouts: resolved.workout,
    diets: resolved.diet,
    supplements: resolved.supplement,
    water: getWater_(session.username, clientToday),
    meals: getMeals_(session.username, clientToday),
    doneToday: getDoneToday_(session.username, clientToday),
    reminders: getRemindersInfo_(session.username),
    lastMessage: getLastMessage_(session.username)
  });
}

function sfMiniHtml_() {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#050908">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{--bg:#050908;--card:#0c1311;--card2:#12211c;--line:rgba(255,255,255,.085);--txt:#f1f6f3;--mut:#8ea09b;--acc:#5be25b;--acc2:#2fbf6a;--warn:#ffd166;--r:18px;--grad:linear-gradient(135deg,#6af05c,#35c96a);--shadow:0 12px 30px rgba(0,0,0,.35)}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0}
body{background:radial-gradient(760px 400px at 50% -10%,rgba(91,226,91,.16),transparent 72%),#050908;color:var(--txt);font-family:system-ui,"Segoe UI",Tahoma,sans-serif;padding-bottom:96px;min-height:100vh}
a{color:var(--acc)}
.top{display:flex;align-items:center;gap:12px;padding:14px 16px 13px;background:linear-gradient(150deg,rgba(18,33,28,.9),rgba(5,9,8,.55) 60%);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20;backdrop-filter:blur(12px)}
.ava{width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:21px;background:linear-gradient(140deg,#14261d,#0a150f);border:1px solid rgba(91,226,91,.3);box-shadow:0 8px 22px rgba(0,0,0,.4);overflow:hidden}
.who{flex:1;min-width:0}
.who b{display:block;font-size:15.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.who small{color:var(--mut);font-size:11.5px}
.streak{background:rgba(91,226,91,.12);border:1px solid rgba(91,226,91,.32);color:var(--acc);border-radius:14px;padding:6px 11px;font-size:11.5px;text-align:center;line-height:1.45;white-space:nowrap;font-weight:600}
.streak b{display:block;font-size:16px;font-weight:800}
main{padding:14px 14px 0}
.card{background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,0) 26%),var(--card);border:1px solid var(--line);border-radius:var(--r);padding:14px;margin-bottom:12px;box-shadow:var(--shadow)}
.sec{display:flex;align-items:center;gap:8px;margin:18px 2px 9px;font-size:13px;color:var(--mut)}
.sec:before{content:"";width:4px;height:15px;border-radius:9px;background:linear-gradient(180deg,#7af05c,#2fbf6a)}
.sec .more{margin-right:auto;font-size:11.5px;color:var(--acc);background:none;border:0;font-family:inherit;cursor:pointer}
.hero{display:flex;gap:14px;align-items:center}
.ring{width:108px;height:108px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto;box-shadow:0 10px 26px rgba(0,0,0,.4)}
.ringIn{width:82px;height:82px;border-radius:50%;background:#0c1311;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.25}
.ringIn b{font-size:20px;font-weight:800}
.ringIn small{font-size:9.5px;color:var(--mut)}
.macros{flex:1;min-width:0}
.macro{margin-bottom:9px}
.macro:last-child{margin-bottom:0}
.mTop{display:flex;justify-content:space-between;font-size:11.5px;color:var(--mut);margin-bottom:4px}
.mTop b{color:var(--txt);font-weight:600}
.bar{height:7px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden}
.bar i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#6af05c,#35c96a)}
.bar.p i{background:linear-gradient(90deg,#6af05c,#35c96a)}
.bar.c i{background:linear-gradient(90deg,#ffb347,#ff9f6b)}
.bar.f i{background:linear-gradient(90deg,#6aa8ff,#a3cdff)}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.tile{background:linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,0) 30%),var(--card);border:1px solid var(--line);border-radius:var(--r);padding:13px;text-align:right;color:var(--txt);font-family:inherit;font-size:13px;cursor:pointer;transition:transform .12s ease,background .12s ease;box-shadow:0 10px 24px rgba(0,0,0,.3)}
.tile:active{transform:scale(.97);background:var(--card2)}
.tile .ic{display:block;font-size:20px;margin-bottom:7px}
.tile b{display:block;font-size:13.5px;font-weight:700;margin-bottom:2px}
.tile small{color:var(--mut);font-size:11px}
.tw{position:relative}
.tw .tile{width:100%}
.tmn{position:absolute;left:8px;top:8px;width:26px;height:26px;border-radius:9px;border:1px solid var(--line);background:var(--card2);color:var(--txt);font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
.tmn:active{transform:scale(.94)}
.exm{cursor:pointer}
.exm.big img{max-height:none}
.wsheet{text-align:center;padding-top:2px}
.wrow{display:flex;align-items:center;justify-content:center;gap:20px;margin:14px 0 16px}
.wbtn{width:74px;height:74px;border-radius:22px;border:0;font-size:34px;font-weight:800;line-height:1;color:#04120a;background:linear-gradient(160deg,#8ef3c1,#2fbf6a);box-shadow:0 10px 24px rgba(91,226,91,.28);cursor:pointer;font-family:inherit}
.wbtn.minus{background:linear-gradient(160deg,#16261f,#0d1712);color:#f1f6f3;border:1px solid var(--line);box-shadow:none}
.wbtn:active{transform:scale(.93)}
.wnum{min-width:112px}
.wnum b{display:block;font-size:44px;line-height:1.1;font-weight:800}
.wnum small{color:var(--mut);font-size:12px}
.wbar{height:10px;background:rgba(255,255,255,.1);border-radius:99px;overflow:hidden;margin:4px 6px 8px}
.wbar i{display:block;height:100%;background:linear-gradient(90deg,#6af05c,#35c96a);border-radius:99px;transition:width .18s}
.chips{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.chip{border-radius:12px;border:1px solid var(--line);background:var(--card2);color:var(--txt);padding:9px 12px;font-family:inherit;font-size:12px;cursor:pointer}
.chip:active{transform:scale(.96)}
.foodItem{display:flex;align-items:center;gap:10px;padding:11px 2px;border-bottom:1px dashed rgba(255,255,255,.09);cursor:pointer}
.foodItem:active{background:rgba(255,255,255,.04)}
.foodItem .t{flex:1;min-width:0}
.foodItem .t b{display:block;font-size:13.5px;font-weight:600}
.foodItem .t small{color:var(--mut);font-size:11px}
optgroup,option{color:#111;background:#fff}
.row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px dashed rgba(255,255,255,.09)}
.row:last-child{border-bottom:0;padding-bottom:0}
.row:first-child{padding-top:0}
.row .t{flex:1;min-width:0}
.row .t b{display:block;font-size:13.5px;font-weight:600;line-height:1.5}
.row .t small{color:var(--mut);font-size:11.5px;line-height:1.7;display:block}
.exm{margin:2px 0 8px;border-radius:14px;overflow:hidden;background:#070d0a;border:1px solid var(--line);position:relative}
.exm img{display:block;width:100%;height:auto;max-height:220px;object-fit:contain;background:#070d0a}
.exm .exmtag{position:absolute;top:8px;inset-inline-start:8px;background:rgba(4,18,10,.74);color:var(--acc);font-size:10.5px;padding:3px 8px;border-radius:999px;backdrop-filter:blur(4px)}
.pill{border-radius:999px;padding:4px 10px;font-size:11px;white-space:nowrap;background:rgba(91,226,91,.12);border:1px solid rgba(91,226,91,.3);color:var(--acc);font-family:inherit;cursor:pointer}
.pill.warn{background:rgba(255,209,102,.12);border-color:rgba(255,209,102,.35);color:var(--warn)}
.pill.gray{background:rgba(255,255,255,.05);border-color:var(--line);color:var(--mut)}
.pill.done{background:linear-gradient(135deg,#6af05c,#35c96a);color:#04120a;border-color:transparent}
.btn{background:linear-gradient(135deg,#6af05c,#35c96a);color:#04120a;border:0;border-radius:13px;padding:12px 14px;font-family:inherit;font-size:13.5px;font-weight:700;cursor:pointer;width:100%;box-shadow:0 10px 22px rgba(91,226,91,.22)}
.btn.g{background:transparent;color:var(--txt);border:1px solid var(--line);box-shadow:none}
.btn.w{background:transparent;color:var(--warn);border:1px solid rgba(255,209,102,.4);box-shadow:none}
.btn:active{opacity:.85}
.inp,select{width:100%;background:#101d18;border:1px solid var(--line);border-radius:12px;padding:12px;color:var(--txt);font-family:inherit;font-size:13.5px;margin:7px 0}
select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,#8ea09b 50%),linear-gradient(135deg,#8ea09b 50%,transparent 50%);background-position:calc(0% + 16px) 50%,calc(0% + 21px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.hint{color:var(--mut);font-size:12px;line-height:2}
.empty{color:var(--mut);font-size:12.5px;text-align:center;padding:18px 8px;line-height:2}
.nav{position:fixed;left:0;right:0;bottom:0;display:flex;background:rgba(8,16,13,.96);backdrop-filter:blur(14px);border-top:1px solid var(--line);padding:7px 4px calc(7px + env(safe-area-inset-bottom));z-index:30}
.nav button{flex:1;background:none;border:0;color:var(--mut);font-family:inherit;font-size:10.5px;padding:5px 2px;cursor:pointer;border-radius:12px}
.nav button.on{color:var(--acc);background:rgba(91,226,91,.09)}
.nav button span{display:block;font-size:18px;margin-bottom:3px}
.sheetWrap{position:fixed;inset:0;background:rgba(0,0,0,.66);display:none;align-items:flex-end;z-index:60}
.sheetWrap.on{display:flex}
.sheet{width:100%;max-height:88vh;overflow:auto;background:#0a120e;border-top-left-radius:24px;border-top-right-radius:24px;border-top:1px solid var(--line);padding:18px 16px calc(24px + env(safe-area-inset-bottom));animation:up .22s ease}
@keyframes up{from{transform:translateY(40px);opacity:.4}to{transform:translateY(0);opacity:1}}
.sheet h3{margin:0 0 6px;font-size:16px}
.sheet .close{float:left;width:32px;height:32px;border-radius:10px;background:var(--card2);border:1px solid var(--line);color:var(--txt);font-size:15px;cursor:pointer}
.toast{position:fixed;bottom:96px;right:50%;transform:translateX(50%) translateY(20px);background:#12291d;border:1px solid rgba(91,226,91,.35);color:var(--txt);padding:10px 16px;border-radius:12px;font-size:12.5px;opacity:0;pointer-events:none;transition:.2s;z-index:80;max-width:86%;text-align:center}
.toast.on{opacity:1;transform:translateX(50%) translateY(0)}
.sk{height:14px;border-radius:8px;background:linear-gradient(90deg,#0c1311,#13221c,#0c1311);background-size:200% 100%;animation:sh 1.2s infinite}
@keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
.badge{font-size:10.5px;color:var(--mut);background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:8px;padding:3px 7px}
.mac{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}
.mac span{font-size:10.5px;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid var(--line);color:var(--mut)}
.mac span.p{color:#7ee2a8;border-color:rgba(91,226,91,.35);background:rgba(91,226,91,.1)}
.mac span.c{color:#ffcf7a;border-color:rgba(255,209,102,.35);background:rgba(255,209,102,.1)}
.mac span.f{color:#ffa88a;border-color:rgba(255,159,107,.35);background:rgba(255,159,107,.1)}
.ava img{width:100%;height:100%;object-fit:contain;border-radius:12px;display:block}
#offbar{position:fixed;inset-inline:0;top:0;z-index:99;display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 12px;font-size:12px;color:#04120a;background:linear-gradient(90deg,#ffd166,#ffb347);box-shadow:0 6px 18px rgba(0,0,0,.35)}
#offbar b{font-weight:800}
#offbar button{border:0;border-radius:9px;padding:5px 10px;font-family:inherit;font-size:11.5px;background:#0c1311;color:#f1f6f3;cursor:pointer}
.exm.flip{position:relative;overflow:hidden;border-radius:14px;aspect-ratio:4/3;min-height:120px;background:#070d0a}
.exm.flip img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#070d0a}
.exm.flip img.alt{opacity:0}
@keyframes sfFlip{0%{opacity:0}50%{opacity:1}100%{opacity:0}}
/* sf-mini-contrast: خوانایی ورودی‌ها (ساعت، گفتگو با مربی) */
input,textarea,select{ color:var(--txt) !important; -webkit-text-fill-color:var(--txt) !important; background:var(--card2) !important; }
input::placeholder,textarea::placeholder{ color:var(--mut) !important; -webkit-text-fill-color:var(--mut) !important; opacity:1 }
input[type=time]{ color-scheme:dark; }
</style>
</head>
<body>
<div class="top">
  <div class="ava" id="ava"><img src="%%LOGO%%" alt="Saeedi Fit Body"></div>
  <div class="who"><b id="uname">Saeedi Fit Body</b><small id="usub">در حال اتصال…</small></div>
  <div class="streak" id="streak">—</div>
</div>
<main id="main">
  <div class="card"><div class="sk" style="width:60%"></div><div class="sk" style="width:90%;margin-top:10px"></div><div class="sk" style="width:40%;margin-top:10px"></div></div>
  <div class="card"><div class="sk" style="width:80%"></div><div class="sk" style="width:50%;margin-top:10px"></div></div>
</main>
<nav class="nav" id="nav">
  <button data-v="home" class="on"><span>🏠</span>خانه</button>
  <button data-v="workout"><span>🏋️</span>تمرین</button>
  <button data-v="diet"><span>🍽️</span>تغذیه</button>
  <button data-v="supp"><span>💊</span>مکمل</button>
  <button data-v="report"><span>📊</span>گزارش</button>
</nav>
<div class="sheetWrap" id="sheetWrap"><div class="sheet" id="sheet"></div></div>
<div class="toast" id="toast"></div>
<script>
var TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
var MINI_KEY = '%%MINIKEY%%';
var S = { token: '', data: null, view: 'home', chat: '', tgName: '' };
var ME = '';

function fa(n) {
  var d = '۰۱۲۳۴۵۶۷۸۹';
  return String(n == null ? '' : n).replace(/[0-9]/g, function (c) { return d[Number(c)]; });
}
function num(n) { return Number(n || 0).toLocaleString('fa-IR'); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function todayISO() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
var MINI_MUT = { addWater: 1, resetWater: 1, saveLog: 1, logMeal: 1, deleteMeal: 1, sendMessage: 1, saveProfile: 1, saveReminders: 1, setExerciseDone: 1, logExerciseSet: 1, copyYesterdayMeals: 1 };
function miniQ() { try { return JSON.parse(localStorage.getItem('fc_mini_q') || '[]'); } catch (e) { return []; } }
function miniQSet(a) { try { localStorage.setItem('fc_mini_q', JSON.stringify(a.slice(-200))); } catch (e) {} miniOff(); }
function miniIsOff() { try { return navigator.onLine === false; } catch (e) { return false; } }
function miniOff() {
  var q = miniQ().length, off = miniIsOff();
  var el = document.getElementById('offbar');
  if (!off && !q) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'offbar'; document.body.appendChild(el); }
  el.innerHTML = (off ? '📴 آفلاین — اطلاعات ذخیره‌شده' : '🔄 در انتظار همگام‌سازی') +
    (q ? ' <b>(' + fa(q) + ')</b>' : '') + ' <button type="button" id="offsync">همگام‌سازی</button>';
  var b = document.getElementById('offsync');
  if (b) b.onclick = function () { miniFlush(true); };
}
var MINI_FLUSH = false;
function miniFlush(loud) {
  if (MINI_FLUSH) return;
  var list = miniQ();
  if (!list.length) { miniOff(); if (loud) toast('همه‌چیز همگام است ✅'); return; }
  MINI_FLUSH = true;
  var step = function () {
    var l = miniQ();
    if (!l.length) { MINI_FLUSH = false; miniOff(); if (loud) { toast('همگام‌سازی انجام شد ✅'); load(); } return; }
    var it = l[0];
    if (!it || !it.n) { l.shift(); miniQSet(l); step(); return; }
    var r = google.script.run
      .withSuccessHandler(function () { var m = miniQ(); m.shift(); miniQSet(m); step(); })
      .withFailureHandler(function () { MINI_FLUSH = false; miniOff(); if (loud) toast('همگام‌سازی نشد؛ بعداً تلاش می‌شود', true); });
    var fn = r[it.n];
    if (typeof fn !== 'function') { l.shift(); miniQSet(l); step(); return; }
    try { fn.apply(r, it.a || []); } catch (e) { MINI_FLUSH = false; miniOff(); }
  };
  step();
}
function srv(name, args) {
  args = args || [];
  if (miniIsOff() && MINI_MUT[name]) {
    var q = miniQ(); q.push({ n: name, a: args, t: Date.now() }); miniQSet(q);
    toast('آفلاین هستی؛ ثبت شد و بعداً همگام می‌شود');
    return Promise.resolve({ ok: true, offline: true });
  }
  return new Promise(function (res, rej) {
    var r = google.script.run
      .withSuccessHandler(function (v) { miniOff(); res(v); })
      .withFailureHandler(function (e) {
        var m = (e && e.message) ? e.message : String(e);
        if (MINI_MUT[name] && /network|fetch|timeout|failed|connection|internet|http|شبکه|اتصال/i.test(m)) {
          var q2 = miniQ(); q2.push({ n: name, a: args, t: Date.now() }); miniQSet(q2);
          toast('اتصال قطع است؛ ثبت شد و بعداً همگام می‌شود');
          res({ ok: true, offline: true });
          return;
        }
        rej(new Error(m));
      });
    var fn = r[name];
    if (typeof fn !== 'function') { rej(new Error('تابع سرور پیدا نشد: ' + name)); return; }
    fn.apply(r, args || []);
  });
}
function buzz(kind) { try { if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred(kind || 'light'); } catch (e) {} }
function toast(t) {
  var el = document.getElementById('toast');
  el.textContent = t; el.classList.add('on');
  setTimeout(function () { el.classList.remove('on'); }, 2200);
}
function sheet(html) {
  document.getElementById('sheet').innerHTML = html;
  document.getElementById('sheetWrap').classList.add('on');
  var c = document.getElementById('sClose');
  if (c) c.onclick = closeSheet;
}
function closeSheet() { document.getElementById('sheetWrap').classList.remove('on'); }
function go(v) { S.view = v; buzz(); render(); window.scrollTo(0, 0); }

/* ---------------- احراز هویت ---------------- */
function boot() {
  if (TG) {
    try {
      TG.ready(); TG.expand();
      if (TG.setHeaderColor) TG.setHeaderColor('#050908');
      if (TG.setBackgroundColor) TG.setBackgroundColor('#050908');
      if (TG.disableVerticalSwipes) TG.disableVerticalSwipes();
    } catch (e) {}
    if (TG.BackButton) {
      try {
        TG.BackButton.onClick(function () {
          if (document.getElementById('sheetWrap').classList.contains('on')) closeSheet();
          else if (S.view !== 'home') go('home');
          else TG.close();
        });
      } catch (e) {}
    }
  }
  if (MINI_KEY) {
    /* اگر نشست قبلی هست، فوراً همان را نشان بده و پشت صحنه تازه‌سازی کن */
    var cachedTok = '';
    try { cachedTok = localStorage.getItem('sfmini_token') || ''; } catch (e) {}
    if (cachedTok) { S.token = cachedTok; load(); }
    srv('sfMiniAuthKey', [MINI_KEY]).then(function (r) {
      S.chat = r.chatId || '';
      if (r.token) { S.token = r.token; saveToken(S.token); load(); }
      else if (!cachedTok) linkView(r);
    }).catch(function (e) { if (!cachedTok) loginView(e.message); });
    return;
  }
  var cached = '';
  try { cached = localStorage.getItem('sfmini_token') || ''; } catch (e) {}
  if (cached) { S.token = cached; load(); return; }
  if (TG && TG.initData) telegramAuth(); else loginView('برای ورود، مینی‌اپ را از داخل گفتگوی ربات باز کن.');
}
function saveToken(t) { try { localStorage.setItem('sfmini_token', t); } catch (e) {} }
function dropToken() { try { localStorage.removeItem('sfmini_token'); } catch (e) {} }
/* اتصال آیدی تلگرام به حساب واردشده */
function linkWith() {
  if (MINI_KEY) return srv('sfMiniLinkKey', [S.token, MINI_KEY]);
  if (TG && TG.initData) return srv('sfMiniLink', [S.token, TG.initData]);
  return Promise.reject(new Error('اتصال خودکار فقط از داخل ربات ممکن است. در ربات /app را بزن.'));
}

function telegramAuth() {
  srv('sfMiniAuth', [TG.initData]).then(function (r) {
    S.chat = r.chatId || '';
    S.tgName = r.name || '';
    if (r.token) { S.token = r.token; saveToken(S.token); load(); }
    else linkView(r);
  }).catch(function (e) { loginView(e.message); });
}

function linkView(r) {
  ME = '';
  document.getElementById('uname').textContent = r.name || 'کاربر تلگرام';
  document.getElementById('usub').textContent = 'حسابت به اپ وصل نیست';
  document.getElementById('streak').innerHTML = '<b>' + fa(r.chatId || '') + '</b>آیدی تلگرام';
  document.getElementById('main').innerHTML =
    '<div class="card"><div class="sec" style="margin-top:0">اتصال به حساب</div>' +
    '<p class="hint">آیدی عددی تلگرام تو: <b style="direction:ltr;display:inline-block">' + fa(r.chatId) + '</b></p>' +
    '<p class="hint">با نام کاربری و رمز اپ وارد شو تا این آیدی به حسابت وصل شود و یادآورها و برنامه‌ها را در تلگرام بگیری.</p>' +
    '<input class="inp" id="lu" placeholder="نام کاربری" dir="ltr" autocapitalize="none">' +
    '<input class="inp" id="lp" type="password" placeholder="رمز عبور">' +
    '<button class="btn" id="lb">ورود و اتصال خودکار</button></div>';
  document.getElementById('lb').onclick = function () {
    var u = document.getElementById('lu').value.trim(), p = document.getElementById('lp').value;
    if (!u || !p) { toast('نام کاربری و رمز را بنویس'); return; }
    srv('login', [u, p]).then(function (res) {
      if (!res || !res.token) { toast('ورود ناموفق بود'); return; }
      S.token = res.token;
      return linkWith().then(function () {
        saveToken(S.token);
        toast('حساب وصل شد ✅');
        load();
      });
    }).catch(function (e) { toast(e.message); });
  };
}

function loginView(msg) {
  document.getElementById('usub').textContent = 'ورود به اپ';
  document.getElementById('main').innerHTML =
    '<div class="card"><div class="sec" style="margin-top:0">ورود</div>' +
    '<p class="hint">' + esc(msg || '') + '</p>' +
    '<input class="inp" id="lu" placeholder="نام کاربری" dir="ltr" autocapitalize="none">' +
    '<input class="inp" id="lp" type="password" placeholder="رمز عبور">' +
    '<button class="btn" id="lb">ورود</button></div>';
  document.getElementById('lb').onclick = function () {
    var u = document.getElementById('lu').value.trim(), p = document.getElementById('lp').value;
    srv('login', [u, p]).then(function (r) {
      if (r && r.token) { S.token = r.token; saveToken(S.token); load(); } else toast('ورود ناموفق بود');
    }).catch(function (e) { toast(e.message); });
  };
}

/* ---------------- داده ---------------- */
function load() {
  /* نمایش فوری از کش (سرعت باز شدن) و بعد تازه‌سازی از سرور */
  var ck = 'sfmini_c_' + String(S.token || '').slice(-8);
  if (!S.data) {
    try {
      var raw = localStorage.getItem(ck);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && o.d) { S.data = o.d; ME = (o.d.user && o.d.user.username) || ''; render(); }
      }
    } catch (e) {}
  }
  /* نسخهٔ سبک مخصوص مینی‌اپ؛ اگر در دسترس نبود به getBootstrap برمی‌گردیم */
  var req = srv('getMiniBootstrap', [S.token, todayISO()]).catch(function (e) {
    var m = String((e && e.message) || e);
    if (/not a function|is not a function|ناشناخته|unknown/i.test(m)) return srv('getBootstrap', [S.token, todayISO()]);
    throw e;
  });
  req.then(function (d) {
    S.data = d;
    ME = (d.user && d.user.username) || '';
    try {
      var keys = ['sfmini_c_' + String(S.token || '').slice(-8)];
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('sfmini_c_') === 0 && keys.indexOf(k) < 0) { try { localStorage.removeItem(k); } catch (e) {} } });
      localStorage.setItem(ck, JSON.stringify({ t: Date.now(), d: d }));
    } catch (e) {}
    render();
  }).catch(function (e) {
    var msg = e && e.message ? e.message : String(e);
    if (S.token && /نشست|سشن|token|session|وارد شو|login/i.test(msg)) {
      S.token = ''; dropToken();
      loginView('نشست منقضی شد. دوباره وارد شو.');
      return;
    }
    document.getElementById('main').innerHTML = '<div class="card"><div class="empty">' + esc(msg) + '</div><button class="btn g" id="retry">تلاش دوباره</button></div>';
    var b = document.getElementById('retry');
    if (b) b.onclick = function () { S.token ? load() : boot(); };
  });
}
function D() { return S.data || {}; }
function prof() { return D().profile || {}; }
function firstWorkout() { var a = D().workouts || []; return a.length ? a[0] : null; }
function firstDiet() { var a = D().diets || []; return a.length ? a[0] : null; }
function firstSupp() { var a = D().supplements || []; return a.length ? a[0] : null; }
function mealToday() { var m = D().meals || {}; return (m.days || {})[todayISO()] || { kcal: 0, protein: 0, carbs: 0, fat: 0 }; }
function doneSet() {
  var d = D().doneToday, out = {};
  if (Array.isArray(d)) d.forEach(function (k) { out[k] = 1; });
  else if (d && typeof d === 'object') Object.keys(d).forEach(function (k) { if (d[k]) out[k] = 1; });
  return out;
}

/* ---------------- رندر ---------------- */
/* انیمیشن دو فریم حرکت: شروع/پایان، بدون وابستگی به انیمیشن CSS */
function sfFlipStart() {
  try {
    var list = document.querySelectorAll(".exm.flip img.alt");
    for (var i = 0; i < list.length; i++) {
      var im = list[i];
      if (im.getAttribute("data-fl")) continue;
      im.setAttribute("data-fl", "1");
      (function (el) {
        var on = false;
        setInterval(function () {
          on = !on;
          el.style.opacity = on ? "1" : "0";
        }, 620);
      })(im);
    }
  } catch (e) {}
}
function render() {
  var p = prof(), u = D().user || {};
  var name = p.name || p.fullName || u.username || S.tgName || 'دوست من';
  document.getElementById('uname').textContent = name;
  document.getElementById('usub').textContent = 'برنامهٔ شخصی ' + (S.view === 'home' ? 'تو' : '—');
  var st = Number(D().streak || 0);
  document.getElementById('streak').innerHTML = '<b>' + fa(st) + '</b>روز پیوسته';
  var el = document.getElementById('main');
  if (S.view === 'home') el.innerHTML = viewHome();
  else if (S.view === 'workout') el.innerHTML = viewWorkout();
  else if (S.view === 'diet') el.innerHTML = viewDiet();
  else if (S.view === 'supp') el.innerHTML = viewSupp();
  else el.innerHTML = viewReport();
  var nav = document.querySelectorAll('#nav button');
  for (var i = 0; i < nav.length; i++) nav[i].className = (nav[i].getAttribute('data-v') === S.view) ? 'on' : '';
  el.querySelectorAll('[data-act]').forEach(function (b) {
    b.onclick = function () { act(b.getAttribute('data-act'), b.getAttribute('data-arg')); };
  });
  el.querySelectorAll('.exm[data-gif]').forEach(function (m) {
    m.onclick = function () { openExMedia(m); };
  });
  sfFlipStart();
  el.querySelectorAll('img[data-alt]').forEach(function (im) {
    im.onerror = function () {
      var a = im.getAttribute('data-alt');
      if (a) { im.removeAttribute('data-alt'); im.src = a; }
      else { im.style.display = 'none'; }
    };
  });
}

function ringHtml(pct, val, lbl, colorA) {
  var p = Math.max(0, Math.min(100, Math.round(pct * 100)));
  var bg = 'conic-gradient(' + (colorA || '#5be25b') + ' 0% ' + p + '%, rgba(255,255,255,.16) ' + p + '% 100%)';
  return '<div class="ring" style="background:' + bg + '"><div class="ringIn"><b>' + fa(val) + '</b><small>' + esc(lbl) + '</small></div></div>';
}
function bar(label, val, target, cls) {
  var pct = target ? Math.min(100, Math.round((Number(val || 0) / Number(target)) * 100)) : 0;
  return '<div class="macro"><div class="mTop"><span>' + label + '</span><span><b>' + fa(Math.round(val || 0)) + '</b> / ' + fa(Math.round(target || 0)) + ' گرم</span></div>' +
    '<div class="bar ' + (cls || '') + '"><i style="width:' + pct + '%"></i></div></div>';
}

function viewHome() {
  var p = prof(), m = mealToday(), w = D().water || { glasses: 0, goal: 8 };
  var target = Number(p.targetCalories || p.calories || 0);
  var h = '<div class="card"><div class="hero">' +
    ringHtml(target ? m.kcal / target : 0, Math.round(m.kcal || 0), 'از ' + fa(target) + ' کالری') +
    '<div class="macros">' + bar('پروتئین', m.protein, p.targetProtein, 'p') + bar('کربوهیدرات', m.carbs, p.targetCarbs, 'c') + bar('چربی', m.fat, p.targetFat, 'f') + '</div>' +
    '</div></div>';
  h += '<div class="grid">' +
    '<button class="tile" data-act="water"><span class="ic">💧</span><b>ثبت آب</b><small>' + fa(w.glasses) + ' از ' + fa(w.goal) + ' لیوان</small></button>' +
    '<button class="tile" data-act="weight"><span class="ic">⚖️</span><b>ثبت وزن</b><small>وزن امروز</small></button>' +
    '<button class="tile" data-act="food"><span class="ic">🍽️</span><b>ثبت غذا</b><small>کالری وعده</small></button>' +
    '<button class="tile" data-act="rem"><span class="ic">⏰</span><b>یادآورها</b><small>تلگرام</small></button>' +
    '<button class="tile" data-act="coach"><span class="ic">✉️</span><b>پیام به مربی</b><small>سؤال و گزارش</small></button>' +
    '<button class="tile" data-act="checkin"><span class="ic">📝</span><b>چک‌این</b><small>گزارش هفتگی</small></button>' +
    '</div>';
  var plan = firstWorkout();
  h += '<div class="sec">تمرین امروز<button class="more" data-act="go" data-arg="workout">همهٔ برنامه</button></div>';
  if (!plan || !(plan.days || []).length) {
    h += '<div class="card"><div class="empty">هنوز برنامهٔ تمرینی برایت ثبت نشده.<br>از مربی بخواه برنامه‌ات را ثبت کند.</div></div>';
  } else {
    var day = (plan.days || [])[0] || {};
    h += '<div class="card"><div class="row" style="border:0;padding:0 0 8px"><div class="t"><b>' + esc(plan.name || 'برنامه') + '</b><small>' + esc(day.title || '') + '</small></div>' +
      '<span class="badge">' + fa((day.exercises || []).length) + ' حرکت</span></div>';
    (day.exercises || []).slice(0, 4).forEach(function (ex) {
      h += '<div class="row"><div class="t"><b>' + esc(ex.name) + '</b><small>' + esc([ex.sets ? fa(ex.sets) + ' ست' : '', ex.reps ? repsFa(ex.reps) : ''].filter(Boolean).join(' × ')) + '</small></div></div>';
    });
    h += '</div>';
  }
  var rem = (D().reminders || {}).items || [];
  h += '<div class="sec">یادآور بعدی</div>';
  h += '<div class="card">' + (rem.length
    ? '<div class="row" style="border:0;padding:0"><div class="t"><b>' + esc(rem[0].time || '') + '</b><small>' + esc(remLabel(rem[0].type)) + '</small></div><span class="pill">' + (rem[0].on === false ? 'خاموش' : 'فعال') + '</span></div>'
    : '<div class="empty">یادآوری نداری — از دکمهٔ «یادآورها» بساز.</div>') + '</div>';
  return h;
}

function remLabel(t) {
  var map = { workout: 'یادآور تمرین', water: 'یادآور آب', meal: 'یادآور وعدهٔ غذایی', weight: 'یادآور وزن', pill: 'یادآور قرص / مکمل', supplement: 'یادآور مکمل', nutrition: 'یادآور تغذیه' };
  return map[t] || 'یادآور';
}

function repsFa(r) {
  var s = String(r == null ? '' : r).trim();
  if (!s) return '';
  if (s.indexOf('+') >= 0) return s.replace(/\\s*\\+\\s*/g, ' + ') + ' (سوپرست)';
  return s + ' تکرار';
}

function exMedia(ex) {
  ex = ex || {};
  var b = ex.bank || {};
  var gifs = (b.gif && b.gif.length) ? b.gif.slice() : ((ex.gif && ex.gif.length) ? ex.gif.slice() : []);
  var frames = [];
  ((b.frames && b.frames.length) ? b.frames : ((ex.frames && ex.frames.length) ? ex.frames : [])).forEach(function (f) {
    var u = Array.isArray(f) ? f[0] : f;
    if (u) frames.push(u);
  });
  var meta = [ex.sets ? fa(ex.sets) + ' ست' : '', ex.reps ? repsFa(ex.reps) : '', ex.rest ? 'استراحت ' + fa(ex.rest) : ''].filter(Boolean).join(' · ');
  var a = gifs[0] || frames[0] || '', c = gifs[1] || frames[1] || '';
  if (!a) return '';
  var isGif = !!gifs.length;
  if (!isGif && c) {
    return '<div class="exm flip" data-gif="' + esc(a) + '" data-gif2="' + esc(c) + '" data-nm="' + esc(ex.name || '') + '" data-mt="' + esc(meta) + '">' +
      '<img src="' + esc(a) + '" alt="" loading="eager" referrerpolicy="no-referrer">' +
      '<img class="alt" src="' + esc(c) + '" alt="" loading="eager" referrerpolicy="no-referrer">' +
      '<span class="exmtag">حرکت متحرک</span></div>';
  }
  return '<div class="exm" data-gif="' + esc(a) + '" data-gif2="' + esc(c) + '" data-nm="' + esc(ex.name || '') + '" data-mt="' + esc(meta) + '">' +
    '<img src="' + esc(a) + '" data-alt="' + esc(c) + '" alt="" loading="eager" referrerpolicy="no-referrer">' +
    '<span class="exmtag">حرکت متحرک</span></div>';
}

/* نمایش بزرگ حرکت: گیف واقعی، یا انیمیشن دو فریم (شروع/پایان) */
function openExMedia(el) {
  var a = el.getAttribute('data-gif') || '', b = el.getAttribute('data-gif2') || '';
  var nm = el.getAttribute('data-nm') || '', mt = el.getAttribute('data-mt') || '';
  if (!a) return;
  buzz();
  var isGif = /\\.gif(\\?|$)/i.test(a);
  var body = isGif
    ? ('<div class="exm big"><img src="' + esc(a) + '" alt="" referrerpolicy="no-referrer"></div>' +
       (b ? '<div class="exm big" style="margin-top:10px"><img src="' + esc(b) + '" alt="" referrerpolicy="no-referrer"></div>' : ''))
    : ('<div class="exm big flip"><img src="' + esc(a) + '" alt="" referrerpolicy="no-referrer">' +
       (b ? '<img class="alt" src="' + esc(b) + '" alt="" referrerpolicy="no-referrer">' : '') + '</div>');
  sheet('<button class="close" id="sClose">✕</button><h3>حرکت ' + esc(nm || 'ورزشی') + '</h3>' +
    (mt ? '<div class="hint">' + esc(mt) + '</div>' : '') + body +
    '<div class="hint" style="text-align:center">برای بستن، ✕ را بزن.</div>');
}

function viewWorkout() {
  var plan = firstWorkout();
  if (!plan || !(plan.days || []).length) return '<div class="card"><div class="empty">برنامهٔ تمرینی ثبت نشده است.</div></div>';
  var done = doneSet(), h = '';
  (plan.days || []).forEach(function (day, di) {
    h += '<div class="sec">' + esc(day.title || ('روز ' + fa(di + 1))) + '</div><div class="card">';
    var exs = day.exercises || [];
    if (!exs.length) h += '<div class="empty">روز استراحت</div>';
    exs.forEach(function (ex, xi) {
      var key = (plan.name || '') + '|' + di + '|' + xi;
      var isDone = !!done[key];
      h += exMedia(ex);
      h += '<div class="row"><div class="t"><b>' + esc(ex.name) + '</b><small>' +
        esc([ex.sets ? fa(ex.sets) + ' ست' : '', ex.reps ? repsFa(ex.reps) : '', ex.rest ? 'استراحت ' + fa(ex.rest) : ''].filter(Boolean).join(' × ')) +
        (ex.notes ? '<br>' + esc(ex.notes) : '') + '</small></div>' +
        '<button class="pill ' + (isDone ? 'done' : 'gray') + '" data-act="done" data-arg="' + esc(key) + '">' + (isDone ? 'انجام شد ✓' : 'تیک') + '</button></div>';
    });
    h += '</div>';
  });
  return h;
}

function viewDiet() {
  var plan = firstDiet();
  if (!plan || !(plan.sections || []).length) return '<div class="card"><div class="empty">برنامهٔ غذایی ثبت نشده است.</div></div>';
  var h = '<div class="sec">' + esc(plan.name || 'برنامهٔ غذایی') + '</div>';
  (plan.sections || []).forEach(function (s) {
    var tip = String(s.title || '').indexOf('توصیه') >= 0;
    h += '<div class="card"' + (tip ? ' style="border-color:rgba(255,209,102,.35)"' : '') + '>' +
      '<div class="row" style="border:0;padding:0 0 6px"><div class="t"><b>' + (tip ? '💡 ' : '') + esc(s.title || '') + '</b></div></div>';
    (s.items || []).forEach(function (it) {
      var mac = '';
      if (it.protein != null || it.carbs != null || it.fat != null) {
        mac = '<div class="mac">' +
          '<span class="p">پروتئین ' + fa(it.protein || 0) + 'گ</span>' +
          '<span class="c">کربو ' + fa(it.carbs || 0) + 'گ</span>' +
          '<span class="f">چربی ' + fa(it.fat || 0) + 'گ</span>' +
          (it.kcal ? '<span>' + fa(it.kcal) + ' کالری</span>' : '') +
          '</div>';
      }
      h += '<div class="row"><div class="t"><b>' + esc(it.title || '') + '</b>' + (it.description ? '<small>' + esc(it.description) + '</small>' : '') + mac + '</div>' +
        (it.kcal && !mac ? '<span class="pill gray">' + fa(it.kcal) + ' کالری</span>' : '') + '</div>';
    });
    h += '</div>';
  });
  return h;
}

function viewSupp() {
  var plan = firstSupp();
  if (!plan) return '<div class="card"><div class="empty">برنامهٔ مکمل ثبت نشده است.</div></div>';
  var h = '<div class="sec">' + esc(plan.name || 'مکمل‌ها') + '</div>';
  (plan.schedule || []).forEach(function (g) {
    h += '<div class="card"><div class="row" style="border:0;padding:0 0 6px"><div class="t"><b>🕐 ' + esc(g.timing || '') + '</b></div></div>';
    (g.items || []).forEach(function (nm) { h += '<div class="row"><div class="t"><b>' + esc(nm) + '</b></div></div>'; });
    h += '</div>';
  });
  (plan.groups || []).forEach(function (g) {
    h += '<div class="card"><div class="row" style="border:0;padding:0 0 6px"><div class="t"><b>' + esc(g.title || 'مکمل‌های دیگر') + '</b></div></div>';
    (g.items || []).forEach(function (it) {
      h += '<div class="row"><div class="t"><b>' + esc(it.name) + '</b><small>' + esc((it.timings || []).join('، ')) + '</small></div></div>';
    });
    h += '</div>';
  });
  if (!(plan.schedule || []).length && !(plan.groups || []).length) {
    (plan.items || []).forEach(function (it) {
      h += '<div class="card"><div class="row" style="border:0;padding:0"><div class="t"><b>' + esc(it.name) + '</b><small>' + esc([it.dosage, it.timing, it.instructions].filter(Boolean).join(' — ')) + '</small></div></div></div>';
    });
  }
  return h;
}

function viewReport() {
  var p = prof(), logs = (D().logs || []).slice(), m = mealToday(), w = D().water || { glasses: 0, goal: 8 };
  var last = null, prev = null;
  logs.forEach(function (l) { if (l && Number(l.weight) > 0) { if (!last) last = l; else if (!prev) prev = l; } });
  var diff = (last && prev) ? (Number(last.weight) - Number(prev.weight)) : 0;
  var h = '<div class="sec">وزن و پیشرفت</div><div class="card">';
  h += '<div class="row"><div class="t"><b>وزن فعلی</b><small>' + (last ? esc(last.date || '') : 'ثبت نشده') + '</small></div><span class="pill">' + (last ? fa(last.weight) + ' کیلو' : '—') + '</span></div>';
  h += '<div class="row"><div class="t"><b>وزن هدف</b><small>هدف تعیین‌شده</small></div><span class="pill gray">' + (p.goalWeight ? fa(p.goalWeight) + ' کیلو' : '—') + '</span></div>';
  h += '<div class="row"><div class="t"><b>تغییر نسبت به ثبت قبل</b><small>' + (diff < 0 ? 'کاهش' : diff > 0 ? 'افزایش' : 'بدون تغییر') + '</small></div><span class="pill ' + (diff < 0 ? '' : diff > 0 ? 'warn' : 'gray') + '">' + (diff > 0 ? '+' : '') + fa(Math.round(diff * 10) / 10) + '</span></div>';
  h += '</div>';
  h += '<div class="sec">امروز</div><div class="card">';
  h += '<div class="row"><div class="t"><b>کالری</b><small>پروتئین ' + fa(m.protein) + ' · کربو ' + fa(m.carbs) + ' · چربی ' + fa(m.fat) + '</small></div><span class="pill">' + fa(m.kcal) + '</span></div>';
  h += '<div class="row"><div class="t"><b>آب</b><small>هدف ' + fa(w.goal) + ' لیوان</small></div><span class="pill ' + (w.glasses >= w.goal ? '' : 'gray') + '">' + fa(w.glasses) + ' لیوان</span></div>';
  h += '<div class="row"><div class="t"><b>استریک</b><small>روزهای پیوستهٔ تمرین</small></div><span class="pill">' + fa(D().streak || 0) + ' روز</span></div>';
  h += '</div>';
  var rem = (D().reminders || {}).items || [];
  h += '<div class="sec">یادآورها<button class="more" data-act="rem">مدیریت</button></div><div class="card">';
  if (!rem.length) h += '<div class="empty">یادآوری نداری.</div>';
  else rem.forEach(function (it, i) {
    h += '<div class="row"><div class="t"><b>' + esc(it.time || '') + '</b><small>' + esc(remLabel(it.type)) + (it.label ? ' — ' + esc(it.label) : '') + '</small></div>' +
      '<span class="pill ' + (it.on === false ? 'gray' : '') + '">' + (it.on === false ? 'خاموش' : 'فعال') + '</span></div>';
  });
  h += '</div>';
  h += '<div class="card"><div class="sec" style="margin-top:0">اتصال تلگرام</div>' +
    '<div class="row" style="border:0"><div class="t"><b>' + (S.chat ? 'وصل ✅' : 'وصل نیست') + '</b><small>' + (S.chat ? 'آیدی: ' + fa(S.chat) : 'برای گرفتن یادآور در تلگرام وصل کن') + '</small></div></div>' +
    (S.chat ? '' : '<button class="btn g" data-act="linktg">اتصال خودکار به تلگرام</button>') + '</div>';
  return h;
}

/* ---------------- کنش‌ها ---------------- */
function act(a, arg) {
  buzz();
  if (a === 'go') { go(arg); return; }
  if (a === 'water') { openWaterSheet(); return; }
  if (a === 'weight') {
    sheet('<button class="close" id="sClose">✕</button><h3>ثبت وزن</h3><p class="hint">وزن امروزت را به کیلوگرم بنویس.</p>' +
      '<input class="inp" id="wv" inputmode="decimal" placeholder="مثلاً 82.5" dir="ltr">' +
      '<button class="btn" id="wOk">ثبت وزن</button>');
    document.getElementById('wOk').onclick = function () {
      var v = parseFloat(String(document.getElementById('wv').value).replace(/[^0-9.]/g, ''));
      if (!v || v < 25 || v > 300) { toast('عدد وزن درست نیست'); return; }
      srv('saveLog', [S.token, { date: todayISO(), weight: v }]).then(function () {
        closeSheet(); toast('وزن ثبت شد ✅'); load();
      }).catch(function (e) { toast(e.message); });
    };
    return;
  }
  if (a === 'food') { openFoodSheet(); return; }
  if (a === 'rem') {
    var items = ((D().reminders || {}).items || []).slice();
    openRemSheet(items);
    return;
  }
  if (a === 'coach') {
    sheet('<button class="close" id="sClose">✕</button><h3>پیام به مربی</h3><p class="hint">سؤال، گزارش تمرین یا هر نکته‌ای.</p>' +
      '<textarea class="inp" id="cm" rows="4" placeholder="متن پیام…"></textarea>' +
      '<button class="btn" id="cOk">ارسال برای مربی</button>');
    document.getElementById('cOk').onclick = function () {
      var t = document.getElementById('cm').value.trim();
      if (!t) { toast('متن پیام خالی است'); return; }
      closeSheet(); toast('پیام در حال ارسال…');
      srv('sendMessage', [S.token, ME, t]).then(function () {
        toast('پیام برای مربی ارسال شد ✅');
      }).catch(function (e) { toast(e.message); });
    };
    return;
  }
  if (a === 'checkin') {
    sheet('<button class="close" id="sClose">✕</button><h3>چک‌این هفتگی</h3><p class="hint">از ۱ تا ۵ به خودت امتیاز بده.</p>' +
      '<select id="c1"><option value="5">انرژی: عالی</option><option value="4">انرژی: خوب</option><option value="3" selected>انرژی: متوسط</option><option value="2">انرژی: کم</option><option value="1">انرژی: خیلی کم</option></select>' +
      '<select id="c2"><option value="5">خواب: عالی</option><option value="4">خواب: خوب</option><option value="3" selected>خواب: متوسط</option><option value="2">خواب: کم</option><option value="1">خواب: خیلی کم</option></select>' +
      '<select id="c3"><option value="5">رژیم: کامل</option><option value="4">رژیم: خوب</option><option value="3" selected>رژیم: متوسط</option><option value="2">رژیم: ضعیف</option><option value="1">رژیم: خیلی ضعیف</option></select>' +
      '<select id="c4"><option value="5">خستگی: خیلی کم</option><option value="4">خستگی: کم</option><option value="3" selected>خستگی: متوسط</option><option value="2">خستگی: زیاد</option><option value="1">خستگی: خیلی زیاد</option></select>' +
      '<input class="inp" id="c5" placeholder="توضیح (اختیاری)">' +
      '<button class="btn" id="ciOk">ارسال چک‌این</button>');
    document.getElementById('ciOk').onclick = function () {
      var v = ['c1', 'c2', 'c3', 'c4'].map(function (id) { return document.getElementById(id).value; });
      var note = document.getElementById('c5').value.trim();
      var txt = 'چک‌این هفتگی\nانرژی: ' + v[0] + '/5 · خواب: ' + v[1] + '/5 · رژیم: ' + v[2] + '/5 · خستگی: ' + v[3] + '/5' + (note ? '\nتوضیح: ' + note : '');
      srv('sendMessage', [S.token, ME, txt]).then(function () {
        closeSheet(); toast('چک‌این ارسال شد ✅');
      }).catch(function (e) { toast(e.message); });
    };
    return;
  }
  if (a === 'done') {
    var key = String(arg || '');
    var isDone = !!doneSet()[key];
    srv('setExerciseDone', [S.token, key, !isDone, todayISO()]).then(function () {
      toast(isDone ? 'تیک برداشته شد' : 'تمرین ثبت شد ✅'); load();
    }).catch(function (e) { toast(e.message); });
    return;
  }
  if (a === 'linktg') {
    if (!MINI_KEY && !(TG && TG.initData)) { toast('این کار فقط از داخل ربات ممکن است. در ربات /app را بزن.'); return; }
    linkWith().then(function (r) {
      S.chat = r.chatId; toast('تلگرام وصل شد ✅'); render();
    }).catch(function (e) { toast(e.message); });
    return;
  }
}

/* ---------------- آب: پنل + و − گرافیکی ---------------- */
function openWaterSheet() {
  var w = D().water || { glasses: 0, goal: 8 };
  var val = Number(w.glasses) || 0, goal = Number(w.goal) || 8;
  var pending = 0, timer = null;
  function paint() {
    var pct = Math.min(100, Math.round(val / Math.max(1, goal) * 100));
    var v = document.getElementById('wVal'); if (v) v.textContent = fa(val);
    var b = document.getElementById('wBar'); if (b) b.style.width = pct + '%';
    var s = document.getElementById('wSub'); if (s) s.textContent = 'از ' + fa(goal) + ' لیوان · ' + fa(pct) + '٪';
  }
  sheet('<button class="close" id="sClose">✕</button><h3>💧 آب امروز</h3>' +
    '<div class="wsheet"><div class="wrow">' +
    '<button class="wbtn minus" id="wMinus" aria-label="کم کردن">−</button>' +
    '<div class="wnum"><b id="wVal">' + fa(val) + '</b><small id="wSub">از ' + fa(goal) + ' لیوان</small></div>' +
    '<button class="wbtn" id="wPlus" aria-label="افزودن">+</button></div>' +
    '<div class="wbar"><i id="wBar"></i></div>' +
    '<div class="hint">هر لیوان ۲۵۰ میلی‌لیتر است. با هر بار زدن همان لحظه ثبت می‌شود.</div>' +
    '</div>');
  paint();
  function push(d) {
    var next = Math.max(0, val + d);
    if (next === val) return;
    val = next; paint(); buzz();
    pending += d;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      var d2 = pending; pending = 0;
      srv('addWater', [S.token, d2, todayISO()]).then(function (r) {
        if (r && r.water) {
          if (D().water) D().water = r.water; else S.data.water = r.water;
          val = Number(r.water.glasses) || val; paint(); render();
        }
      }).catch(function (e) { toast(e.message); });
    }, 320);
  }
  document.getElementById('wPlus').onclick = function () { push(1); };
  document.getElementById('wMinus').onclick = function () { push(-1); };
}

/* ---------------- غذا: لیست غذاهای برنامه + ثبت با یک لمس ---------------- */
function planFoods() {
  var out = [], seen = {};
  (D().diets || []).forEach(function (p) {
    (p.sections || []).forEach(function (s) {
      (s.items || []).forEach(function (it) {
        var t = String(it.title || '').trim();
        if (!t || seen[t.toLowerCase()]) return;
        seen[t.toLowerCase()] = 1;
        out.push({ t: t, k: Number(it.kcal) || 0, p: Number(it.protein) || 0, c: Number(it.carbs) || 0, f: Number(it.fat) || 0 });
      });
    });
  });
  return out;
}

function openFoodSheet() {
  var foods = planFoods();
  sheet('<button class="close" id="sClose">✕</button><h3>🍽️ ثبت غذا</h3>' +
    '<input class="inp" id="fq" placeholder="جست‌وجو در غذاهای برنامه…">' +
    '<div id="fList"></div>' +
    '<div class="sec">غذا در لیست نیست؟</div>' +
    '<button class="btn g" id="fManual">ثبت دستی با کالری و ماکرو</button>');

  function draw(q) {
    q = String(q || '').trim().toLowerCase();
    var el = document.getElementById('fList');
    if (!foods.length) { el.innerHTML = '<div class="empty">برنامهٔ غذایی نداری. با «ثبت دستی» اضافه کن.</div>'; return; }
    var list = foods.filter(function (x) { return !q || x.t.toLowerCase().indexOf(q) >= 0; }).slice(0, 40);
    el.innerHTML = list.length ? list.map(function (x) {
      var mac = [];
      if (x.p) mac.push('پروتئین ' + fa(x.p) + 'گ');
      if (x.c) mac.push('کربو ' + fa(x.c) + 'گ');
      if (x.f) mac.push('چربی ' + fa(x.f) + 'گ');
      return '<div class="foodItem" data-fi="' + foods.indexOf(x) + '"><div class="t"><b>' + esc(x.t) + '</b><small>' +
        (mac.join(' · ') || 'بدون ماکرو') + '</small></div><span class="pill">' + (x.k ? fa(x.k) + ' کالری' : '+') + '</span></div>';
    }).join('') : '<div class="empty">چیزی پیدا نشد</div>';
    el.querySelectorAll('[data-fi]').forEach(function (n) {
      n.onclick = function () {
        var x = foods[Number(n.getAttribute('data-fi'))];
        if (!x) return;
        buzz();
        srv('logMeal', [S.token, { title: x.t, kcal: x.k, protein: x.p, carbs: x.c, fat: x.f }, todayISO()]).then(function () {
          closeSheet(); toast('«' + x.t + '» ثبت شد ✅'); load();
        }).catch(function (e) { toast(e.message); });
      };
    });
  }
  draw('');
  document.getElementById('fq').oninput = function () { draw(this.value); };
  document.getElementById('fManual').onclick = openManualFood;
}

function openManualFood() {
  sheet('<button class="close" id="sClose">✕</button><h3>ثبت دستی غذا</h3><p class="hint">اسم خوراکی و کالری/ماکروها را بنویس.</p>' +
    '<input class="inp" id="fn" placeholder="مثلاً نان و پنیر و گردو">' +
    '<input class="inp" id="fk" inputmode="numeric" placeholder="کالری" dir="ltr">' +
    '<input class="inp" id="fp" inputmode="numeric" placeholder="پروتئین (گرم)" dir="ltr">' +
    '<input class="inp" id="fc" inputmode="numeric" placeholder="کربوهیدرات (گرم)" dir="ltr">' +
    '<input class="inp" id="ff" inputmode="numeric" placeholder="چربی (گرم)" dir="ltr">' +
    '<button class="btn" id="fOk">ثبت وعده</button>');
  document.getElementById('fOk').onclick = function () {
    var t = document.getElementById('fn').value.trim();
    var val = function (id) { return Math.round(parseFloat(String(document.getElementById(id).value).replace(/[^0-9]/g, '')) || 0); };
    var k = val('fk'), pr = val('fp'), cb = val('fc'), ft = val('ff');
    if (!t || (!k && !pr && !cb && !ft)) { toast('اسم و کالری یا ماکرو را بنویس'); return; }
    srv('logMeal', [S.token, { title: t, kcal: k, protein: pr, carbs: cb, fat: ft }, todayISO()]).then(function () {
      closeSheet(); toast('وعده ثبت شد ✅'); load();
    }).catch(function (e) { toast(e.message); });
  };
}

function openRemSheet(items) {
  var types = [['workout', 'تمرین'], ['water', 'آب'], ['meal', 'وعدهٔ غذایی'], ['weight', 'وزن'], ['pill', 'قرص / مکمل'], ['supplement', 'مکمل'], ['nutrition', 'تغذیه']];
  var opts = types.map(function (t) { return '<option value="' + t[0] + '">' + t[1] + '</option>'; }).join('');
  var list = items.map(function (it, i) {
    return '<div class="row"><div class="t"><b>' + esc(it.time || '') + '</b><small>' + esc(remLabel(it.type)) + (it.label ? ' — ' + esc(it.label) : '') + '</small></div>' +
      '<button class="pill ' + (it.on === false ? 'gray' : '') + '" data-rem="' + i + '">' + (it.on === false ? 'خاموش' : 'فعال') + '</button>' +
      '<button class="pill gray" data-del="' + i + '">حذف</button></div>';
  }).join('');
  sheet('<button class="close" id="sClose">✕</button><h3>یادآورها</h3>' +
    '<p class="hint">یادآورها هر دقیقه بررسی و در تلگرام برایت ارسال می‌شوند.</p>' +
    '<div id="remList">' + (list || '<div class="empty">یادآوری نداری.</div>') + '</div>' +
    '<div class="sec">یادآور جدید</div>' +
    '<select id="rt">' + opts + '</select>' +
    '<input class="inp" id="rTime" inputmode="numeric" placeholder="ساعت مثل 21:30" dir="ltr">' +
    '<input class="inp" id="rLabel" placeholder="متن دلخواه (اختیاری) مثلاً ویتامین D">' +
    '<button class="btn" id="rAdd">افزودن یادآور</button>');

  function save(next, msg) {
    srv('sfMiniSaveReminders', [S.token, next]).then(function () {
      closeSheet(); toast(msg); load();
    }).catch(function (e) { toast(e.message); });
  }
  document.getElementById('remList').querySelectorAll('[data-rem]').forEach(function (b) {
    b.onclick = function () {
      var i = Number(b.getAttribute('data-rem'));
      items[i].on = items[i].on === false;
      save(items, 'وضعیت یادآور تغییر کرد');
    };
  });
  document.getElementById('remList').querySelectorAll('[data-del]').forEach(function (b) {
    b.onclick = function () {
      items.splice(Number(b.getAttribute('data-del')), 1);
      save(items, 'یادآور حذف شد');
    };
  });
  document.getElementById('rAdd').onclick = function () {
    var t = document.getElementById('rTime').value.trim();
    var ty = document.getElementById('rt').value;
    var lb = document.getElementById('rLabel').value.trim();
    var m = t.match(/^([01]?\\d|2[0-3]):([0-5]\\d)$/);
    if (!m) { toast('ساعت را مثل 21:30 بنویس'); return; }
    var time = (m[1].length === 1 ? '0' + m[1] : m[1]) + ':' + m[2];
    if (items.length >= 12) { toast('حداکثر ۱۲ یادآور'); return; }
    items.push({ type: ty, time: time, on: true, label: lb });
    save(items, 'یادآور ساخته شد ✅');
  };
}

/* ---------------- رویدادها ---------------- */
document.getElementById('nav').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-v]');
  if (b) go(b.getAttribute('data-v'));
});
document.getElementById('sheetWrap').addEventListener('click', function (e) {
  if (e.target.id === 'sheetWrap') closeSheet();
});
boot();
window.addEventListener('online', function () { miniOff(); miniFlush(false); });
window.addEventListener('offline', function () { miniOff(); });
try { miniOff(); } catch (e) {}
</script>
</body>
</html>`;
}


/* ===== BEGIN SfApp3.gs (v3) ===== */
/**
 * SfApp3.gs — لایهٔ نسخهٔ ۳ (افزودنی و بدون دست‌زدن به شیت‌های موجود)
 *
 *   • انتخاب «برنامهٔ فعال» هر شاگرد (تمرین / تغذیه / مکمل)
 *   • اشتراک: وضعیت، روزهای باقی‌مانده، هشدار ۳ روز مانده به پایان
 *   • پرداخت کارت‌به‌کارت: شماره کارت + آپلود رسید + ارسال رسید به تلگرام ادمین
 *   • مدیریت پرداخت‌ها/پکیج‌ها/اشتراک‌ها برای مربی
 *   • حذف برنامه (برنامه‌ساز) و تمدید دستی اشتراک
 *
 * نصب: در Apps Script یک فایل Script جدید با نام SfApp3 بساز و این متن را کامل بچسبان.
 */

var SF3_SEL_PREFIX = 'ACTIVE_SEL_';

/* ---------- ابزارهای کوچک ---------- */
function sf3Truthy_(v) {
  var s = String(v == null ? '' : v).trim().toLowerCase();
  return !(s === '' || s === 'false' || s === '0' || s === 'no' || s === 'خیر');
}
function sf3AddDays_(iso, days) {
  var d = new Date(String(iso || todayISO_()) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + (Number(days) || 0));
  return d.toISOString().slice(0, 10);
}
function sf3SelKey_(username) { return SF3_SEL_PREFIX + String(username || '').toLowerCase(); }
function sf3ReadSel_(username) {
  var raw = '';
  try { raw = sfGetSetting_(sf3SelKey_(username)); } catch (e) { raw = ''; }
  var sel = {};
  try { sel = JSON.parse(raw || '{}') || {}; } catch (e) { sel = {}; }
  return sel;
}

/* ---------- ساخت شیت‌ها و مقادیر پیش‌فرض ---------- */
function sf3Ensure_() {
  try { sfEnsure_(); } catch (e) {}
  /* sfAppend_/sfRewrite_ برای شیت‌هایی که در SF_TEXT_COLS نیستند خطا می‌دهند؛
     اینجا با null (یعنی «همهٔ ستون‌ها متن») ثبتشان می‌کنیم. */
  try {
    if (typeof SF_TEXT_COLS !== 'undefined') {
      ['SF_Packages', 'SF_Subs', 'SF_Payments', 'SF_Coupons', 'SF_Settings'].forEach(function (n) {
        if (!(n in SF_TEXT_COLS)) SF_TEXT_COLS[n] = null;
      });
    }
  } catch (e) {}
  var ss = getSS_();
  var defs = [
    ['SF_Packages', SF_PACKAGES_HEADERS],
    ['SF_Subs', SF_SUBS_HEADERS],
    ['SF_Payments', SF_PAYMENTS_HEADERS],
    ['SF_Coupons', SF_COUPONS_HEADERS],
    ['SF_Settings', ['Key', 'Value']]
  ];
  defs.forEach(function (d) {
    try { ensureSheetWithHeaders_(ss, d[0], d[1]); } catch (e) {}
  });
  var pkgs = [];
  try { pkgs = sfObjects_(sfRead_('SF_Packages')); } catch (e) { pkgs = []; }
  if (!pkgs.length) {
    try {
      sfAppend_('SF_Packages', [
        { PackageID: 'P30', Name: 'اشتراک یک‌ماهه', Days: 30, Price: 1500000, Features: 'برنامه تمرین + تغذیه + مکمل', Badge: 'محبوب', Active: 'TRUE', Sort: '1' },
        { PackageID: 'P90', Name: 'اشتراک سه‌ماهه', Days: 90, Price: 3900000, Features: 'سه ماه پشتیبانی و بازبینی برنامه', Badge: 'اقتصادی', Active: 'TRUE', Sort: '2' }
      ]);
    } catch (e) {}
  }
  try {
    if (!sfGetSetting_('CARD_NUMBER')) sfSetSetting_('CARD_NUMBER', '');
    if (!sfGetSetting_('CARD_HOLDER')) sfSetSetting_('CARD_HOLDER', '');
  } catch (e) {}
  return true;
}

/* ---------- وضعیت تلگرام ---------- */
function sf3TgInfo_() {
  var token = '', chats = [];
  try { token = sfTgToken_() || ''; } catch (e) { token = ''; }
  try {
    var p = PropertiesService.getScriptProperties();
    var one = p.getProperty('COACH_TELEGRAM_CHAT_ID');
    if (one) chats.push(one);
    (p.getProperty('ADMIN_CHATS') || '').split(',').forEach(function (x) {
      x = String(x || '').trim();
      if (x && chats.indexOf(x) < 0) chats.push(x);
    });
  } catch (e) {}
  return { configured: !!token, adminChat: chats.length > 0, chats: chats };
}

function sf3SendReceiptPhoto_(fileId, caption) {
  if (!fileId) return false;
  var info = sf3TgInfo_();
  if (!info.configured || !info.chats.length) return false;
  var token = '';
  try { token = sfTgToken_() || ''; } catch (e) { return false; }
  var blob = null;
  try { blob = DriveApp.getFileById(fileId).getBlob(); } catch (e) { blob = null; }
  if (!blob) return false;
  var ok = false;
  info.chats.forEach(function (chat) {
    try {
      var payload = { chat_id: String(chat), caption: String(caption || '').slice(0, 900) };
      if (blob) payload.photo = blob;
      UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/sendPhoto', { method: 'post', payload: payload, muteHttpExceptions: true });
      ok = true;
    } catch (e) {}
  });
  return ok;
}

/* ============================================================
 * API شاگرد
 * ============================================================ */

/** وضعیت اشتراک + پکیج‌ها + شماره کارت + پرداخت‌های اخیر من */
function sf3MySub(token) {
  var s = requireSession_(token);
  sf3Ensure_();
  var sub = { status: 'none', daysLeft: 0, endDate: '' };
  try { sub = sfActiveSubOf_(s.username); } catch (e) {}
  // هر کسی که هنوز ردیف اشتراک ندارد: «none» می‌ماند (قفل نمی‌شود)
  var pkgs = [];
  try {
    pkgs = sfObjects_(sfRead_('SF_Packages'))
      .filter(function (p) { return sf3Truthy_(p.Active); })
      .sort(function (a, b) { return (Number(a.Sort) || 0) - (Number(b.Sort) || 0); })
      .map(function (p) {
        return { id: normalize_(p.PackageID), name: normalize_(p.Name), days: Number(p.Days) || 30, price: Number(p.Price) || 0, features: normalize_(p.Features), badge: normalize_(p.Badge) };
      });
  } catch (e) { pkgs = []; }
  var pays = [];
  try {
    pays = sfObjects_(sfRead_('SF_Payments'))
      .filter(function (r) { return String(normalize_(r.Username)).toLowerCase() === String(s.username).toLowerCase(); })
      .map(function (r) { return { payId: normalize_(r.PayID), status: normalize_(r.Status), final: Number(r.Final) || 0, packageId: normalize_(r.PackageID), createdAt: normalize_(r.CreatedAt) }; })
      .slice(-5).reverse();
  } catch (e) {}
  return {
    subscription: sub,
    packages: pkgs,
    card: { number: sfGetSetting_('CARD_NUMBER'), holder: sfGetSetting_('CARD_HOLDER') },
    payments: pays,
    serverDate: todayISO_(),
    telegram: (function () { var t = sf3TgInfo_(); return { configured: t.configured, adminChat: t.adminChat }; })()
  };
}

/** انتخاب برنامهٔ فعال */
function sf3GetActive(token) {
  var s = requireSession_(token);
  return { selection: sf3ReadSel_(s.username) };
}

function sf3SetActive(token, kind, value) {
  sf3Ensure_();
  var s = requireSession_(token);
  kind = String(kind || '').toLowerCase();
  if (['workout', 'diet', 'supplement'].indexOf(kind) < 0) throw new Error('نوع برنامه نامعتبر است.');
  var wanted = String(value || '').trim();
  if (wanted) {
    var rp = { workout: [], diet: [], supplement: [] };
    try { rp = resolveUserPlans_(s.username); } catch (e) {}
    var list = rp[kind] || [];
    var okName = list.some(function (x) { return String(normalize_(x.name)) === wanted; });
    if (!okName) throw new Error('این برنامه به شما تخصیص داده نشده است.');
  }
  var key = sf3SelKey_(s.username);
  var sel = sf3ReadSel_(s.username);
  sel[kind] = wanted;
  sfSetSetting_(key, JSON.stringify(sel));
  try { sfAudit_(s.username, 'active_plan', kind, '', wanted, ''); } catch (e) {}
  return { ok: true, selection: sel };
}

/** ارسال رسید کارت‌به‌کارت + اطلاع به تلگرام ادمین */
function sf3SubmitReceipt(token, p) {
  p = p || {};
  var s = requireSession_(token);
  sf3Ensure_();
  if (!p.receipt || !p.receipt.base64) throw new Error('تصویر رسید را انتخاب کنید.');
  var res = sfPayReceipt_(token, { packageId: p.packageId, coupon: p.coupon || '', receipt: p.receipt }, p.cid || '');
  // ارسال عکس رسید به ادمین (اگر ربات تنظیم شده باشد)
  try {
    var row = sfObjects_(sfRead_('SF_Payments')).filter(function (r) { return normalize_(r.PayID) === normalize_(res.payId); })[0];
    if (row && row.ReceiptFileId) {
      sf3SendReceiptPhoto_(row.ReceiptFileId,
        '🧾 رسید جدید\n' + s.username + '\nمبلغ: ' + res.amount + ' تومان\nشناسه: ' + res.payId);
    }
  } catch (e) {}
  return res;
}

/* ============================================================
 * API مربی / ادمین
 * ============================================================ */

function sf3RequireCoach_(token) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین به این بخش دسترسی دارد.');
  return s;
}

function sf3AdminOverview(token) {
  var s = sf3RequireCoach_(token);
  sf3Ensure_();
  var pays = [], subs = [], users = [];
  try { pays = sfObjects_(sfRead_('SF_Payments')); } catch (e) {}
  try { subs = sfObjects_(sfRead_('SF_Subs')); } catch (e) {}
  try { users = sfObjects_(sfRead_(CONFIG.USERS_SHEET)); } catch (e) {}

  var pending = [], recent = [];
  pays.forEach(function (r) {
    var st = String(normalize_(r.Status)).toLowerCase();
    var o = {
      payId: normalize_(r.PayID), username: normalize_(r.Username), packageId: normalize_(r.PackageID),
      amount: Number(r.Amount) || 0, final: Number(r.Final) || 0, status: st,
      createdAt: normalize_(r.CreatedAt), reason: normalize_(r.RejectReason),
      receipt: r.ReceiptFileId ? ('https://drive.google.com/file/d/' + r.ReceiptFileId + '/view') : ''
    };
    if (st === 'pending_review') pending.push(o); else recent.push(o);
  });
  pending.sort(function (a, b) { return String(a.createdAt) < String(b.createdAt) ? 1 : -1; });
  recent.sort(function (a, b) { return String(a.createdAt) < String(b.createdAt) ? 1 : -1; });

  var pkgs = [];
  try {
    pkgs = sfObjects_(sfRead_('SF_Packages')).map(function (p) {
      return { id: normalize_(p.PackageID), name: normalize_(p.Name), days: Number(p.Days) || 30, price: Number(p.Price) || 0, features: normalize_(p.Features), badge: normalize_(p.Badge), active: sf3Truthy_(p.Active), sort: Number(p.Sort) || 1 };
    });
  } catch (e) {}

  // وضعیت اشتراک همهٔ کاربران
  var byUser = {};
  subs.forEach(function (r) {
    byUser[String(normalize_(r.Username)).toLowerCase()] = 1;
  });
  var subRows = [];
  users.forEach(function (u) {
    var un = normalize_(u.user || u.Username);
    if (!un) return;
    var sub = { status: 'none', daysLeft: 0, endDate: '' };
    try { sub = sfActiveSubOf_(un); } catch (e) {}
    subRows.push({ username: un, role: normalize_(u.role) || 'user', status: sub.status, daysLeft: Number(sub.daysLeft) || 0, endDate: sub.endDate });
  });
  subRows.sort(function (a, b) { return (a.daysLeft || 9999) - (b.daysLeft || 9999); });

  var expiring = subRows.filter(function (r) { return r.status !== 'none' && r.daysLeft <= 7; });
  return {
    ok: true,
    pending: pending,
    recent: recent.slice(0, 30),
    packages: pkgs,
    card: { number: sfGetSetting_('CARD_NUMBER'), holder: sfGetSetting_('CARD_HOLDER') },
    subscriptionRows: subRows,
    stats: {
      pending: pending.length,
      active: subRows.filter(function (r) { return r.status === 'active' || r.status === 'grace'; }).length,
      expiring: expiring.length,
      none: subRows.filter(function (r) { return r.status === 'none'; }).length
    },
    telegram: (function () { var t = sf3TgInfo_(); return { configured: t.configured, adminChat: t.adminChat }; })()
  };
}

function sf3AdminDecide(token, payId, approve, reason) {
  sf3RequireCoach_(token);
  sf3Ensure_();
  if (approve) return sfApprovePayment_(token, payId, reason || '');
  return sfRejectPayment_(token, payId, reason || '');
}

function sf3AdminSetCard(token, number, holder) {
  sf3RequireCoach_(token);
  sfSetSetting_('CARD_NUMBER', String(number || '').trim());
  sfSetSetting_('CARD_HOLDER', String(holder || '').trim());
  return { ok: true };
}

function sf3AdminSavePackage(token, p) {
  sf3RequireCoach_(token);
  sf3Ensure_();
  p = p || {};
  var id = String(p.id || '').trim() || ('P' + Math.floor(Date.now() / 1000));
  var obj = {
    PackageID: id,
    Name: String(p.name || '').trim() || 'اشتراک',
    Days: Math.max(1, Number(p.days) || 30),
    Price: Math.max(0, Number(p.price) || 0),
    Features: String(p.features || ''),
    Badge: String(p.badge || ''),
    Active: p.active === false ? 'FALSE' : 'TRUE',
    Sort: String(Number(p.sort) || 1)
  };
  sfRewrite_('SF_Packages', function (o) { return normalize_(o.PackageID) !== id; }, [obj]);
  return { ok: true, id: id };
}

function sf3AdminDeletePackage(token, id) {
  sf3RequireCoach_(token);
  sfRewrite_('SF_Packages', function (o) { return normalize_(o.PackageID) !== normalize_(id); }, []);
  return { ok: true };
}

/** تمدید/فعال‌سازی دستی اشتراک یک شاگرد */
function sf3AdminGrantSub(token, username, days, packageId) {
  var s = sf3RequireCoach_(token);
  sf3Ensure_();
  var un = String(username || '').trim();
  if (!un) throw new Error('نام شاگرد مشخص نیست.');
  var rec = getUserRecord_(un);
  if (!rec) throw new Error('این شاگرد پیدا نشد.');
  var add = Math.max(1, Number(days) || 30);
  var cur = sfActiveSubOf_(un);
  var start = (cur.endDate && Number(cur.daysLeft) > 0) ? cur.endDate : todayISO_();
  var end = sf3AddDays_(start, add);
  sfAppend_('SF_Subs', [{
    SubID: Utilities.getUuid().slice(0, 8), Username: un, PackageID: normalize_(packageId) || 'MANUAL',
    StartDate: start, EndDate: end, Status: 'active', Source: 'admin', CreatedAt: new Date().toISOString()
  }]);
  try { sfAudit_(s.username, 'sub', un, cur.endDate || '', end, 'grant ' + add + 'd'); } catch (e) {}
  return { ok: true, endDate: end };
}

/** حذف کامل یک برنامه از برنامه‌ساز (تمرین) */
function sfAdminDeletePlan(token, planId) {
  sf3RequireCoach_(token);
  sfEnsure_();
  var id = String(planId || '').trim();
  if (!id) throw new Error('شناسهٔ برنامه مشخص نیست.');
  var found = sfObjects_(sfRead_(SF.PLANS)).some(function (p) { return normalize_(p.PlanID) === id; });
  if (!found) throw new Error('برنامه پیدا نشد.');
  sfRewrite_(SF.PLANS, function (o) { return normalize_(o.PlanID) !== id; }, []);
  sfRewrite_(SF.BLOCKS, function (o) { return normalize_(o.PlanID) !== id; }, []);
  sfRewrite_(SF.ITEMS, function (o) { return normalize_(o.PlanID) !== id; }, []);
  sfRewrite_(SF.SETS, function (o) { return normalize_(o.PlanID) !== id; }, []);
  return { ok: true, planId: id };
}

/** تنظیم تست تلگرام ادمین */
function sf3AdminTgTest(token) {
  sf3RequireCoach_(token);
  var t = sf3TgInfo_();
  if (!t.configured) throw new Error('توکن ربات در Script Properties تنظیم نشده است (TG_TOKEN).');
  if (!t.adminChat) throw new Error('چت ادمین ثبت نشده؛ یک‌بار به ربات پیام بده.');
  var ok = false;
  try {
    var tokenTg = sfTgToken_();
    t.chats.forEach(function (chat) {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + tokenTg + '/sendMessage', {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({ chat_id: chat, text: '✅ اتصال ربات به پنل پرداخت برقرار است.' }),
        muteHttpExceptions: true
      });
      ok = true;
    });
  } catch (e) {}
  return { ok: ok };
}

/** لیست همهٔ برنامه‌ها برای صفحهٔ مدیریت */
function sf3AdminAllPlans(token) {
  sf3RequireCoach_(token);
  sfEnsure_();
  var plans = sfObjects_(sfRead_(SF.PLANS));
  var blocks = sfObjects_(sfRead_(SF.BLOCKS));
  return plans.map(function (p) {
    var bs = blocks.filter(function (b) { return normalize_(b.PlanID) === normalize_(p.PlanID); });
    var days = {};
    bs.forEach(function (b) { days[String(b.DayNo)] = 1; });
    return {
      planId: normalize_(p.PlanID), username: normalize_(p.Username), planName: normalize_(p.PlanName),
      active: sf3Truthy_(p.Active), days: Object.keys(days).length, blocks: bs.length,
      updatedAt: normalize_(p.UpdatedAt), createdAt: normalize_(p.CreatedAt)
    };
  }).sort(function (a, b) { return String(b.updatedAt || b.createdAt) < String(a.updatedAt || a.createdAt) ? -1 : 1; });
}

/* ===== END SfApp3.gs (v3) ===== */


// ---------------------------------------------------------------------------
// patch v15 — تشخیص حرکت تکراری نسبت به برنامهٔ قبلی + هشدار مربی
// ---------------------------------------------------------------------------

function sfNormName_(s) {
  return String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c\s]+/g, '').toLowerCase();
}

// برنامهٔ «قبلی» شاگرد: آخرین برنامه‌ای که قبل از برنامهٔ فعلی ساخته شده (برنامهٔ فعلی با excludePlanId کنار گذاشته می‌شود)
function sfPrevPlanInfo_(username, excludePlanId) {
  const u = normalize_(username).toLowerCase();
  const ex = normalize_(excludePlanId);
  const all = sfObjects_(sfRead_(SF.PLANS)).filter(p => normalize_(p.Username).toLowerCase() === u);
  const self = ex ? all.find(p => normalize_(p.PlanID) === ex) : null;
  let others = all.filter(p => normalize_(p.PlanID) !== ex);
  if (self && self.CreatedAt) others = others.filter(p => String(p.CreatedAt) < String(self.CreatedAt));
  if (!others.length) return null;
  others.sort((a, b) => String(b.CreatedAt).localeCompare(String(a.CreatedAt)));
  const prev = others[0];
  const items = sfObjects_(sfRead_(SF.ITEMS)).filter(i => normalize_(i.PlanID) === normalize_(prev.PlanID));
  const ids = {}, names = {};
  items.forEach(i => {
    if (normalize_(i.ExerciseID)) ids[normalize_(i.ExerciseID)] = i.ExerciseName;
    if (normalize_(i.ExerciseName)) names[sfNormName_(i.ExerciseName)] = i.ExerciseName;
  });
  return { planId: prev.PlanID, planName: prev.PlanName, createdAt: prev.CreatedAt, ids: ids, names: names };
}

// برای نشان‌دادن «تکراری از قبل» داخل سازندهٔ برنامه
function sfPrevPlanExercises(token, username, excludePlanId) {
  sfAdmin_(token); sfEnsure_();
  const prev = sfPrevPlanInfo_(username, excludePlanId);
  if (!prev) return { has: false, ids: [], names: [] };
  return { has: true, planName: prev.planName, ids: Object.keys(prev.ids), names: Object.keys(prev.names).map(k => prev.names[k]) };
}

function sfRepeatedExercises_(planBlocks, prev) {
  const out = [], seen = {};
  if (!prev) return out;
  planBlocks.forEach(b => b.items.forEach(ex => {
    const id = normalize_(ex.ExerciseID);
    if (seen[id]) return;
    if (prev.ids[id] !== undefined || prev.names[sfNormName_(ex.PersianName)]) { seen[id] = 1; out.push({ exerciseId: id, name: ex.PersianName }); }
  }));
  return out;
}

function sfAlertsList_() {
  return sfObjects_(sfRead_('SF_Alerts'))
    .filter(a => normalize_(a.Seen).toUpperCase() !== 'TRUE')
    .sort((a, b) => String(b.Time).localeCompare(String(a.Time)))
    .slice(0, 50)
    .map(a => ({ id: a.AlertID, time: a.Time, username: a.Username, planId: a.PlanID, planName: a.PlanName, type: a.Type, message: a.Message }));
}

function sfCoachAlerts(token) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('دسترسی مربی لازم است.');
  sfEnsure_();
  return sfAlertsList_();
}

function sfCoachAlertsDismiss(token, ids) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('دسترسی مربی لازم است.');
  sfEnsure_();
  const set = {}; (ids || []).forEach(x => { set[normalize_(x)] = 1; });
  return sfWithLock_(() => {
    const rd = sfRead_('SF_Alerts');
    if (rd.idx.Seen === undefined) return { ok: true };
    rd.rows.forEach((r, i) => { if (set[normalize_(r[rd.idx.AlertID])]) rd.sh.getRange(i + 2, rd.idx.Seen + 1).setValue('TRUE'); });
    sfInvalidate_('SF_Alerts');
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------
// patch v16 — موتور محاسبات بدن (BMI / BMR / TDEE / هدف / کالری / ماکرو)
// ---------------------------------------------------------------------------
function sfBodyEngine_(p) {
  p = p || {};
  var num = function (v, d) { v = parseFloat(v); return isFinite(v) && v > 0 ? v : d; };
  var w = num(p.weight, 75), h = num(p.height, 175), a = Math.round(num(p.age, 25));
  var g = String(p.gender || 'm').toLowerCase() === 'f' ? 'f' : 'm';
  var act = num(p.activity, 1.55), gw = num(p.goalWeight, 0), bf = num(p.bodyFat, 0);
  var pace = ['gentle', 'standard', 'aggressive'].indexOf(p.pace) >= 0 ? p.pace : 'standard';
  var hm = h / 100, bmi = +(w / (hm * hm)).toFixed(1), warn = [];
  var C = bmi < 16 ? ['severe_under', 'کم‌وزنی شدید', '#38bdf8'] : bmi < 18.5 ? ['under', 'کم‌وزن', '#38bdf8'] : bmi < 25 ? ['normal', 'نرمال', '#4ade80']
    : bmi < 30 ? ['over', 'اضافه‌وزن', '#facc15'] : bmi < 35 ? ['obese1', 'چاقی درجه 1', '#fb923c'] : bmi < 40 ? ['obese2', 'چاقی درجه 2', '#f87171'] : ['obese3', 'چاقی درجه 3', '#ef4444'];
  var healthy = { min: +(18.5 * hm * hm).toFixed(1), max: +(24.9 * hm * hm).toFixed(1), ideal: +(22 * hm * hm).toFixed(1) };
  var bmr = (bf > 0 && bf < 60) ? 370 + 21.6 * (w * (1 - bf / 100)) : 10 * w + 6.25 * h - 5 * a + (g === 'm' ? 5 : -161);
  var tdee = bmr * act;
  var want = ['lose', 'maintain', 'gain'].indexOf(p.goal) >= 0 ? p.goal : 'auto', goal, reason;
  var diff = gw ? gw - w : 0;
  if (want !== 'auto') { goal = want; reason = 'هدف را مربی انتخاب کرده است.';
    if (goal === 'gain' && bmi >= 27) warn.push('BMI بالاست؛ افزایش وزن معمولاً توصیه نمی‌شود مگر هدف عضله‌سازی با نظارت باشد.');
    if (goal === 'lose' && bmi < 18.5) warn.push('BMI زیر نرمال است؛ کاهش وزن توصیه نمی‌شود.'); }
  else if (gw && Math.abs(diff) >= 1.5 && !(diff < 0 && bmi < 18.5) && !(diff > 0 && bmi >= 27)) { goal = diff < 0 ? 'lose' : 'gain'; reason = 'بر اساس وزن هدف (' + gw + ' کیلو) و BMI فعلی ' + bmi.toFixed(1) + '.'; }
  else if (bmi < 18.5) { goal = 'gain'; reason = 'BMI ' + bmi.toFixed(1) + ' کمتر از نرمال است؛ افزایش وزن سالم پیشنهاد می‌شود.'; }
  else if (bmi >= 25) { goal = 'lose'; reason = 'BMI ' + bmi.toFixed(1) + ' بالاتر از نرمال است؛ کاهش وزن تدریجی پیشنهاد می‌شود.'; if (bmi < 27) warn.push('اگر فرد ورزشکار با توده عضلانی بالاست، BMI گمراه‌کننده است؛ ریکامپ را در نظر بگیرید.'); }
  else { goal = 'maintain'; reason = 'BMI نرمال است؛ حفظ وزن و بهبود ترکیب بدن (ریکامپ) پیشنهاد می‌شود.'; }
  var floor = Math.max(g === 'f' ? 1200 : 1500, Math.round(bmr * 0.85));
  function scen(k) {
    var rate = 0, kcal = tdee, clamped = false;
    if (k === 'lose') { rate = -Math.min(bmi < 25 ? 0.5 : 1, w * { gentle: 0.005, standard: 0.0075, aggressive: 0.01 }[pace]); kcal = tdee + rate * 7700 / 7;
      var lo = Math.max(tdee * 0.75, floor); if (kcal < lo) { kcal = lo; clamped = true; rate = (kcal - tdee) * 7 / 7700; } }
    if (k === 'gain') { rate = Math.min(0.5, w * { gentle: 0.0025, standard: 0.004, aggressive: 0.006 }[pace]); kcal = tdee + rate * 7700 / 7;
      var hi = tdee * 1.2; if (kcal > hi) { kcal = hi; clamped = true; rate = (kcal - tdee) * 7 / 7700; } }
    return { goal: k, kcal: Math.round(kcal), weeklyKg: +rate.toFixed(2), clamped: clamped };
  }
  var S = { lose: scen('lose'), maintain: scen('maintain'), gain: scen('gain') }, cur = S[goal];
  if (cur.clamped) warn.push(goal === 'lose' ? 'کسری کالری به حداقل ایمن محدود شد.' : 'مازاد کالری به سقف ایمن محدود شد.');
  if (a < 18) warn.push('زیر 18 سال: برنامه‌ریزی کالری حتماً با نظر پزشک/متخصص تغذیه باشد.');
  if (bmi < 16 || bmi >= 40) warn.push('BMI در محدودهٔ پرخطر است؛ پیگیری پزشکی توصیه می‌شود.');
  var ideal = healthy.ideal, ref = bmi >= 30 ? ideal + 0.25 * (w - ideal) : w;
  var protein = Math.max(90, Math.round(ref * (goal === 'lose' ? 2.0 : goal === 'gain' ? 1.8 : 1.6)));
  var fat = Math.round(Math.max(0.6 * ref, 0.25 * cur.kcal / 9));
  var carbs = Math.max(50, Math.round((cur.kcal - protein * 4 - fat * 9) / 4));
  var tot = protein * 4 + fat * 9 + carbs * 4 || 1;
  var weeks = (gw && cur.weeklyKg && (gw - w) * cur.weeklyKg > 0) ? Math.min(104, Math.ceil(Math.abs(gw - w) / Math.abs(cur.weeklyKg))) : null;
  var glasses = Math.max(6, Math.min(16, Math.round(35 * w / 250)));
  return { bmi: +bmi.toFixed(1), bmiClass: { key: C[0], label: C[1], color: C[2] }, healthy: healthy, bmr: Math.round(bmr), tdee: Math.round(tdee),
    goal: goal, goalReason: reason, weeklyKg: cur.weeklyKg, dailyDelta: Math.round(cur.kcal - tdee), weeks: weeks, scenarios: S,
    targetCalories: cur.kcal, targetProtein: protein, targetCarbs: carbs, targetFat: fat,
    macroPct: { p: Math.round(protein * 4 / tot * 100), c: Math.round(carbs * 4 / tot * 100), f: Math.round(fat * 9 / tot * 100) },
    fiber: Math.round(14 * cur.kcal / 1000), waterGoal: glasses, waterMl: Math.round(35 * w), warnings: warn };
}

function sfAdminGetBody(token, username) {
  sfAdmin_(token);
  const u = normalize_(username);
  if (!u) throw new Error('شاگرد مشخص نیست.');
  const profile = getProfile_(u);
  return { profile: profile, res: sfBodyEngine_(Object.assign({}, profile, { goal: 'auto' })) };
}

// مربی کالری/ماکرو را (با موتور سرور) محاسبه و روی پروفایل شاگرد ذخیره می‌کند
function sfAdminApplyTargets(token, username, input) {
  sfAdmin_(token);
  const u = normalize_(username);
  if (!u) throw new Error('شاگرد مشخص نیست.');
  input = input || {};
  const cur = getProfile_(u);
  const num = (v, lo, hi, d) => { v = Number(v); return isFinite(v) && v >= lo && v <= hi ? v : d; };
  const p = {
    username: u, name: cur.name || u,
    gender: String(input.gender || cur.gender || 'm').toLowerCase() === 'f' ? 'f' : 'm',
    age: Math.round(num(input.age, 10, 90, cur.age)), height: num(input.height, 100, 230, cur.height),
    weight: num(input.weight, 30, 300, cur.weight), goalWeight: num(input.goalWeight, 30, 300, num(input.weight, 30, 300, cur.weight)),
    activity: num(input.activity, 1.1, 2.2, cur.activity), goal: ['lose', 'maintain', 'gain'].indexOf(input.goal) >= 0 ? input.goal : 'auto',
    pace: input.pace
  };
  const m = sfBodyEngine_(p);
  p.goal = m.goal;
  Object.assign(p, { bmr: m.bmr, tdee: m.tdee, targetCalories: m.targetCalories, targetProtein: m.targetProtein, targetCarbs: m.targetCarbs, targetFat: m.targetFat, waterGoal: m.waterGoal, updatedAt: new Date().toISOString() });
  const sh = getSS_().getSheetByName(CONFIG.PROFILES_SHEET);
  const values = sh.getDataRange().getValues();
  let row = -1;
  for (let r = 1; r < values.length; r++) if (normalize_(values[r][0]).toLowerCase() === u.toLowerCase()) { row = r + 1; break; }
  const oldAvatar = row === -1 ? '' : normalize_(sh.getRange(row, 18).getValue());
  const data = [p.username, p.name, p.gender, p.age, p.height, p.weight, p.goalWeight, p.activity, p.goal, p.bmr, p.tdee, p.targetCalories, p.targetProtein, p.targetCarbs, p.targetFat, p.waterGoal, p.updatedAt, oldAvatar];
  if (row === -1) sh.appendRow(data); else sh.getRange(row, 1, 1, data.length).setValues([data]);
  appendProfileHistory_(p);
  dropSheetCache_();
  return { ok: true, profile: p, metrics: m };
}


// ---------------------------------------------------------------------------
// patch v17 — PDF با تصویر حرکت، ساخت خودکار برنامهٔ غذایی، هشدار وزن
// ---------------------------------------------------------------------------

function sfPdfFetchImgs_(candsList) {
  // candsList: [[url,...], ...] → ['data:image/..;base64,..' | '', ...]
  const out = candsList.map(function () { return ''; });
  const isG = function (u) { return /^https:\/\/(drive\.google\.com|lh3\.googleusercontent\.com|docs\.google\.com)\//.test(u); };
  const req = function (u) { const r = { url: u, muteHttpExceptions: true, followRedirects: true }; if (isG(u)) r.headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }; return r; };
  const take = function (resp) {
    try {
      if (resp.getResponseCode() !== 200) return '';
      const b = resp.getBlob(), ct = String(b.getContentType() || '');
      if (ct.indexOf('image/') !== 0 || ct.indexOf('svg') >= 0) return '';
      const bytes = b.getBytes(); if (bytes.length > 700000) return '';
      return 'data:' + ct + ';base64,' + Utilities.base64Encode(bytes);
    } catch (e) { return ''; }
  };
  const idx = [], reqs = [];
  candsList.forEach(function (c, i) { if (c && c.length) { idx.push(i); reqs.push(req(c[0])); } });
  let resp = [];
  try { resp = UrlFetchApp.fetchAll(reqs); } catch (e) { resp = []; }
  idx.forEach(function (i, k) {
    let d = resp[k] ? take(resp[k]) : '';
    for (let t = 1; !d && t < Math.min(3, candsList[i].length); t++) { try { d = take(UrlFetchApp.fetch(candsList[i][t], req(candsList[i][t]))); } catch (e) {} }
    out[i] = d;
  });
  return out;
}

function sfPdfRepsFa_(r) {
  const s = normalize_(r);
  if (s.indexOf('+') >= 0) { const p = s.split('+'); return p[0] + ' سنگین + ' + (p[1] || '') + ' سبک'; }
  return s;
}

function sfWorkoutPdfHtml2_(target, planName, withImages) {
  const u = normalize_(target).toLowerCase(), pn = normalize_(planName);
  let plans = sfObjects_(sfRead_(SF.PLANS)).filter(function (p) { return normalize_(p.Username).toLowerCase() === u && sfIsTrue_(p.Active); });
  if (pn) { const m = plans.filter(function (p) { return normalize_(p.PlanName) === pn; }); if (m.length) plans = m; }
  if (!plans.length) throw new Error('برنامهٔ تمرینی فعالی پیدا نشد.');
  plans.sort(function (a, b) { return String(b.CreatedAt).localeCompare(String(a.CreatedAt)); });
  const bank = sfBankMap_();
  const built = sfBuildPlans_([plans[0]], bank);
  const plan = built.plans[0];
  // تصویرها
  const ids = [], cands = [];
  plan.days.forEach(function (d) { d.blocks.forEach(function (b) { b.items.forEach(function (it) {
    if (ids.indexOf(it.exerciseId) < 0) { ids.push(it.exerciseId); const m = bank[it.exerciseId] ? sfMediaOf_(bank[it.exerciseId]) : { frames: [], gif: [] };
      cands.push((m.frames[0] && m.frames[0].length ? m.frames[0] : (m.gif || [])).slice(0, 3)); }
  }); }); });
  let imgs = [];
  if (withImages !== false) { try { imgs = sfPdfFetchImgs_(cands.slice(0, 60)); } catch (e) { imgs = []; } }
  const imgOf = function (id) { const i = ids.indexOf(id); return i >= 0 && imgs[i] ? imgs[i] : ''; };
  const prof = getProfile_(target);
  let h = '<div class="hd"><table width="100%"><tr><td><h1>' + sfEsc_(plan.planName) + '</h1><div class="sub">' + sfEsc_(prof.name || target) + (plan.goal ? ' — ' + sfEsc_(plan.goal) : '') + ' — ' + sfEsc_(todayISO_()) + '</div></td><td class="logo">SAEEDI<br><small>FIT BODY</small></td></tr></table></div>';
  if (plan.coachNotes) h += '<p class="note">' + sfEsc_(plan.coachNotes) + '</p>';
  plan.days.forEach(function (d) {
    if (!d.blocks.length) return;
    h += '<h2 class="day">روز ' + d.dayNo + (d.title ? ' — ' + sfEsc_(d.title) : '') + '</h2>';
    d.blocks.forEach(function (b) {
      h += '<table class="blk" width="100%" cellspacing="0"><tr><td class="bh" colspan="2">' + sfEsc_(b.techniqueLabel || 'ست معمولی') + (b.restBetweenSec ? ' · استراحت ' + b.restBetweenSec + ' ثانیه' : '') + '</td></tr>';
      b.items.forEach(function (it, k) {
        const im = imgOf(it.exerciseId), ex = bank[it.exerciseId] || {};
        h += '<tr><td class="im">' + (im ? '<img src="' + im + '" width="86" height="86">' : '<div class="ph"></div>') + '</td><td class="ex"><b>' + (b.items.length > 1 ? 'ABCDEF'.charAt(k) + ') ' : '') + sfEsc_(it.name) + '</b><div class="sub">' +
          sfEsc_([it.group, ex.Equipment, ex.Level].filter(Boolean).join(' • ')) + '</div>';
        h += '<table class="st" width="100%" cellspacing="0"><tr><th>ست</th><th>تکرار</th><th>وزنه (kg)</th><th>استراحت</th></tr>';
        b.sets.forEach(function (s) {
          const c = s.cells[k] || s.cells[0] || {};
          h += '<tr><td>' + s.setNo + '</td><td>' + sfEsc_(sfPdfRepsFa_(c.reps)) + '</td><td>' + sfEsc_(c.weight || '—') + '</td><td>' + (s.rest ? s.rest + ' ث' : '') + '</td></tr>';
        });
        h += '</table></td></tr>';
      });
      h += '</table>';
    });
  });
  return h;
}

function sfDietPdfHtml2_(target, planName, withImages) {
  const u = normalize_(target).toLowerCase(), pn = normalize_(planName);
  let rows = sfObjects_(sfRead_('SF_Diets')).filter(function (r) { return normalize_(r.Username).toLowerCase() === u && sfIsTrue_(r.Active); });
  if (pn) { const m = rows.filter(function (r) { return normalize_(r.PlanName) === pn; }); if (m.length) rows = m; }
  if (!rows.length) throw new Error('برنامهٔ غذایی پیدا نشد.');
  const name = normalize_(rows[0].PlanName);
  rows = rows.filter(function (r) { return normalize_(r.PlanName) === name; });
  rows.sort(function (a, b) { return (Number(a.SectionNo) || 0) - (Number(b.SectionNo) || 0) || (Number(a.ItemNo) || 0) - (Number(b.ItemNo) || 0); });
  const foods = {}; try { sfObjects_(sfRead_(SF.FOODS)).forEach(function (f) { foods[normalize_(f.FoodID)] = f; }); } catch (e) {}
  const prof = getProfile_(target);
  const order = [], secs = {}; let tk = 0, tp = 0, tc = 0, tf = 0;
  rows.forEach(function (r) { const t = normalize_(r.SectionTitle) || 'وعده'; if (!secs[t]) { secs[t] = []; order.push(t); } secs[t].push(r);
    tk += Number(r.Kcal) || 0; tp += Number(r.Protein) || 0; tc += Number(r.Carbs) || 0; tf += Number(r.Fat) || 0; });
  let h = '<div class="hd"><table width="100%"><tr><td><h1>' + sfEsc_(name) + '</h1><div class="sub">' + sfEsc_(prof.name || target) + ' — ' + sfEsc_(todayISO_()) + '</div></td><td class="logo">SAEEDI<br><small>FIT BODY</small></td></tr></table></div>';
  h += '<table class="tot" width="100%" cellspacing="0"><tr><td>هدف روزانه<br><b>' + (prof.targetCalories || '—') + '</b> kcal</td><td>پروتئین<br><b>' + (prof.targetProtein || '—') + '</b> g</td><td>کربوهیدرات<br><b>' + (prof.targetCarbs || '—') + '</b> g</td><td>چربی<br><b>' + (prof.targetFat || '—') + '</b> g</td><td>مجموع این برنامه<br><b>' + Math.round(tk) + '</b> kcal</td></tr></table>';
  order.forEach(function (t) {
    h += '<h2 class="day">' + sfEsc_(t) + '</h2><table class="st" width="100%" cellspacing="0"><tr><th>غذا</th><th>مقدار / توضیح</th><th>kcal</th><th>P</th><th>C</th><th>F</th></tr>';
    secs[t].forEach(function (r) {
      const f = foods[normalize_(r.FoodID)];
      h += '<tr><td><b>' + sfEsc_(r.ItemTitle) + '</b></td><td>' + sfEsc_(r.Description) + (f && f.Recipe ? '<div class="sub">' + sfEsc_(f.Recipe) + '</div>' : '') + '</td><td>' + (r.Kcal || '') + '</td><td>' + (r.Protein || '') + '</td><td>' + (r.Carbs || '') + '</td><td>' + (r.Fat || '') + '</td></tr>';
    });
    h += '</table>';
  });
  return h;
}

// ---------------------------------------------------------------------------
// ساخت خودکار برنامهٔ غذایی از روی هدف کالری/ماکرو
// ---------------------------------------------------------------------------
function sfAutoDiet(token, username, opts) {
  sfAdmin_(token); sfEnsure_(); sfEnsureV16_();
  opts = opts || {};
  const u = normalize_(username);
  const prof = u ? getProfile_(u) : {};
  const num = function (v, d) { v = Number(v); return isFinite(v) && v > 0 ? v : d; };
  const T = { k: num(opts.kcal, num(prof.targetCalories, 2200)), p: num(opts.protein, num(prof.targetProtein, 140)), c: num(opts.carbs, num(prof.targetCarbs, 250)), f: num(opts.fat, num(prof.targetFat, 70)) };
  const nm = Math.max(3, Math.min(6, Math.round(num(opts.meals, 5))));
  const veg = opts.vegetarian === true || opts.vegetarian === 'true';
  const rnd = (function (seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(Number(opts.seed) * 7919 + (u.length * 131) + 17);
  const all = sfObjects_(sfRead_(SF.FOODS)).filter(function (r) { return sfIsTrue_(r.Active); }).map(sfFoodObj_);
  const avoid = {}; (opts.avoid || []).forEach(function (x) { avoid[normalize_(x)] = 1; });
  const bad = /سیر|پیاز|ترب|کرفس|رشته آش|کشک|کره بادام|ارده|تخمه آفتابگردان نمکی/;
  const by = function (cat, filt) { return all.filter(function (f) { return f.category === cat && !avoid[f.id] && !bad.test(f.name) && (!filt || filt(f)); }); };
  const pick = function (list) { if (!list.length) return null; return list[Math.floor(rnd() * list.length)]; };
  const has = function (f, re) { return re.test(f.name); };
  const shares = { 3: [0.3, 0.4, 0.3], 4: [0.25, 0.33, 0.14, 0.28], 5: [0.22, 0.1, 0.3, 0.1, 0.28], 6: [0.2, 0.1, 0.28, 0.1, 0.25, 0.07] }[nm];
  const names = { 3: ['صبحانه', 'ناهار', 'شام'], 4: ['صبحانه', 'ناهار', 'عصرانه', 'شام'], 5: ['صبحانه', 'میان‌وعده صبح', 'ناهار', 'عصرانه', 'شام'], 6: ['صبحانه', 'میان‌وعده صبح', 'ناهار', 'عصرانه', 'شام', 'قبل خواب'] }[nm];
  const kinds = { 3: ['bf', 'main', 'main'], 4: ['bf', 'main', 'snack', 'main'], 5: ['bf', 'snack', 'main', 'snack', 'main'], 6: ['bf', 'snack', 'main', 'snack', 'main', 'bed'] }[nm];
  const leanOnly = (T.f * 9 / Math.max(1, T.k)) < 0.3;
  const protMain = function () { return veg ? by('حبوبات').concat(by('پروتئین گیاهی')) : by('پروتئین حیوانی', function (f) { return !/جگر|گوسفند|استیک|سالمون/.test(f.name) && (!leanOnly || f.fat100 / Math.max(1, f.protein100) <= 0.45); }); };
  const per = function (f, g, k) { return Math.round((f[k + '100'] || 0) * g / 100); };
  const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  const meals = [];
  shares.forEach(function (sh, i) {
    const mk = sh * T.k, mp = sh * T.p, mc = sh * T.c, mf = sh * T.f, kind = kinds[i], items = [];
    const add = function (food, grams) { if (!food || grams < 5) return; grams = Math.round(grams / 5) * 5; items.push({ food: food, g: grams }); };
    const prot = function (list, share) { const f = pick(list); if (f) add(f, clamp(mp * share / Math.max(0.05, f.protein100 / 100), 40, 320)); return f; };
    const carb = function (list, need) { const f = pick(list); if (f) add(f, clamp(need / Math.max(0.05, f.carb100 / 100), 30, 650)); return f; };
    if (kind === 'bf') {
      const egg = by('پروتئین حیوانی', function (f) { return has(f, /تخم/); }), dairy = by('لبنیات', function (f) { return !/پرچرب/.test(f.name); });
      prot(veg ? dairy : (rnd() < 0.5 ? egg : dairy).length ? (rnd() < 0.5 ? egg : dairy) : dairy.concat(egg), 0.7);
      carb(by('غلات و نان'), mc * 0.85); add(pick(by('سبزیجات')), 100); add(pick(by('مغزها و دانه‌ها')), clamp(mf * 0.3 / 0.55, 0, 25));
    } else if (kind === 'main') {
      prot(protMain(), 0.8); carb(i === shares.length - 1 && T.c < 200 ? by('غلات و نان') : by('برنج و ماکارونی').concat(by('غلات و نان')), mc * 0.8);
      add(pick(by('سبزیجات')), 150); add(pick(by('روغن و چربی', function (f) { return /زیتون|کنجد/.test(f.name); })), clamp(mf * 0.35 / 1.0, 0, 15));
    } else if (kind === 'snack') {
      const fr = pick(by('میوه‌ها')); if (fr) add(fr, clamp(mc * 0.7 / Math.max(0.05, fr.carb100 / 100), 80, 300));
      const d = pick(by('لبنیات', function (f) { return !/پرچرب/.test(f.name); })); if (d) add(d, clamp(mp * 0.7 / Math.max(0.05, d.protein100 / 100), 100, 300));
      if (mf > 6) add(pick(by('مغزها و دانه‌ها')), clamp(mf * 0.5 / 0.55, 10, 30));
    } else {
      const d = pick(by('لبنیات', function (f) { return !/پرچرب|بستنی/.test(f.name); })); if (d) add(d, clamp(mp * 0.9 / Math.max(0.05, d.protein100 / 100), 100, 300));
      add(pick(by('مغزها و دانه‌ها')), 15);
    }
    meals.push({ title: names[i], items: items, target: { k: Math.round(mk), p: Math.round(mp), c: Math.round(mc), f: Math.round(mf) } });
  });
  const tot = function () { let k = 0, p = 0, c = 0, f = 0; meals.forEach(function (m) { m.items.forEach(function (x) { k += per(x.food, x.g, 'kcal'); p += per(x.food, x.g, 'protein'); c += per(x.food, x.g, 'carb'); f += per(x.food, x.g, 'fat'); }); }); return { k: k, p: p, c: c, f: f }; };
  // تنظیم نهایی: کربوهیدرات‌ها (و پروتئین‌ها) را با نسبت کالری/پروتئین هدف مقیاس کن
  for (let it = 0; it < 4; it++) {
    const t = tot(); if (!t.k) break;
    const rk = clamp(T.k / t.k, 0.6, 1.6);
    if (t.f > T.f * 1.1) { const rf = clamp(T.f * 1.05 / t.f, 0.4, 1); meals.forEach(function (m) { m.items.forEach(function (x) { if (x.food.category === 'روغن و چربی' || x.food.category === 'مغزها و دانه‌ها') x.g = Math.max(5, Math.round(x.g * rf / 5) * 5); }); }); }
    meals.forEach(function (m) { m.items.forEach(function (x, ix) {
      const cat = x.food.category;
      if (cat === 'غلات و نان' || cat === 'برنج و ماکارونی' || cat === 'میوه‌ها') x.g = clamp(Math.round(x.g * (1 + (rk - 1) * 1.6) / 5) * 5, 20, 700);
      else if (cat === 'پروتئین حیوانی' || cat === 'حبوبات' || cat === 'پروتئین گیاهی') x.g = clamp(Math.round(x.g * (1 + (T.p / Math.max(1, tot().p) - 1) * 0.6) / 5) * 5, 40, 380);
    }); });
  }
  const sections = meals.map(function (m) {
    let k = 0, p = 0, c = 0, f = 0; const lines = [], tn = [];
    m.items.forEach(function (x) {
      const kk = per(x.food, x.g, 'kcal'); k += kk; p += per(x.food, x.g, 'protein'); c += per(x.food, x.g, 'carb'); f += per(x.food, x.g, 'fat');
      const unit = x.food.servingGrams > 0 && x.food.servingName && x.food.servingGrams < 400 ? ' (≈ ' + Math.round(x.g / x.food.servingGrams * 10) / 10 + ' ' + x.food.servingName + ')' : '';
      lines.push(x.g + ' گرم ' + x.food.name + unit); if (tn.length < 2) tn.push(x.food.name);
    });
    return { title: m.title, items: [{ title: tn.join(' + ') || m.title, description: lines.join(' + '), kcal: String(k), protein: String(p), carbs: String(c), fat: String(f), grams: '', foodId: '' }], target: m.target };
  });
  const T2 = tot();
  return { sections: sections, totals: { kcal: T2.k, protein: T2.p, carbs: T2.c, fat: T2.f }, targets: T, foodsCount: all.length };
}

// هشدار وزن: پیشرفت وزن نسبت به هدف در ۲۱ روز گذشته (محاسبهٔ لحظه‌ای)
function sfWeightAlerts_(athletes) {
  const out = [];
  (athletes || []).forEach(function (a) {
    try {
      const prof = getProfile_(a.username), hist = getProfileHistory_(a.username).filter(function (x) { return x.weight; });
      if (hist.length < 2) return;
      const last = hist[hist.length - 1], cut = sfDaysAgoISO_(21);
      const old = hist.filter(function (x) { return x.date <= cut; }).pop() || null;
      if (!old) return;
      const delta = last.weight - old.weight, goal = String(prof.goal || 'maintain');
      const gw = Number(prof.goalWeight) || 0, w = Number(prof.weight) || last.weight;
      let msg = '';
      if (goal === 'lose' && gw && w > gw + 1 && delta > -0.3) msg = 'در ۲۱ روز گذشته وزن ' + (delta > 0 ? 'بیشتر شده (+' + delta.toFixed(1) + ')' : 'تقریباً ثابت مانده') + ' ولی هدف کاهش وزن است؛ کالری یا پایبندی را بررسی کنید.';
      else if (goal === 'gain' && gw && w < gw - 1 && delta < 0.3) msg = 'در ۲۱ روز گذشته وزن ' + (delta < 0 ? 'کم شده (' + delta.toFixed(1) + ')' : 'تقریباً ثابت مانده') + ' ولی هدف افزایش وزن است؛ کالری را بالا ببرید.';
      if (msg) out.push({ id: 'W-' + a.username, time: last.date, username: a.username, planId: '', planName: '', type: 'weight', message: msg });
    } catch (e) {}
  });
  return out;
}

function sfPdfCss2_() {
  return 'body{font-family:Tahoma,Arial,sans-serif;direction:rtl;color:#111;font-size:11px}' +
    '.hd{border-bottom:3px solid #6fb82a;margin-bottom:10px}.hd h1{font-size:20px;margin:0 0 3px}.logo{text-align:left;font-weight:bold;font-size:16px;color:#2e7d1e;letter-spacing:1px}.logo small{font-size:9px;letter-spacing:3px}' +
    '.sub{color:#666;font-size:10px;line-height:1.7}.note{background:#fff8e1;border:1px solid #f5b301;padding:6px 8px;border-radius:4px}' +
    'h2.day{background:#14263a;color:#fff;padding:6px 10px;font-size:14px;margin:14px 0 6px;border-radius:4px}' +
    'table.blk{border:1px solid #cfd8dc;margin-bottom:8px;page-break-inside:avoid}td.bh{background:#e8f5e9;font-weight:bold;padding:5px 8px;color:#1b5e20}' +
    'td.im{width:92px;padding:6px;vertical-align:top;text-align:center}td.ex{padding:6px;vertical-align:top}.ph{width:86px;height:86px;background:#eceff1;border-radius:6px}' +
    'img{border-radius:6px;border:1px solid #cfd8dc}table.st{border-collapse:collapse;margin-top:4px}table.st th{background:#eceff1;padding:3px 6px;font-size:10px;border:1px solid #cfd8dc}table.st td{padding:3px 6px;border:1px solid #cfd8dc;text-align:center}' +
    'table.tot td{background:#f1f8e9;border:1px solid #c5e1a5;padding:6px;text-align:center;font-size:11px}table.tot b{font-size:14px;color:#2e7d1e}';
}