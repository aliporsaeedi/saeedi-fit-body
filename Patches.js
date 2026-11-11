/* =====================================================================
 * Patches.gs — اصلاحات ایزوله (فایل جدید؛ به هیچ فایل دیگری وابسته نیست جز توابع موجود)
 *  • setWater: دکمهٔ «−» آب در اپ این تابع را صدا می‌زد ولی روی سرور وجود نداشت (خطا بلعیده می‌شد و دکمه کار نمی‌کرد).
 * ===================================================================== */
function setWater(token, glasses, clientToday) {
  var s = requireSession_(token);
  var today = isValidDateStr_(clientToday) ? clientToday : todayISO_();
  var target = Math.max(0, Math.min(60, Math.round(safeNumber_(glasses, 0))));
  var cur = getWater_(s.username, today);
  var delta = target - cur.glasses;
  if (!delta) return { ok: true, water: { glasses: cur.glasses, goal: cur.goal } };
  return addWater(token, delta, today);
}
