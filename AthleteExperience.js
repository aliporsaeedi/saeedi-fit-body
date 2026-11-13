/* Own-account additions for the athlete UI. No client-supplied username is trusted. */
function sfAthleteExerciseGuide(token, planName, dayIndex, exerciseIndex) {
  var s = requireSession_(token), plans = resolveUserPlans_(s.username).workout || [];
  var plan = plans.find(function(p) { return normalize_(p.name) === normalize_(planName); });
  if (!plan || !Number.isInteger(Number(dayIndex)) || !Number.isInteger(Number(exerciseIndex))) throw new Error('برنامه یا حرکت معتبر نیست.');
  var day = (plan.days || [])[Number(dayIndex)], ex = day && (day.exercises || [])[Number(exerciseIndex)];
  if (!ex) throw new Error('حرکت در برنامهٔ شما پیدا نشد.');
  var training = ex.training || null, names = training && training.size > 1 ? [ex.name] : String(ex.name).split(/\s*\+\s*/).filter(Boolean).slice(0, 6);
  var memo = sfBankMemo_(), allowMedia = sfGate_(s).features.gif;
  return { ok: true, name: ex.name, training: training, notes: ex.notes || '', parts: names.map(function(name) {
    var b = null;
    if (training && training.exerciseId && names.length === 1) b = memo.list.find(function(x) { return normalize_(x.ExerciseID) === normalize_(training.exerciseId); });
    if (!b) { var idx = memo.map[sfKeyNorm_(name)]; if (idx !== undefined) b = memo.list[idx]; }
    if (!b) return { name: name, found: false };
    return { name: name, matchedName: b.PersianName, found: true, instructions: normalize_(b.Instructions), tips: normalize_(b.Tips),
      muscle: normalize_(b.MuscleGroup), secondary: normalize_(b.SecondaryMuscle), equipment: normalize_(b.Equipment), movementType: normalize_(b.MovementType),
      gif: allowMedia ? b.gif || [] : [], frames: allowMedia ? b.frames || [] : [] };
  }) };
}
function sfAthleteReminderState(token) { var s = requireSession_(token); return { ok: true, reminders: getRemindersInfo_(s.username), gate: sfGate_(s) }; }
function sfAthletePlanPdf(token, kind, planName) {
  var s = requireSession_(token), kinds = { workout: 'workout', diet: 'diet', supplement: 'supplement' };
  if (!kinds[kind]) throw new Error('نوع برنامه معتبر نیست.');
  var plans = resolveUserPlans_(s.username)[kind] || [];
  var plan = plans.find(function(p) { return normalize_(p.name) === normalize_(planName); });
  if (!plan) throw new Error('این برنامه به حساب شما تخصیص داده نشده است.');
  var inner = sfAthletePlanHtml_(kind, plan, s.username);
  var html = '<!doctype html><html dir="rtl" lang="fa"><head><meta charset="utf-8"><style>' + sfPdfCss_() + sfPdfCss2_() + '</style></head><body>' + inner + '</body></html>';
  var name = 'SaeediFit_' + kind + '_' + todayISO_() + '.pdf', pdf = Utilities.newBlob(html, 'text/html', 'plan.html').getAs('application/pdf').setName(name), bytes = pdf.getBytes();
  if (bytes.length > 8 * 1024 * 1024) throw new Error('حجم فایل بیشتر از حد مجاز است؛ برای خروجی با مربی هماهنگ کنید.');
  return { ok: true, name: name, mime: 'application/pdf', base64: Utilities.base64Encode(bytes) };
}

/* Render exactly the already-authorized resolved plan, including imported legacy plans. */
function sfAthletePlanHtml_(kind, plan, username) {
  var esc = function(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }).replace(/[۰-۹]/g,function(d){return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d));}).replace(/[٠-٩]/g,function(d){return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d));}); };
  var row = function(cells) { return '<tr>' + cells.map(function(v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>'; };
  var table = function(head, rows) { return '<table style="width:100%;border-collapse:collapse"><thead><tr>' + head.map(function(v){return '<th>'+esc(v)+'</th>';}).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>'; };
  var logo = ''; try { logo = '<img width="100" height="100" style="object-fit:contain;background:#f2f4ef;border-radius:12px" src="data:image/svg+xml;base64,' + HtmlService.createHtmlOutputFromFile('BrandLogo').getContent().trim() + '" alt="Saeedi Fit Body">'; } catch(e) {}
  var h = '<header style="border-bottom:2px solid #246447;padding-bottom:14px">'+logo+'<h1>'+esc(plan.name)+'</h1><p>'+esc(username)+' · '+esc(todayISO_())+'</p></header>';
  if (kind === 'workout') {
    (plan.days || []).forEach(function(day) {
      h += '<h2>'+esc(day.title)+'</h2>';
      if (day.isRest || !(day.exercises || []).length) { h += '<p>روز استراحت</p>'; return; }
      h += table(['حرکت','ست','تکرار','استراحت (ثانیه)','مدل و یادداشت مربی'],day.exercises.map(function(ex) {
        var t=ex.training, rest=ex.bank && ex.bank.rest;
        return row([ex.name,ex.sets,ex.reps,rest == null ? '—' : rest, (t ? (t.label || t.technique) + (t.size>1 ? ' · '+t.position+'/'+t.size+' · '+t.peers.join(' + ') : '') + (t.description ? ' · '+t.description : '') : '') + (ex.notes ? ' · '+ex.notes : '')]);
      }));
      day.exercises.forEach(function(ex) { if (!ex.training || !(ex.training.sets || []).length) return; h += '<h3>'+esc(ex.name)+'</h3>'+table(['ست','تکرار','وزنهٔ هدف','استراحت (ثانیه)'],ex.training.sets.map(function(s){return row([s.setNo,s.reps,s.weight,s.rest == null ? '—' : s.rest]);})); });
    });
  } else if (kind === 'diet') {
    (plan.sections || []).forEach(function(section) { h += '<h2>'+esc(section.title)+'</h2>'+table(['غذا','مقدار و توضیح','kcal','پروتئین','کربوهیدرات','چربی'],(section.items || []).map(function(i){return row([i.title || i.name,i.description,i.kcal == null ? '—' : i.kcal,i.protein == null ? '—' : i.protein,i.carbs == null ? '—' : i.carbs,i.fat == null ? '—' : i.fat]);})); });
  } else {
    (plan.schedule || []).forEach(function(s){h += '<h2>'+esc(s.timing)+'</h2>'+table(['مکمل'],(s.items || []).map(function(i){return row([i]);}));});
    (plan.groups || []).forEach(function(g){h += '<h2>'+esc(g.title)+'</h2>'+table(['مکمل','زمان مصرف'],(g.items || []).map(function(i){return row([i.name,(i.timings || []).join('، ')]);}));});
    if ((plan.items || []).length) h += '<h2>جزئیات برنامهٔ مکمل</h2>'+table(['دسته','نام','دوز ثبت‌شده','زمان','توضیح مربی'],plan.items.map(function(i){return row([i.category,i.name,i.dosage,i.timing,i.instructions]);}));
  }
  if ((plan.notes || []).length) h += '<h2>یادداشت‌های مربی</h2><p>'+ (Array.isArray(plan.notes) ? plan.notes : [plan.notes]).map(esc).join('<br>')+'</p>';
  return h;
}
