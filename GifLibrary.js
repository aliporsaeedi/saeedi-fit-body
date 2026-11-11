/**
 * GifLibrary.js — تطبیق «گیف‌های جدید» مربی با بانک حرکات
 *
 * قاعده‌ها:
 *   ۱) هر فایل گیف/تصویر داخل پوشهٔ گیف‌ها با نام حرکت تطبیق داده می‌شود.
 *   ۲) اگر حرکتی در بانک پیدا نشد، همان‌جا ساخته می‌شود تا «هر گیفی که هست،
 *      حرکتش هم در لیست حرکات باشد».
 *   ۳) گیف جدید در ستون‌های GifNewFileId / GifNewURL ذخیره می‌شود و در نمایش
 *      همیشه بر گیف قدیمی (GifURL / GifFileId) اولویت دارد؛ گیف قدیمی فقط
 *      وقتی دیده می‌شود که گیف جدیدی برای آن حرکت وجود نداشته باشد.
 *
 * پوشه: پارامتر (لینک/آیدی/نام) → Script Property با نام SF_GIF_FOLDER →
 *        پوشهٔ SaeediFit_New_GIFs → پوشهٔ دانلود SaeediFit_Exercise_GIFs
 */

var SF_GIF_LIB = {
  DEFAULT_FOLDER: 'SaeediFit_New_GIFs',
  MEDIA_EXT: /\.(gif|webp|png|jpe?g)$/i,
  MAX_FILES: 400
};

/** نام و لینک پوشهٔ گیف (برای نشان دادن به مربی در پنل). */
function sfGifFolderInfo(ref) {
  try {
    var f = sfGifFolder_(ref);
    return { ok: true, name: f.getName(), id: f.getId(), url: 'https://drive.google.com/drive/folders/' + f.getId() };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e), name: SF_GIF_LIB.DEFAULT_FOLDER };
  }
}

function sfGifFolderRef_() {
  try { return PropertiesService.getScriptProperties().getProperty('SF_GIF_FOLDER') || ''; } catch (e) { return ''; }
}

function sfGifFolder_(ref) {
  var r = normalize_(ref) || sfGifFolderRef_();
  if (r) {
    var id = sfDriveIdFromUrl_(r);
    var fm = r.match(/\/folders\/([\w-]{20,})/);
    if (!id && fm) id = fm[1];
    if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
    if (/^[A-Za-z0-9_-]{20,}$/.test(r)) { try { return DriveApp.getFolderById(r); } catch (e2) {} }
    var byName = DriveApp.getFoldersByName(r);
    if (byName.hasNext()) return byName.next();
  }
  var def = DriveApp.getFoldersByName(SF_GIF_LIB.DEFAULT_FOLDER);
  if (def.hasNext()) return def.next();
  var dl = DriveApp.getFoldersByName(SF.DRIVE_FOLDER);
  if (dl.hasNext()) return dl.next();
  /* هیچ پوشه‌ای نبود: خودمان می‌سازیم و لینکش را برمی‌گردانیم تا مربی فقط
     فایل‌ها را داخلش بریزد (قبلاً این‌جا خطا می‌داد و کار متوقف می‌شد). */
  var made = DriveApp.createFolder(SF_GIF_LIB.DEFAULT_FOLDER);
  try { made.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eSh) {}
  return made;
}

/** نام فایل → نام حرکت: پسوند، آندرلاین، شماره‌های ابتدایی و پرانتز حذف می‌شوند. */
function sfGifName_(fileName) {
  var s = String(fileName == null ? '' : fileName)
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s*[-–—]+\s*/g, ' ')
    .replace(/[()\[\]{}]+/g, ' ');
  s = sfPiClean_(s);
  s = s.replace(/^(EXC?\s*\d+|SF\s*-?\s*\d+)\s+/i, '').replace(/\s+\d{1,3}$/, '');
  return s.trim();
}

/** نام‌های جایگزین برای تطبیق بهتر (حذف کلمات تجهیزاتی/اضافه). */
function sfGifNameVariants_(name) {
  var out = [name];
  var s = String(name || '');
  var stripped = s.replace(/\b(دستگاه|با دستگاه|دمبل|هالتر|سیم‌کش|سیم کش|کابل|وزنه بدن|بدون وزنه|اسمیت)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (stripped && stripped !== s) out.push(stripped);
  var first = s.split(/\s+(?:و|با)\s+|،|,/)[0].trim();
  if (first && first !== s && first.length > 2) out.push(first);
  return out;
}

/** بهترین آدرس رسانه برای یک حرکت (گیف جدید → فایل درایو → گیف قدیمی). */
function sfBestGif_(o) {
  var m = sfMediaOf_(o);
  return m.gif && m.gif.length ? { url: m.gif[0], candidates: m.gif, src: m.src } : { url: '', candidates: [], src: '' };
}

function sfGifSetNew_(rd, rowIdx, file, opts) {
  opts = opts || {};
  var sh = rd.sh, I = rd.idx;
  var put = function (col, val) {
    if (I[col] === undefined) return;
    var c = sh.getRange(rowIdx + 2, I[col] + 1);
    c.setNumberFormat('@');
    c.setValue(val);
  };
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (eSh) {}
  put('GifNewFileId', file.getId());
  put('GifNewURL', 'https://lh3.googleusercontent.com/d/' + file.getId());
  if (opts.mediaStatus) put('MediaStatus', opts.mediaStatus);
}

/**
 * یک دور تطبیق کامل. dryRun=true فقط گزارش می‌دهد و چیزی نمی‌نویسد.
 * خروجی: { files, matched, created, skipped:[{name, reason}], ... }
 */
function sfGifLibrarySync_(ref, dryRun) {
  sfEnsure_();
  var folder = sfGifFolder_(ref);
  var it = folder.getFiles();
  var files = [];
  while (it.hasNext() && files.length < SF_GIF_LIB.MAX_FILES) {
    var f = it.next();
    if (SF_GIF_LIB.MEDIA_EXT.test(f.getName())) files.push(f);
  }

  var res = { ok: true, folder: folder.getName(), files: files.length, matched: 0, created: 0, createdNames: [], skipped: [], dryRun: !!dryRun, remaining: 0 };
  if (!files.length) return res;

  var done = {};
  var rd = sfRead_(SF.BANK);

  files.forEach(function (file) {
    var name = sfGifName_(file.getName());
    if (!name) { res.skipped.push({ name: file.getName(), reason: 'نام فایل خوانا نبود' }); return; }

    var bank = null;
    sfGifNameVariants_(name).forEach(function (v) {
      if (bank) return;
      try { bank = sfBankByName_(v); } catch (e) { bank = null; }
    });

    if (bank) {
      var id = normalize_(bank.ExerciseID);
      if (done[id]) { res.skipped.push({ name: name, reason: 'گیف تکراری برای «' + bank.PersianName + '»' }); return; }
      done[id] = 1;
      if (!dryRun) {
        var rowIdx = rd.rows.findIndex(function (r) { return normalize_(r[0]) === id; });
        if (rowIdx < 0) { res.skipped.push({ name: name, reason: 'ردیف حرکت در بانک پیدا نشد' }); return; }
        sfGifSetNew_(rd, rowIdx, file, { mediaStatus: 'new-gif' });
      }
      res.matched++;
      return;
    }

    if (dryRun) { res.created++; res.createdNames.push(name); return; }
    /* گیف بدون حرکت: حرکت ساخته می‌شود تا هیچ گیفی بی‌حرکت نماند */
    try {
      var row = sfPiCreateBank_(name, { group: sfPiGuessGroup_(name, ''), sets: 3, reps: '10', rest: 60 });
      rd = sfRead_(SF.BANK);
      var newIdx = rd.rows.findIndex(function (r) { return normalize_(r[0]) === normalize_(row.ExerciseID); });
      if (newIdx >= 0) sfGifSetNew_(rd, newIdx, file, { mediaStatus: 'new-gif' });
      done[normalize_(row.ExerciseID)] = 1;
      res.created++;
      res.createdNames.push(name);
    } catch (e) {
      res.skipped.push({ name: name, reason: 'ساخت حرکت ناموفق بود: ' + ((e && e.message) || e) });
    }
  });

  if (!dryRun) { sfInvalidate_(SF.BANK); SF_BANK_MEMO_ = null; }
  return res;
}

function sfGifLibraryStatus_() {
  sfEnsure_();
  var rows = sfObjects_(sfRead_(SF.BANK));
  var st = { total: rows.length, newGif: 0, oldOnly: 0, noGif: 0, folder: '', folderRef: sfGifFolderRef_() };
  rows.forEach(function (o) {
    if (normalize_(o.GifNewFileId) || normalize_(o.GifNewURL)) st.newGif++;
    else if (normalize_(o.GifFileId) || normalize_(o.GifURL)) st.oldOnly++;
    else st.noGif++;
  });
  try { st.folder = sfGifFolder_('').getName(); } catch (e) { st.folder = ''; }
  return st;
}

/* ---------------- API پنل ادمین ---------------- */

function sfAdminGifStatus(token) {
  sfAdmin_(token);
  return sfGifLibraryStatus_();
}

function sfAdminGifSync(token, ref, dryRun) {
  sfAdmin_(token);
  return sfWithLock_(function () { return sfGifLibrarySync_(ref, dryRun); });
}

/** پوشهٔ گیف‌ها را برای اجراهای بعدی ذخیره می‌کند. */
function sfAdminGifFolderSave(token, ref) {
  sfAdmin_(token);
  var r = normalize_(ref);
  if (!r) throw new Error('لینک یا نام پوشه خالی است.');
  PropertiesService.getScriptProperties().setProperty('SF_GIF_FOLDER', r);
  return { ok: true, folder: sfGifFolder_(r).getName(), ref: r };
}
