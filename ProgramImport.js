/**
 * ProgramImport.js — ورود هوشمند برنامهٔ تمرین از فایل
 *
 * قالب ورودی همان قالب شیت/CSV مربی است:
 *   | ردیف | نام حرکت | نحوه اجرا | تعداد ست | تکرارها | توضیحات |
 * و سرِ هر جلسه با خطی مثل «جلسه اول: جلوپا و باسن» مشخص می‌شود.
 *
 * خروجی این فایل دو تابع API است:
 *   sfAdminParseProgram(token, {text, username, planName})  → پیش‌نمایش
 *   sfAdminImportProgram(token, {...همان, createMissing})   → ثبت واقعی برنامه
 *
 * حرکات با همان موتور تطبیق بانک (sfBankByName_) به بانک حرکات وصل می‌شوند،
 * پس گیف/آموزش حرکت خودکار روی برنامه می‌نشیند. حرکت‌های ناشناخته یا گزارش
 * می‌شوند یا (با createMissing) به بانک اضافه می‌شوند تا بعداً گیف بگیرند.
 *
 * وابستگی‌ها: Code.gs (normalize_, todayISO_, sfAdmin_, sfAppend_, sfRead_, sfObjects_)
 *            TrainingModule.gs (SF, sfBankByName_, sfBankMap_, sfBankLegacyInfo_,
 *            sfTechnique_, sfExInfo_, sfAdminSavePlan, SF_BANK_MEMO_, sfPi* helpers)
 *            ExerciseData.gs (SF_BANK_HEADERS)
 */

/* ------------------------------------------------------------------ */
/* ابزارهای متنی                                                       */
/* ------------------------------------------------------------------ */

function sfPiDigits_(s) {
  return String(s == null ? '' : s)
    .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 1776); })
    .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 1632); });
}

function sfPiClean_(s) {
  return sfPiDigits_(s)
    .replace(/\u200c/g, ' ')
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* یک خط CSV استاندارد (با پشتیبانی از "" داخل نقل‌قول) */
function sfPiCsvLine_(line) {
  var out = [], cur = '', q = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line.charAt(i);
    if (q) {
      if (ch === '"' && line.charAt(i + 1) === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function sfPiDelimiter_(text) {
  var sample = String(text || '').split('\n').slice(0, 40).join('\n');
  var pipe = (sample.match(/\|/g) || []).length;
  var tab = (sample.match(/\t/g) || []).length;
  var comma = (sample.match(/,/g) || []).length;
  if (pipe && pipe >= tab && pipe >= comma) return '|';
  if (tab && tab >= comma) return '\t';
  return ',';
}

/** متن فایل → آرایهٔ سطرها؛ ستون‌های خالی حذف نمی‌شوند. */
function sfPiRows_(text) {
  var raw = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  if (!raw.trim()) return [];
  var d = sfPiDelimiter_(raw);
  var lines = raw.split('\n');
  var rows = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line || !line.trim()) { rows.push([]); continue; }
    var cells;
    if (d === '|') {
      var t = line.trim();
      if (t.charAt(0) === '|') t = t.slice(1);
      if (t.charAt(t.length - 1) === '|') t = t.slice(0, -1);
      cells = t.split('|');
    } else if (d === '\t') {
      cells = line.split('\t');
    } else {
      cells = sfPiCsvLine_(line);
    }
    rows.push(cells.map(function (c) { return sfPiClean_(c); }));
  }
  return rows;
}

function sfPiNonEmpty_(cells) {
  var n = 0;
  for (var i = 0; i < cells.length; i++) if (cells[i]) n++;
  return n;
}

function sfPiHasHeader_(cells) {
  var j = cells.join(' ');
  return /ردیف/.test(j) && /(نام حرکت|حرکت|بخش)/.test(j);
}

function sfPiIsSession_(cells) {
  var j = cells.join(' ');
  if (!j) return false;
  if (!/جلسه|روز|Day|Session/i.test(j)) return false;
  if (sfPiHasHeader_(cells)) return false;
  var numbers = j.replace(/[^0-9]/g, '');
  return numbers.length < 6;
}

function sfPiSessionTitle_(cells, index) {
  var best = '';
  for (var i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    if (/جلسه|روز|Day|Session/i.test(cells[i])) { best = cells[i]; break; }
    if (!best) best = cells[i];
  }
  best = sfPiClean_(best);
  return best || ('روز ' + index);
}

/* ------------------------------------------------------------------ */
/* تجزیهٔ حرکت / تکنیک / ست / تکرار                                     */
/* ------------------------------------------------------------------ */

function sfPiNameParts_(name) {
  return String(name == null ? '' : name)
    .split(/\s*\+\s*|\s*،\s*/)
    .map(function (p) { return sfPiClean_(p).replace(/^[-–—]+|[-–—]+$/g, '').trim(); })
    .filter(function (p) { return !!p && p.length > 1; });
}

function sfPiLooksCardio_(name) {
  if (/سوئدی|push[ -]?up|پوش\s*آپ|شنا\s*(دست|شیب|الماسی|روی|مچ|دیوار|زانو|آرچر|انفجاری)/i.test(String(name || ''))) return false;
  return /هوازی|دوچرخه|الپتیکال|تردمیل|دویدن|شنا|پله|طناب|روئینگ|کاردیو/i.test(String(name || ''));
}

function sfPiTechniqueOf_(cell, partsCount, name) {
  var t = sfPiClean_(cell).toLowerCase();
  if (/سوپر|سوپerset|superset/.test(t)) return 'superset';
  if (/تری\s*ست|تریست|triset/.test(t)) return 'triset';
  if (/جاینت|giant/.test(t)) return 'giantset';
  if (/دراپ/.test(t) && /مکانیک/.test(t)) return 'mechanical_drop';
  if (/دراپ|drop/.test(t)) return 'dropset';
  if (/هرمی/.test(t) && /معکوس|reverse/.test(t)) return 'reverse_pyramid';
  if (/هرمی|pyramid/.test(t)) return 'pyramid';
  if (/رست|rest\s*pause|restpause/.test(t)) return 'restpause';
  if (/مایو|myo/.test(t)) return 'myoreps';
  if (/تمپو|اسلو|tempo/.test(t)) return 'tempo';
  if (/fst/.test(t)) return 'fst7';
  if (/هوازی|کاردیو|cardio/.test(t)) return 'cardio';
  if (/معمولی|نرمال|normal/.test(t)) return 'normal';
  if (!t) {
    if (partsCount >= 4) return 'giantset';
    if (partsCount === 3) return 'triset';
    if (partsCount === 2) return 'superset';
    if (sfPiLooksCardio_(name)) return 'cardio';
  }
  return 'normal';
}

/** تکنیک را با تعداد واقعی حرکت‌ها هم‌تراز می‌کند تا اعتبارسنجی رد نکند. */
function sfPiAlignTechnique_(tech, partsCount) {
  if (partsCount >= 4) return 'giantset';
  if (partsCount === 3) return (tech === 'mechanical_drop') ? 'mechanical_drop' : 'triset';
  if (partsCount === 2) {
    return tech === 'mechanical_drop' ? tech : 'superset';
  }
  if (tech === 'superset' || tech === 'triset' || tech === 'giantset' || tech === 'mechanical_drop') return 'normal';
  return tech;
}

/** «20-18-15-10-6*15» → ["20","18","15","10","6+15"] */
function sfPiRepSeq_(repsCell) {
  var t = sfPiDigits_(repsCell).replace(/[–—]/g, '-').trim();
  if (!t) return [];
  var m = t.match(/^\s*(\d+)\s*\(([^)]*)\)/);       /* 4(12-10) */
  if (m) return sfPiRepSeq_(m[2]);
  if (/دقیقه|ثانیه|کیلومتر|متر/.test(t)) return [t.replace(/\s+/g, ' ')];
  return t.split('-')
    .map(function (p) { return p.trim(); })
    .filter(function (p) { return !!p; })
    .map(function (p) {
      if (p.indexOf('*') >= 0) {
        return p.split('*').map(function (x) { return x.trim(); }).filter(Boolean).join('+');
      }
      return p;
    });
}

function sfPiSetsCount_(setsCell, repsCell, isCardio) {
  var n = Number(String(sfPiDigits_(setsCell)).replace(/[^0-9]/g, ''));
  if (n > 0) return Math.max(1, Math.min(20, n));
  var paren = String(sfPiDigits_(repsCell)).match(/^\s*(\d+)\s*\(/);
  if (paren) return Math.max(1, Math.min(20, Number(paren[1])));
  var seq = sfPiRepSeq_(repsCell);
  if (isCardio) return 1;
  if (seq.length) return Math.min(20, seq.length);
  return 3;
}

/** «چهار ست» / «۵ ست» در توضیحات → تعداد ست */
function sfPiWordSets_(text) {
  var t = sfPiDigits_(text || "");
  var words = { "یک": 1, "دو": 2, "سه": 3, "چهار": 4, "پنج": 5, "شش": 6, "شیش": 6, "هفت": 7, "هشت": 8, "نه": 9, "ده": 10 };
  var m = t.match(/(یک|دو|سه|چهار|پنج|شش|شیش|هفت|هشت|نه|ده)\s*ست/);
  if (m) return words[m[1]] || 0;
  var d = t.match(/([0-9]{1,2})\s*ست/);
  if (d) return Math.max(1, Math.min(20, Number(d[1])));
  return 0;
}

function sfPiRestFor_(tech) {
  if (tech === 'cardio') return 0;
  if (tech === 'superset' || tech === 'triset' || tech === 'giantset') return 90;
  if (tech === 'pyramid' || tech === 'reverse_pyramid') return 90;
  if (tech === 'fst7') return 40;
  if (tech === 'dropset' || tech === 'mechanical_drop') return 60;
  return 60;
}

/* ------------------------------------------------------------------ */
/* حدس گروه عضلانی / وسیله برای حرکات تازه                              */
/* ------------------------------------------------------------------ */

function sfPiGuessGroup_(name, dayTitle) {
  var s = name || '';
  if (/سوئدی|push[ -]?up|پوش\s*آپ|شنا\s*(دست|شیب|الماسی|روی|مچ|دیوار|زانو|آرچر|انفجاری)/i.test(s)) return /دست\s*جمع|الماسی/.test(s) ? 'پشت بازو' : 'سینه';
  var map = [
    [/هوازی|دوچرخه|الپتیکال|تردمیل|دویدن|شنا/, 'هوازی'],
    [/زیر\s*بغل|لت\b|بارفیکس|قایق|تی\s*بار|پول\s*اور|ددلیفت/, 'زیر بغل'],
    [/سرشانه|نشر|شراگ|فیس\s*پول|فلای\s*معکوس/, 'سرشانه'],
    [/پشت\s*بازو|پشتبازو|دیپ|پرس\s*سینه\s*دست\s*جمع/, 'پشت بازو'],
    [/جلو\s*بازو|جلوبازو|بازو/, 'جلو بازو'],
    [/سینه|پرس\s*سینه|فلای|کراس/, 'سینه'],
    [/شکم|کرانچ|پلانک|زیر\s*شکم|چرخ\s*شکم|اب\s*ول/, 'شکم و پهلو'],
    [/پهلو|ساید/, 'شکم و پهلو'],
    [/ساق/, 'ساق'],
    [/باسن|هیپ|ابداکشن|ادداکتور|کیک\s*بک|پل\s*باسن/, 'باسن'],
    [/پشت\s*پا|همسترینگ|رومانیایی|فیله/, 'پشت پا'],
    [/جلو\s*پا|اسکوات|اسکات|لانگز|پرس\s*پا|فرانت/, 'جلو پا'],
    [/داخل\s*پا/, 'داخل پا']
  ];
  for (var i = 0; i < map.length; i++) if (map[i][0].test(s)) return map[i][1];
  return 'سایر';
}

function sfPiGuessEquipment_(name) {
  var n = String(name || '');
  if (/هالتر|بار\b/.test(n)) return 'هالتر';
  if (/دمبل/.test(n)) return 'دمبل';
  if (/سیم\s*کش|سیمکش|کابل/.test(n)) return 'سیم‌کش';
  if (/دستگاه|ماشین|اسمیت/.test(n)) return 'دستگاه';
  if (/وزن\s*بدن|بدون\s*وزنه/.test(n)) return 'وزن بدن';
  if (/طناب/.test(n)) return 'طناب';
  if (/صفحه/.test(n)) return 'صفحه';
  return '';
}

function sfPiNextBankId_() {
  var max = 0;
  try {
    sfObjects_(sfRead_(SF.BANK)).forEach(function (o) {
      var m = String(o.ExerciseID || '').match(/(\d+)/);
      if (m) max = Math.max(max, Number(m[1]));
    });
  } catch (e) {}
  max = max + 1;
  return 'EX' + ('0000' + max).slice(-4);
}

function sfPiCreateBank_(name, info) {
  var id = sfPiNextBankId_();
  var row = {
    ExerciseID: id,
    PersianName: name,
    EnglishName: '',
    Category: info.category || (sfPiLooksCardio_(name) ? 'هوازی' : 'بدنسازی'),
    MuscleGroup: info.group || sfPiGuessGroup_(name, info.dayTitle),
    SubGroup: '',
    SecondaryMuscle: '',
    Equipment: sfPiGuessEquipment_(name),
    Level: 'متوسط',
    MovementType: 'ترکیبی',
    Instructions: '',
    Tips: '',
    SuggestedSets: String(info.sets || 3),
    SuggestedReps: String(info.reps || '10'),
    RestSec: String(info.rest || 60),
    Intensity: '',
    Aliases: '',
    GifURL: '',
    GifSourceURL: '',
    YouTubeURL: '',
    MediaStatus: '',
    Active: 'true',
    SourceNote: 'import'
  };
  try {
    sfAppend_(SF.BANK, [row]);
    SF_BANK_MEMO_ = null;
  } catch (e) {
    throw new Error('ساخت حرکت «' + name + '» در بانک ناموفق بود: ' + ((e && e.message) || e));
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* تجزیهٔ کامل متن به روزها و بلوک‌ها                                   */
/* ------------------------------------------------------------------ */

function sfPiParse_(text, opts) {
  opts = opts || {};
  var overrides = opts.overrides || {};
  var blockOverrides = opts.blockOverrides || {};
  var rows = sfPiRows_(text || '');
  if (!rows.length) throw new Error('متنی برای خواندن پیدا نشد.');

  var days = [];
  var current = null;
  var dayIndex = 0;
  var rowNo = 0;
  var unmatched = [];

  function newDay(title) {
    dayIndex++;
    if (dayIndex > 14) throw new Error('بیشتر از ۱۴ روز در فایل بود؛ فایل را به جلسه‌های کمتر تقسیم کن.');
    current = { dayNo: dayIndex, title: title || ('روز ' + dayIndex), blocks: [] };
    days.push(current);
    return current;
  }

  for (var r = 0; r < rows.length; r++) {
    var cells = rows[r] || [];
    if (sfPiNonEmpty_(cells) === 0) continue;
    if (sfPiHasHeader_(cells)) continue;
    var onlyMarks = true;
    for (var mi = 0; mi < cells.length; mi++) {
      if (!cells[mi]) continue;
      if (!/^[-–—:._\s]+$/.test(cells[mi])) { onlyMarks = false; break; }
    }
    if (onlyMarks) continue;
    if (sfPiIsSession_(cells)) { newDay(sfPiSessionTitle_(cells, dayIndex + 1)); continue; }

    /* سطر داده: باید نام حرکت داشته باشد */
    var nameCell = cells[1] || '';
    if (!nameCell) continue;
    if (/^(نام حرکت|حرکت)$/.test(nameCell)) continue;
    if (!current) newDay(opts.defaultDayTitle || 'روز 1');

    rowNo++;
    var techCell = cells[2] || '';
    var setsCell = cells[3] || '';
    var repsCell = cells[4] || '';
    var notes = cells.slice(5).filter(Boolean).join(' — ');

    var parts = sfPiNameParts_(nameCell);
    if (!parts.length) continue;

    var tech = sfPiTechniqueOf_(techCell, parts.length, nameCell), originalTechnique=tech;
    tech = sfPiAlignTechnique_(tech, parts.length);
    if (tech !== originalTechnique && originalTechnique !== 'normal') notes='روش ترکیبی سطر اصلی: ' + (techCell || originalTechnique) + (notes ? ' — ' + notes : '');
    var isCardio = tech === 'cardio';
    var setsCount = sfPiSetsCount_(setsCell, repsCell, isCardio);
    if (!/[0-9]/.test(sfPiDigits_(setsCell || ""))) {
      var wordSets = sfPiWordSets_(notes);
      if (wordSets) setsCount = wordSets;
    }
    var seq = sfPiRepSeq_(repsCell);
    if (!seq.length) seq = isCardio ? ['20 دقیقه'] : [''];
    if (isCardio) setsCount = 1;

    var minutes = '';
    var mm = sfPiDigits_(repsCell + ' ' + notes).match(/(\d+)\s*دقیقه/);
    if (mm) minutes = mm[1] + ' دقیقه';

    var rest = sfPiRestFor_(tech);
    var blockKey = current.dayNo + ':' + rowNo;
    var bo = blockOverrides[blockKey] || {};
    if (bo.technique) {
      var bt = sfTechnique_(normalize_(bo.technique));
      if (bt && parts.length >= bt.min && parts.length <= bt.max) {
        tech = bt.key;
        isCardio = tech === 'cardio';
        rest = sfPiRestFor_(tech);
      }
    }
    if (bo.sets != null && String(bo.sets) !== '') setsCount = sfPiSetsCount_(String(bo.sets), repsCell, isCardio);
    if (bo.reps != null && String(bo.reps) !== '') {
      var bseq = sfPiRepSeq_(String(bo.reps));
      if (bseq.length) seq = bseq;
    }
    if (bo.rest != null && String(bo.rest) !== '') rest = Math.max(0, Math.min(600, Number(bo.rest) || rest));
    if (bo.notes != null) notes = sfPiClean_(String(bo.notes));
    if (isCardio) setsCount = 1;
    var items = [];
    for (var p = 0; p < parts.length; p++) {
      var nm = sfPiClean_(overrides[rowNo + ':' + p] || parts[p]);
      var bank = null;
      try { bank = sfBankByName_(nm); } catch (e) { bank = null; }
      if (!bank && opts.createMissing) {
        try {
          bank = sfPiCreateBank_(nm, {
            dayTitle: current.title,
            sets: setsCount,
            reps: seq[0] || '10',
            rest: rest
          });
        } catch (e2) { bank = null; }
      }
      if (!bank) {
        unmatched.push({ row: rowNo, day: current.title, name: nm });
        items.push({ name: nm, row: rowNo, idx: p, exerciseId: '', matched: false, gif: false, gifNew: false });
        continue;
      }
      var gifNew = !!(normalize_(bank.GifNewFileId) || normalize_(bank.GifNewURL));
      items.push({
        name: nm,
        row: rowNo,
        idx: p,
        exerciseId: bank.ExerciseID,
        fa: bank.PersianName,
        group: bank.MuscleGroup,
        category: bank.Category,
        gif: !!(gifNew || bank.GifURL || bank.GifFileId || bank.GifSourceURL),
        gifNew: gifNew,
        matched: true
      });
    }

    /* اگر حرکت هوازی به حرکت غیرهوازی وصل شد، تکنیک را نرمال کن */
    if (isCardio && items[0] && items[0].category && items[0].category !== 'هوازی') tech = 'normal';

    current.blocks.push({
      technique: tech,
      extra:tech !== originalTechnique ? {sourceTechnique:originalTechnique,sourceTechniqueText:techCell} : {},
      blockKey: blockKey,
      parts: items,
      setsCount: setsCount,
      repsSeq: seq,
      minutes: minutes,
      notes: notes,
      rest: rest,
      sourceRow: rowNo
    });
  }

  /* حذف روزهای بی‌بلوک */
  days = days.filter(function (d) { return d.blocks.length; });
  if (!days.length) throw new Error('هیچ حرکتی در فایل پیدا نشد. مطمئن شو ستون‌ها همان قالب برنامه هستند.');

  var totalBlocks = 0, totalItems = 0, matchedItems = 0, withMedia = 0, withNewGif = 0;
  days.forEach(function (d) {
    d.blocks.forEach(function (b) {
      totalBlocks++;
      b.parts.forEach(function (p) {
        totalItems++;
        if (p.matched) matchedItems++;
        if (p.gif) withMedia++;
        if (p.gifNew) withNewGif++;
      });
    });
  });

  return {
    days: days,
    unmatched: unmatched,
    stats: {
      days: days.length,
      blocks: totalBlocks,
      exercises: totalItems,
      matched: matchedItems,
      unmatched: unmatched.length,
      withMedia: withMedia,
      withNewGif: withNewGif
    }
  };
}

/** تجزیه → بدنهٔ آمادهٔ sfAdminSavePlan */
function sfPiPayload_(parsed, opts) {
  var blocks = [];
  parsed.days.forEach(function (day) {
    day.blocks.forEach(function (b) {
      var items = b.parts.map(function (p) { return { exerciseId: p.exerciseId, name:p.name || p.fa || '' }; });
      var sets = [];
      for (var i = 0; i < b.setsCount; i++) {
        var reps = b.repsSeq[Math.min(i, b.repsSeq.length - 1)] || '';
        if (b.technique === 'cardio') reps = b.minutes || reps || '20 دقیقه';
        sets.push({
          setNo: i + 1,
          restAfterSec: b.rest,
          cells: items.map(function () { return { reps: reps, weight: '' }; }),
          extra: b.technique === 'cardio' ? { minutes: b.minutes || reps } : {}
        });
      }
      blocks.push({
        dayNo: day.dayNo,
        dayTitle: day.title,
        technique: b.technique,
        notes: b.notes || '',
        restBetweenSec: b.rest,
        extra: b.extra || {},
        items: items,
        sets: sets
      });
    });
  });
  return {
    planName: (opts && opts.planName) || '',
    username: (opts && opts.username) || '',
    goal: (opts && opts.goal) || '',
    level: (opts && opts.level) || '',
    coachNotes: (opts && opts.coachNotes) || '',
    blocks: blocks
  };
}

function sfPiTechniqueLabel_(key) {
  try {
    var t = sfTechnique_(key);
    return t ? t.label : key;
  } catch (e) { return key; }
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

/**
 * پیش‌نمایش بدون ذخیره. اگر createMissing روشن باشد، حرکت‌های ناشناخته
 * همان‌جا در بانک ساخته می‌شوند (پس «ثبت» فقط برنامه را می‌نویسد).
 */
function sfAdminParseProgram(token, p) {
  sfAdmin_(token);
  p = p || {};
  try { sfEnsure_(); } catch (e) {}

  // Validate block structure before creating any missing exercises in the database.
  var preflight = sfPiParse_(p.text, { createMissing: false, overrides: p.overrides || {}, blockOverrides: p.blockOverrides || {} });
  preflight.days.forEach(function(day) { day.blocks.forEach(function(block) {
    var technique = sfTechnique_(block.technique);
    if (!technique || block.parts.length < technique.min || block.parts.length > technique.max) {
      throw new Error('روز ' + day.dayNo + '، روش «' + (technique ? technique.label : block.technique) + '» با تعداد حرکت‌های این بلوک سازگار نیست؛ ابتدا پیش‌نمایش را اصلاح کن.');
    }
  }); });
  var parsed = sfPiParse_(p.text, { createMissing: !!p.createMissing, overrides: p.overrides || {}, blockOverrides: p.blockOverrides || {} });
  var days = parsed.days.map(function (d) {
    return {
      dayNo: d.dayNo,
      title: d.title,
      blocks: d.blocks.map(function (b) {
        return {
          technique: b.technique,
          techniqueLabel: sfPiTechniqueLabel_(b.technique),
          blockKey: b.blockKey,
          sets: b.setsCount,
          reps: b.repsSeq.join('-'),
          rest: b.rest,
          minutes: b.minutes,
          notes: b.notes,
          sourceRow: b.sourceRow,
          problems: b.parts.filter(function (x) { return !x.matched; }).map(function (x) { return x.name; }),
          items: b.parts.map(function (x) {
            return { name: x.name, row: x.row, idx: x.idx, fa: x.fa || '', exerciseId: x.exerciseId || '', matched: !!x.matched, gif: !!x.gif, gifNew: !!x.gifNew };
          })
        };
      })
    };
  });
  return {
    ok: true,
    planName: p.planName || '',
    username: p.username || '',
    days: days,
    unmatched: parsed.unmatched,
    stats: parsed.stats
  };
}

/** ثبت واقعی برنامه برای شاگرد انتخاب‌شده. */
function sfAdminImportProgram(token, p) {
  sfAdmin_(token);
  p = p || {};
  if (!p.text) throw new Error('متن یا فایل برنامه را بده.');
  if (!p.username) throw new Error('شاگرد را انتخاب کن.');
  try { sfEnsure_(); } catch (e) {}

  var bankBefore = 0;
  try { bankBefore = sfObjects_(sfRead_(SF.BANK)).length; } catch (eB) {}
  var parsed = sfPiParse_(p.text, { createMissing: true, overrides: p.overrides || {}, blockOverrides: p.blockOverrides || {} });
  var bankAfter = 0;
  try { bankAfter = sfObjects_(sfRead_(SF.BANK)).length; } catch (eA) {}
  var created = Math.max(0, bankAfter - bankBefore);
  var payload = sfPiPayload_(parsed, p);
  if (!payload.planName) payload.planName = 'برنامه ' + todayISO_();
  var res = sfAdminSavePlan(token, payload);
  var bankName = '';
  if (p.saveToBank) {
    try {
      bankName = sfText_(p.bankName, 120) || payload.planName;
      sfWithLock_(function() { sf7CopyWorkoutTo_((res && res.planId) || '', SF7_LIB, bankName, ''); });
    } catch (eB) { bankName = ''; }
  }
  return {
    ok: true,
    planId: (res && res.planId) || '',
    planName: payload.planName,
    stats: Object.assign({}, parsed.stats, { created: created }),
    created: created,
    unmatched: parsed.unmatched,
    days: parsed.days.length,
    blocks: payload.blocks.length,
    savedToBank: bankName
  };
}
