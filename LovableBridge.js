/* =====================================================================
 * FitApp.js — توابع اپ ورزشکار با طراحی جدید (فایل تازه؛ فایل‌های قبلی دست نخورده‌اند)
 *  • sfMyPayments        : تاریخچهٔ پرداخت‌های خودِ شاگرد برای نمایش مراحل پرداخت
 *  • sfCouponPreview     : محاسبهٔ تخفیف کد قبل از ارسال رسید
 *  • sfBarcodeFood       : اطلاعات کامل غذایی بارکد (کالری + سه ماکرو) از Open Food Facts
 *  • sfCoachAi*          : مربی هوشمند با هوش مصنوعی لاوبل، شخصی‌شده با برنامه و پیشرفت ثبت‌شده
 * ===================================================================== */

function sfMyPayments(token) {
  var s = requireSession_(token), me = String(normalize_(s.username)).toLowerCase();
  var names = {};
  try { sfObjects_(sfRead_('SF_Packages')).forEach(function (r) { names[normalize_(r.PackageID)] = normalize_(r.Name); }); } catch (e) {}
  var rows = [];
  try { rows = sfObjects_(sfRead_('SF_Payments')); } catch (e) { rows = []; }
  return rows.filter(function (r) { return String(normalize_(r.Username)).toLowerCase() === me; })
    .map(function (r) {
      var pid = normalize_(r.PackageID);
      return {
        payId: normalize_(r.PayID), packageId: pid, packageName: names[pid] || pid,
        amount: Number(r.Amount) || 0, discount: Number(r.Discount) || 0, final: Number(r.Final) || 0,
        status: String(normalize_(r.Status)).toLowerCase(), createdAt: normalize_(r.CreatedAt),
        reviewedAt: normalize_(r.ReviewedAt), reason: normalize_(r.RejectReason)
      };
    })
    .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; })
    .slice(0, 12);
}

function sfCouponPreview(token, packageId, code) {
  requireSession_(token);
  var pkg = sfPackageRow_(packageId);
  if (!pkg) throw new Error('پکیج انتخاب نشده است.');
  var price = Number(pkg.Price) || 0, c = normalize_(code);
  var d = 0;
  try { d = sfCouponDiscount_(c, normalize_(packageId), price); } catch (e) { d = 0; }
  return { ok: d > 0, code: c, price: price, discount: d, final: Math.max(0, price - d) };
}

function sfBarcodeFood(token, barcode) {
  requireSession_(token);
  var code = String(normalize_(barcode)).replace(/[۰-۹]/g, function (c) { return String(c.charCodeAt(0) - 1776); }).replace(/\D/g, '');
  if (code.length < 6) throw new Error('بارکد نامعتبر است.');
  var cache = CacheService.getScriptCache(), ck = 'offx_' + code, hit = cache.get(ck);
  if (hit !== null && hit !== undefined) return hit === '-' ? null : JSON.parse(hit);
  var url = 'https://world.openfoodfacts.org/api/v2/product/' + code + '.json?fields=product_name,product_name_fa,generic_name,brands,nutriments,serving_quantity,serving_size,image_front_small_url';
  var out = null;
  try {
    var r = UrlFetchApp.fetch(url, { muteHttpExceptions: true, headers: { 'User-Agent': 'SaeediFitBody/1.0 (fitness app)' } });
    var j = JSON.parse(r.getContentText() || '{}');
    if (j && j.status === 1 && j.product) {
      var p = j.product, n = p.nutriments || {};
      var num = function (k) { var v = Number(n[k]); return isFinite(v) ? Math.round(v * 10) / 10 : 0; };
      var kcal = num('energy-kcal_100g') || (num('energy_100g') ? Math.round(num('energy_100g') / 4.184) : 0);
      out = {
        code: code,
        name: normalize_(p.product_name_fa || p.product_name || p.generic_name) || 'محصول بدون نام',
        brand: normalize_(p.brands || ''),
        image: normalize_(p.image_front_small_url || ''),
        kcal100: kcal, protein100: num('proteins_100g'), carbs100: num('carbohydrates_100g'), fat100: num('fat_100g'),
        servingGrams: Number(p.serving_quantity) || 0, servingName: normalize_(p.serving_size || '')
      };
    }
  } catch (e) { throw new Error('اتصال به بانک بارکد برقرار نشد. کمی بعد دوباره امتحان کن.'); }
  cache.put(ck, out ? JSON.stringify(out) : '-', 21600);
  return out;
}

/* The reference UI uses the already configured Apps Script AI provider. */
function sfCoachAiState(token) {
  var s = requireSession_(token), user = String(s.username).toLowerCase(), st = sfAiStatus(token), hist = [];
  try { hist = JSON.parse(CacheService.getScriptCache().get('ai_hist_' + user) || '[]'); } catch (e) {}
  return { ok: true, enabled: !!st.enabled, locked: !!st.locked, tierName: sfGate_(s).tierName,
    remaining: st.remaining || 0, limit: st.limit || 0, monthCap: -1, monthRemaining: -1,
    goals: PropertiesService.getScriptProperties().getProperty('ai_goals_' + user) || '',
    history: (Array.isArray(hist) ? hist : []).map(function(h) { return { role: h.role === 'model' ? 'ai' : 'me', text: String(h.text || ''), at: h.at || '' }; }) };
}
function sfCoachAiSaveGoals(token, text) {
  var s = requireSession_(token), user = String(s.username).toLowerCase(), clean = sfAiClean_(text, 700);
  PropertiesService.getScriptProperties().setProperty('ai_goals_' + user, clean);
  return { ok: true, goals: clean };
}
function sfCoachAiClear(token) {
  var s = requireSession_(token);
  CacheService.getScriptCache().remove('ai_hist_' + String(s.username).toLowerCase());
  return { ok: true };
}
function sfCoachAiAsk(token, question, clientToday) {
  requireSession_(token);
  var result = sfAiAsk(token, question), st = sfCoachAiState(token);
  return { ok: true, answer: result.answer, remaining: result.remaining, monthRemaining: -1, history: st.history };
}
