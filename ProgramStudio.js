/**
 * ProgramStudio.gs — ویرایش، تحلیل و تولید هوشمند برنامه‌های تمرینی
 *
 * چرا این فایل؟ پنل ادمین (?page=admin) فقط فهرست برنامه‌ها را نشان می‌داد و
 * برای هر تغییری باید به اپ شاگردان می‌رفت. این‌جا همان قابلیت‌های پنل اپ
 * (ویرایش ست/تکرار/روش تمرینی)، بانک برنامه‌ها و تحلیل برنامه با یک موتور
 * تولید برنامهٔ هدف‌محور اضافه شده است.
 *
 * وابستگی: Code.gs, TrainingModule.gs (SF, sfRead_, sfBuildPlans_, sfAdminSavePlan, ...)
 *           ProgramImport.gs (ساخت برنامه از قالب متنی)
 */

/* -------------------------------------------------------------- دسترسی --- */

function sfPsCoach_(token) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('این بخش فقط برای مربی/ادمین است.');
  sfEnsure_();
  return s;
}
function sfPsAdmin_(token) {
  var s = requireSession_(token);
  if (!isAdmin_(s)) throw new Error('فقط ادمین می‌تواند برنامه را ذخیره یا تولید کند.');
  sfEnsure_();
  return s;
}

/* ------------------------------------------------------- خواندن برنامه --- */

function sfPsPlanRow_(planId) {
  var id = normalize_(planId);
  if (!id) throw new Error('شناسهٔ برنامه لازم است.');
  var plan = sfObjects_(sfRead_(SF.PLANS)).filter(function (o) { return normalize_(o.PlanID) === id; })[0];
  if (!plan) throw new Error('برنامه پیدا نشد.');
  return plan;
}

/** برنامهٔ کامل (روزها، بلوک‌ها، ست‌ها) برای فرم ویرایش. */
function sfPsPlanGet(token, planId) {
  sfPsCoach_(token);
  var plan = sfPsPlanRow_(planId);
  var built = sfBuildPlans_([plan], sfBankMap_());
  return { ok: true, plan: built.plans[0], exercises: built.exercises, techniques: SF_TECHNIQUES };
}

/**
 * ذخیرهٔ ویرایش‌ها. همان قرارداد sfAdminSavePlan را می‌گیرد
 * (blocks با items[].exerciseId و sets[].cells[].reps) و فقط ادمین اجازه دارد.
 */
function sfPsPlanSave(token, payload) {
  sfPsAdmin_(token);
  payload = payload || {};
  if (!payload.planId) throw new Error('برای ذخیره، شناسهٔ برنامه لازم است.');
  var res = sfAdminSavePlan(token, payload);
  return Object.assign({ ok: true }, res || {});
}

/* ---------------------------------------------------------- تحلیل برنامه --- */

var SF_PS_GROUP_ORDER = ['سینه', 'پشت', 'سرشانه', 'جلوبازو', 'پشت بازو', 'پا', 'باسن', 'ساق پا', 'شکم', 'هوازی'];
var SF_PS_GOAL_LABEL = { lose: 'کاهش چربی', gain: 'افزایش حجم', strength: 'افزایش قدرت', tone: 'تناسب اندام' };

/**
 * نگاشت نام گروه عضلانی به کلید ثابت.
 * ترتیب مهم است: «پشت بازو» نباید در سبد «پشت» بیفتد و «ساق پا» نباید
 * با «پا» یکی شود. پس اول موارد مرکب بررسی می‌شوند.
 */
function sfPsCanon_(group) {
  var g = normalize_(group).replace(/\u200c/g, ' ').replace(/\s+/g, ' ').trim();
  if (!g) return '';
  if (/پشت ?بازو|ترایسپ|پشت بازو/.test(g)) return 'پشت بازو';
  if (/جلو ?بازو|بایسپ/.test(g)) return 'جلوبازو';
  if (/ساق|کالف/.test(g)) return 'ساق پا';
  if (/باسن|سرین|گلوت/.test(g)) return 'باسن';
  if (/پشت|لت|زیربغل/.test(g)) return 'پشت';
  if (/سینه|پکت/.test(g)) return 'سینه';
  if (/سرشانه|دلت|شانه/.test(g)) return 'سرشانه';
  if (/شکم|پهلو|ابس|فیله/.test(g)) return 'شکم';
  if (/هوازی|کاردیو/.test(g)) return 'هوازی';
  if (/پا|ران|چهارسر|همسترینگ/.test(g)) return 'پا';
  return g;
}
function sfPsGroupKey_(group) {
  var g = sfPsCanon_(group);
  return g || 'نامشخص';
}

/**
 * تحلیل یک برنامهٔ ساخته‌شده: حجم هر گروه عضلانی در یک دوره،
 * تعادل فشار/کشش، پوشش هوازی، پوشش گیف و هشدارهای قابل‌اصلاح.
 */
function sfPsAnalyze_(plan, exMap) {
  exMap = exMap || {};
  var groups = {}, techs = {}, gifs = { NEW: 0, OLD: 0, NONE: 0 };
  var days = (plan && plan.days) || [];
  var blocksN = 0, itemsN = 0, setsN = 0, cardioSets = 0, maxDaySets = 0;
  var daySets = [];

  days.forEach(function (day) {
    var dSets = 0;
    (day.blocks || []).forEach(function (b) {
      blocksN++;
      techs[b.technique] = (techs[b.technique] || 0) + 1;
      var nSets = (b.sets || []).length || 1;
      (b.items || []).forEach(function (it) {
        itemsN++;
        var g = sfPsGroupKey_(it.group);
        if (!groups[g]) groups[g] = { sets: 0, exercises: 0 };
        groups[g].sets += nSets;
        groups[g].exercises += 1;
        dSets += nSets;
        setsN += nSets;
        var ex = exMap[it.exerciseId] || {};
        if (g === 'هوازی' || ex.cardio) cardioSets += nSets;
        var src = (ex.media && ex.media.src) || '';
        if (src === 'new') gifs.NEW++;
        else if (src) gifs.OLD++;
        else gifs.NONE++;
      });
    });
    daySets.push(dSets);
    if (dSets > maxDaySets) maxDaySets = dSets;
  });

  var warnings = [], tips = [];

  /* گروه‌های اصلی که هیچ ستی ندارند (پا فقط با «پا» یا «باسن» یا «ساق پا» حساب می‌شود) */
  var legSets = (groups['پا'] ? groups['پا'].sets : 0) + (groups['باسن'] ? groups['باسن'].sets : 0) + (groups['ساق پا'] ? groups['ساق پا'].sets : 0);
  if (!days.length) warnings.push('برنامه هیچ روزی ندارد.');
  if (!legSets) warnings.push('هیچ ستی برای پا/باسن/ساق ثبت نشده؛ برنامهٔ متعادل باید پایین‌تنه داشته باشد.');
  if (!(groups['پشت'] && groups['پشت'].sets)) warnings.push('برای پشت (زیربغل/لت) ستی ثبت نشده؛ خطر ناهم‌ترازی فشار و کشش.');
  if (!(groups['سینه'] && groups['سینه'].sets)) warnings.push('برای سینه ستی ثبت نشده.');

  var chest = groups['سینه'] ? groups['سینه'].sets : 0;
  var back = groups['پشت'] ? groups['پشت'].sets : 0;
  if (chest && back && chest > back * 1.5) warnings.push('ست سینه (' + chest + ') بیش از ۱.۵ برابر ست پشت (' + back + ') است؛ سهم پشت را بیشتر کن.');
  if (back && chest && back > chest * 1.8) warnings.push('ست پشت (' + back + ') خیلی بیشتر از سینه (' + chest + ') است؛ سینه را تقویت کن.');

  var press = (groups['سرشانه'] ? groups['سرشانه'].sets : 0) + chest;
  var pull = back + ((groups['جلوبازو'] ? groups['جلوبازو'].sets : 0));
  if (press && pull && press > pull * 1.6) warnings.push('نسبت «فشار به کشش» به نفع فشار است؛ کشش (پشت/جلوبازو) را متعادل کن.');
  if (press && pull && pull > press * 1.8) warnings.push('نسبت «کشش به فشار» به نفع کشش است؛ سرشانه/سینه را بیشتر کن.');

  Object.keys(groups).forEach(function (g) {
    if (groups[g].sets > 24) warnings.push('حجم «' + g + '» در یک دوره ' + groups[g].sets + ' ست است؛ بالای ۲۴ ست در دوره برای یک گروه زیاد است.');
  });
  if (maxDaySets > 32) warnings.push('یک روز ' + maxDaySets + ' ست دارد؛ جلسه بیش از حد طولانی می‌شود.');
  if (days.length && maxDaySets && maxDaySets < 6) tips.push('جلسه‌ها خیلی کوتاه‌اند؛ برای هر روز حداقل ۸ تا ۱۲ ست در نظر بگیر.');

  var goal = normalize_(plan && plan.goal);
  if (/چربی|lose|کاهش/i.test(goal) && !cardioSets) warnings.push('هدف کاهش چربی است ولی هیچ بلوک هوازی در برنامه نیست.');
  if (/قدرت|strength/i.test(goal) && maxDaySets > 24) tips.push('برای هدف قدرتی، ست‌های کم با تکرار پایین (۳ تا ۶) بهتر جواب می‌دهد.');
  if (/حجم|gain/i.test(goal) && maxDaySets && maxDaySets < 12) tips.push('برای افزایش حجم، ۱۴ تا ۲۰ ست در هر جلسه منطقی‌تر است.');

  if (itemsN && gifs.NONE) tips.push(gifs.NONE + ' حرکت گیف ندارد؛ از کارت «گیف‌های جدید حرکات» تطبیق را اجرا کن.');
  if (gifs.OLD && !gifs.NEW) tips.push('همهٔ گیف‌های این برنامه قدیمی‌اند؛ اگر گیف جدید ساخته‌ای، تطبیق را اجرا کن.');

  var penalty = warnings.length * 12 + (gifs.NONE && itemsN ? Math.min(15, Math.round(gifs.NONE / itemsN * 15)) : 0);
  var score = Math.max(20, Math.min(100, 100 - penalty));

  return {
    planId: plan && plan.planId, planName: plan && plan.planName, username: plan && plan.username,
    goal: goal, level: normalize_(plan && plan.level),
    summary: {
      days: days.length, blocks: blocksN, exercises: itemsN, sets: setsN,
      cardioSets: cardioSets, maxDaySets: maxDaySets, daySets: daySets,
      groups: groups, techs: techs, gifs: gifs
    },
    score: score,
    warnings: warnings,
    tips: tips
  };
}

function sfPsPlanAnalysis(token, planId) {
  sfPsCoach_(token);
  var plan = sfPsPlanRow_(planId);
  var built = sfBuildPlans_([plan], sfBankMap_());
  var a = sfPsAnalyze_(built.plans[0], built.exercises);
  return Object.assign({ ok: true }, a, { techniques: SF_TECHNIQUES });
}

/* ------------------------------------------------------- بانک برنامه‌ها --- */

function sfPsBankList(token) {
  sfPsCoach_(token);
  var plans = sfObjects_(sfRead_(SF.PLANS)).filter(function (p) { return normalize_(p.Username) === SF7_LIB; });
  if (!plans.length) return { ok: true, items: [], total: 0 };
  var built = sfBuildPlans_(plans, sfBankMap_());
  var items = built.plans.map(function (p) {
    var a = sfPsAnalyze_(p, built.exercises);
    return {
      planId: p.planId, name: p.planName, goal: p.goal || '', level: p.level || '',
      days: a.summary.days, blocks: a.summary.blocks, exercises: a.summary.exercises,
      sets: a.summary.sets, score: a.score, gifs: a.summary.gifs, updatedAt: p.updatedAt || p.createdAt || ''
    };
  }).sort(function (x, y) { return String(y.updatedAt).localeCompare(String(x.updatedAt)); });
  return { ok: true, items: items, total: items.length };
}

/** یک برنامهٔ شاگرد را در بانک برنامه‌ها (کتابخانه) ذخیره می‌کند. */
function sfPsPlanToBank(token, planId, name) {
  var s = sfPsAdmin_(token);
  var plan = sfPsPlanRow_(planId);
  var nm = sfText_(name, 120) || normalize_(plan.PlanName);
  if (!nm) throw new Error('نام برنامه لازم است.');
  sf7CopyWorkoutTo_(plan.PlanID, SF7_LIB, nm, s.username);
  return { ok: true, name: nm };
}

/* ------------------------------------------------ تولید هوشمند برنامه --- */

var SF_PS_SPLITS = {
  1: [{ title: 'کل بدن', groups: ['سینه', 'پشت', 'پا', 'سرشانه', 'شکم'] }],
  2: [
    { title: 'بالاتنه', groups: ['سینه', 'پشت', 'سرشانه', 'پشت بازو'] },
    { title: 'پایین‌تنه و شکم', groups: ['پا', 'باسن', 'ساق پا', 'شکم'] }
  ],
  3: [
    { title: 'فشار: سینه و سرشانه', groups: ['سینه', 'سرشانه', 'پشت بازو'] },
    { title: 'کشش: پشت و جلوبازو', groups: ['پشت', 'جلوبازو'] },
    { title: 'پا و شکم', groups: ['پا', 'باسن', 'ساق پا', 'شکم'] }
  ],
  4: [
    { title: 'سینه و پشت بازو', groups: ['سینه', 'پشت بازو'] },
    { title: 'پشت و جلوبازو', groups: ['پشت', 'جلوبازو'] },
    { title: 'پا و باسن', groups: ['پا', 'باسن', 'ساق پا'] },
    { title: 'سرشانه و شکم', groups: ['سرشانه', 'شکم'] }
  ],
  5: [
    { title: 'سینه', groups: ['سینه', 'پشت بازو'] },
    { title: 'پشت', groups: ['پشت', 'جلوبازو'] },
    { title: 'پا', groups: ['پا', 'ساق پا'] },
    { title: 'سرشانه و شکم', groups: ['سرشانه', 'شکم'] },
    { title: 'باسن و بازو', groups: ['باسن', 'جلوبازو', 'پشت بازو'] }
  ],
  6: [
    { title: 'فشار سنگین (سینه/سرشانه)', groups: ['سینه', 'سرشانه', 'پشت بازو'] },
    { title: 'کشش سنگین (پشت/بازو)', groups: ['پشت', 'جلوبازو'] },
    { title: 'پا (جلوی ران)', groups: ['پا', 'ساق پا'] },
    { title: 'فشار سبک و شکم', groups: ['سینه', 'سرشانه', 'شکم'] },
    { title: 'کشش سبک و باسن', groups: ['پشت', 'باسن'] },
    { title: 'پا (پشت ران) و ساق', groups: ['پا', 'ساق پا', 'شکم'] }
  ]
};

var SF_PS_GOAL_PLAN = {
  lose: { sets: 3, reps: '12-15', rest: 45, lastTech: 'dropset', cardio: 1 },
  gain: { sets: 4, reps: '8-12', rest: 90, lastTech: 'normal', cardio: 0 },
  strength: { sets: 5, reps: '4-6', rest: 150, lastTech: 'normal', cardio: 0 },
  tone: { sets: 3, reps: '15-20', rest: 60, lastTech: 'dropset', cardio: 0 }
};

function sfPsEquipMatch_(equip, wanted) {
  var e = normalize_(equip), w = normalize_(wanted);
  if (!w || w === 'all') return true;
  if (w === 'body') return e.indexOf('وزن بدن') >= 0 || e.indexOf('بدون وزنه') >= 0;
  return e.indexOf(w) >= 0;
}

function sfPsPick_(byGroup, group, used, rotation, count, level) {
  var pool = byGroup[group] || [];
  if (!pool.length) return [];
  var fresh = pool.filter(function (e) { return !used[e.ExerciseID]; });
  var list = fresh.length >= count ? fresh : pool;
  var out = [];
  for (var i = 0; i < list.length && out.length < count; i++) {
    var idx = (rotation + i) % list.length;
    var ex = list[idx];
    if (!ex || used[ex.ExerciseID]) continue;
    if (level === 'مبتدی' && normalize_(ex.Level) === 'پیشرفته') continue;
    used[ex.ExerciseID] = 1;
    out.push(ex);
  }
  return out;
}

function sfPsBlockOf_(ex, goalCfg, isLast, dayNo, dayTitle, restBetween) {
  var sets = [];
  var reps = goalCfg.reps;
  for (var i = 1; i <= goalCfg.sets; i++) {
    sets.push({
      setNo: i,
      restAfterSec: goalCfg.rest,
      cells: [{ reps: reps, weight: '' }]
    });
  }
  return {
    dayNo: dayNo, dayTitle: dayTitle,
    technique: isLast && goalCfg.lastTech !== 'normal' ? goalCfg.lastTech : 'normal',
    notes: '', restBetweenSec: restBetween,
    items: [{ exerciseId: ex.ExerciseID }],
    sets: sets
  };
}

/** هدف شاگرد را از پروفایل خودش می‌خواند؛ اگر پروفایلی نبود، «افزایش حجم». */
function sfPsGoalFromProfile_(username) {
  try {
    var p = getProfile_(normalize_(username));
    var g = normalize_((p && p.goal) || '').toLowerCase();
    if (g === 'lose') return 'lose';
    if (g === 'gain') return 'gain';
    if (g === 'maintain' || g === 'maintenance') return 'tone';
  } catch (e) { }
  return '';
}

/**
 * تولید برنامهٔ هدف‌محور از بانک حرکات.
 * ورودی: { username, planName, goal, level, daysPerWeek, equipment, sessionMinutes, saveToBank, note }
 * goal = 'auto' یعنی هدف از پروفایل شاگرد خوانده شود.
 */
function sfPsSmartGenerate(token, opts) {
  var s = sfPsAdmin_(token);
  opts = opts || {};
  var username = sfText_(opts.username, 80);
  if (!username) throw new Error('شاگرد مقصد را انتخاب کن (برنامه باید به یک شاگرد ثبت شود).');
  var goalIn = normalize_(opts.goal);
  if (goalIn === 'auto' || goalIn === '') goalIn = sfPsGoalFromProfile_(username) || 'gain';
  var goal = ['lose', 'gain', 'strength', 'tone'].indexOf(goalIn) >= 0 ? goalIn : 'gain';
  var level = ['مبتدی', 'متوسط', 'پیشرفته'].indexOf(normalize_(opts.level)) >= 0 ? normalize_(opts.level) : 'متوسط';
  var daysPerWeek = Math.max(1, Math.min(6, Number(opts.daysPerWeek) || 3));
  var minutes = Math.max(20, Math.min(120, Number(opts.sessionMinutes) || 60));
  var equip = normalize_(opts.equipment) || 'all';
  var planName = sfText_(opts.planName, 120) || (SF_PS_GOAL_LABEL[goal] + ' — ' + daysPerWeek + ' روزه');

  var bank = sfObjects_(sfRead_(SF.BANK)).filter(function (e) { return sfIsTrue_(e.Active); });
  if (!bank.length) throw new Error('بانک حرکات خالی است.');
  var pool = bank.filter(function (e) {
    if (!sfPsEquipMatch_(e.Equipment, equip)) return false;
    if (level === 'مبتدی' && normalize_(e.Level) === 'پیشرفته') return false;
    return true;
  });
  if (!pool.length) throw new Error('با این وسیله و سطح، حرکتی در بانک پیدا نشد؛ گزینهٔ «همهٔ وسایل» را انتخاب کن.');

  var byGroup = {};
  pool.forEach(function (e) {
    var g = sfPsCanon_(e.MuscleGroup);
    if (!g) return;
    if (!byGroup[g]) byGroup[g] = [];
    byGroup[g].push(e);
  });
  Object.keys(byGroup).forEach(function (g) {
    byGroup[g].sort(function (a, b) {
      var ac = normalize_(a.MovementType) === 'ترکیبی' ? 0 : 1;
      var bc = normalize_(b.MovementType) === 'ترکیبی' ? 0 : 1;
      if (ac !== bc) return ac - bc;
      var as = Number(a.SuggestedSets) || 0, bs = Number(b.SuggestedSets) || 0;
      if (as !== bs) return bs - as;
      return String(a.ExerciseID).localeCompare(String(b.ExerciseID));
    });
  });

  var goalCfg = SF_PS_GOAL_PLAN[goal];
  var split = SF_PS_SPLITS[daysPerWeek] || SF_PS_SPLITS[3];
  var perGroup = minutes >= 75 ? 2 : 1;
  var used = {};
  var blocks = [], rotation = 0;
  var cardioEx = pool.filter(function (e) { return normalize_(e.Category) === 'هوازی'; });

  split.forEach(function (day, di) {
    var picked = [];
    day.groups.forEach(function (g, gi) {
      if (g === 'شکم' && minutes < 45) return;
      var want = (gi === 0 || perGroup === 2) ? perGroup : 1;
      var got = sfPsPick_(byGroup, g, used, rotation + di + gi, want, level);
      got.forEach(function (ex) { picked.push(ex); });
    });
    if (!picked.length) return;
    var restBetween = goal === 'strength' ? 120 : 75;
    picked.forEach(function (ex, i) {
      blocks.push(sfPsBlockOf_(ex, goalCfg, i === picked.length - 1 && picked.length > 1, di + 1, day.title, restBetween));
    });
    if (goalCfg.cardio && cardioEx.length) {
      var cx = cardioEx[(rotation + di) % cardioEx.length];
      blocks.push({
        dayNo: di + 1, dayTitle: day.title, technique: 'cardio', notes: 'پایان جلسه — شدت متوسط',
        restBetweenSec: 0, items: [{ exerciseId: cx.ExerciseID }],
        sets: [{ setNo: 1, restAfterSec: 0, cells: [{ reps: (goal === 'lose' ? '20' : '15') + ' دقیقه', weight: '' }] }]
      });
    }
  });

  if (!blocks.length) throw new Error('با این تنظیمات بلوکی ساخته نشد؛ روزهای تمرین یا سطح را تغییر بده.');

  var note = sfText_(opts.note, 800);
  var coachNotes = (note ? note + '\n' : '') + 'تولید خودکار بر اساس هدف ' + SF_PS_GOAL_LABEL[goal] + ' — ' + daysPerWeek + ' روز در هفته، سطح ' + level + '.';
  var payload = {
    planName: planName, username: username, goal: SF_PS_GOAL_LABEL[goal], level: level,
    coachNotes: coachNotes, blocks: blocks
  };
  var saved = sfAdminSavePlan(token, payload);
  var planId = (saved && saved.planId) || '';

  var bankName = '';
  if (opts.saveToBank) {
    try {
      bankName = sfText_(opts.bankName, 120) || planName;
      sf7CopyWorkoutTo_(planId, SF7_LIB, bankName, s.username);
    } catch (eB) { bankName = ''; }
  }

  var analysis = null;
  try {
    var one = sfObjects_(sfRead_(SF.PLANS)).filter(function (p) { return normalize_(p.PlanID) === planId; })[0];
    var built = sfBuildPlans_([one], sfBankMap_());
    analysis = sfPsAnalyze_(built.plans[0], built.exercises);
  } catch (eA) { analysis = null; }

  return {
    ok: true, planId: planId, planName: planName, username: username,
    goal: SF_PS_GOAL_LABEL[goal], days: daysPerWeek, blocks: blocks.length,
    exercises: analysis ? analysis.summary.exercises : 0,
    sets: analysis ? analysis.summary.sets : 0,
    savedToBank: bankName, analysis: analysis
  };
}

/** توزیع حجم و گروه‌ها برای داشبورد برنامه‌ها (بدون تحلیل سنگین). */
function sfPsVolumeBrief(token) {
  sfPsCoach_(token);
  var plans = sfObjects_(sfRead_(SF.PLANS)).filter(function (p) { return normalize_(p.Username) !== SF7_LIB; });
  var blocks = sfObjects_(sfRead_(SF.BLOCKS));
  var byGoal = {};
  plans.forEach(function (p) {
    var g = normalize_(p.Goal) || 'بدون هدف';
    byGoal[g] = (byGoal[g] || 0) + 1;
  });
  return { ok: true, plans: plans.length, blocks: blocks.length, byGoal: byGoal };
}
