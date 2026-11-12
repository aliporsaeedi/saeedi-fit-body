/**
 * MoveSearch.js — جستجوی زنده روی کتابخانهٔ ۱۳۲۳ حرکتی + افزودن حرکت به برنامهٔ شاگرد
 *
 * چرا این فایل: کتابخانه فقط «گیف‌محور» بود و مربی باید کل ۱۳۲۳ ردیف را در شیت
 * می‌گشت. این‌جا:
 *   ۱) sfAdminLibSearch  — جستجو/فیلتر/صفحه‌بندی سمت سرور (فارسی و انگلیسی)
 *   ۲) sfAdminLibFacets  — شمارش گروه عضلانی / وسیله / سطح برای فیلترها
 *   ۳) sfAdminLibAddToPlan — افزودن یک حرکت از کتابخانه به یک روز از برنامهٔ شاگرد
 *      (بلوک + حرکت + ست‌ها را در همان اسکیمای SF_Blocks/SF_Items/SF_Sets می‌سازد)
 */

/* نرمال‌سازی فارسی: ی/ک عربی، اعراب، فاصله‌های تکراری */
function sfMoveNorm_(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

function sfMoveCat_(it) {
  if (it.c === 'cardio') return 'هوازی';
  if (it.g === 'شکم' || it.g === 'پهله') return 'شکم و پهلو';
  if (it.c === 'stretching') return 'کششی';
  return 'بدنسازی';
}

function sfMoveItem_(it) {
  return {
    id: it.id,
    key: String(it.i || '').split('/').join('__'),
    fa: it.fa, en: it.n,
    group: it.g || '', sub: it.sub || '',
    equip: it.ef || '', equipKey: it.e || '',
    level: it.lv || '', cat: it.c || '', catFa: sfMoveCat_(it),
    mech: it.mech || '', body: it.b || '',
    sets: it.sets || 3, reps: it.reps || '8-12', rest: it.rest || 75,
    gif: sfLibMedia_(it),
    thumb: it.thumb || '',
    video: it.YouTubeURL || ('https://www.youtube.com/results?search_query=' + encodeURIComponent(it.n + ' exercise proper form tutorial'))
  };
}


/** عدد لاتین → رقم فارسی (برای عنوان پیش‌فرض «روز ۲») */
function sfMoveFaNum_(n) {
  var d = '۰۱۲۳۴۵۶۷۸۹';
  return String(n == null ? '' : n).replace(/[0-9]/g, function (c) { return d.charAt(Number(c)); });
}

/** امتیاز تطبیق: نام فارسی/انگلیسی که با عبارت شروع شود یا کلمهٔ کامل باشد بالاتر می‌آید */
function sfMoveScore_(it, words, q) {
  var fa = sfMoveNorm_(it.fa), en = sfMoveNorm_(it.n);
  var g = sfMoveNorm_(it.g), sub = sfMoveNorm_(it.sub), ef = sfMoveNorm_(it.ef);
  var score = 0;
  if (fa === q) score += 120;
  if (en === q) score += 110;
  if (fa.indexOf(q) === 0) score += 90;
  if (en.indexOf(q) === 0) score += 80;
  if ((' ' + fa + ' ').indexOf(' ' + q + ' ') >= 0) score += 70;
  if ((' ' + en + ' ').indexOf(' ' + q + ' ') >= 0) score += 60;
  if (g === q || sub === q || ef === q) score += 55;
  if (fa.indexOf(q) >= 0) score += 30;
  if (en.indexOf(q) >= 0) score += 25;
  if (g.indexOf(q) >= 0) score += 15;
  for (var i = 0; i < words.length; i++) {
    if (fa.indexOf(words[i]) === 0 || en.indexOf(words[i]) === 0) score += 20;
  }
  return score;
}

/** شمارش فیلترها: گروه عضلانی، وسیله، سطح */
function sfAdminLibFacets(token) {
  sfAdmin_(token); sfEnsure_();
  var g = {}, e = {}, l = {};
  SF_LIB.forEach(function (it) {
    if (it.g) g[it.g] = (g[it.g] || 0) + 1;
    if (it.ef) e[it.ef] = (e[it.ef] || 0) + 1;
    if (it.lv) l[it.lv] = (l[it.lv] || 0) + 1;
  });
  var toList = function (m) {
    return Object.keys(m).map(function (k) { return { key: k, count: m[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  };
  return { total: SF_LIB.length, groups: toList(g), equip: toList(e), levels: toList(l) };
}

/**
 * جستجو در کتابخانه.
 * input: { q, group, equip, level, page, per }
 * q روی نام فارسی، نام انگلیسی، عضله، زیرگروه و وسیله جستجو می‌کند و می‌تواند چند کلمه باشد.
 */
function sfAdminLibSearch(token, input) {
  sfAdmin_(token); sfEnsure_();
  input = input || {};
  var q = sfMoveNorm_(input.q);
  var words = q ? q.split(' ').filter(Boolean) : [];
  var group = sfMoveNorm_(input.group), equip = sfMoveNorm_(input.equip), level = sfMoveNorm_(input.level);
  var per = Math.min(120, Math.max(12, parseInt(input.per, 10) || 48));
  var page = Math.max(1, parseInt(input.page, 10) || 1);

  var hits = [];
  for (var i = 0; i < SF_LIB.length; i++) {
    var it = SF_LIB[i];
    if (group && sfMoveNorm_(it.g) !== group) continue;
    if (equip && sfMoveNorm_(it.ef) !== equip) continue;
    if (level && sfMoveNorm_(it.lv) !== level) continue;
    if (words.length) {
      var hay = sfMoveNorm_([it.fa, it.n, it.g, it.sub, it.ef, it.id, (it.sec || []).join(' ')].join(' '));
      var okAll = true;
      for (var w = 0; w < words.length; w++) {
        if (hay.indexOf(words[w]) < 0) { okAll = false; break; }
      }
      if (!okAll) continue;
    }
    hits.push({ it: it, score: words.length ? sfMoveScore_(it, words, q) : 0 });
  }

  /* مرتب‌سازی: نزدیک‌ترین نام اول؛ در نبود عبارت، ترتیب کتابخانه حفظ می‌شود */
  if (words.length) {
    hits.sort(function (a, b) { return b.score - a.score || String(a.it.fa).localeCompare(String(b.it.fa), 'fa'); });
  }
  hits = hits.map(function (h) { return h.it; });

  var total = hits.length;
  var start = (page - 1) * per;
  var slice = hits.slice(start, start + per);
  return {
    ok: true, total: total, page: page, per: per,
    pages: Math.max(1, Math.ceil(total / per)),
    hasMore: start + slice.length < total,
    items: slice.map(sfMoveItem_)
  };
}

/** پیدا کردن یک حرکت از کتابخانه با id/key، یا از بانک حرکات با ExerciseID/نام */
function sfMoveFind_(ref) {
  ref = sfMoveNorm_(ref);
  if (!ref) return null;
  for (var i = 0; i < SF_LIB.length; i++) {
    var it = SF_LIB[i];
    if (sfMoveNorm_(it.id) === ref || sfMoveNorm_(String(it.i).split('/').join('__')) === ref) return { lib: it };
  }
  try {
    var bank = sfObjects_(sfRead_(SF.BANK));
    for (var b = 0; b < bank.length; b++) {
      if (sfMoveNorm_(bank[b].ExerciseID) === ref || sfMoveNorm_(bank[b].PersianName) === ref) return { bank: bank[b] };
    }
  } catch (e) {}
  return null;
}

/**
 * افزودن یک حرکت به برنامهٔ شاگرد.
 * input: { planId | username, exerciseId | key, dayNo, dayTitle, sets, reps, restSec, weight, technique, position }
 * یک بلوک تازه در آن روز ساخته می‌شود تا چیدمان بلوک‌های موجود به هم نریزد.
 */
function sfAdminLibAddToPlan(token, input) {
  var session = sfAdmin_(token); sfEnsure_();
  input = input || {};
  return sfWithLock_(function () {
    var plans = sfObjects_(sfRead_(SF.PLANS));
    var planId = sfMoveNorm_(input.planId);
    var plan = planId ? plans.filter(function (p) { return sfMoveNorm_(p.PlanID) === planId; })[0] : null;
    if (!plan && input.username) {
      var mine = plans.filter(function (p) {
        return sfMoveNorm_(p.Username) === sfMoveNorm_(input.username);
      });
      plan = mine.filter(function (p) { return sfIsTrue_(p.Active); })[0] || mine[0];
    }
    if (!plan) throw new Error('برنامهٔ تمرینی پیدا نشد؛ اول برای این شاگرد یک برنامه بساز.');

    var found = sfMoveFind_(input.exerciseId || input.key);
    if (!found) throw new Error('این حرکت در کتابخانه پیدا نشد.');

    var exId, exName, exGroup, exCat, defSets, defReps, defRest, gif;
    if (found.lib) {
      var it = found.lib;
      exId = it.id; exName = it.fa; exGroup = it.g || ''; exCat = sfMoveCat_(it);
      defSets = Number(it.sets) || 3; defReps = String(it.reps || '8-12'); defRest = Number(it.rest) || 75;
      gif = sfLibMedia_(it);
    } else {
      var b = found.bank;
      exId = normalize_(b.ExerciseID); exName = normalize_(b.PersianName); exGroup = normalize_(b.MuscleGroup);
      exCat = normalize_(b.Category) || 'بدنسازی';
      defSets = Number(b.SuggestedSets) || 3; defReps = normalize_(b.SuggestedReps) || '8-12'; defRest = Number(b.RestSec) || 75;
      gif = normalize_(b.GifNewURL) || normalize_(b.GifSourceURL);
    }
    if (!exId) throw new Error('شناسهٔ حرکت خالی است.');

    var planKey = normalize_(plan.PlanID);
    var blocks = sfObjects_(sfRead_(SF.BLOCKS)).filter(function (o) { return normalize_(o.PlanID) === planKey; });
    var dayNo = Math.max(1, Math.min(14, parseInt(input.dayNo, 10) || 1));
    var dayBlocks = blocks.filter(function (o) { return Number(o.DayNo) === dayNo; });
    var order = dayBlocks.reduce(function (m, o) { return Math.max(m, Number(o.OrderNo) || 0); }, 0) + 1;

    var used = {};
    blocks.forEach(function (o) { used[normalize_(o.BlockID)] = 1; });
    var blockId = '', n = blocks.length + 1;
    do { blockId = planKey + '-B' + n; n++; } while (used[blockId]);

    var tech = sfTechnique_(sfText_(input.technique, 30)) ? sfText_(input.technique, 30) : 'normal';
    var dayTitle = sfText_(input.dayTitle, 60) || (dayBlocks.length ? normalize_(dayBlocks[0].DayTitle) : ('روز ' + sfMoveFaNum_(dayNo)));
    var sets = Math.max(1, Math.min(12, parseInt(input.sets, 10) || defSets));
    var reps = sfText_(input.reps, 30) || defReps;
    var rest = Math.max(0, Math.min(900, parseInt(input.restSec, 10) || defRest));
    var weight = sfText_(input.weight, 20);

    sfAppend_(SF.BLOCKS, [{
      BlockID: blockId, PlanID: planKey, DayNo: String(dayNo), DayTitle: dayTitle,
      OrderNo: String(order), Technique: tech, BlockNotes: '', RestBetweenSec: String(rest), Extra: ''
    }]);
    sfAppend_(SF.ITEMS, [{
      ItemID: blockId + '-I1', BlockID: blockId, PlanID: planKey, PosNo: '1',
      ExerciseID: exId, ExerciseName: exName, MuscleGroup: exGroup, Category: exCat
    }]);
    var setRows = [];
    for (var s = 1; s <= sets; s++) {
      setRows.push({
        SetID: blockId + '-S' + s + '-1', BlockID: blockId, PlanID: planKey, SetNo: String(s), PosNo: '1',
        ExerciseID: exId, Reps: reps, TargetWeightKg: weight, RestAfterSec: String(rest), Technique: tech, Extra: ''
      });
    }
    sfAppend_(SF.SETS, setRows);

    /* UpdatedAt برنامه */
    try {
      var prd = sfRead_(SF.PLANS);
      var ri = prd.rows.findIndex(function (r) { return normalize_(r[prd.idx.PlanID]) === planKey; });
      if (ri >= 0) {
        prd.sh.getRange(ri + 2, prd.idx.UpdatedAt + 1).setValue(new Date().toISOString());
        prd.sh.getRange(ri + 2, prd.idx.Username + 1).setValue(normalize_(plan.Username));
      }
    } catch (eUp) {}

    sfInvalidate_(SF.PLANS); sfInvalidate_(SF.BLOCKS); sfInvalidate_(SF.ITEMS); sfInvalidate_(SF.SETS);

    return {
      ok: true, planId: planKey, planName: normalize_(plan.PlanName), username: normalize_(plan.Username),
      dayNo: dayNo, dayTitle: dayTitle, blockId: blockId, order: order,
      exerciseId: exId, exerciseName: exName, muscleGroup: exGroup, category: exCat,
      sets: sets, reps: reps, restSec: rest, weightKg: weight, gif: gif,
      byCoach: normalize_(session.username)
    };
  });
}

/** روزهای یک برنامه برای انتخاب «کدام روز» در فرم افزودن */
function sfAdminPlanDays(token, planId) {
  sfAdmin_(token); sfEnsure_();
  var key = normalize_(planId);
  var blocks = sfObjects_(sfRead_(SF.BLOCKS)).filter(function (o) { return normalize_(o.PlanID) === key; });
  var map = {};
  blocks.forEach(function (b) {
    var d = Number(b.DayNo) || 1;
    var o = map[d] || (map[d] = { dayNo: d, title: normalize_(b.DayTitle) || ('روز ' + sfMoveFaNum_(d)), blocks: 0, exercises: 0 });
    o.blocks++;
  });
  var items = sfObjects_(sfRead_(SF.ITEMS)).filter(function (o) { return normalize_(o.PlanID) === key; });
  items.forEach(function (i) {
    var b = blocks.filter(function (x) { return normalize_(x.BlockID) === normalize_(i.BlockID); })[0];
    if (!b) return;
    var d = Number(b.DayNo) || 1;
    if (map[d]) map[d].exercises++;
  });
  return {
    ok: true,
    days: Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.dayNo - b.dayNo; }),
    nextDay: Object.keys(map).length ? (Math.max.apply(null, Object.keys(map).map(Number)) + 1) : 1
  };
}

/* ---------------------------------------------------------- ویرایش برنامه --- */

/** تغییر نام برنامه (بعد از ساخت هم کار می‌کند) */
function sfAdminRenamePlan(token, planId, newName) {
  sfAdmin_(token); sfEnsure_();
  var id = normalize_(planId), name = sfText_(newName, 120);
  if (!id) throw new Error('شناسهٔ برنامه لازم است.');
  if (!name) throw new Error('نام تازه را بنویس.');
  return sfWithLock_(function () {
    var rd = sfRead_(SF.PLANS);
    var row = -1;
    rd.rows.forEach(function (r, i) { if (normalize_(r[rd.idx.PlanID]) === id) row = i; });
    if (row < 0) throw new Error('برنامه پیدا نشد.');
    rd.sh.getRange(row + 2, rd.idx.PlanName + 1).setValue(name);
    rd.sh.getRange(row + 2, rd.idx.UpdatedAt + 1).setValue(new Date().toISOString());
    sfInvalidate_(SF.PLANS);
    return { ok: true, planId: id, planName: name };
  });
}

/**
 * تغییر نام یک حرکت داخل برنامه (و در صورت خواست، جایگزینی خودِ حرکت).
 * name خالی باشد یعنی نام فعلی حفظ می‌شود؛ exerciseId خالی یعنی حرکت عوض نمی‌شود.
 */
function sfAdminUpdatePlanItem(token, planId, itemId, name, exerciseId) {
  sfAdmin_(token); sfEnsure_();
  var id = normalize_(planId), iid = normalize_(itemId);
  if (!id || !iid) throw new Error('شناسهٔ برنامه/حرکت لازم است.');
  return sfWithLock_(function () {
    var newName = sfText_(name, 120);
    var ref = exerciseId ? sfMoveFind_(exerciseId) : null;
    if (exerciseId && !ref) throw new Error('حرکت جانشین پیدا نشد.');

    var rd = sfRead_(SF.ITEMS);
    var row = -1;
    rd.rows.forEach(function (r, i) {
      if (normalize_(r[rd.idx.PlanID]) === id && normalize_(r[rd.idx.ItemID]) === iid) row = i;
    });
    if (row < 0) throw new Error('این حرکت در برنامه پیدا نشد.');

    var out = { ok: true, itemId: iid };
    var finalName = newName || normalize_(rd.rows[row][rd.idx.ExerciseName]);
    if (newName) {
      rd.sh.getRange(row + 2, rd.idx.ExerciseName + 1).setValue(newName);
      out.exerciseName = newName;
    }
    if (ref) {
      var exId = ref.lib ? ref.lib.id : normalize_(ref.bank.ExerciseID);
      var exFa = ref.lib ? ref.lib.fa : normalize_(ref.bank.PersianName);
      var exGroup = ref.lib ? (ref.lib.g || '') : normalize_(ref.bank.MuscleGroup);
      var exCat = ref.lib ? sfMoveCat_(ref.lib) : (normalize_(ref.bank.Category) || 'بدنسازی');
      rd.sh.getRange(row + 2, rd.idx.ExerciseID + 1).setValue(exId);
      if (!newName) rd.sh.getRange(row + 2, rd.idx.ExerciseName + 1).setValue(exFa);
      if (rd.idx.MuscleGroup != null) rd.sh.getRange(row + 2, rd.idx.MuscleGroup + 1).setValue(exGroup);
      if (rd.idx.Category != null) rd.sh.getRange(row + 2, rd.idx.Category + 1).setValue(exCat);
      out.exerciseId = exId;
      /* ست‌های همان بلوک هم به حرکت تازه اشاره کنند */
      try {
        var srd = sfRead_(SF.SETS);
        var blockId = normalize_(rd.rows[row][rd.idx.BlockID]);
        srd.rows.forEach(function (r, i) {
          if (normalize_(r[srd.idx.BlockID]) === blockId && normalize_(r[srd.idx.ExerciseID]) !== exId) {
            srd.sh.getRange(i + 2, srd.idx.ExerciseID + 1).setValue(exId);
          }
        });
        sfInvalidate_(SF.SETS);
      } catch (eSets) {}
      if (!out.exerciseName) out.exerciseName = exFa;
    }
    sfInvalidate_(SF.ITEMS);
    return out;
  });
}

/** لیست حرکت‌های یک برنامه (برای انتخاب هنگام نام‌گذاری/جایگزینی) */
function sfAdminPlanItems(token, planId) {
  sfAdmin_(token); sfEnsure_();
  var id = normalize_(planId);
  var blocks = {};
  sfObjects_(sfRead_(SF.BLOCKS)).forEach(function (b) {
    if (normalize_(b.PlanID) === id) blocks[normalize_(b.BlockID)] = b;
  });
  return {
    ok: true,
    items: sfObjects_(sfRead_(SF.ITEMS))
      .filter(function (it) { return normalize_(it.PlanID) === id; })
      .map(function (it) {
        var b = blocks[normalize_(it.BlockID)] || {};
        return {
          itemId: it.ItemID, blockId: it.BlockID, name: it.ExerciseName, exerciseId: it.ExerciseID,
          group: it.MuscleGroup, dayNo: Number(b.DayNo) || 1, dayTitle: normalize_(b.DayTitle) || ('روز ' + (Number(b.DayNo) || 1))
        };
      })
  };
}

/* ------------------------------------------------------------ آناتومی --- */

/** نگاشت نام گروه عضلانی (فارسی/انگلیسی) به ناحیهٔ آناتومی */
var SF_ANATOMY_MAP_ = [
  ['adductors',/داخل\s*(ران|پا)|ادکتور|adductors?/i], ['abductors',/خارج\s*(ران|پا)|ابدکتور|abductors?/i],
  ['triceps', /پشت\s*بازو|triceps?/i], ['biceps', /جلو\s*بازو|biceps?/i],
  ['hamstrings', /پشت\s*(پا|ران)|همسترینگ|hamstrings?/i],
  ['quads', /جلو\s*(پا|ران)|چهار\s*سر|quadriceps|quads?/i],
  ['calves', /ساق|calves|calf/i], ['lowerback', /کمر\s*پایین|پایین\s*کمر|فیله|lower[ -]?back|lumbar|erector/i],
  ['forearms', /ساعد|forearms?/i], ['obliques', /پهلو|obliques?/i],
  ['shoulders', /سر\s*شانه|دلتو|shoulder|deltoid/i], ['traps', /کول|تراپ|trapezius|traps?/i],
  ['lats', /زیر\s*بغل|(?:^|\s)لت(?:\s|$)|latissimus|(?:^|\s)lats?(?:\s|$)/i],
  ['chest', /سینه|chest|pectoral/i], ['glutes', /باسن|سرین|glute/i],
  ['abs', /شکم|abdominals?|(?:^|\s)abs(?:\s|$)|core/i], ['back', /پشت|کمر\s*بالا|upper[ -]?back|middle[ -]?back|rhomboid|(?:^|\s)back(?:\s|$)/i]
];
function sfAnatomyKey_(group) {
  var g=normalize_(group).replace(/\u200c/g,' ').replace(/\s+/g,' ').trim();
  for(var i=0;i<SF_ANATOMY_MAP_.length;i++) if(SF_ANATOMY_MAP_[i][1].test(g)) return SF_ANATOMY_MAP_[i][0];
  return '';
}
function sfExerciseRegion_(ex) {
  if(SF_ANATOMY_MAP_.some(function(row){return row[0]===ex.AnatomyRegion;})) return ex.AnatomyRegion;
  var key=sfAnatomyKey_(ex.SubGroup) || sfAnatomyKey_(ex.MuscleGroup);if(key)return key;
  var meta=sfLibMediaMeta_(ex);return meta ? sfAnatomyKey_(meta.muscle) : '';
}
function sfAnatomyCompute_(plan, blocks, items, sets, bank) {
  var id=normalize_(plan.PlanID), byBlock={}, bySet={}, days={}, totals={}, secondary={}, rows=[],unknown=[];
  blocks.filter(function(b) { return normalize_(b.PlanID)===id; }).forEach(function(b) { byBlock[b.BlockID]=b; });
  sets.filter(function(s) { return normalize_(s.PlanID)===id; }).forEach(function(s) { var key=s.BlockID+'|'+s.ExerciseID+'|'+s.PosNo; (bySet[key] || (bySet[key]={}))[s.SetNo]=true; });
  items.filter(function(it) { return normalize_(it.PlanID)===id; }).forEach(function(it) {
    var block=byBlock[it.BlockID]; if(!block) return;
    var ex=bank[it.ExerciseID] || {},category=normalize_(ex.Category || it.Category),cardio=category ? category==='هوازی' : block.Technique==='cardio',conflict=!!category && block.Technique==='cardio' && !cardio;
    var primary=sfExerciseRegion_(ex) || sfAnatomyKey_(it.MuscleGroup),origin=primary ? 'bank' : 'unknown';
    if(!primary && !cardio) { primary=sfAnatomyKey_(it.ExerciseName); if(primary) origin='name-estimate'; }
    var sec=String(ex.SecondaryMuscle || '').split(/[,،;|/]+/).map(sfAnatomyKey_).filter(function(k,i,all) { return k && k!==primary && all.indexOf(k)===i; });
    var n=Object.keys(bySet[it.BlockID+'|'+it.ExerciseID+'|'+it.PosNo] || {}).length, dayNo=Number(block.DayNo) || 1;
    var day=days[dayNo] || (days[dayNo]={dayNo:dayNo,title:block.DayTitle || 'روز '+dayNo,regions:{},secondary:{},items:[]});
    var row={itemId:it.ItemID,exerciseId:it.ExerciseID,name:it.ExerciseName,group:ex.MuscleGroup || it.MuscleGroup,region:cardio ? '' : primary,secondary:cardio ? [] : sec,sets:n,dayNo:dayNo,cardio:cardio,techniqueConflict:conflict,mappingSource:origin};
    rows.push(row); day.items.push(row);
    if(!cardio && primary) { totals[primary]=(totals[primary] || 0)+n; day.regions[primary]=(day.regions[primary] || 0)+n; }
    if(!cardio) sec.forEach(function(k) { secondary[k]=(secondary[k] || 0)+n; day.secondary[k]=(day.secondary[k] || 0)+n; });
    if(!cardio && (!primary || origin==='name-estimate' || !n || conflict)) unknown.push(row);
  });
  var upper=['chest','back','lats','traps','shoulders','biceps','triceps','forearms'],lower=['glutes','quads','hamstrings','calves','adductors','abductors'];
  function sum(keys) { return keys.reduce(function(n,k) { return n+(totals[k] || 0); },0); }
  return {ok:true,planId:id,planName:plan.PlanName,username:plan.Username,goal:plan.Goal || '',level:plan.Level || '',days:Object.keys(days).map(function(k) { return days[k]; }).sort(function(a,b) { return a.dayNo-b.dayNo; }),totals:totals,secondaryTotals:secondary,items:rows,unmapped:unknown,metric:'direct-sets',balance:{upper:sum(upper),lower:sum(lower),warnings:unknown.length ? [unknown.length+' حرکت به تکمیل گروه عضلانی یا ست نیاز دارد؛ تا اصلاح بانک، تحلیل پوشش کامل نیست.'] : [],score:null},explanation:'رنگ بدن بر اساس ست‌های ثبت‌شده برای عضلهٔ اصلی است. عضلات کمکی جدا گزارش می‌شوند؛ این نمایش اندازه‌گیری شدت درگیری یا تشخیص پزشکی نیست.'};
}
function sfAdminPlanAnatomy(token,planId) {
  sfAdmin_(token); sfEnsure_(); var id=normalize_(planId),plan=sfObjects_(sfRead_(SF.PLANS)).find(function(p) { return normalize_(p.PlanID)===id; });
  if(!plan) throw new Error('برنامه پیدا نشد.');
  return sfAnatomyCompute_(plan,sfObjects_(sfRead_(SF.BLOCKS)),sfObjects_(sfRead_(SF.ITEMS)),sfObjects_(sfRead_(SF.SETS)),sfBankMap_());
}

/** فهرست برنامه‌های یک شاگرد (برای انتخابگر صفحهٔ آناتومی) */
function sfAdminAnatomyPlans(token, username) {
  sfAdmin_(token); sfEnsure_();
  var u = normalize_(username);
  var dayCount_ = {};
  sfObjects_(sfRead_(SF.BLOCKS)).forEach(function (b) {
    var pid = normalize_(b.PlanID), d = Number(b.DayNo) || 0;
    if (d > (dayCount_[pid] || 0)) dayCount_[pid] = d;
  });
  return {
    ok: true,
    plans: sfObjects_(sfRead_(SF.PLANS))
      .filter(function (p) { return normalize_(p.Username) && normalize_(p.Username) !== '__LIB__' && (!u || normalize_(p.Username) === u); })
      .map(function (p) {
        var month = '';
        try {
          var created = p.CreatedAt ? new Date(p.CreatedAt) : null;
          if (created && !isNaN(created.getTime())) month = Utilities.formatDate(created, 'Asia/Tehran', 'yyyy-MM');
        } catch (e) {}
        return {
          planId: p.PlanID, planName: normalize_(p.PlanName), username: normalize_(p.Username),
          days: dayCount_[normalize_(p.PlanID)] || 0,
          month: month,
          active: String(p.Active) !== 'FALSE' && String(p.Active) !== 'false'
        };
      })
  };
}
