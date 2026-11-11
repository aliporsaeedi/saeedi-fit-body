/**
 * ErrorReport.js — خطاهای اپ/پنل/بک‌اند را به تلگرام ادمین می‌فرستد
 *
 * چرا: قبلاً خطاها فقط در کنسول مرورگر یا لاگ Apps Script می‌ماندند و کسی
 * خبردار نمی‌شد. حالا هر خطای واقعی (کرش JS، رد شدن درخواست، خطای شیت/بانک،
 * قطع اتصال به سرور) به چت ادمین می‌رود.
 *
 * مقصد: COACH_TELEGRAM_CHAT_ID یا TG_ADMIN_CHAT یا فهرست ADMIN_CHATS.
 */

var SF_ERR_BUCKET = 'SF_ErrorLog';
var SF_ERR_MAX_TEXT = 1400;

function sfErrProps_() {
  try { return PropertiesService.getScriptProperties(); } catch (e) { return null; }
}

/** چت‌های ادمین: اصلی + فهرست ذخیره‌شده */
function sfErrChats_() {
  var p = sfErrProps_();
  var out = [];
  if (p) {
    var main = String(p.getProperty('COACH_TELEGRAM_CHAT_ID') || p.getProperty('TG_ADMIN_CHAT') || '').trim();
    if (main) out.push(main);
    String(p.getProperty('ADMIN_CHATS') || '').split(',').forEach(function (c) {
      c = String(c || '').trim();
      if (c && out.indexOf(c) < 0) out.push(c);
    });
  }
  return out;
}

/** متن خوانا و کوتاه برای تلگرام */
function sfErrFmt_(data) {
  data = data || {};
  var role = String(data.role || '').toLowerCase();
  var who = String(data.username || '').trim() || (role ? '(' + role + ')' : 'ناشناس');
  var lines = [];
  lines.push('🚨 <b>خطا در ' + (data.app === 'admin' ? 'پنل ادمین' : (data.app === 'server' ? 'سرور' : 'اپ شاگرد')) + '</b>');
  lines.push('👤 ' + who);
  if (data.action) lines.push('🎯 ' + data.action);
  lines.push('📝 ' + String(data.message || 'بدون پیام').slice(0, 400));
  if (data.fn) lines.push('⚙️ تابع: ' + data.fn);
  var extra = data.extra ? String(data.extra) : '';
  if (extra) lines.push('➕ ' + extra.slice(0, 300));
  if (data.url) lines.push('🔗 ' + String(data.url).slice(0, 160));
  if (data.stack) lines.push('<pre>' + String(data.stack).slice(0, 500) + '</pre>');
  lines.push('🕒 ' + Utilities.formatDate(new Date(), 'Asia/Tehran', 'yyyy-MM-dd HH:mm:ss'));
  return lines.join('\n').slice(0, SF_ERR_MAX_TEXT + 400);
}

/** ثبت در شیت لاگ (سبک، حداکثر ۵۰۰ ردیف نگه داشته می‌شود) */
function sfErrLog_(data) {
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(SF_ERR_BUCKET);
    if (!sh) {
      sh = ss.insertSheet(SF_ERR_BUCKET);
      sh.appendRow(['Time', 'App', 'User', 'Role', 'Action', 'Function', 'Message', 'Extra', 'URL', 'Stack']);
      sh.setFrozenRows(1);
    }
    sh.appendRow([
      new Date(), data.app || '', data.username || '', data.role || '', data.action || '',
      data.fn || '', String(data.message || '').slice(0, 500), String(data.extra || '').slice(0, 500),
      String(data.url || '').slice(0, 300), String(data.stack || '').slice(0, 1000)
    ]);
    if (sh.getLastRow() > 520) sh.deleteRows(2, sh.getLastRow() - 500);
  } catch (e) { /* لاگ نباید خودش خطا بدهد */ }
}

/**
 * گزارش خطا از سمت کلاینت یا سرور.
 * دادهٔ ورودی هرچه بود، امن پاک‌سازی می‌شود؛ توکن/رمز هرگز فرستاده نمی‌شود.
 */
function sfErrorReport(data, token) {
  try {
    data = data || {};
    var session = null;
    try { if (token) session = requireSession_(token); } catch (e) { session = null; }
    var clean = {
      app: String(data.app || 'app').slice(0, 20),
      action: String(data.action || '').slice(0, 120),
      fn: String(data.fn || '').slice(0, 60),
      message: String(data.message || '').slice(0, 600),
      extra: String(data.extra || '').slice(0, 400),
      url: String(data.url || '').slice(0, 200),
      stack: String(data.stack || '').slice(0, 700),
      username: session ? session.username : String(data.username || '').slice(0, 60),
      role: session ? session.role : String(data.role || '').slice(0, 20)
    };
    if (!clean.message) return { ok: false, error: 'empty' };

    /* ضدتکرار: همان خطا از همان کاربر در ۲ دقیقه یک‌بار */
    try {
      var cache = CacheService.getScriptCache();
      var key = 'err_' + (clean.username || 'anon') + '_' + clean.message.slice(0, 80);
      if (cache.get(key)) return { ok: true, deduped: true };
      cache.put(key, '1', 120);
    } catch (eC) {}

    sfErrLog_(clean);
    var text = sfErrFmt_(clean);
    sfErrChats_().forEach(function (chat) {
      try { sfTgSend_(chat, text, null); } catch (e1) {}
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

/** گزارش از داخل سرور (خطای API، شیت، اتصال…) */
function sfErrNotify_(where, err, extra) {
  try {
    var msg = String((err && err.message) || err || '').slice(0, 600);
    if (!msg) return;
    var cache = CacheService.getScriptCache();
    var key = 'serr_' + where + '_' + msg.slice(0, 60);
    if (cache.get(key)) return;
    cache.put(key, '1', 180);
    var text = '🛠 <b>خطای سرور</b>\n📍 ' + where + '\n📝 ' + msg +
      (extra ? '\n➕ ' + String(extra).slice(0, 250) : '') +
      '\n🕒 ' + Utilities.formatDate(new Date(), 'Asia/Tehran', 'yyyy-MM-dd HH:mm:ss');
    sfErrChats_().forEach(function (chat) { try { sfTgSend_(chat, text, null); } catch (e1) {} });
  } catch (e) {}
}

/** برای خودآزمایی پنل: یک خطای تستی به تلگرام ادمین بفرست */
function sfAdminErrorTest(token) {
  sfAdmin_(token);
  var chats = sfErrChats_();
  var sent = 0;
  chats.forEach(function (c) {
    try { var r = sfTgSend_(c, '✅ آزمایش گزارش خطا — این پیام از پنل مدیریت آمد.', null); if (r && r.ok !== false) sent++; } catch (e) {}
  });
  return { ok: true, chats: chats.length, sent: sent };
}
