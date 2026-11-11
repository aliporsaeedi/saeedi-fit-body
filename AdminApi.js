/**
 * AdminApi.gs — API یکپارچهٔ پنل ادمین (نسخهٔ ۲)
 *
 * اصل طراحی: هر قابلیت فقط یک‌جا پیاده‌سازی می‌شود.
 *  • منو و دسترسی‌ها (ADM_MENU) فقط همین‌جا تعریف می‌شود و کلاینت آن را از adm_boot می‌گیرد.
 *  • چهار بانک (حرکات، غذا، مکمل، ویتامین/مینرال) با یک موتور عمومی (ADM_BANKS + adm_bank*) کار می‌کنند.
 *  • برنامه‌ها، پرداخت‌ها، هشدارها و ... از توابع موجود (sf3Admin*, sfAdmin*, admin*) صدا زده می‌شوند و دوباره‌نویسی نشده‌اند.
 * وابستگی‌ها: Code.gs, TrainingModule.gs, ExerciseData.gs (بدون تغییر)
 */

/* ------------------------------------------------------------------ منو --- */
/* roles: چه نقش‌هایی می‌بینند. sub: زیرمجموعه‌ها (کلیک روی عنوان باز/بسته می‌شود). */
const ADM_MENU = [
  { id: 'dashboard', title: 'داشبورد', icon: '◧', roles: ['admin', 'coach'] },
  { id: 'users', title: 'شاگردها', icon: '☺', roles: ['admin', 'coach'], sub: [
    { id: 'users.list', title: 'فهرست کاربران', roles: ['admin'] },
    { id: 'users.create', title: 'افزودن کاربر', roles: ['admin'] },
    { id: 'users.activity', title: 'حضور و پیگیری تمرین' },
    { id: 'users.progress', title: 'پیشرفت و رتبه‌بندی', roles: ['admin'] },
    { id: 'users.mealImages', title: 'عکس دستی غذا', roles: ['admin'] }
  ] },
  { id: 'plans', title: 'برنامه‌ها', icon: '☰', roles: ['admin', 'coach'], sub: [
    { id: 'plans.workout', title: 'برنامه‌های تمرینی' },
    { id: 'plans.create', title: 'برنامه‌ساز (برنامهٔ تازه)', roles: ['admin'] },
    { id: 'plans.edit', title: 'ویرایش ست و تکرار', roles: ['admin'] },
    { id: 'plans.bank', title: 'بانک برنامه‌ها' },
    { id: 'plans.anatomy', title: 'آناتومی و تعادل عضلانی' },
    { id: 'plans.supp', title: 'برنامه‌های مکمل', roles: ['admin'] },
    { id: 'plans.library', title: 'کتابخانهٔ قالب‌ها' }
  ] },
  { id: 'smart', title: 'مربی هوشمند و AI', icon: '✦', roles: ['admin', 'coach'], sub: [
    { id: 'smart.coach', title: 'دستیار مربی' },
    { id: 'plans.generate', title: 'ساخت هوشمند تمرین', roles: ['admin'] },
    { id: 'plans.diet', title: 'ساخت هوشمند تغذیه', roles: ['admin'] },
    { id: 'plans.analysis', title: 'تحلیل تمرین' },
    { id: 'smart.ai', title: 'تنظیمات هوش مصنوعی', roles: ['admin'] },
    { id: 'smart.logs', title: 'گزارش استفاده از AI', roles: ['admin'] }
  ] },
  { id: 'banks', title: 'بانک‌های اطلاعات', icon: '▤', roles: ['admin', 'coach'], sub: [
    { id: 'bank.exercises', title: 'حرکات تمرینی' },
    { id: 'bank.moves', title: 'جستجوی حرکت + افزودن به برنامه' },
    { id: 'bank.library', title: 'کتابخانهٔ گیف‌ها (۱۳۲۳ حرکت)' },
    { id: 'bank.foods', title: 'غذاها' },
    { id: 'bank.supps', title: 'مکمل‌ها' },
    { id: 'bank.minerals', title: 'ویتامین و مینرال' },
    { id: 'bank.models', title: 'مدل‌های رژیم' },
    { id: 'bank.techniques', title: 'روش‌های تمرینی' }
  ] },
  { id: 'finance', title: 'اعتبار و اشتراک', icon: '¤', roles: ['admin', 'coach'], sub: [
    { id: 'finance.membership', title: 'اعتبار و اشتراک' }
  ] },
  { id: 'comms', title: 'ارتباط', icon: '✉', roles: ['admin', 'coach'], sub: [
    { id: 'comms.chat', title: 'گفت‌وگو با شاگردها' },
    { id: 'comms.alerts', title: 'هشدارهای مربی' },
    { id: 'comms.telegram', title: 'تلگرام' }
  ] },
  { id: 'system', title: 'سیستم', icon: '⚙', roles: ['admin'], sub: [
    { id: 'system.errors', title: 'گزارش خطاها' },
    { id: 'system.media', title: 'ابزار رسانه' },
    { id: 'system.sheets', title: 'شیت‌ها' }
  ] }
];

/* ------------------------------------------------------------ دسترسی/صفحه --- */
function admServePage_() {
  return HtmlService.createHtmlOutputFromFile('AdminApp')
    .setTitle('Saeedi Fit | پنل مدیریت')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function adm_who_(token, adminOnly) {
  const s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('این پنل فقط برای مربی/ادمین است.');
  if (adminOnly && !isAdmin_(s)) throw new Error('فقط ادمین به این بخش دسترسی دارد.');
  return s;
}
function adm_boot(token) {
  const s = adm_who_(token, false);
  const role = String(s.role || '').toLowerCase();
  const menu = ADM_MENU.filter(m => m.roles.indexOf(role) >= 0).map(m => Object.assign({}, m, { sub: (m.sub || []).filter(x => !x.roles || x.roles.indexOf(role) >= 0) }));
  return { ok: true, user: { username: s.username, role: role }, menu: menu, appUrl: ScriptApp.getService().getUrl(), banks: adm_bankSchemas_(), techniques: SF_TECHNIQUES };
}

/* ------------------------------------------------------------ پیکربندی بانک‌ها --- */
/* type: text | area | num | select | url | img | bool ؛ g: گروه فرم ؛ list: نمایش در جدول */
function F_(k, label, type, g, extra) { return Object.assign({ k: k, label: label, type: type || 'text', g: g || 'اصلی' }, extra || {}); }
const ADM_BANKS = {
  exercises: {
    title: 'حرکات تمرینی', sheet: 'SF_ExerciseBank', id: 'ExerciseID', prefix: 'EX', name: 'PersianName', sub: 'EnglishName',
    search: ['PersianName', 'EnglishName', 'Aliases', 'MuscleGroup', 'SubGroup', 'Equipment'],
    facets: ['Category', 'MuscleGroup', 'Equipment', 'Level'],
    media: { img: ['ImgSrc0', 'ImgSrc1'], gif: 'GifURL', video: 'YouTubeURL' },
    fields: [
      F_('PersianName', 'نام فارسی', 'text'), F_('EnglishName', 'نام انگلیسی', 'text'),
      F_('Category', 'دسته', 'select', 'اصلی', { options: ['بدنسازی', 'شکم و پهلو', 'هوازی', 'کشش و انعطاف', 'پلایومتریک', 'پاورلیفتینگ', 'وزنه‌برداری المپیک', 'استرانگمن'] }),
      F_('MuscleGroup', 'گروه عضلانی', 'text'), F_('SubGroup', 'زیرگروه', 'text'), F_('SecondaryMuscle', 'عضلات فرعی', 'text'),
      F_('Equipment', 'وسیله', 'text'), F_('Level', 'سطح', 'select', 'اصلی', { options: ['مبتدی', 'متوسط', 'پیشرفته'] }),
      F_('MovementType', 'نوع حرکت', 'select', 'اصلی', { options: ['ترکیبی', 'تک‌مفصلی'] }),
      F_('Instructions', 'روش اجرا (فارسی)', 'area', 'آموزش'), F_('Tips', 'نکات', 'area', 'آموزش'), F_('InstructionsEN', 'Instructions (EN)', 'area', 'آموزش'),
      F_('SuggestedSets', 'ست پیشنهادی', 'num', 'پیشنهاد'), F_('SuggestedReps', 'تکرار پیشنهادی', 'text', 'پیشنهاد'),
      F_('RestSec', 'استراحت (ثانیه)', 'num', 'پیشنهاد'), F_('Intensity', 'شدت', 'text', 'پیشنهاد'), F_('Aliases', 'نام‌های دیگر (برای جستجو)', 'text', 'پیشنهاد'),
      F_('GifNewURL', 'لینک گیف جدید (اولویت اول)', 'url', 'رسانه'), F_('GifNewFileId', 'شناسهٔ فایل گیف جدید در درایو', 'text', 'رسانه'),
      F_('GifURL', 'لینک گیف قدیمی (پشتیبان)', 'url', 'رسانه'), F_('ImgSrc0', 'تصویر ۱', 'img', 'رسانه'), F_('ImgSrc1', 'تصویر ۲', 'img', 'رسانه'),
      F_('YouTubeURL', 'لینک یوتیوب', 'url', 'رسانه'), F_('SourceNote', 'یادداشت منبع', 'text', 'رسانه')
    ]
  },
  foods: {
    title: 'غذاها', sheet: 'SF_Foods', id: 'FoodID', prefix: 'FD', name: 'PersianName', sub: 'EnglishName',
    search: ['PersianName', 'EnglishName', 'Tags', 'Category'], facets: ['Category', 'DietType'],
    media: { img: ['ImageURL'], video: 'VideoURL' },
    fields: [
      F_('PersianName', 'نام فارسی', 'text'), F_('EnglishName', 'نام انگلیسی', 'text'), F_('Category', 'گروه غذایی', 'text'), F_('DietType', 'نوع رژیم', 'text'),
      F_('ServingName', 'واحد (مثلاً عدد، کاسه)', 'text', 'مقدار'), F_('ServingGrams', 'گرم در هر واحد', 'num', 'مقدار'),
      F_('Kcal100', 'کالری (۱۰۰ گرم)', 'num', 'ارزش غذایی'), F_('Protein100', 'پروتئین (۱۰۰ گرم)', 'num', 'ارزش غذایی'), F_('Carb100', 'کربوهیدرات (۱۰۰ گرم)', 'num', 'ارزش غذایی'),
      F_('Fat100', 'چربی (۱۰۰ گرم)', 'num', 'ارزش غذایی'), F_('Fiber100', 'فیبر (۱۰۰ گرم)', 'num', 'ارزش غذایی'),
      F_('Recipe', 'طرز تهیه', 'area', 'روش‌ها'), F_('Methods', 'روش‌های پخت (هر خط: روش | ضریب کالری | توضیح)', 'area', 'روش‌ها'),
      F_('ImageURL', 'تصویر محصول', 'img', 'رسانه'), F_('ImageCredit', 'اعتبار و مجوز تصویر', 'text', 'رسانه'), F_('ImageSourceURL', 'صفحهٔ منبع تصویر', 'url', 'رسانه'), F_('ImageSearchStatus', 'وضعیت جستجوی تصویر', 'text', 'رسانه'), F_('VideoURL', 'لینک یوتیوب', 'url', 'رسانه'), F_('WikiTitle', 'عنوان برای یافتن تصویر', 'text', 'رسانه'),
      F_('Tags', 'برچسب‌ها', 'text', 'رسانه')
    ]
  },
  supps: {
    title: 'مکمل‌ها', sheet: 'SF_SuppBank', id: 'SuppID', prefix: 'SP', name: 'PersianName', sub: 'EnglishName',
    search: ['PersianName', 'EnglishName', 'Category', 'Purpose'], facets: ['Category', 'Evidence'],
    media: { img: ['ImageURL'], video: 'VideoURL' },
    fields: [
      F_('PersianName', 'نام فارسی', 'text'), F_('EnglishName', 'نام انگلیسی', 'text'), F_('Category', 'دسته', 'text'), F_('Forms', 'شکل مصرف', 'text'),
      F_('Purpose', 'هدف', 'text', 'مصرف'), F_('Dose', 'دوز معمول', 'text', 'مصرف'), F_('Timing', 'زمان مصرف', 'text', 'مصرف'), F_('WithFood', 'همراه غذا', 'text', 'مصرف'),
      F_('Benefits', 'فواید', 'area', 'ایمنی'), F_('Cautions', 'احتیاط‌ها', 'area', 'ایمنی'), F_('Interactions', 'تداخل‌ها', 'area', 'ایمنی'),
      F_('Evidence', 'سطح شواهد', 'select', 'ایمنی', { options: ['قوی', 'متوسط', 'ضعیف'] }), F_('Notes', 'یادداشت', 'area', 'ایمنی'),
      F_('ImageURL', 'تصویر محصول', 'img', 'رسانه'), F_('ImageCredit', 'اعتبار و مجوز تصویر', 'text', 'رسانه'), F_('ImageSourceURL', 'صفحهٔ منبع تصویر', 'url', 'رسانه'), F_('ImageSearchStatus', 'وضعیت جستجوی تصویر', 'text', 'رسانه'), F_('VideoURL', 'لینک یوتیوب', 'url', 'رسانه'), F_('WikiTitle', 'عنوان برای یافتن تصویر', 'text', 'رسانه')
    ]
  },
  minerals: {
    title: 'ویتامین و مینرال', sheet: 'SF_MineralBank', id: 'MinID', prefix: 'MN', name: 'PersianName', sub: 'EnglishName',
    search: ['PersianName', 'EnglishName', 'Functions', 'FoodSources'], facets: ['Type'],
    media: { img: ['ImageURL'], video: 'VideoURL' },
    fields: [
      F_('PersianName', 'نام فارسی', 'text'), F_('EnglishName', 'نام انگلیسی', 'text'), F_('Type', 'نوع', 'select', 'اصلی', { options: ['مینرال', 'ویتامین'] }),
      F_('RdaMale', 'نیاز روزانه (مرد)', 'text', 'مقادیر'), F_('RdaFemale', 'نیاز روزانه (زن)', 'text', 'مقادیر'), F_('UpperLimit', 'حد بالای مجاز', 'text', 'مقادیر'),
      F_('Functions', 'نقش در بدن', 'area', 'اطلاعات'), F_('Deficiency', 'علائم کمبود', 'area', 'اطلاعات'), F_('Excess', 'عوارض زیاده‌روی', 'area', 'اطلاعات'),
      F_('FoodSources', 'منابع غذایی (مقدار در ۱۰۰ گرم)', 'area', 'اطلاعات'), F_('Absorption', 'نکتهٔ جذب', 'text', 'اطلاعات'), F_('Interactions', 'تداخل‌ها', 'text', 'اطلاعات'),
      F_('SuppForms', 'شکل‌های مکمل', 'text', 'اطلاعات'), F_('BestTime', 'بهترین زمان مصرف', 'text', 'اطلاعات'),
      F_('ImageURL', 'تصویر محصول', 'img', 'رسانه'), F_('ImageCredit', 'اعتبار و مجوز تصویر', 'text', 'رسانه'), F_('ImageSourceURL', 'صفحهٔ منبع تصویر', 'url', 'رسانه'), F_('ImageSearchStatus', 'وضعیت جستجوی تصویر', 'text', 'رسانه'), F_('VideoURL', 'لینک یوتیوب', 'url', 'رسانه'), F_('WikiTitle', 'عنوان برای یافتن تصویر', 'text', 'رسانه')
    ]
  }
};
function adm_bankSchemas_() {
  const out = {};
  Object.keys(ADM_BANKS).forEach(function (k) {
    const b = ADM_BANKS[k];
    out[k] = { title: b.title, sheetName: b.sheet, id: b.id, name: b.name, sub: b.sub, facets: b.facets, media: b.media, fields: b.fields };
  });
  return out;
}

/* ------------------------------------------------------------ آماده‌سازی شیت‌ها --- */
function adm_register_() {
  const extra = {
    SF_SuppBank: ['SuppID', 'PersianName', 'EnglishName', 'Category', 'Forms', 'Purpose', 'Dose', 'Timing', 'WithFood', 'Benefits', 'Cautions', 'Interactions', 'Evidence', 'Notes', 'ImageURL', 'VideoURL', 'WikiTitle', 'Active', 'ImageCredit', 'ImageSourceURL', 'ImageSearchStatus'],
    SF_MineralBank: ['MinID', 'PersianName', 'EnglishName', 'Type', 'RdaMale', 'RdaFemale', 'UpperLimit', 'Functions', 'Deficiency', 'Excess', 'FoodSources', 'Absorption', 'Interactions', 'SuppForms', 'BestTime', 'ImageURL', 'VideoURL', 'WikiTitle', 'Active', 'ImageCredit', 'ImageSourceURL', 'ImageSearchStatus']
  };
  Object.keys(extra).forEach(function (n) { SF_HEADERS[n] = extra[n]; SF_TEXT_COLS[n] = null; });
  if (SF_HEADERS.SF_ExerciseBank.indexOf('InstructionsEN') < 0) SF_HEADERS.SF_ExerciseBank.push('InstructionsEN');
  ['Methods', 'WikiTitle'].forEach(function (h) { if (SF_HEADERS.SF_Foods.indexOf(h) < 0) SF_HEADERS.SF_Foods.push(h); });
  ['ImageCredit', 'ImageSourceURL', 'ImageSearchStatus'].forEach(function (h) { if (SF_HEADERS.SF_Foods.indexOf(h) < 0) SF_HEADERS.SF_Foods.push(h); });
}
function adm_ensure_() {
  adm_register_();
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('ADM_READY_V2') === '1') return;
  props.deleteProperty(SF.READY_PROP);
  sfEnsure_();
  try { sfEnsureV16_(); } catch (e) {}
  props.setProperty('ADM_READY_V2', '1');
}
function adm_bank_(name) {
  const b = ADM_BANKS[name];
  if (!b) throw new Error('بانک نامعتبر است.');
  return b;
}

/* ------------------------------------------------------------ لیست/جستجو --- */
function adm_norm_(s) { return String(s == null ? '' : s).replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u200c]/g, ' ').toLowerCase(); }

/** opts: {q, facets:{Col:value}, page, size, onlyMissingMedia, onlyInactive} */
function adm_bankList(token, bank, opts) {
  adm_who_(token, false); adm_ensure_();
  const b = adm_bank_(bank); opts = opts || {};
  const rd = sfRead_(b.sheet);
  const all = sfObjects_(rd);
  const q = adm_norm_(opts.q);
  const facets = opts.facets || {};
  const facetVals = {}; b.facets.forEach(function (f) { facetVals[f] = {}; });
  all.forEach(function (o) { b.facets.forEach(function (f) { const v = normalize_(o[f]); if (v) facetVals[f][v] = (facetVals[f][v] || 0) + 1; }); });
  const imgCols = (b.media.img || []);
  const rows = all.filter(function (o) {
    for (var i = 0; i < b.facets.length; i++) { const f = b.facets[i]; if (facets[f] && normalize_(o[f]) !== facets[f]) return false; }
    if (opts.onlyInactive && sfIsTrue_(o.Active)) return false;
    if (opts.onlyMissingMedia && imgCols.every(function (c) { return normalize_(o[c]); })) return false;
    if (q) { const hay = adm_norm_(b.search.map(function (c) { return o[c]; }).join(' ')); if (hay.indexOf(q) < 0) return false; }
    return true;
  });
  const size = Math.max(10, Math.min(100, Number(opts.size) || 30));
  const page = Math.max(1, Number(opts.page) || 1);
  const slice = rows.slice((page - 1) * size, page * size).map(function (o) {
    const light = adm_light_(b, o);
    /* گیف‌های جدید مربی بر گیف قدیمی اولویت دارند (نصب‌شده در GifLibrary.js) */
    if (bank === 'exercises' && typeof sfBestGif_ === 'function') { const g = sfBestGif_(o); light._gif = g.url; light._gifSrc = g.src; }
    return light;
  });
  return { ok: true, total: rows.length, all: all.length, page: page, size: size, items: slice, facets: facetVals };
}
/* نسخهٔ سبک برای جدول: متن‌های بلند حذف می‌شوند تا پاسخ کوچک بماند */
function adm_light_(b, o) {
  const out = {};
  b.fields.forEach(function (f) { if (f.type !== 'area') out[f.k] = normalize_(o[f.k]); });
  out[b.id] = normalize_(o[b.id]); out.Active = sfIsTrue_(o.Active);
  return out;
}
function adm_bankGet(token, bank, id) {
  adm_who_(token, false); adm_ensure_();
  const b = adm_bank_(bank);
  const o = sfObjects_(sfRead_(b.sheet)).filter(function (r) { return normalize_(r[b.id]) === normalize_(id); })[0];
  if (!o) throw new Error('مورد پیدا نشد.');
  const out = {}; b.fields.forEach(function (f) { out[f.k] = normalize_(o[f.k]); });
  out[b.id] = normalize_(o[b.id]); out.Active = sfIsTrue_(o.Active);
  return out;
}

/* ------------------------------------------------------------ ذخیره/حذف --- */
function adm_clean_(b, f, v) {
  if (f.type === 'num') { const n = Number(String(v == null ? '' : v).replace(/,/g, '.')); return isFinite(n) && String(v).trim() !== '' ? n : ''; }
  const s = normalize_(v).slice(0, f.type === 'area' ? 4000 : 400);
  if ((f.type === 'url' || f.type === 'img') && s && !/^https?:\/\//i.test(s)) throw new Error('«' + f.label + '» باید با http:// یا https:// شروع شود.');
  return s;
}
function adm_foodServing_(o) {
  const g = Number(o.ServingGrams) || 100, k = g / 100;
  o.KcalServing = Math.round((Number(o.Kcal100) || 0) * k); o.ProteinServing = Math.round((Number(o.Protein100) || 0) * k);
  o.CarbServing = Math.round((Number(o.Carb100) || 0) * k); o.FatServing = Math.round((Number(o.Fat100) || 0) * k);
}
function adm_bankSave(token, bank, item) {
  adm_who_(token, true); adm_ensure_();
  const b = adm_bank_(bank); item = item || {};
  if (!normalize_(item[b.name])) throw new Error('نام الزامی است.');
  return sfWithLock_(function () {
    sfInvalidate_(b.sheet);
    const rd = sfRead_(b.sheet);
    const id = normalize_(item[b.id]) || (b.prefix + '-' + Date.now().toString(36).toUpperCase());
    const rowIdx = rd.rows.findIndex(function (r) { return normalize_(r[rd.idx[b.id]]) === id; });
    const obj = rowIdx >= 0 ? sfObj_(rd, rd.rows[rowIdx]) : {};
    b.fields.forEach(function (f) { if (item[f.k] !== undefined) obj[f.k] = adm_clean_(b, f, item[f.k]); });
    if (item.ImageURL !== undefined) obj.ImageSearchStatus = normalize_(item.ImageURL) ? 'manual' : '';
    obj[b.id] = id; obj.Active = item.Active === false ? 'FALSE' : 'TRUE';
    if (bank === 'foods') adm_foodServing_(obj);
    if (rowIdx >= 0) {
      const vals = rd.headers.map(function (h) { return obj[h] == null ? '' : obj[h]; });
      const rng = rd.sh.getRange(rowIdx + 2, 1, 1, rd.headers.length); rng.setNumberFormat('@'); rng.setValues([vals]);
    } else { sfAppend_(b.sheet, [obj]); }
    sfInvalidate_(b.sheet);
    if (bank === 'foods') sfBumpFoodCache_();
    return { ok: true, id: id, created: rowIdx < 0 };
  });
}
function adm_bankSetActive(token, bank, id, active) {
  adm_who_(token, true); adm_ensure_();
  const b = adm_bank_(bank);
  return sfWithLock_(function () {
    sfInvalidate_(b.sheet);
    const rd = sfRead_(b.sheet);
    const i = rd.rows.findIndex(function (r) { return normalize_(r[rd.idx[b.id]]) === normalize_(id); });
    if (i < 0) throw new Error('مورد پیدا نشد.');
    const c = rd.sh.getRange(i + 2, rd.idx.Active + 1); c.setNumberFormat('@'); c.setValue(active ? 'TRUE' : 'FALSE');
    sfInvalidate_(b.sheet); if (bank === 'foods') sfBumpFoodCache_();
    return { ok: true };
  });
}
function adm_bankDelete(token, bank, id) {
  adm_who_(token, true); adm_ensure_();
  const b = adm_bank_(bank);
  return sfWithLock_(function () {
    const kept = sfObjects_(sfRead_(b.sheet)).filter(function (o) { return normalize_(o[b.id]) !== normalize_(id); });
    sfRewrite_(b.sheet, function () { return false; }, kept);
    if (bank === 'foods') sfBumpFoodCache_();
    return { ok: true };
  });
}

/* ------------------------------------------------------------ تصویر خودکار از ویکی‌پدیا --- */
function adm_wikiReq_(title, search) {
  const base = 'https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=520&redirects=1';
  return { url: base + (search ? '&generator=search&gsrlimit=1&gsrsearch=' : '&titles=') + encodeURIComponent(title), muteHttpExceptions: true, headers: { 'User-Agent': 'SaeediFit-Admin/2.0' } };
}
function adm_wikiThumb_(resp) {
  try {
    if (resp.getResponseCode() !== 200) return '';
    const pages = (JSON.parse(resp.getContentText()).query || {}).pages || {};
    const k = Object.keys(pages)[0];
    return k && pages[k].thumbnail ? pages[k].thumbnail.source : '';
  } catch (e) { return ''; }
}
function adm_productImageReq_(query, bank) {
  var q = String(query || '').trim();
  if (!q) return null;
  if (bank === 'supps' || bank === 'minerals') q += ' supplement package';
  var url = 'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' + encodeURIComponent(q) +
    '&search_simple=1&action=process&json=1&page_size=8&fields=code,product_name,brands,image_front_url,photographers_tags';
  return { url: url, muteHttpExceptions: true, headers: { 'User-Agent': 'SaeediFit/2.1' } };
}
function adm_productImage_(resp, query) {
  try {
    if (!resp || resp.getResponseCode() !== 200) return null;
    var products = (JSON.parse(resp.getContentText()) || {}).products || [];
    var terms = String(query || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').split(/\s+/).filter(function (x) { return x.length > 2; });
    var best = null, bestScore = 0;
    products.forEach(function (p) {
      var image = String(p.image_front_url || '');
      if (!/^https:\/\/images\.openfoodfacts\.org\//i.test(image)) return;
      var title = String((p.product_name || '') + ' ' + (p.brands || '')).toLowerCase();
      var score = terms.length ? terms.filter(function (t) { return title.indexOf(t) >= 0; }).length / terms.length : 0;
      if (!best || score > bestScore) { best = p; bestScore = score; }
    });
    if (!best || bestScore < 0.34) return null;
    var code = String(best.code || '');
    var photographers = (best.photographers_tags || []).join(', ');
    return { image: String(best.image_front_url), source: code ? 'https://world.openfoodfacts.org/product/' + encodeURIComponent(code) : 'https://world.openfoodfacts.org/',
      credit: 'Open Food Facts' + (photographers ? ' · ' + photographers : '') + ' · CC BY-SA 3.0' };
  } catch (e) { return null; }
}
/** تصاویر محصول را از بانک محصول می‌گیرد؛ ردیف‌های بی‌نتیجه را علامت می‌زند تا جستجو دور بی‌نهایت نسازد. */
function adm_mediaFill(token, bank, limit) {
  adm_who_(token, true); adm_ensure_();
  const b = adm_bank_(bank);
  if (bank === 'exercises') throw new Error('برای حرکات از تصاویر آمادهٔ بانک استفاده می‌شود (همگام‌سازی).');
  return sfWithLock_(function () {
    sfInvalidate_(b.sheet);
    const rd = sfRead_(b.sheet);
    const todo = []; rd.rows.forEach(function (r, i) {
      var image = normalize_(r[rd.idx.ImageURL]), status = normalize_(r[rd.idx.ImageSearchStatus]);
      var placeholder = /^data:image\/svg\+xml/i.test(image);
      if (normalize_(r[0]) && (!image || placeholder) && status !== 'not-found') todo.push(i);
    });
    const batch = todo.slice(0, Math.max(1, Math.min(40, Number(limit) || 25)));
    const reqs = batch.map(function (i) { const r = rd.rows[i]; return adm_productImageReq_(normalize_(r[rd.idx.EnglishName]) || normalize_(r[rd.idx.PersianName]), bank); });
    const resp = reqs.length ? UrlFetchApp.fetchAll(reqs.map(function (r) { return r || { url: 'https://world.openfoodfacts.org/', muteHttpExceptions: true }; })) : [];
    let found = 0, unmatched = 0;
    function put(row, col, value) { if (rd.idx[col] == null) return; var c = rd.sh.getRange(row + 2, rd.idx[col] + 1); c.setNumberFormat('@'); c.setValue(value); }
    batch.forEach(function (i, n) {
      var r = rd.rows[i], name = normalize_(r[rd.idx.EnglishName]) || normalize_(r[rd.idx.PersianName]);
      var image = adm_productImage_(resp[n], name);
      if (image) {
        put(i, 'ImageURL', image.image); put(i, 'ImageCredit', image.credit); put(i, 'ImageSourceURL', image.source); put(i, 'ImageSearchStatus', 'product');
        found++;
      } else { put(i, 'ImageSearchStatus', 'not-found'); unmatched++; }
    });
    sfInvalidate_(b.sheet);
    if (bank === 'foods') sfBumpFoodCache_();
    return { ok: true, tried: batch.length, found: found, unmatched: unmatched, remaining: Math.max(0, todo.length - batch.length), missingTotal: todo.length };
  });
}

/* ------------------------------------------------------------ داشبورد --- */
function adm_dashboard(token) {
  const s = adm_who_(token, false); adm_ensure_();
  const dashKey = 'adm_dash_v4_' + String(s.role || '').toLowerCase() + '_' + String(s.username || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 48);
  try { const hit = CacheService.getScriptCache().get(dashKey); if (hit) return JSON.parse(hit); } catch (e) {}
  const out = { ok: true, role: String(s.role).toLowerCase(), users: { total: 0, user: 0, coach: 0, admin: 0 }, banks: {}, pending: 0, alerts: 0, errors: 0, telegram: { configured: false, adminChat: false } };
  try {
    sfObjects_(sfRead_(CONFIG.USERS_SHEET)).forEach(function (u) {
      const r = (normalize_(u.role) || 'user').toLowerCase(); out.users.total++; out.users[r] = (out.users[r] || 0) + 1;
    });
  } catch (e) {
    const v = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1).filter(function (r) { return normalize_(r[0]); });
    v.forEach(function (r) { const k = normalize_(r[5]).toLowerCase() || 'user'; out.users.total++; out.users[k] = (out.users[k] || 0) + 1; });
  }
  Object.keys(ADM_BANKS).forEach(function (k) {
    const b = ADM_BANKS[k]; let rows = [];
    try { rows = sfObjects_(sfRead_(b.sheet)); } catch (e) {}
    const imgs = b.media.img || [];
    const mediaCols = imgs.concat(b.media.gif ? [b.media.gif] : [], k === 'exercises' ? ['GifNewURL'] : []);
    const hasRealImage = function (o) { return mediaCols.some(function (c) { return /^https?:\/\//i.test(normalize_(o[c])); }); };
    out.banks[k] = { title: b.title, total: rows.length, noImage: rows.filter(function (o) { return !hasRealImage(o); }).length };
  });
  try { out.pending = sfObjects_(sfRead_('SF_Payments')).filter(function (p) { return String(normalize_(p.Status)).toLowerCase() === 'pending_review'; }).length; } catch (e) {}
  try { out.alerts = (sfCoachAlerts(token) || []).length; } catch (e) {}
  try {
    const board = adm_activityBoard(token, todayISO_());
    out.activity = { date: board.date, total: board.stats.total, completed: board.stats.completed, noLog: board.stats.noLog, rows: board.rows };
  } catch (e) { out.activity = { total: 0, completed: 0, noLog: 0, rows: [], error: String(e && e.message || e) }; }
  if (String(s.role).toLowerCase() === 'admin') {
    try { const err = getSS_().getSheetByName('SF_ErrorLog'); out.errors = err ? Math.max(0, err.getLastRow() - 1) : 0; } catch (e) {}
    try { const tg = sf3TgInfo_(); out.telegram = { configured: tg.configured, adminChat: tg.adminChat }; } catch (e) {}
  }
  try { CacheService.getScriptCache().put(dashKey, JSON.stringify(out), 30); } catch (e) {}
  return out;
}

/* حضور تمرین امروز بر پایهٔ WorkoutDone، ثبت ست‌ها و تکمیل SF_Progress. */
function adm_activityBoard(token, dateISO) {
  const session = adm_who_(token, false);
  const day = isValidDateStr_(dateISO) ? dateISO : todayISO_();
  const records = sfUserRecords_().filter(function (u) {
    if (u.role === 'admin' || u.role === 'coach') return false;
    if (String(session.role || '').toLowerCase() !== 'admin' && String(u.coachUsername || '').toLowerCase() !== String(session.username || '').toLowerCase()) return false;
    return true;
  });
  const done = {}, lastWork = {};
  function mark(username) { const k = String(username || '').toLowerCase(); if (k) done[k] = true; }
  function readSheet(name, predicate) {
    try {
      const sh = getSS_().getSheetByName(name); if (!sh || sh.getLastRow() < 2) return;
      const v = sh.getDataRange().getDisplayValues(), h = v[0].map(function (x) { return normalize_(x).toLowerCase(); });
      const userI = h.indexOf('username') >= 0 ? h.indexOf('username') : 0;
      const dateI = h.indexOf('dateiso') >= 0 ? h.indexOf('dateiso') : 1;
      const doneI = h.indexOf('completed');
      for (let i = 1; i < v.length; i++) {
        const username = String(v[i][userI] || '').trim().toLowerCase(), rowDay = dateKey_(v[i][dateI]);
        if (doneI >= 0 && !/^(true|1|yes|بله)$/i.test(String(v[i][doneI]).trim())) continue;
        if (predicate && !predicate(v[i], h)) continue;
        if (username && /^\d{4}-\d{2}-\d{2}$/.test(rowDay) && (!lastWork[username] || rowDay > lastWork[username])) lastWork[username] = rowDay;
        if (rowDay !== day) continue;
        mark(v[i][userI]);
      }
    } catch (e) {}
  }
  readSheet('WorkoutDone');
  readSheet('ExerciseLogs');
  readSheet('SF_Progress', function (r, h) {
    const i = h.indexOf('completed'); return i < 0 || /^(true|1|yes|بله)$/i.test(String(r[i]).trim());
  });
  const rows = records.map(function (u) {
    const username = String(u.username || '');
    return { username: username, telegram: !!u.telegramChatId, completed: !!done[username.toLowerCase()], lastActive: lastWork[username.toLowerCase()] || '' };
  }).sort(function (a, b) { return Number(a.completed) - Number(b.completed) || a.username.localeCompare(b.username); });
  const completed = rows.filter(function (r) { return r.completed; }).length;
  return { ok: true, date: day, rows: rows, stats: { total: rows.length, completed: completed, noLog: rows.length - completed, linkedTelegram: rows.filter(function (r) { return r.telegram; }).length } };
}

/* یادآوری تلگرام برای شاگردان انتخاب‌شده‌ای که امروز تمرین را ثبت نکرده‌اند. */
function adm_sendActivityReminder(token, usernames, message, dateISO) {
  const session = adm_who_(token, false);
  const board = adm_activityBoard(token, dateISO);
  const selected = Array.from(new Set((usernames || []).map(function (x) { return String(x || '').trim().toLowerCase(); }).filter(Boolean))).slice(0, 60);
  if (!selected.length) throw new Error('حداقل یک شاگرد را انتخاب کن.');
  const eligible = board.rows.filter(function (r) { return selected.indexOf(r.username.toLowerCase()) >= 0 && !r.completed; });
  if (!eligible.length) throw new Error('شاگرد انتخاب‌شده‌ای بدون ثبت تمرین امروز پیدا نشد.');
  const botToken = (typeof botProps_ === 'function' ? botProps_().getProperty('TELEGRAM_BOT_TOKEN') : PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN')) || '';
  if (!botToken) throw new Error('توکن ربات تلگرام تنظیم نشده است.');
  const users = sfUserRecords_(), byName = {};
  users.forEach(function (u) { byName[String(u.username || '').toLowerCase()] = u; });
  const body = String(message || 'امروز هنوز ثبت تمرین نداری. اگر تمرینت را انجام دادی، لطفاً آن را در برنامه علامت بزن. اگر امروز روز استراحتت است، این پیام را نادیده بگیر.').trim().slice(0, 1000);
  const reqs = [], targets = [];
  eligible.forEach(function (r) {
    const u = byName[r.username.toLowerCase()] || {};
    if (String(session.role || '').toLowerCase() !== 'admin' && String(u.coachUsername || '').toLowerCase() !== String(session.username || '').toLowerCase()) return;
    if (!u.telegramChatId) return;
    reqs.push({ url: 'https://api.telegram.org/bot' + botToken + '/sendMessage', method: 'post', payload: { chat_id: u.telegramChatId, text: body }, muteHttpExceptions: true });
    targets.push(r.username);
  });
  if (!reqs.length) throw new Error('برای شاگردان انتخاب‌شده شناسهٔ تلگرام ثبت نشده یا دسترسی مربی ندارند.');
  const res = UrlFetchApp.fetchAll(reqs);
  let sent = 0, failed = 0;
  res.forEach(function (r) { try { if (r.getResponseCode() === 200 && JSON.parse(r.getContentText()).ok) sent++; else failed++; } catch (e) { failed++; } });
  return { ok: true, sent: sent, failed: failed, targets: targets };
}

/** فهرست خطاهای ثبت‌شده، فقط برای ادمین */
function adm_errorsList(token, limit) {
  adm_who_(token, true);
  var sh = getSS_().getSheetByName('SF_ErrorLog');
  if (!sh || sh.getLastRow() < 2) return { ok: true, rows: [] };
  var values = sh.getDataRange().getDisplayValues();
  var headers = values.shift().map(function (h) { return normalize_(h); });
  var max = Math.max(1, Math.min(150, Number(limit) || 80));
  var rows = values.slice(-max).reverse().map(function (r) {
    var o = {};
    headers.forEach(function (h, i) { o[h] = r[i] || ''; });
    return {
      time: o.Time, app: o.App, username: o.User, role: o.Role, action: o.Action,
      fn: o.Function, message: o.Message, extra: o.Extra, url: o.URL, stack: o.Stack
    };
  });
  return { ok: true, rows: rows };
}

/* ------------------------------------------------------------ کاربران --- */
/* ستون‌های Users: A نام، B رمز، C مکمل، D تمرین، E غذا، F نقش، G تلگرام، H ایمیل (طبق Code.gs)، I مربی */
function adm_usersList(token) {
  adm_who_(token, true);
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  const v = sh.getDataRange().getDisplayValues();
  const out = [];
  for (let i = 1; i < v.length; i++) {
    const r = v[i]; if (!normalize_(r[0])) continue;
    out.push({ username: normalize_(r[0]), role: normalize_(r[5]).toLowerCase() || 'user', supp: normalize_(r[2]), workout: normalize_(r[3]), diet: normalize_(r[4]), telegram: normalize_(r[6]), email: normalize_(r[7]), coach: normalize_(r[8]) });
  }
  const sheets = getSS_().getSheets().map(function (x) { return x.getName(); });
  return { ok: true, users: out, sheetNames: sheets };
}
function adm_userSave(token, input) {
  const me = adm_who_(token, true); input = input || {};
  const t = getUserRecord_(input.username);
  if (!t) throw new Error('کاربر پیدا نشد.');
  const role = String(input.role || '').toLowerCase();
  if (['user', 'coach', 'admin'].indexOf(role) < 0) throw new Error('نقش نامعتبر است.');
  if (t.role === 'admin' && role !== 'admin') {
    const admins = getSS_().getSheetByName(CONFIG.USERS_SHEET).getDataRange().getValues().slice(1).filter(function (r) { return normalize_(r[0]) && normalize_(r[5]).toLowerCase() === 'admin'; }).length;
    if (admins <= 1) throw new Error('حداقل یک ادمین باید بماند.');
  }
  const sh = getSS_().getSheetByName(CONFIG.USERS_SHEET);
  const pipe = function (s) { return String(s || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean).join('|'); };
  sfWithLock_(function () {
    sh.getRange(t.row, 3, 1, 4).setValues([[pipe(input.supp), pipe(input.workout), pipe(input.diet), role]]);
    const g = sh.getRange(t.row, 7); g.setNumberFormat('@'); g.setValue(normalize_(input.telegram));
    const i9 = sh.getRange(t.row, 9); i9.setNumberFormat('@'); i9.setValue(normalize_(input.coach));
  });
  return { ok: true };
}

/* صفحهٔ پنل مدیریت برای میزبانی روی Cloudflare (همان مسیر JSON اپ) */
function sfGetAdminPage() {
  try { return HtmlService.createTemplateFromFile('AdminApp').evaluate().getContent(); }
  catch (e) { return HtmlService.createHtmlOutputFromFile('AdminApp').getContent(); }
}
