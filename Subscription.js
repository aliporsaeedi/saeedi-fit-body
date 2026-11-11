/**
 * Subscription.js — منبع واحد وضعیت اشتراک (v1)
 *
 * هدف‌ها:
 *  1) یک تابع، یک داده: sfSubState() هر چیزی که UI اشتراک لازم دارد را برمی‌گرداند
 *     (وضعیت من، پکیج‌ها، جدول مقایسه، شماره کارت، تنظیمات ادمین).
 *  2) هیچ قیمت/مدتی هاردکد بازنویسی نمی‌شود؛ ادمین صاحب داده است.
 *  3) سطح دسترسی از ستون Tier خوانده می‌شود، نه از متن نام پکیج.
 *  4) ارسال رسید با گزارش صادقانهٔ وضعیت تلگرام.
 *
 * این فایل به توابع موجود پروژه تکیه دارد:
 *   getSS_ / normalize_ / todayISO_ / requireSession_ / isCoach_ /
 *   sfActiveSubOf_ / sfPackageRow_ / sfSheet_ / sfObjects_ / sfAppend_ /
 *   sfUpdateSheet_ / sfInvalidate_ / sfGetSetting_ / sfSetSetting_ /
 *   ensureSheetWithHeaders_ / SF_PACKAGES_HEADERS / SF_TEXT_COLS / sfLine_ ...
 */

var SFSUB_ = {
  READY: 'SFSUB_READY_V1',
  CARD_NUMBER: 'CARD_NUMBER',
  CARD_HOLDER: 'CARD_HOLDER',
  SUPPORT: 'SUB_SUPPORT_PHONE',
  GUARANTEE: 'SUB_GUARANTEE',
  SLOTS: 'SUB_SLOTS',
  MATRIX: 'SUB_MATRIX',
  MARKETING: 'SUB_MARKETING',
  RENEW_DAYS: 'SUB_RENEW_REMIND_DAYS',
  DEFAULT_SUPPORT: '09127278492'
};

var SFSUB_DEFAULT_MATRIX = [
  { key: 'plans',   label: 'برنامه تمرین + تغذیه + مکمل', silver: 'دارد',   gold: 'دارد' },
  { key: 'pdf',     label: 'دانلود PDF برنامه',           silver: 'دارد',   gold: 'دارد' },
  { key: 'video',   label: 'گیف و انیمیشن حرکات',         silver: '—',      gold: 'دارد' },
  { key: 'bot',     label: 'ربات تلگرام (یادآور و ثبت)',   silver: '—',      gold: 'دارد' },
  { key: 'ai',      label: 'سؤال از مربی هوشمند',         silver: '۱۰ در ماه', gold: 'نامحدود' },
  { key: 'reports', label: 'تحلیل پیشرفت + گزارش هفتگی',   silver: '—',      gold: 'دارد' },
  { key: 'support', label: 'پشتیبانی مربی',               silver: 'پیام',   gold: 'اولویت‌دار' }
];

function sfSubGet_(key, def) {
  try {
    var v = sfGetSetting_(key);
    if (v === null || v === undefined || String(v) === '') return def;
    return String(v);
  } catch (e) { return def; }
}

function sfSubJson_(key, def) {
  try {
    var raw = sfSubGet_(key, '');
    if (!raw) return def;
    var v = JSON.parse(raw);
    return v || def;
  } catch (e) { return def; }
}

/** یک‌بار برای همیشه: شیت و ستون‌های لازم را آماده می‌کند و فقط اگر شیت خالی بود بذر می‌زند. */
function sfSubEnsure_() {
  try {
    if (typeof SF_TEXT_COLS !== 'undefined') {
      ['SF_Packages', 'SF_Subs', 'SF_Payments', 'SF_Settings'].forEach(function (n) {
        if (!(n in SF_TEXT_COLS)) SF_TEXT_COLS[n] = null;
      });
    }
  } catch (e) {}

  var P = null;
  try { P = PropertiesService.getScriptProperties(); } catch (e) { P = null; }
  if (P && P.getProperty(SFSUB_.READY) === '1') return true;

  var ss = null;
  try { ss = getSS_(); } catch (e) { ss = null; }
  if (!ss) return false;

  try { ensureSheetWithHeaders_(ss, 'SF_Packages', SF_PACKAGES_HEADERS); } catch (e) {}
  try { ensureSheetWithHeaders_(ss, 'SF_Settings', ['Key', 'Value']); } catch (e) {}

  /* ستون‌های تازه: Tier / CompareAt / Description */
  var changed = false;
  try {
    var sh = ss.getSheetByName('SF_Packages');
    if (sh) {
      var lastCol = Math.max(1, sh.getLastColumn());
      var hdr = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(normalize_);
      ['Tier', 'CompareAt', 'Description'].forEach(function (h) {
        if (hdr.indexOf(h) < 0) { sh.getRange(1, hdr.length + 1).setValue(h); hdr.push(h); changed = true; }
      });
    }
  } catch (e) {}
  if (changed) { try { sfInvalidate_('SF_Packages'); } catch (e) {} }

  /* بذر فقط وقتی هیچ پکیجی نیست — هیچ‌وقت قیمت موجود را بازنویسی نمی‌کند */
  var rows = [];
  try { rows = sfObjects_(sfRead_('SF_Packages')); } catch (e) { rows = []; }
  if (!rows.length) {
    try {
      sfAppend_('SF_Packages', [
        { PackageID: 'SILVER30', Name: 'نقره‌ای', Tier: 'silver', Days: '30', Price: '1500000', CompareAt: '2100000',
          Features: 'برنامه تمرین و تغذیه + دانلود PDF + ۱۰ سؤال از مربی هوشمند', Badge: '', Active: 'true', Sort: '1', Description: '' },
        { PackageID: 'GOLD180', Name: 'طلایی', Tier: 'gold', Days: '180', Price: '6900000', CompareAt: '9000000',
          Features: 'همهٔ نقره‌ای + گیف حرکات + ربات تلگرام + هوش مصنوعی نامحدود + تحلیل پیشرفت', Badge: 'پیشنهاد ما', Active: 'true', Sort: '2', Description: '' }
      ]);
      try { sfInvalidate_('SF_Packages'); } catch (e) {}
    } catch (e) {}
  }

  try {
    if (P) {
      if (!sfSubGet_(SFSUB_.SUPPORT, '')) sfSetSetting_(SFSUB_.SUPPORT, SFSUB_.DEFAULT_SUPPORT);
      if (P.getProperty(SFSUB_.READY) !== '1') P.setProperty(SFSUB_.READY, '1');
    }
  } catch (e) {}
  return true;
}

/** سطح پکیج: ستون Tier اول، بعد متن نام به‌عنوان پشتیبان */
function sfSubTierOf_(pkg) {
  var t = String((pkg && pkg.Tier) || '').toLowerCase();
  if (t === 'gold' || t === 'silver') return t;
  var n = String((pkg && pkg.Name) || '');
  if (/طلای|gold|حرفه|الماس/i.test(n)) return 'gold';
  return 'silver';
}

function sfSubTruthy_(v) {
  var s = String(v === null || v === undefined ? '' : v).trim().toLowerCase();
  return !(s === 'false' || s === '0' || s === 'no' || s === 'خیر');
}

/** پکیج‌های قابل فروش، مرتب‌شده */
function sfSubPlans_() {
  var out = [];
  try {
    sfObjects_(sfRead_('SF_Packages')).forEach(function (r) {
      if (!sfSubTruthy_(r.Active)) return;
      var days = Number(r.Days) || 0;
      var price = Number(r.Price) || 0;
      out.push({
        id: normalize_(r.PackageID),
        name: normalize_(r.Name) || normalize_(r.PackageID),
        tier: sfSubTierOf_(r),
        days: days,
        price: price,
        compareAt: Number(r.CompareAt) || 0,
        perDay: days > 0 && price > 0 ? Math.round(price / days) : 0,
        features: String(normalize_(r.Features) || '').split(/[+·|،]/).map(function (s) { return normalize_(s); }).filter(Boolean),
        badge: normalize_(r.Badge),
        description: normalize_(r.Description || ''),
        sort: Number(r.Sort) || 0
      });
    });
  } catch (e) { out = []; }
  out.sort(function (a, b) {
    if (a.sort !== b.sort) return a.sort - b.sort;
    return a.price - b.price;
  });
  return out;
}

/** وضعیت «من» — تنها منبع تاریخ پایان و روزهای باقی‌مانده */
function sfSubMe_(session) {
  var sub = { status: 'none', daysLeft: 0, endDate: '' };
  try { sub = sfActiveSubOf_(session.username); } catch (e) { sub = { status: 'none', daysLeft: 0, endDate: '' }; }
  var role = String((session && session.role) || '').toLowerCase();
  var staff = role === 'coach' || role === 'admin';
  var pkg = null;
  if (sub && sub.packageId) { try { pkg = sfPackageRow_(sub.packageId); } catch (e) { pkg = null; } }
  var tier = staff ? 'gold' : (sub.status === 'none' ? 'none' : sfSubTierOf_(pkg));
  var tierName = staff ? 'مربی' : (tier === 'gold' ? 'طلایی' : (tier === 'silver' ? 'نقره‌ای' : 'بدون اشتراک'));
  return {
    username: session.username,
    staff: staff,
    status: staff ? 'staff' : sub.status,
    active: staff || sub.status === 'active' || sub.status === 'grace',
    tier: tier,
    tierName: tierName,
    packageId: normalize_(sub.packageId || ''),
    packageName: pkg ? normalize_(pkg.Name) : '',
    daysLeft: Math.round(Number(sub.daysLeft) || 0),
    endDate: normalize_(sub.endDate || '')
  };
}

function sfSubActiveCount_() {
  try {
    var now = todayISO_();
    var seen = {};
    sfObjects_(sfRead_('SF_Subs')).forEach(function (r) {
      if (String(normalize_(r.Status)).toLowerCase() !== 'active') return;
      if (String(normalize_(r.EndDate)) < now) return;
      seen[String(normalize_(r.Username)).toLowerCase()] = 1;
    });
    return Object.keys(seen).length;
  } catch (e) { return 0; }
}

/**
 * تنها تابعی که UI اشتراک صدا می‌زند.
 * @param {string} token
 */
function sfSubState(token) {
  var s = requireSession_(token);
  sfSubEnsure_();
  var me = sfSubMe_(s);
  var matrix = sfSubJson_(SFSUB_.MATRIX, null);
  if (!matrix || !matrix.length) matrix = SFSUB_DEFAULT_MATRIX;
  var marketing = sfSubJson_(SFSUB_.MARKETING, {});
  var cardNumber = sfSubGet_(SFSUB_.CARD_NUMBER, '');
  var cardHolder = sfSubGet_(SFSUB_.CARD_HOLDER, '');
  var support = sfSubGet_(SFSUB_.SUPPORT, SFSUB_.DEFAULT_SUPPORT);
  var state = {
    ok: true,
    serverDate: todayISO_(),
    me: me,
    plans: sfSubPlans_(),
    matrix: matrix,
    card: { number: cardNumber, holder: cardHolder },
    support: { phone: support, whatsapp: String(support).replace(/^0/, '98') },
    marketing: {
      guarantee: sfSubGet_(SFSUB_.GUARANTEE, 'اگر هفتهٔ اول راضی نبودی، جبران می‌کنیم.'),
      slots: sfSubGet_(SFSUB_.SLOTS, ''),
      showDaily: marketing.showDaily !== false,
      showSocial: marketing.showSocial !== false,
      showCompare: marketing.showCompare !== false
    },
    stats: { activeCount: sfSubActiveCount_() },
    renewRemindDays: Number(sfSubGet_(SFSUB_.RENEW_DAYS, '7')) || 7,
    staff: !!me.staff
  };
  if (me.staff) {
    state.admin = {
      card: state.card,
      support: support,
      guarantee: state.marketing.guarantee,
      slots: state.marketing.slots,
      renewRemindDays: state.renewRemindDays,
      matrix: matrix,
      plans: sfSubPlans_()
    };
  }
  return state;
}

/** ذخیرهٔ تنظیمات اشتراک توسط مربی/ادمین */
function sfSubSaveSettings(token, cfg) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  cfg = cfg || {};
  sfSubEnsure_();
  if (cfg.cardNumber !== undefined) sfSetSetting_(SFSUB_.CARD_NUMBER, normalize_(cfg.cardNumber));
  if (cfg.cardHolder !== undefined) sfSetSetting_(SFSUB_.CARD_HOLDER, normalize_(cfg.cardHolder));
  if (cfg.support !== undefined) sfSetSetting_(SFSUB_.SUPPORT, normalize_(cfg.support));
  if (cfg.guarantee !== undefined) sfSetSetting_(SFSUB_.GUARANTEE, normalize_(cfg.guarantee));
  if (cfg.slots !== undefined) sfSetSetting_(SFSUB_.SLOTS, normalize_(cfg.slots));
  if (cfg.renewRemindDays !== undefined) sfSetSetting_(SFSUB_.RENEW_DAYS, String(Number(cfg.renewRemindDays) || 7));
  if (cfg.matrix && cfg.matrix.length) {
    var clean = cfg.matrix.map(function (r) {
      return { key: normalize_(r.key), label: normalize_(r.label), silver: normalize_(r.silver), gold: normalize_(r.gold) };
    });
    sfSetSetting_(SFSUB_.MATRIX, JSON.stringify(clean));
  }
  try { sfAudit_(s.username, 'sub_settings', 'subscription', '', JSON.stringify(cfg).slice(0, 400), ''); } catch (e) {}
  return { ok: true };
}

/** ذخیره یا ساخت پکیج (قیمت، مدت، سطح، قیمت خط‌خورده) */
function sfSubSavePlan(token, p) {
  var s = requireSession_(token);
  if (!isCoach_(s)) throw new Error('فقط مربی/ادمین.');
  p = p || {};
  var id = normalize_(p.id || p.PackageID);
  if (!id) throw new Error('کد پکیج لازم است.');
  sfSubEnsure_();
  var patch = {
    Name: normalize_(p.name) || id,
    Tier: String(normalize_(p.tier)).toLowerCase() === 'gold' ? 'gold' : 'silver',
    Days: String(Math.max(1, Number(p.days) || 30)),
    Price: String(Math.max(0, Number(p.price) || 0)),
    CompareAt: String(Math.max(0, Number(p.compareAt) || 0)),
    Features: normalize_(p.features),
    Badge: normalize_(p.badge),
    Active: p.active === false ? 'false' : 'true',
    Sort: String(Number(p.sort) || 0),
    Description: normalize_(p.description || '')
  };
  var found = false;
  try {
    found = sfObjects_(sfRead_('SF_Packages')).some(function (r) { return normalize_(r.PackageID) === id; });
  } catch (e) { found = false; }
  if (found) {
    sfUpdateSheet_('SF_Packages', function (r) { return normalize_(r.PackageID) === id; }, patch);
  } else {
    patch.PackageID = id;
    sfAppend_('SF_Packages', [patch]);
  }
  try { sfInvalidate_('SF_Packages'); } catch (e) {}
  try { sfAudit_(s.username, 'package', id, found ? 'update' : 'create', JSON.stringify(patch), ''); } catch (e) {}
  return { ok: true, created: !found, id: id };
}

/**
 * ثبت رسید کارت‌به‌کارت + ارسال به تلگرام، با پاسخ صادقانه:
 * telegram: 'sent' | 'not_configured' | 'failed'
 */
function sfSubReceipt(token, p) {
  var s = requireSession_(token);
  p = p || {};
  sfSubEnsure_();
  if (!p.receipt || !p.receipt.base64) throw new Error('تصویر رسید را انتخاب کنید.');
  var res = sfPayReceipt_(token, { packageId: p.packageId, coupon: p.coupon || '', receipt: p.receipt }, p.cid || '');

  var telegram = 'failed';
  var info = { configured: false, chats: [] };
  try { info = sf3TgInfo_() || info; } catch (e) {}
  if (!info.configured || !info.chats || !info.chats.length) {
    telegram = 'not_configured';
  } else {
    try {
      var row = null;
      sfObjects_(sfRead_('SF_Payments')).forEach(function (r) {
        if (!row && normalize_(r.PayID) === normalize_(res.payId)) row = r;
      });
      if (row && row.ReceiptFileId) {
        var ok = sf3SendReceiptPhoto_(row.ReceiptFileId,
          '🧾 رسید جدید\n' + s.username + '\nمبلغ: ' + res.amount + ' تومان\nشناسه: ' + res.payId);
        telegram = ok ? 'sent' : 'failed';
      }
    } catch (e) { telegram = 'failed'; }
  }
  return { ok: true, payId: res.payId, amount: res.amount, telegram: telegram };
}
