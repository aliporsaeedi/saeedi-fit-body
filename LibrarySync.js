/**
 * LibrarySync.gs — کتابخانهٔ ۱۳۲۳ حرکتی ExerciseGymGifsDB → بانک حرکات
 *
 * قاعده‌ها (طبق درخواست مربی):
 *   ۱) کتابخانهٔ جدید منبع اصلی است: گیف کتابخانه روی ردیف حرکت می‌نشیند.
 *   ۲) هر حرکت قدیمی که در کتابخانه هم هست، حذف نمی‌شود؛ فقط گیف جدید به آن
 *      اضافه می‌شود تا گیف قبلی به‌عنوان «پشتیبان» بماند (اگر گیف جدید لود نشد،
 *      همان گیف قدیمی نمایش داده می‌شود — منطقش در sfMediaOf_ است).
 *   ۳) اگر حرکتی در بانک نبود، از کتابخانه ساخته می‌شود (شناسهٔ EXL...).
 *   ۴) گیف‌ها اول از CDN خوانده می‌شوند؛ هر وقت مربی دکمهٔ «دانلود به درایو» را
 *      بزند، فایل به درایو خودش منتقل می‌شود و از آن به بعد بدون اینترنت خارجی
 *      هم نمایش داده می‌شود.
 */

var SF_LIB_SET = {
  PDF_BUDGET_MS: 210000,   // سهم زمانی هر فراخوانی دانلود (درایو)
  PDF_MAX_ITEMS: 40,       // حداکثر حرکت در هر فراخوانی
  FOLDER: 'SaeediFit_Exercise_GIFs'
};

/* ---------------------------------------------------------------- کمکی‌ها --- */

function sfLibKey_(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '');
}

/* کلید بی‌ترتیبِ نام انگلیسی: «Barbell Bench Press - Medium Grip» و
   «barbell bench grip medium press» یکی می‌شوند تا حرکات تکراری ساخته نشود. */
var SF_LIB_STOP_ = { the: 1, a: 1, an: 1, with: 1, on: 1, to: 1, of: 1, v: 1, '2': 1, '3': 1, male: 1, female: 1, exercise: 1, in: 1, and: 1, for: 1, up: 1 };
function sfLibTokenKey_(s) {
  var parts = String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9\s-]+/g, ' ').split(/[\s-]+/);
  var out = [];
  parts.forEach(function (t) { if (t && !SF_LIB_STOP_[t]) out.push(t); });
  out.sort();
  return out.join(' ');
}

/** ایندکس بانک: شناسه و نام انگلیسی و نام‌های جایگزین → شمارهٔ ردیف شیت */
function sfLibBankIndex_() {
  var rd = sfRead_(SF.BANK);
  var I = rd.idx, byId = {}, byName = {}, byTokens = {}, rows = [];
  rd.rows.forEach(function (r, i) {
    var id = normalize_(r[I.ExerciseID]);
    if (!id) return;
    rows.push({ rowNo: i + 2, id: id, r: r });
    byId[id] = i + 2;
    var en = sfLibKey_(r[I.EnglishName]);
    if (en && !byName[en]) byName[en] = i + 2;
    var et = sfLibTokenKey_(r[I.EnglishName]);
    if (et && !byTokens[et]) byTokens[et] = i + 2;
    var fa = sfLibKey_(r[I.PersianName]);
    if (fa && !byName[fa]) byName[fa] = i + 2;
    String(r[I.Aliases] || '').split(/[،,|؛;]/).forEach(function (a) {
      var k = sfLibKey_(a);
      if (k && !byName[k]) byName[k] = i + 2;
    });
  });
  return { rd: rd, byId: byId, byName: byName, byTokens: byTokens, rows: rows };
}

function sfLibFindRow_(idx, it) {
  if (idx.byId[it.id]) return idx.byId[it.id];
  var k = sfLibKey_(it.n);
  if (k && idx.byName[k]) return idx.byName[k];
  var fk = sfLibKey_(it.fa);
  if (fk && idx.byName[fk]) return idx.byName[fk];
  var tk = sfLibTokenKey_(it.n);
  if (tk && idx.byTokens[tk]) return idx.byTokens[tk];
  return 0;
}

/** یک آیتم کتابخانه → آبجکت ردیف بانک (برای ردیف‌های تازه) */
function sfLibRow_(it) {
  var o = {};
  o.ExerciseID = it.id;
  o.PersianName = it.fa;
  o.EnglishName = it.n;
  o.Category = it.c === 'cardio' ? 'هوازی' : (it.g === 'شکم' || it.g === 'پهله' ? 'شکم و پهلو' : (it.c === 'stretching' ? 'کششی' : 'بدنسازی'));
  o.MuscleGroup = it.g;
  o.SubGroup = it.sub || '';
  o.SecondaryMuscle = (it.sec || []).join('، ');
  o.Equipment = it.ef;
  o.Level = it.lv;
  o.MovementType = it.mech;
  o.Instructions = '«' + it.fa + '» — ' + it.g + ' با ' + it.ef + '. حرکت را در دامنهٔ کامل و کنترل‌شده اجرا کنید؛ برگشت (فاز منفی) آهسته‌تر از حرکت باشد. تنفس: بازدم در فاز تلاش، دم در برگشت.';
  o.Tips = it.c === 'stretching' ? 'کشش تا حد کشش ملایم، بدون درد؛ هر وضعیت را نگه دارید.' : '';
  o.SuggestedSets = String(it.sets || 3);
  o.SuggestedReps = String(it.reps || '8-12');
  o.RestSec = String(it.rest || 75);
  o.Intensity = '';
  o.Aliases = [it.n].filter(Boolean).join('، ');
  o.GifURL = it.gif;      // منبع اصلی CDN، فقط به‌عنوان پشتیبان
  o.GifSourceURL = sfLibMedia_(it);
  o.GifFileId = '';
  o.ImgSrc0 = it.thumb || '';
  o.ImgSrc1 = '';
  o.ImgFileId0 = '';
  o.ImgFileId1 = '';
  o.YouTubeURL = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(it.n + ' exercise proper form tutorial');
  o.MediaStatus = 'cdn';
  o.Active = 'بله';
  o.SourceNote = 'کتابخانهٔ ExerciseGymGifsDB ' + SF_LIB_VERSION + ' (گیف: صاحب اثر اصلی)';
  o.GifNewFileId = '';
  o.GifNewURL = sfLibMedia_(it);   // منبع اصلی نمایش تا وقتی در درایو ذخیره شود
  return o;
}

/* ------------------------------------------------------------- وضعیت/گزارش --- */

function sfLibStats_() {
  var idx = sfLibBankIndex_();
  var I = idx.rd.idx, st = {
    version: SF_LIB_VERSION, total: SF_LIB.length, inBank: 0, matched: 0, missing: 0,
    cdnOnly: 0, inDrive: 0, withOldGif: 0, bankTotal: idx.rows.length
  };
  SF_LIB.forEach(function (it) {
    var rowNo = sfLibFindRow_(idx, it);
    if (!rowNo) { st.missing++; return; }
    if (idx.byId[it.id]) st.inBank++; else st.matched++;
    var r = idx.rd.rows[rowNo - 2] || [];
    if (normalize_(r[I.GifFileId]) || normalize_(r[I.GifNewFileId])) st.inDrive++;
    else if (normalize_(r[I.GifNewURL]) || normalize_(r[I.GifSourceURL])) st.cdnOnly++;
    if (normalize_(r[I.GifURL]) && !normalize_(r[I.GifNewFileId])) st.withOldGif++;
  });
  return st;
}

function sfAdminLibStatus(token) {
  sfAdmin_(token); sfEnsure_();
  var st = sfLibStats_();
  st.ok = true;
  st.folder = SF_LIB_SET.FOLDER;
  return st;
}

/* -------------------------------------------------------------- ورود داده --- */

/**
 * کتابخانه را وارد بانک می‌کند:
 *   - حرکات ناموجود را می‌سازد،
 *   - برای حرکات موجودی که گیف ندارند، گیف کتابخانه را می‌گذارد،
 *   - هیچ گیف قبلی‌ای را پاک نمی‌کند.
 */
function sfAdminLibImport(token) {
  sfAdmin_(token); sfEnsure_();
  return sfWithLock_(function () {
    var idx = sfLibBankIndex_();
    var rd = idx.rd, sh = rd.sh, I = rd.idx;
    var added = 0, gifFilled = 0, ytFilled = 0, kept = 0, rebased = 0;
    var fresh = [];

    SF_LIB.forEach(function (it) {
      var rowNo = sfLibFindRow_(idx, it);
      if (!rowNo) { fresh.push(sfLibRow_(it)); return; }
      var r = rd.rows[rowNo - 2] || [];
      var setCell = function (col, val) {
        if (I[col] == null) return;
        var c = sh.getRange(rowNo, I[col] + 1);
        c.setNumberFormat('@'); c.setValue(val);
      };
      var hasDrive = !!(normalize_(r[I.GifNewFileId]) || normalize_(r[I.GifFileId]));
      var hasNew = !!(normalize_(r[I.GifNewURL]) || normalize_(r[I.GifNewFileId]));
      /* مهاجرت: لینک‌های قدیمی CDN به نسخهٔ سبک و میزبانی‌شدهٔ خودمان تغییر می‌کند
         تا اپ به jsDelivr وابسته نباشد (و آفلاین هم کار کند). */
      var curNew = normalize_(r[I.GifNewURL]), curSrc = normalize_(r[I.GifSourceURL]);
      if (curNew && curNew.indexOf('cdn.jsdelivr.net') >= 0 && normalize_(it.gifSelf)) {
        setCell('GifNewURL', it.gifSelf); rebased++; curNew = it.gifSelf;
      }
      if (curSrc && curSrc.indexOf('cdn.jsdelivr.net') >= 0 && normalize_(it.gifSelf)) {
        setCell('GifSourceURL', it.gifSelf); curSrc = it.gifSelf;
      }
      if (hasDrive) { kept++; }
      else if (!hasNew) {
        setCell('GifNewURL', sfLibMedia_(it));
        if (!normalize_(r[I.GifSourceURL])) setCell('GifSourceURL', sfLibMedia_(it));
        if (!normalize_(r[I.ImgSrc0]) && it.thumb) setCell('ImgSrc0', it.thumb);
        if (!normalize_(r[I.MediaStatus])) setCell('MediaStatus', 'cdn');
        gifFilled++;
      } else {
        kept++;
      }
      if (!normalize_(r[I.GifURL])) setCell('GifURL', sfLibMedia_(it));
      if (!normalize_(r[I.YouTubeURL])) {
        setCell('YouTubeURL', 'https://www.youtube.com/results?search_query=' + encodeURIComponent(it.n + ' exercise proper form tutorial'));
        ytFilled++;
      }
    });

    if (fresh.length) {
      // دسته‌ای می‌نویسیم تا یک اجرا با ۱۳۰۰ ردیف هم جا شود.
      for (var i = 0; i < fresh.length; i += 200) {
        sfWriteBankRows_(sh, fresh.slice(i, i + 200).map(sfLibRowToArray_));
      }
      added = fresh.length;
    }
    sfInvalidate_(SF.BANK);
    var st = sfLibStats_();
    return {
      ok: true, added: added, gifFilled: gifFilled, youtubeFilled: ytFilled, kept: kept, rebased: rebased,
      total: st.total, inBank: st.inBank, missing: st.missing, cdnOnly: st.cdnOnly, inDrive: st.inDrive, bankTotal: st.bankTotal
    };
  });
}

function sfLibRowToArray_(o) {
  return SF_BANK_HEADERS.map(function (h) { return o[h] == null ? '' : String(o[h]); });
}

/* ------------------------------------------------------- دانلود به درایو --- */


/* نسخهٔ سبک و میزبانی‌شدهٔ خودمان (WebP متحرک) اولویت دارد؛ CDN فقط پشتیبان است. */
function sfLibMedia_(it) {
  if (!it) return '';
  return normalize_(it.gifSelf) || normalize_(it.gif) || '';
}

function sfLibDriveFolder_() {
  var it = DriveApp.getFoldersByName(SF_LIB_SET.FOLDER);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(SF_LIB_SET.FOLDER);
}

/** یک دسته گیف کتابخانه را به درایو مربی منتقل می‌کند (قابل تکرار تا ته). */
function sfLibDownloadBatch_(maxItems, budgetMs) {
  sfEnsure_();
  var idx = sfLibBankIndex_();
  var rd = idx.rd, sh = rd.sh, I = rd.idx;
  var started = Date.now();
  var folder = sfLibDriveFolder_();
  var res = { processed: 0, saved: 0, failed: 0, remaining: 0, errors: [] };

  var todo = [];
  SF_LIB.forEach(function (it) {
    var rowNo = sfLibFindRow_(idx, it);
    if (!rowNo) return;
    var r = rd.rows[rowNo - 2] || [];
    if (normalize_(r[I.GifFileId]) || normalize_(r[I.GifNewFileId])) return;
    todo.push({ it: it, rowNo: rowNo, r: r });
  });

  todo.forEach(function (job) {
    if (res.processed >= maxItems || Date.now() - started > budgetMs) return;
    var it = job.it, rowNo = job.rowNo;
    var setCell = function (col, val) {
      if (I[col] == null) return;
      var c = sh.getRange(rowNo, I[col] + 1);
      c.setNumberFormat('@'); c.setValue(val);
    };
    try {
      var id = sfDownloadToDrive_(folder, sfLibMedia_(it), it.id + '_gif');
      setCell('GifFileId', id);
      // گیف درایو، منبع اصلی می‌شود؛ لینک CDN پاک می‌شود تا نمایش از درایو باشد.
      if (normalize_(job.r[I.GifNewURL])) setCell('GifNewURL', '');
      if (!normalize_(job.r[I.GifSourceURL])) setCell('GifSourceURL', sfLibMedia_(it));
      try {
        if (it.thumb) setCell('ImgFileId0', sfDownloadToDrive_(folder, it.thumb, it.id + '_thumb'));
      } catch (eThumb) { /* تصویر بندانگشتی اختیاری است */ }
      setCell('MediaStatus', 'drive');
      res.saved++;
    } catch (e) {
      setCell('MediaStatus', 'cdn');
      res.failed++;
      if (res.errors.length < 12) res.errors.push(it.fa + ' — ' + e.message);
    }
    res.processed++;
  });

  res.remaining = todo.length - res.processed;
  sfInvalidate_(SF.BANK);
  return res;
}

/**
 * بازگرداندن دسترسی «هر کسی با لینک» روی فایل‌های گیف/تصویر شیت.
 * اگر دسترسی این فایل‌ها در درایو بسته شده باشد، گیف‌ها در اپ باز نمی‌شوند
 * (آیکن تصویر لود نمی‌شود) در حالی که ردیف و لینک در شیت سالم است.
 */
function sfAdminLibReshare(token) {
  sfAdmin_(token);
  var rd = sfRead_(SF.BANK), I = rd.idx;
  var cols = ['GifFileId', 'GifNewFileId', 'ImgFileId0', 'ImgFileId1'];
  var ids = {}, seen = 0;
  rd.rows.forEach(function (r) {
    cols.forEach(function (c) {
      var id = normalize_(r[I[c]]);
      if (id && /^[A-Za-z0-9_-]{20,}$/.test(id)) { if (!ids[id]) { ids[id] = 1; seen++; } }
    });
  });
  var list = Object.keys(ids);
  var mode = sfMediaSharing_();
  var out = { mode: mode, total: list.length, shared: 0, failed: 0, left: 0, errors: [] };
  if (!list.length || mode === 'PRIVATE') { out.left = list.length; return out; }
  var access = mode === 'DOMAIN_WITH_LINK' ? DriveApp.Access.DOMAIN_WITH_LINK : DriveApp.Access.ANYONE_WITH_LINK;
  var budget = Date.now() + 240000;
  for (var i = 0; i < list.length; i++) {
    if (Date.now() > budget) { out.left = list.length - i; break; }
    try {
      DriveApp.getFileById(list[i]).setSharing(access, DriveApp.Permission.VIEW);
      out.shared++;
    } catch (e) {
      out.failed++;
      if (out.errors.length < 8) out.errors.push(list[i] + ': ' + ((e && e.message) || e));
    }
  }
  return out;
}

function sfAdminLibDownload(token) {
  sfAdmin_(token);
  return sfWithLock_(function () { return sfLibDownloadBatch_(SF_LIB_SET.PDF_MAX_ITEMS, SF_LIB_SET.PDF_BUDGET_MS); });
}

// از ادیتور Apps Script: Run > sfLibDownloadRun — چند بار اجرا کن تا remaining=0 شود.
function sfLibDownloadRun() {
  var r = sfLibDownloadBatch_(120, 290000);
  Logger.log('ذخیره شد: %s | ناموفق: %s | باقی‌مانده: %s', r.saved, r.failed, r.remaining);
  r.errors.forEach(function (e) { Logger.log(e); });
  return r;
}
