
var S = { token: '', user: null, menu: [], banks: {}, techniques: [], appUrl: '', route: '', bank: {}, open: {} };
var $ = function (id) { return document.getElementById(id); };
function esc(s) { return String(s == null ? '' : s).replace(/[۰-۹٠-٩]/g, function (d) { var a = '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩'; var n = a.indexOf(d); return n < 10 ? String(n) : String(n - 10); }).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fa(n) { return Number(n || 0).toLocaleString('en-US'); }
function toast(m, bad) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = m; if (bad) t.style.background = '#d33', t.style.color = '#fff'; document.body.appendChild(t); setTimeout(function () { t.remove(); }, bad ? 5000 : 2600); }
function rpc(fn) {
  var args = Array.prototype.slice.call(arguments, 1);
  return new Promise(function (ok, no) {
    google.script.run.withSuccessHandler(ok).withFailureHandler(function (e) {
      var m = (e && e.message) || String(e);
      if (typeof reportErr === 'function' && /HTTP |network|fetch|timeout|unexpected|502|504/i.test(m)) reportErr(m, { fn: fn, action: 'admin.rpc' });
      no(new Error(m));
    })[fn].apply(null, args);
  });
}
function call(fn) { var a = Array.prototype.slice.call(arguments, 1); return rpc.apply(null, [fn, S.token].concat(a)); }
function fail(e) { var m = (e && e.message) || String(e); if (/جلسه|منقضی/.test(m)) { logout(true); } toast(m, true); }
/* ---- گزارش خطاهای پورتال به تلگرام ادمین ---- */
var ADM_ERR = { n: 0, seen: {} };
function reportErr(message, opts) {
  try {
    opts = opts || {};
    var key = String(message || '').slice(0, 90);
    if (ADM_ERR.seen[key] || ADM_ERR.n >= 15) return;
    ADM_ERR.seen[key] = 1; ADM_ERR.n++;
    google.script.run.withFailureHandler(function () {})['sfErrorReport']({
      app: 'admin', action: opts.action || '', fn: opts.fn || '',
      message: String(message || '').slice(0, 500), extra: String(opts.extra || '').slice(0, 300),
      url: String(location.href || '').slice(0, 180), stack: String(opts.stack || '').slice(0, 600)
    }, S.token || '');
  } catch (e) {}
}
/* گارد محیط: این اسکریپت در پروژهٔ Apps Script هم push می‌شود و در سرور window وجود ندارد */
if (typeof window !== 'undefined') {
window.addEventListener('error', function (e) { reportErr((e && e.message) || 'JS error', { stack: e && e.error && e.error.stack, action: 'admin.window.error' }); });
window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; reportErr((r && r.message) || String(r || 'rejection'), { stack: r && r.stack, action: 'admin.unhandled' }); });
window.addEventListener('offline', function () { try { localStorage.setItem('adm_net_was_offline', '1'); } catch (e) {} });
window.addEventListener('online', function () {
  try { if (localStorage.getItem('adm_net_was_offline') === '1') { localStorage.removeItem('adm_net_was_offline'); reportErr('اتصال اینترنت قطع و دوباره برقرار شد', { action: 'admin.network.reconnected' }); } } catch (e) {}
});
}

function store(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }

/* ---------- ورود ---------- */
function loginView(msg) {
  $('root').innerHTML = '<div class="login card"><p class="l-kick">SAEEDI FIT BODY · ADMIN PANEL</p><h2>پنل مدیریت ادمین</h2><p class="l-sub">از این مسیر فقط مربی/ادمین وارد می‌شود؛ صفحه‌ی اختصاصی مدیریت است و با اپ شاگردان فرق دارد.</p>' +
    (msg ? '<div class="note">' + esc(msg) + '</div>' : '') +
    '<p><input id="lu" placeholder="نام کاربری" class="ltr" autocomplete="username"></p>' +
    '<p><input id="lp" type="password" placeholder="رمز عبور" class="ltr" autocomplete="current-password"></p>' +
    '<button class="btn" id="lb" style="width:100%">ورود به پنل مدیریت</button><p class="l-hint">آدرس اختصاصی این پنل <span class="ltr">/admin</span> است · <a href="https://site-d704e421b31647eabb76af850b46435c.freebuff.page/">اپ شاگردان</a> جداست</p></div>';
  var go = function () {
    $('lb').disabled = true;
    rpc('login', $('lu').value, $('lp').value).then(function (r) { S.token = r.token; store('adm_token', r.token); store('fc_session', r.token); boot(); })
      .catch(function (e) { loginView(e.message); });
  };
  $('lb').onclick = go; $('lp').onkeydown = function (e) { if (e.key === 'Enter') go(); };
}
function logout(silent) { try { rpc('logout', S.token); } catch (e) {} S.token = ''; store('adm_token', null); store('fc_session', null); loginView(silent ? 'نشست شما تمام شده است؛ دوباره وارد شوید.' : ''); }
function boot() {
  call('adm_boot').then(function (r) {
    S.user = r.user; S.menu = r.menu; S.banks = r.banks; S.techniques = r.techniques || []; S.appUrl = r.appUrl;
    var h = location.hash.replace('#/', '');
    S.route = h || 'dashboard';
    shell();
  }).catch(function (e) {
    var msg = (e && e.message) || String(e);
    /* اگر توکن ذخیره‌شدهٔ پنل منقضی شده ولی نشست اپ شاگردان معتبر است،
       بدون درخواست رمز دوباره با همان نشست وارد می‌شویم. */
    var alt = load('fc_session');
    if (/جلسه|منقضی|session|token/i.test(msg) && alt && alt !== S.token) {
      store('adm_token', null); S.token = alt; boot(); return;
    }
    if (/دسترسی|ادمین/.test(msg)) { store('adm_token', null); S.token = ''; loginView('این حساب دسترسی مدیریت ندارد؛ با نام کاربری ادمین/مربی وارد شوید.'); }
    else loginView(msg);
  });
}

/* ---------- پوسته: منوی گروهی با زیرمجموعه‌های بازشو ---------- */
function groupOf(route) { var g = route.split('.')[0]; return g === 'bank' ? 'banks' : g; }
function shell() {
  var cur = groupOf(S.route);
  var nav = S.menu.map(function (m) {
    if (!m.sub) return '<div class="grp' + (S.route === m.id ? ' on' : '') + '"><button class="gh" data-go="' + m.id + '"><span class="ic">' + m.icon + '</span>' + esc(m.title) + '</button></div>';
    var open = S.open[m.id] !== undefined ? S.open[m.id] : (m.id === cur);
    return '<div class="grp' + (open ? ' open' : '') + (m.id === cur ? ' on' : '') + '"><button class="gh" data-tg="' + m.id + '"><span class="ic">' + m.icon + '</span>' + esc(m.title) + '<span class="ar">◀</span></button>' +
      '<div class="sub">' + m.sub.map(function (s) { return '<a data-go="' + s.id + '" class="' + (S.route === s.id ? 'on' : '') + '">' + esc(s.title) + '</a>'; }).join('') + '</div></div>';
  }).join('');
  $('root').innerHTML = '<button class="nav-shade" id="navShade" aria-label="بستن منو"></button><div class="app"><aside class="side" id="side"><div class="brand"><span class="brand-mark">SF</span><div><b>SAEEDI FIT</b><small>مربی و مدیریت · ' + esc(S.user.username) + ' (' + (S.user.role === 'admin' ? 'ادمین' : 'مربی') + ')</small></div></div>' +
    '<nav class="nav">' + nav + '</nav><div class="sfoot"><button class="btn sec sm" id="thm">تغییر پوسته</button><a class="btn sec sm" href="' + esc(S.appUrl) + '" target="_blank">برنامه‌ساز (اپ)</a><a class="btn sec sm" href="#/plans.workout">ورود برنامه از فایل</a><button class="btn sec sm" id="out">خروج</button></div></aside>' +
    '<section class="main"><div class="top"><button class="btn sec burger" id="bg">☰</button><h1 id="ttl"></h1><div id="acts"></div></div><div id="view"></div></section></div>';
  document.querySelectorAll('[data-tg]').forEach(function (b) { b.onclick = function () { var id = b.getAttribute('data-tg'); var g = b.parentNode; var o = !g.classList.contains('open'); g.classList.toggle('open', o); S.open[id] = o; }; });
  var closeNav = function(){ $('side').classList.remove('show'); $('navShade').classList.remove('on'); };
  document.querySelectorAll('[data-go]').forEach(function (b) { b.onclick = function () { go(b.getAttribute('data-go')); closeNav(); }; });
  $('out').onclick = function () { logout(); };
  $('bg').onclick = function () { var show = !$('side').classList.contains('show'); $('side').classList.toggle('show', show); $('navShade').classList.toggle('on', show); };
  $('navShade').onclick = closeNav;
  $('thm').onclick = function () { var d = document.documentElement; var cur = d.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'); var n = cur === 'dark' ? 'light' : 'dark'; d.setAttribute('data-theme', n); store('adm_theme', n); };
  var t = load('adm_theme'); document.documentElement.setAttribute('data-theme', t || 'dark');
  render();
}
function go(route) { S.route = route; location.hash = '#/' + route; S.open[groupOf(route)] = true; shell(); }
function titleOf(route) {
  if (route === 'plans.edit') return 'برنامه‌ها ‹ ویرایش ست و تکرار';
  var t = '';
  S.menu.forEach(function (m) { if (m.id === route) t = m.title; (m.sub || []).forEach(function (s) { if (s.id === route) t = m.title + ' ‹ ' + s.title; }); });
  return t || 'پنل مدیریت';
}
function setActs(h) { $('acts').innerHTML = h || ''; }
function view(h) { $('view').innerHTML = h; }
function loading() { view('<div class="empty">در حال بارگذاری…</div>'); }

var R = {};
function render() {
  $('ttl').textContent = titleOf(S.route); setActs('');
  var r = S.route;
  var f = r.indexOf('bank.') === 0 && S.banks[r.slice(5)] ? R.bank : R[r];
  if (!f) { view('<div class="empty">این صفحه پیدا نشد.</div>'); return; }
  loading();
  try { f(r.slice(5)); } catch (e) { fail(e); }
}

/* ---------- داشبورد ---------- */
R.dashboard = function () {
  call('adm_dashboard').then(function (d) {
    var banks = Object.keys(d.banks).map(function (k) { var b = d.banks[k]; return '<div class="card kpi"><small>' + esc(b.title) + '</small><b>' + fa(b.total) + '</b><small>نیازمند تصویر معتبر: ' + fa(b.noImage) + '</small></div>'; }).join('');
    var u = d.users, isAdmin = d.role === 'admin';
    view('<div class="hero-band"><p class="hb-sec">SAEEDI FIT · مرکز مدیریت</p><h2>سلام ' + esc(S.user.username) + '، وضعیت مجموعه اینجاست</h2><p>کارهای روزمره، شاگردها، اشتراک‌ها و سلامت محتوا را از یک نمای یکپارچه مدیریت کن.</p><div class="bar">' + (isAdmin ? '<button class="btn" data-go="plans.create">＋ ساخت برنامهٔ تمرینی</button><button class="btn sec" data-go="plans.diet">برنامهٔ تغذیه</button><button class="btn sec" data-go="users.list">مدیریت شاگردها</button>' : '<button class="btn sec" data-go="users.activity">پیگیری تمرین شاگردها</button><button class="btn sec" data-go="comms.chat">گفت‌وگو با شاگردها</button>') + '</div></div>' +
      '<div class="dash-grid"><div class="card dash-card"><div class="dk">شاگردها</div><div class="dv">' + fa(u.user) + '</div><div class="ds">از ' + fa(u.total) + ' حساب ثبت‌شده در پنل</div></div>' +
      '<div class="card dash-card"><div class="dk">در انتظار بررسی مالی</div><div class="dv">' + fa(d.pending) + '</div><div class="ds"><a data-go="finance.membership">رفتن به اعتبار و اشتراک ←</a></div></div>' +
      '<div class="card dash-card"><div class="dk">هشدارهای مربی</div><div class="dv">' + fa(d.alerts) + '</div><div class="ds"><a data-go="comms.alerts">بررسی و پیگیری ←</a></div></div>' +
      '<div class="card dash-card"><div class="dk">سلامت ربات تلگرام</div><div class="dv" style="font-size:20px">' + (d.telegram && d.telegram.configured ? '<span class="pill ok">توکن متصل</span>' : '<span class="pill bad">نیازمند تنظیم</span>') + '</div><div class="ds">چت ادمین: ' + (d.telegram && d.telegram.adminChat ? '<span class="pill ok">آماده</span>' : '<span class="pill warn">بررسی شود</span>') + '</div></div></div>' +
      '<div class="card"><div class="bar" style="justify-content:space-between"><div><h3 style="margin:0">تمرین امروز</h3><small class="sub">بر اساس ثبت پایان تمرین و ثبت ست‌ها در ' + esc(d.activity && d.activity.date || '') + '</small></div><button class="btn sec sm" data-go="users.activity">فهرست کامل و پیگیری</button></div><div class="grid g4"><div class="card kpi"><small>شاگردها</small><b>' + fa(d.activity && d.activity.total || 0) + '</b></div><div class="card kpi"><small>تمرین ثبت‌شده</small><b>' + fa(d.activity && d.activity.completed || 0) + '</b></div><div class="card kpi"><small>بدون ثبت امروز</small><b>' + fa(d.activity && d.activity.noLog || 0) + '</b></div><div class="card kpi"><small>گفت‌وگوهای شاگردها</small><b><a data-go="comms.chat">بازکردن صندوق پیام ←</a></b></div></div>' + activityDoneHtml((d.activity && d.activity.rows) || []) + activityReminderHtml((d.activity && d.activity.rows) || [], true) + (d.activity && d.activity.error ? '<div class="note">آمار حضور خوانده نشد: ' + esc(d.activity.error) + '</div>' : '') + '</div>' +
      '<div class="dash-split"><div><h3>کتابخانهٔ محتوا</h3><div class="grid g2">' + banks + '</div></div><div><div class="card"><h3>دسترسی سریع</h3><div class="dash-quick">' + (isAdmin ? '<button class="btn sec" data-go="plans.create">برنامه‌ساز دستی</button><button class="btn sec" data-go="plans.generate">ساخت هوشمند تمرین</button><button class="btn sec" data-go="plans.diet">ساخت هوشمند تغذیه</button>' : '') + '<button class="btn sec" data-go="smart.coach">مربی هوشمند</button><button class="btn sec" data-go="comms.chat">گفت‌وگو با شاگردها</button>' + (isAdmin ? '<button class="btn sec" data-go="plans.anatomy">آناتومی شاگرد</button>' : '') + '</div></div><div class="card"><h3>سلامت و کیفیت داده</h3>' +
      Object.keys(d.banks).map(function(k){var b=d.banks[k], pct=b.total?Math.round((b.total-b.noImage)*100/b.total):100;return '<div class="health-row"><span>'+esc(b.title)+'</span><span class="pill '+(b.noImage?'warn':'ok')+'">'+fa(pct)+'٪ دارای تصویر</span></div>';}).join('') +
      (isAdmin ? '<div class="health-row"><span>خطاهای ثبت‌شده</span><span class="pill '+(d.errors?'warn':'ok')+'">'+fa(d.errors||0)+' مورد</span></div><div class="bar" style="margin:12px 0 0"><button class="btn sec sm" data-go="system.errors">مرکز خطاها</button><button class="btn sec sm" data-go="comms.telegram">سلامت تلگرام</button></div>' : '') + '</div></div></div>');
    var eb = $('errTest');
    if (eb) eb.onclick = function () {
      eb.disabled = true;
      call('sfAdminErrorTest').then(function (r) {
        eb.disabled = false;
        toast('گزارش آزمایشی به ' + fa(r.sent) + ' چت ادمین ارسال شد' + (r.sent ? '' : ' — چت ادمین تنظیم نشده'));
      }).catch(function (e) { eb.disabled = false; fail(e); });
    };
    document.querySelectorAll('#view [data-go]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); go(a.getAttribute('data-go')); }; });
    bindActivityReminder();
  }).catch(fail);
};

function activityReminderHtml(rows, compact) {
  rows = rows || [];
  var list = rows.filter(function (x) { return !x.completed; }).slice(0, compact ? 8 : rows.length);
  return '<h4>بدون ثبت امروز</h4><div class="activity-list">' + (list.length ? list.map(function (r) { return '<label class="activity-item"><input type="checkbox" data-rem-user="' + esc(r.username) + '"' + (r.telegram ? '' : ' disabled') + '><span class="ltr"><b>' + esc(r.username) + '</b></span><span class="pill warn">ثبت تمرین ندارد</span><small>' + (r.telegram ? 'تلگرام آماده' : 'تلگرام وصل نیست') + '</small><small>آخرین تمرین ثبت‌شده: ' + esc(r.lastActive || 'ندارد') + '</small></label>'; }).join('') : '<div class="note ok">همهٔ شاگردها تمرین امروز را ثبت کرده‌اند.</div>') + '</div>' +
    (list.length ? '<div class="bar"><button class="btn sec sm" type="button" data-rem-all>انتخاب همهٔ قابل ارسال</button><button class="btn sm" type="button" data-rem-send>ارسال یادآوری تلگرام</button><span class="sub">فقط موارد انتخاب‌شده پیام می‌گیرند.</span></div><div data-rem-result></div>' : '');
}
function activityDoneHtml(rows) {
  var done = (rows || []).filter(function (x) { return x.completed; });
  return '<details class="done-list"><summary>تمرین ثبت‌شده امروز · ' + fa(done.length) + '</summary><div class="muscle-tags">' + (done.map(function (x) { return '<span class="pill ok ltr">' + esc(x.username) + '</span>'; }).join('') || '<span class="sub">هنوز موردی ثبت نشده</span>') + '</div></details>';
}
function bindActivityReminder() {
  document.querySelectorAll('[data-rem-all]').forEach(function (b) { b.onclick = function () { document.querySelectorAll('[data-rem-user]:not(:disabled)').forEach(function (c) { c.checked = true; }); }; });
  document.querySelectorAll('[data-rem-send]').forEach(function (b) { b.onclick = function () {
    var names = Array.prototype.map.call(document.querySelectorAll('[data-rem-user]:checked'), function (c) { return c.getAttribute('data-rem-user'); });
    if (!names.length) { toast('اول شاگردهای موردنظر را انتخاب کن.', true); return; }
    b.disabled = true; var out = b.parentNode.parentNode.querySelector('[data-rem-result]'); if (out) out.textContent = 'در حال ارسال…';
    call('adm_sendActivityReminder', names).then(function (r) { if (out) out.innerHTML = '<div class="note">ارسال‌شده: ' + fa(r.sent) + ' · ناموفق: ' + fa(r.failed) + '</div>'; toast('یادآوری‌ها ارسال شد: ' + fa(r.sent)); }).catch(function (e) { if (out) out.innerHTML = '<div class="note">' + esc(e.message) + '</div>'; fail(e); }).then(function () { b.disabled = false; });
  }; });
}

R['users.activity'] = function () {
  var day = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  view('<div class="hero-band"><p class="hb-sec">شاگردها · پیگیری روزانه</p><h2>چه کسی تمرینش را ثبت کرده؟</h2><p>وضعیت از پایان تمرین و ست‌های ثبت‌شده می‌آید؛ ثبت صرف آب یا غذا به‌عنوان تمرین حساب نمی‌شود.</p><div class="bar"><input id="act_day" type="date" value="' + day + '"><button class="btn sec" id="act_reload">به‌روزرسانی</button></div></div><div id="act_data" class="card">در حال خواندن تمرین‌های امروز…</div>');
  var load = function () { call('adm_activityBoard', $('act_day').value).then(function (r) {
    var rows = r.rows || [], done = rows.filter(function (x) { return x.completed; }).length, no = rows.length - done;
    $('act_data').innerHTML = '<div class="grid g4"><div class="card kpi"><small>کل شاگردها</small><b>' + fa(rows.length) + '</b></div><div class="card kpi"><small>تمرین ثبت‌شده</small><b>' + fa(done) + '</b></div><div class="card kpi"><small>بدون ثبت</small><b>' + fa(no) + '</b></div><div class="card kpi"><small>تلگرام متصل</small><b>' + fa(rows.filter(function (x) { return x.telegram; }).length) + '</b></div></div>' + activityDoneHtml(rows) + activityReminderHtml(rows, false);
    bindActivityReminder();
  }).catch(function (e) { $('act_data').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; }); };
  $('act_reload').onclick = load; load();
};

/* ---------- کاربران ---------- */
R['users.list'] = function () {
  call('adm_usersList').then(function (r) {
    var rows = r.users, q = '', role = '';
    var draw = function () {
      var list = rows.filter(function (u) { return (!role || u.role === role) && (!q || u.username.toLowerCase().indexOf(q) >= 0); });
      $('ul').innerHTML = list.map(function (u) {
        return '<tr><td class="ltr"><b>' + esc(u.username) + '</b></td><td><span class="pill">' + ({ admin: 'ادمین', coach: 'مربی', user: 'شاگرد' }[u.role] || u.role) + '</span></td><td>' + esc([u.workout, u.diet, u.supp].filter(Boolean).join(' · ')) + '</td><td class="ltr">' + esc(u.coach) + '</td><td><button class="btn sec sm" data-e="' + esc(u.username) + '">ویرایش</button></td></tr>';
      }).join('') || '<tr><td colspan="5" class="empty">کاربری پیدا نشد.</td></tr>';
      document.querySelectorAll('[data-e]').forEach(function (b) { b.onclick = function () { userDlg(rows.filter(function (x) { return x.username === b.getAttribute('data-e'); })[0], r.sheetNames); }; });
    };
    view('<div class="card"><div class="bar"><input class="q" id="uq" placeholder="جستجوی نام کاربری…"><select id="ur"><option value="">همهٔ نقش‌ها</option><option value="user">شاگرد</option><option value="coach">مربی</option><option value="admin">ادمین</option></select><span class="pill">' + fa(rows.length) + ' کاربر</span></div>' +
      '<div class="wrap"><table><thead><tr><th>نام کاربری</th><th>نقش</th><th>برنامه‌های اختصاصی‌شده (قدیمی/شیتی)</th><th>مربی</th><th></th></tr></thead><tbody id="ul"></tbody></table></div></div>');
    $('uq').oninput = function () { q = this.value.toLowerCase(); draw(); }; $('ur').onchange = function () { role = this.value; draw(); };
    draw();
  }).catch(fail);
};
function userDlg(u, sheets) {
  var dl = '<datalist id="sl">' + sheets.map(function (s) { return '<option value="' + esc(s) + '">'; }).join('') + '</datalist>';
  modal('<h3 class="ltr">' + esc(u.username) + '</h3>' + dl + '<div class="fg"><div><label>نقش</label><select id="f_role"><option value="user">شاگرد</option><option value="coach">مربی</option><option value="admin">ادمین</option></select></div>' +
    '<div><label>شناسهٔ تلگرام (Chat ID)</label><input id="f_tg" class="ltr" value="' + esc(u.telegram) + '"></div><div><label>مربی این شاگرد</label><input id="f_co" class="ltr" value="' + esc(u.coach) + '"></div>' +
    '<div class="full"><label>برنامه‌های تمرینی شیتی (با | جدا کنید)</label><input id="f_w" list="sl" value="' + esc(u.workout) + '"></div>' +
    '<div class="full"><label>برنامه‌های غذایی شیتی</label><input id="f_d" list="sl" value="' + esc(u.diet) + '"></div>' +
    '<div class="full"><label>برنامه‌های مکمل شیتی</label><input id="f_s" list="sl" value="' + esc(u.supp) + '"></div></div>' +
    '<div class="bar" style="margin-top:14px"><button class="btn" id="sv">ذخیره</button><button class="btn sec" id="pw">تغییر رمز</button><button class="btn bad" id="dx">حذف کاربر</button></div>');
  $('f_role').value = u.role;
  $('sv').onclick = function () {
    call('adm_userSave', { username: u.username, role: $('f_role').value, telegram: $('f_tg').value, coach: $('f_co').value, workout: $('f_w').value, diet: $('f_d').value, supp: $('f_s').value })
      .then(function () { toast('ذخیره شد ✅'); closeModal(); render(); }).catch(fail);
  };
  $('pw').onclick = function () { var p = prompt('رمز جدید (حداقل 6 کاراکتر):'); if (!p) return; call('adminResetPassword', u.username, p).then(function () { toast('رمز تغییر کرد.'); }).catch(fail); };
  $('dx').onclick = function () { if (!confirm('کاربر «' + u.username + '» حذف شود؟')) return; call('adminDeleteUser', u.username).then(function () { toast('حذف شد.'); closeModal(); render(); }).catch(fail); };
}
R['users.create'] = function () {
  view('<div class="card" style="max-width:480px"><div class="fg"><div class="full"><label>نام کاربری</label><input id="c_u" class="ltr"></div><div class="full"><label>رمز عبور (حداقل 6 کاراکتر)</label><input id="c_p" class="ltr" type="password"></div>' +
    '<div class="full"><label>نقش</label><select id="c_r"><option value="user">شاگرد</option><option value="coach">مربی</option><option value="admin">ادمین</option></select></div></div>' +
    '<p><button class="btn" id="c_b">ساخت کاربر</button></p></div>');
  $('c_b').onclick = function () { call('adminCreateUser', { username: $('c_u').value, password: $('c_p').value, role: $('c_r').value }).then(function () { toast('کاربر ساخته شد ✅'); go('users.list'); }).catch(fail); };
};

/* ---------- برنامه‌ها ---------- */
function plansTable(rows, cols, acts) {
  if (!rows.length) return '<div class="empty">موردی وجود ندارد.</div>';
  return '<div class="wrap"><table><thead><tr>' + cols.map(function (c) { return '<th>' + c[0] + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
    rows.map(function (r, i) { return '<tr>' + cols.map(function (c) { return '<td>' + c[1](r) + '</td>'; }).join('') + '<td><div class="bar" style="margin:0">' + acts(r, i) + '</div></td></tr>'; }).join('') + '</tbody></table></div>';
}
var pill = function (on) { return on ? '<span class="pill ok">فعال</span>' : '<span class="pill">غیرفعال</span>'; };
function builderNote() { return '<div class="note">همهٔ کارها همین‌جاست: «برنامه‌ساز» برای ساخت برنامهٔ تازه، «ویرایش ست و تکرار» برای تغییر روش تمرینی/ست/تکرار، «تولید هوشمند» برای ساخت خودکار بر اساس هدف شاگرد، و «بانک برنامه‌ها» برای نگه‌داشتن قالب‌ها.</div>'; }
/* ورود برنامه از قالب مشخص (همان قالب ضمیمه‌ی مربی) — تحلیل، پیش‌نویس،
   نشان‌دادن موارد نیازمند اصلاح با رنگ قرمز و ثبت در بانک/برنامه */
function importCard() {
  return '<div class="card"><h3>ورود برنامه از قالب (CSV / متن)</h3>' +
    '<p class="note">فایل قالب را انتخاب کن (ستون‌ها: ردیف | نام حرکت | نحوه اجرا | تعداد ست | تکرارها | توضیحات؛ سر هر جلسه یک خط «جلسه…:»). بعد از «تحلیل»، برنامه به‌صورت پیش‌نویس نشان داده می‌شود؛ ردیف‌های قرمز یعنی حرکت در بانک پیدا نشده — نام درست را همان‌جا بنویس و «تحلیل دوباره» بزن. ست، تکرارها، روش تمرینی و استراحت هر بلوک هم بالای همان بلوک قابل ویرایش است و با «ثبت برنامه» ذخیره می‌شود.</p>' +
    '<div class="bar"><input type="file" id="impFile" accept=".csv,.tsv,.txt"></div>' +
    '<textarea id="impText" rows="3" placeholder="یا متن قالب را دستی اینجا بچسبان…"></textarea>' +
    '<div class="bar"><input id="impName" placeholder="نام برنامه (اختیاری)"><select id="impUser"><option value="">شاگرد مقصد…</option></select>' +
    '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="impBank" checked style="width:auto"> ذخیره در بانک برنامه‌ها</label>' +
    '<button class="btn" id="impGo">تحلیل و پیش‌نویس</button><button class="btn sec" id="impSave" disabled>ثبت برنامه</button></div>' +
    '<div id="impOut"></div></div>';
}
function wireImport() {
  if (!$('impFile')) return;
  var ov = {};                 /* "ردیف:شماره‌حرکت" → نام اصلاح‌شده */
  var blkOv = {};              /* "روز:ردیف" → {technique, sets, reps, rest} */
  var techOpts = function (cur) {
    return (S.techniques || []).map(function (t) { return '<option value="' + esc(t.key) + '"' + (t.key === cur ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join('');
  };
  call('adm_usersList').then(function (r) { var s = $('impUser'); if (!s) return; r.users.filter(function (u) { return u.role === 'user'; }).forEach(function (u) { var o = document.createElement('option'); o.value = u.username; o.textContent = u.username; s.appendChild(o); }); }).catch(function () {});
  $('impFile').onchange = function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { $('impText').value = rd.result; }; rd.readAsText(f, 'utf-8'); };

  var collect = function () {
    var seen = {};
    document.querySelectorAll('#impOut [data-ov]').forEach(function (inp) {
      var k = inp.getAttribute('data-ov'), v = (inp.value || '').trim();
      seen[k] = 1;
      if (v && v !== inp.getAttribute('data-orig')) ov[k] = v; else delete ov[k];
    });
    Object.keys(ov).forEach(function (k) { if (!seen[k]) delete ov[k]; });
    /* ست، تکرار، روش تمرینی و استراحت هر بلوک */
    blkOv = {};
    document.querySelectorAll('#impOut [data-blk]').forEach(function (el) {
      var k = el.getAttribute('data-blk'), f = el.getAttribute('data-bf');
      if (!k) return;
      blkOv[k] = blkOv[k] || {};
      var bv = (el.value || '').trim();
      if (bv !== '' || f === 'technique' || f === 'sets') blkOv[k][f] = bv;
    });
    return ov;
  };

  var show = function (p) {
    /* The user may switch routes while the parser RPC is still running. */
    if (!$('impOut')) return;
    var sx = p.stats || {}, bad = 0;
    var h = '<div class="grid g4"><div class="card kpi"><small>روز</small><b>' + fa(sx.days || 0) + '</b></div>' +
      '<div class="card kpi"><small>بلوک</small><b>' + fa(sx.blocks || 0) + '</b></div>' +
      '<div class="card kpi"><small>حرکت</small><b>' + fa(sx.exercises || 0) + '</b></div>' +
      '<div class="card kpi"><small>تطبیق با بانک</small><b>' + fa(sx.matched || 0) + '</b><small>گیف جدید: ' + fa(sx.withNewGif || 0) + ' · هر گیف: ' + fa(sx.withMedia || 0) + '</small></div></div>';
    h += '<div class="wrap draft"><table><thead><tr><th>ردیف</th><th>نام حرکت (قابل اصلاح)</th><th>تطبیق بانک</th><th>گیف</th></tr></thead><tbody>';
    (p.days || []).forEach(function (d) {
      h += '<tr class="dh"><td colspan="4"><b>' + esc(d.title) + '</b></td></tr>';
      (d.blocks || []).forEach(function (b) {
        var bk = b.blockKey || ((d.dayNo || '') + ':' + (b.sourceRow || ''));
        h += '<tr class="bh"><td colspan="4"><div class="blk">' +
          '<select data-blk="' + esc(bk) + '" data-bf="technique" title="روش تمرینی">' + techOpts(b.technique) + '</select>' +
          '<label>ست <input type="number" min="1" max="20" data-blk="' + esc(bk) + '" data-bf="sets" value="' + esc(b.sets || 1) + '"></label>' +
          '<label>تکرار <input data-blk="' + esc(bk) + '" data-bf="reps" value="' + esc(b.reps || '') + '" title="مثل 8-12 یا 12-10-8-6"></label>' +
          '<label>استراحت <input type="number" min="0" max="600" data-blk="' + esc(bk) + '" data-bf="rest" value="' + esc(b.rest == null ? '' : b.rest) + '" title="ثانیه"></label>' +
          '</div></td></tr>';
        (b.items || []).forEach(function (it, i) {
          var isBad = !it.matched; if (isBad) bad++;
          var k = (it.row == null ? '' : it.row) + ':' + (it.idx == null ? i : it.idx);
          h += '<tr class="' + (isBad ? 'bad' : '') + '"><td>' + (it.row == null ? '' : fa(it.row)) + '</td>' +
            '<td><input data-ov="' + esc(k) + '" data-orig="' + esc(it.name) + '" value="' + esc(it.name) + '"></td>' +
            '<td>' + (it.matched ? '<span class="pill ok">' + esc(it.fa || it.exerciseId) + '</span>' : '<span class="pill bad">در بانک نیست</span>') + '</td>' +
            '<td>' + (it.gifNew ? '<span class="pill ok">گیف جدید</span>' : (it.gif ? '<span class="pill warn">گیف قدیمی</span>' : '<span class="pill bad">بدون گیف</span>')) + '</td></tr>';
        });
      });
    });
    h += '</tbody></table></div>';
    h += bad
      ? '<div class="note"><b>' + fa(bad) + ' حرکت قرمز است</b> (در بانک پیدا نشد). نام درست را در همان ردیف بنویس و «تحلیل دوباره» را بزن؛ اگر با «ثبت برنامه» ادامه بدهی، همین نام‌ها به‌عنوان حرکت تازه در بانک ساخته می‌شوند.</div>'
      : '<div class="note">همهٔ حرکات در بانک پیدا شدند ✅</div>';
    h += '<div class="bar"><button class="btn sec" id="impRe">تحلیل دوباره با نام‌های اصلاح‌شده</button></div>';
    $('impOut').innerHTML = h;
    $('impSave').disabled = false;
    $('impRe').onclick = function () { collect(); analyze(); };
    document.querySelectorAll('#impOut [data-ov]').forEach(function (inp) {
      inp.onchange = function () { collect(); };
    });
  };

  var analyze = function () {
    if (!$('impText') || !$('impGo') || !$('impOut')) return;
    var t = $('impText').value.trim();
    if (!t) { toast('اول فایل انتخاب کن یا متن را بچسبان.', true); return; }
    $('impGo').disabled = true;
    $('impOut').innerHTML = '<div class="note">در حال تحلیل…</div>';
    call('sfAdminParseProgram', { text: t, planName: $('impName').value.trim(), overrides: ov, blockOverrides: blkOv })
      .then(function (r) { var b = $('impGo'); if (b) b.disabled = false; if ($('impOut')) show(r); })
      .catch(function (e) { var b = $('impGo'), out = $('impOut'); if (b) b.disabled = false; if (out) out.innerHTML = '<div class="note">' + esc(e.message) + '</div>'; });
  };

  $('impGo').onclick = function () { collect(); analyze(); };
  $('impSave').onclick = function () {
    var t = $('impText').value.trim(), u = $('impUser').value;
    if (!u) { toast('شاگرد مقصد را انتخاب کن.', true); return; }
    collect();
    this.disabled = true;
    call('sfAdminImportProgram', { text: t, planName: $('impName').value.trim(), username: u, overrides: ov, blockOverrides: blkOv, saveToBank: !!($('impBank') && $('impBank').checked) })
      .then(function (r) { toast('برنامه ثبت شد ✅ (' + fa((r.stats && r.stats.created) || 0) + ' حرکت جدید به بانک اضافه شد' + (r.savedToBank ? ' · در بانک برنامه‌ها هم ذخیره شد' : '') + ')'); render(); })
      .catch(function (e) { var b = $('impSave'), out = $('impOut'); if (b) b.disabled = false; toast(e.message, true); if (out) out.insertAdjacentHTML('afterbegin', '<div class="note">' + esc(e.message) + '</div>'); });
  };
}
R['plans.workout'] = function () {
  call('sf3AdminAllPlans').then(function (rows) {
    rows = rows.filter(function (p) { return p.username !== '__LIB__'; });
    var admin = S.user.role === 'admin';
    view(plansToolbar() + importCard() + builderNote() + '<div class="card"><h3>برنامه‌های ثبت‌شده</h3>' + plansTable(rows, [['برنامه', function (p) { return '<b>' + esc(p.planName) + '</b>'; }], ['شاگرد', function (p) { return '<span class="ltr">' + esc(p.username) + '</span>'; }], ['روز / بلوک', function (p) { return fa(p.days) + ' / ' + fa(p.blocks); }], ['وضعیت', function (p) { return pill(p.active); }]],
      function (p) {
        return (admin ? '<button class="btn sm" data-ed="' + esc(p.planId) + '">ویرایش ست و تکرار</button>' : '') +
          '<button class="btn sec sm" data-rn="' + esc(p.planId) + '" data-nm="' + esc(p.planName) + '">تغییر نام</button>' +
          '<button class="btn sec sm" data-an="' + esc(p.planId) + '">تحلیل</button>' +
          (admin ? '<button class="btn sec sm" data-b="' + esc(p.planId) + '">ذخیره در بانک</button>' : '') +
          '<button class="btn sec sm" data-t="' + esc(p.planId) + '" data-on="' + (p.active ? 0 : 1) + '">' + (p.active ? 'غیرفعال' : 'فعال') + '</button>' +
          '<button class="btn sec sm" data-c="' + esc(p.planId) + '">کپی برای شاگرد</button>' +
          '<button class="btn bad sm" data-d="' + esc(p.planId) + '">حذف</button>';
      }) + '</div>');
    wireImport();
    document.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { call('sfAdminSetPlanActive', b.getAttribute('data-t'), b.getAttribute('data-on') === '1').then(function () { render(); }).catch(fail); }; });
    document.querySelectorAll('[data-c]').forEach(function (b) { b.onclick = function () { var u = prompt('نام کاربری شاگرد مقصد:'); if (!u) return; call('sfAdminDuplicatePlan', b.getAttribute('data-c'), u.trim(), '').then(function () { toast('کپی شد ✅'); render(); }).catch(fail); }; });
    document.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { if (!confirm('برنامه و همهٔ ست‌هایش حذف شود؟ برگشت‌پذیر نیست.')) return; call('sfAdminDeletePlan', b.getAttribute('data-d')).then(function () { render(); }).catch(fail); }; });
    document.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { S.editPlan = b.getAttribute('data-ed'); go('plans.edit'); }; });
    document.querySelectorAll('[data-rn]').forEach(function (b) {
      b.onclick = function () {
        var cur = b.getAttribute('data-nm') || '';
        var nn = prompt('نام تازهٔ برنامه:', cur);
        if (nn == null) return;
        nn = nn.trim();
        if (!nn || nn === cur) return;
        call('sfAdminRenamePlan', b.getAttribute('data-rn'), nn).then(function () { toast('نام برنامه تغییر کرد'); render(); }).catch(fail);
      };
    });
    document.querySelectorAll('[data-an]').forEach(function (b) { b.onclick = function () { S.analysisPlan = b.getAttribute('data-an'); go('plans.analysis'); }; });
    document.querySelectorAll('[data-b]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-b'), row = rows.filter(function (x) { return x.planId === id; })[0] || {};
        var nm = prompt('نام در بانک برنامه‌ها:', row.planName || '');
        if (nm === null) return;
        b.disabled = true;
        call('sfPsPlanToBank', id, nm.trim()).then(function (r) { toast('در بانک برنامه‌ها ذخیره شد ✅ (' + r.name + ')'); b.disabled = false; }).catch(function (e) { b.disabled = false; fail(e); });
      };
    });
  }).catch(fail);
};
function simplePlans(listFn, setFn, delFn, cols) {
  call(listFn, '').then(function (rows) {
    view(builderNote() + '<div class="card">' + plansTable(rows, cols, function (p) { return '<button class="btn sec sm" data-t="' + esc(p.username + '||' + p.planName) + '" data-on="' + (p.active ? 0 : 1) + '">' + (p.active ? 'غیرفعال' : 'فعال') + '</button><button class="btn bad sm" data-d="' + esc(p.username + '||' + p.planName) + '">حذف</button>'; }) + '</div>');
    document.querySelectorAll('[data-t]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-t').split('||'); call(setFn, k[0], k[1], b.getAttribute('data-on') === '1').then(function () { render(); }).catch(fail); }; });
    document.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { if (!confirm('این برنامه حذف شود؟')) return; var k = b.getAttribute('data-d').split('||'); call(delFn, k[0], k[1]).then(function () { render(); }).catch(fail); }; });
  }).catch(fail);
}
R['plans.diet'] = function () { simplePlans('sfAdminListDiets', 'sfAdminSetDietActive', 'sfAdminDeleteDiet', [['برنامه', function (p) { return '<b>' + esc(p.planName) + '</b>'; }], ['شاگرد', function (p) { return '<span class="ltr">' + esc(p.username) + '</span>'; }], ['وعده / ردیف', function (p) { return fa(p.sections) + ' / ' + fa(p.rows); }], ['کالری کل', function (p) { return fa(p.kcal); }], ['وضعیت', function (p) { return pill(p.active); }]]); };
R['plans.supp'] = function () { simplePlans('sfAdminListSupps', 'sfAdminSetSuppActive', 'sfAdminDeleteSupp', [['برنامه', function (p) { return '<b>' + esc(p.planName) + '</b>'; }], ['شاگرد', function (p) { return '<span class="ltr">' + esc(p.username) + '</span>'; }], ['آیتم', function (p) { return fa(p.items); }], ['وضعیت', function (p) { return pill(p.active); }]]); };
R['plans.library'] = function () {
  call('sf7LibList').then(function (r) {
    var kind = { workout: 'تمرینی', diet: 'غذایی', supp: 'مکمل' };
    view(builderNote() + '<div class="card">' + plansTable(r.items, [['قالب', function (p) { return '<b>' + esc(p.name) + '</b>'; }], ['نوع', function (p) { return kind[p.kind] || p.kind; }], ['تعداد', function (p) { return fa(p.count); }], ['آخرین تغییر', function (p) { return esc(String(p.updatedAt).slice(0, 10)); }]],
      function (p) { return '<button class="btn sec sm" data-a="' + esc(p.kind + '||' + p.name) + '">اختصاص به شاگرد</button><button class="btn bad sm" data-d="' + esc(p.kind + '||' + p.name) + '">حذف</button>'; }) + '</div>');
    document.querySelectorAll('[data-a]').forEach(function (b) { b.onclick = function () { var k = b.getAttribute('data-a').split('||'); var u = prompt('نام کاربری شاگرد:'); if (!u) return; call('sf7LibAssign', k[0], k[1], u.trim(), '').then(function () { toast('اختصاص داده شد ✅'); }).catch(fail); }; });
    document.querySelectorAll('[data-d]').forEach(function (b) { b.onclick = function () { if (!confirm('قالب حذف شود؟')) return; var k = b.getAttribute('data-d').split('||'); call('sf7LibDelete', k[0], k[1]).then(function () { render(); }).catch(fail); }; });
  }).catch(fail);
};

/* ---------- پنل برنامه‌ها: تحلیل، تولید هوشمند، ویرایش، بانک ---------- */
function anaHtml(a) {
  var sx = a.summary || {}, g = sx.groups || {}, gifs = sx.gifs || {};
  var order = Object.keys(g).sort(function (x, y) { return g[y].sets - g[x].sets; });
  var max = 1; order.forEach(function (k) { max = Math.max(max, g[k].sets); });
  var h = '<div class="grid g4">' +
    '<div class="card kpi"><small>روز</small><b>' + fa(sx.days) + '</b></div>' +
    '<div class="card kpi"><small>بلوک</small><b>' + fa(sx.blocks) + '</b></div>' +
    '<div class="card kpi"><small>حرکت</small><b>' + fa(sx.exercises) + '</b><small>کل ست: ' + fa(sx.sets) + '</small></div>' +
    '<div class="card kpi"><small>نمرهٔ تعادل</small><b>' + fa(a.score) + '</b><small>از 100</small></div></div>' +
    '<div class="anal"><h3>حجم هر گروه در یک دوره (ست)</h3><div class="bars">' +
    (order.length ? order.map(function (k) {
      return '<div class="baru"><span>' + esc(k) + '</span><i style="width:' + Math.round(g[k].sets / max * 100) + '%"></i><b>' + fa(g[k].sets) + '</b></div>';
    }).join('') : '<div class="empty">ستی ثبت نشده.</div>') + '</div></div>' +
    '<div class="grid g4">' +
    '<div class="card kpi"><small>گیف جدید</small><b>' + fa(gifs.NEW) + '</b></div>' +
    '<div class="card kpi"><small>فقط گیف قدیمی</small><b>' + fa(gifs.OLD) + '</b></div>' +
    '<div class="card kpi"><small>بدون گیف</small><b>' + fa(gifs.NONE) + '</b></div>' +
    '<div class="card kpi"><small>ست هوازی</small><b>' + fa(sx.cardioSets) + '</b><small>سنگین‌ترین روز: ' + fa(sx.maxDaySets) + ' ست</small></div></div>';
  if ((a.warnings || []).length) h += '<div class="card"><h3>موارد نیازمند اصلاح</h3><ul>' + a.warnings.map(function (w) { return '<li style="color:var(--bad)">' + esc(w) + '</li>'; }).join('') + '</ul></div>';
  if ((a.tips || []).length) h += '<div class="card"><h3>پیشنهاد مربی</h3><ul>' + a.tips.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
  if (!(a.warnings || []).length && !(a.tips || []).length) h += '<div class="note">برنامه متعادل است ✅</div>';
  return h;
}
R['plans.analysis'] = function () {
  call('sf3AdminAllPlans').then(function (rows) {
    var plans = rows.slice();
    if (!plans.length) { view('<div class="empty">هنوز برنامه‌ای ثبت نشده؛ اول از فایل یا با «تولید هوشمند» یک برنامه بساز.</div>'); return; }
    var pre = S.analysisPlan || '';
    if (pre && !plans.some(function (p) { return p.planId === pre; })) pre = '';
    view('<div class="card"><div class="bar"><select id="an_sel">' + plans.map(function (p) {
      return '<option value="' + esc(p.planId) + '"' + (p.planId === pre ? ' selected' : '') + '>' + esc(p.planName) + ' — ' + (p.username === '__LIB__' ? 'بانک برنامه‌ها' : esc(p.username)) + '</option>';
    }).join('') + '</select><button class="btn" id="an_go">تحلیل برنامه</button></div><div id="an_out"></div></div>');
    var run = function () {
      $('an_out').innerHTML = '<div class="note">در حال تحلیل…</div>';
      call('sfPsPlanAnalysis', $('an_sel').value).then(function (a) {
        S.analysisPlan = a.planId;
        $('an_out').innerHTML = '<h3 style="margin-top:14px">' + esc(a.planName) + ' <small class="ltr" style="color:var(--mute)">' + esc(a.username) + '</small></h3>' + anaHtml(a);
      }).catch(function (e) { $('an_out').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; });
    };
    $('an_go').onclick = run;
    run();
  }).catch(fail);
};
R['plans.generate'] = function () {
  call('adm_usersList').then(function (u) {
    var users = u.users.filter(function (x) { return x.role === 'user'; });
    if (!users.length) { view('<div class="empty">اول یک شاگرد بساز؛ برنامه به یک شاگرد ثبت می‌شود.</div>'); return; }
    var sel = function (id, items, def) {
      return '<select id="' + id + '">' + items.map(function (x) {
        var pair = Object.prototype.toString.call(x) === '[object Array]';
        var v = pair ? x[0] : x, t = pair ? (x[1] || x[0]) : x;
        return '<option value="' + esc(v) + '"' + (String(v) === String(def) ? ' selected' : '') + '>' + esc(t) + '</option>';
      }).join('') + '</select>';
    };
    view('<div class="card"><h3>تولید هوشمند برنامه بر اساس هدف</h3>' +
      '<p class="note">هدف، سطح، تعداد روز و وسایل را انتخاب کن؛ برنامه از بانک حرکات با حجم و تکرار متناسب همان هدف ساخته می‌شود، به شاگرد ثبت می‌شود و می‌توانی در همان لحظه در بانک برنامه‌ها هم ذخیره‌اش کنی. بعد از ساخت می‌توانی با «ویرایش ست و تکرار» دستی هم تغییرش بدهی.</p>' +
      '<div class="fg"><div><label>هدف</label>' + sel('g_goal', [['auto', 'خودکار از پروفایل شاگرد'], ['lose', 'کاهش چربی'], ['gain', 'افزایش حجم'], ['strength', 'افزایش قدرت'], ['tone', 'تناسب اندام']], 'auto') + '</div>' +
      '<div><label>سطح</label>' + sel('g_level', [['مبتدی', 'مبتدی'], ['متوسط', 'متوسط'], ['پیشرفته', 'پیشرفته']], 'متوسط') + '</div>' +
      '<div><label>روز در هفته</label>' + sel('g_days', [['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6']], '3') + '</div>' +
      '<div><label>وسایل</label>' + sel('g_equip', [['all', 'همهٔ وسایل'], ['body', 'وزن بدن'], ['دمبل', 'دمبل'], ['هالتر', 'هالتر'], ['دستگاه', 'دستگاه'], ['سیمکش', 'سیم‌کش'], ['کش', 'کش']], 'all') + '</div>' +
      '<div><label>مدت جلسه (دقیقه)</label><input id="g_min" type="number" min="20" max="120" value="60"></div>' +
      '<div><label>شاگرد مقصد</label>' + sel('g_user', users.map(function (x) { return [x.username, x.username]; })) + '</div>' +
      '<div class="full"><label>نام برنامه (خالی = خودکار)</label><input id="g_name"></div>' +
      '<div class="full"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="g_bank" checked style="width:auto"> هم در بانک برنامه‌ها ذخیره شود</label></div></div>' +
      '<div class="bar" style="margin-top:14px"><button class="btn" id="g_go">ساخت برنامه</button><button class="btn sec" id="g_again" disabled>ساخت نمونهٔ دیگر</button></div>' +
      '<div id="g_out"></div></div>');
    var build = function () {
      $('g_go').disabled = true; $('g_again').disabled = true;
      $('g_out').innerHTML = '<div class="note">در حال ساخت برنامه…</div>';
      call('sfPsSmartGenerate', {
        username: $('g_user').value, planName: $('g_name').value.trim(), goal: $('g_goal').value,
        level: $('g_level').value, daysPerWeek: $('g_days').value, equipment: $('g_equip').value,
        sessionMinutes: $('g_min').value, saveToBank: !!($('g_bank') && $('g_bank').checked)
      }).then(function (r) {
        $('g_go').disabled = false; $('g_again').disabled = false;
        $('g_out').innerHTML = '<div class="card"><h3>ساخته شد: ' + esc(r.planName) + '</h3><p class="note">' + esc(r.goal) + ' · ' + fa(r.days) + ' روز · ' + fa(r.blocks) + ' بلوک · ' + fa(r.sets) + ' ست' + (r.savedToBank ? ' · در بانک برنامه‌ها: ' + esc(r.savedToBank) : '') + '</p></div>' +
          (r.analysis ? anaHtml(Object.assign({}, r.analysis, { score: (r.analysis && r.analysis.score) || 0 })) : '') +
          '<div class="bar"><button class="btn" id="g_edit">ویرایش ست و تکرار همین برنامه</button><button class="btn sec" id="g_an">صفحهٔ تحلیل</button></div>';
        toast('برنامه ساخته و ثبت شد ✅');
        $('g_edit').onclick = function () { S.editPlan = r.planId; go('plans.edit'); };
        $('g_an').onclick = function () { S.analysisPlan = r.planId; go('plans.analysis'); };
      }).catch(function (e) { $('g_go').disabled = false; $('g_again').disabled = false; $('g_out').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; });
    };
    $('g_go').onclick = build;
    $('g_again').onclick = build;
  }).catch(fail);
};
R['plans.bank'] = function () {
  call('sfPsBankList').then(function (r) {
    if (!r.items.length) {
      view('<div class="empty">بانک برنامه‌ها خالی است. از «برنامه‌های تمرینی» دکمهٔ «ذخیره در بانک» یا از «تولید هوشمند» با تیک بانک استفاده کن.</div>');
      return;
    }
    var admin = S.user.role === 'admin';
    view('<div class="card"><h3>بانک برنامه‌ها</h3><p class="note">برنامه‌های آماده برای اختصاص سریع به شاگردها و تحلیل.</p>' +
      plansTable(r.items, [['برنامه', function (p) { return '<b>' + esc(p.name) + '</b>'; }], ['هدف / سطح', function (p) { return esc(p.goal || '—') + (p.level ? ' · ' + esc(p.level) : ''); }],
        ['روز / حرکت', function (p) { return fa(p.days) + ' / ' + fa(p.exercises); }], ['ست', function (p) { return fa(p.sets); }], ['نمره', function (p) { return fa(p.score); }]],
        function (p) {
          return '<button class="btn sec sm" data-an="' + esc(p.planId) + '">تحلیل</button>' +
            '<button class="btn sm" data-as="' + esc(p.name) + '">اختصاص به شاگرد</button>' +
            (admin ? '<button class="btn bad sm" data-dl="' + esc(p.name) + '">حذف</button>' : '');
        }) + '</div>');
    document.querySelectorAll('[data-an]').forEach(function (b) { b.onclick = function () { S.analysisPlan = b.getAttribute('data-an'); go('plans.analysis'); }; });
    document.querySelectorAll('[data-as]').forEach(function (b) { b.onclick = function () { var u = prompt('نام کاربری شاگرد مقصد:'); if (!u) return; call('sf7LibAssign', 'workout', b.getAttribute('data-as'), u.trim(), '').then(function () { toast('اختصاص داده شد ✅'); }).catch(fail); }; });
    document.querySelectorAll('[data-dl]').forEach(function (b) { b.onclick = function () { if (!confirm('از بانک برنامه‌ها حذف شود؟')) return; call('sf7LibDelete', 'workout', b.getAttribute('data-dl')).then(function () { toast('حذف شد.'); render(); }).catch(fail); }; });
  }).catch(fail);
};

/* ---------- ویرایش برنامه: ست، تکرار، روش تمرینی + افزودن/حذف حرکت ---------- */
/* ویرایش نام حرکت داخل برنامه + جایگزینی حرکت با جستجو در کتابخانه */
function openItemEditor(planId, blockId, done) {
  call('sfAdminPlanItems', planId).then(function (r) {
    var items = (r.items || []).filter(function (it) { return !blockId || it.blockId === blockId; });
    if (!items.length) { toast('حرکتی برای ویرایش پیدا نشد.', true); return; }
    var rows = items.map(function (it, i) {
      return '<div class="card" data-row="' + i + '" style="margin:8px 0;padding:10px">' +
        '<div class="fg"><div class="full"><label>نام حرکت (روز ' + fa(it.dayNo) + ')</label>' +
        '<input data-nm="' + i + '" value="' + esc(it.name) + '"></div>' +
        '<div class="full"><label>جایگزینی با حرکت کتابخانه (اختیاری)</label>' +
        '<input data-q="' + i + '" placeholder="مثلاً: لت پول‌داون">' +
        '<div data-res="' + i + '" class="sub" style="margin-top:6px"></div></div></div>' +
        '<input type="hidden" data-ex="' + i + '" value="' + esc(it.exerciseId) + '"></div>';
    }).join('');
    modal('<h3>ویرایش حرکت</h3><p class="note">نام را عوض کن، یا با جستجو حرکت دیگری از کتابخانه انتخاب کن تا همان جای این حرکت بنشیند (ست‌ها هم منتقل می‌شوند).</p>' + rows +
      '<div class="bar"><button class="btn" id="ie_save">ذخیره</button></div>');
    items.forEach(function (it, i) {
      var q = document.querySelector('[data-q="' + i + '"]');
      if (!q) return;
      var timer;
      q.oninput = function () {
        var v = this.value.trim();
        var host = document.querySelector('[data-res="' + i + '"]');
        clearTimeout(timer);
        if (v.length < 2) { host.innerHTML = ''; return; }
        timer = setTimeout(function () {
          host.innerHTML = 'در جستجو…';
          call('sfAdminLibSearch', { q: v, per: 6 }).then(function (res) {
            host.innerHTML = (res.items || []).map(function (x, k) {
              return '<button type="button" class="btn sec sm" style="margin:2px" data-pick="' + i + '" data-id="' + esc(x.id) + '" data-name="' + esc(x.fa) + '">' + esc(x.fa) + ' <small>· ' + esc(x.group) + '</small></button>';
            }).join('') || 'چیزی پیدا نشد';
            host.querySelectorAll('[data-pick]').forEach(function (pb) {
              pb.onclick = function () {
                document.querySelector('[data-ex="' + pb.getAttribute('data-pick') + '"]').value = pb.getAttribute('data-id');
                document.querySelector('[data-nm="' + pb.getAttribute('data-pick') + '"]').value = pb.getAttribute('data-name');
                host.innerHTML = '✅ انتخاب شد: ' + esc(pb.getAttribute('data-name'));
              };
            });
          }).catch(function () { host.innerHTML = ''; });
        }, 320);
      };
    });
    var save = document.getElementById('ie_save');
    save.onclick = function () {
      save.disabled = true;
      var jobs = items.map(function (it, i) {
        var nm = document.querySelector('[data-nm="' + i + '"]').value.trim();
        var ex = document.querySelector('[data-ex="' + i + '"]').value;
        if (nm === it.name && ex === it.exerciseId) return null;
        return call('sfAdminUpdatePlanItem', planId, it.itemId, nm, ex === it.exerciseId ? '' : ex);
      }).filter(Boolean);
      if (!jobs.length) { closeModal(); toast('تغییری نبود'); return; }
      Promise.all(jobs).then(function () { closeModal(); toast('حرکت‌ها به‌روز شد'); if (done) done(); })
        .catch(function (e) { save.disabled = false; fail(e); });
    };
  }).catch(fail);
}

function editBlockHtml(b, tech, dayNo, dayTitle) {
  var seq = (b.sets || []).map(function (s) { return ((s.cells || [])[0] || {}).reps || ''; });
  var uniq = seq.filter(function (v, i, all) { return v && all.indexOf(v) === i; });
  var repsText = uniq.length > 1 ? seq.join('-') : (uniq[0] || '10');
  var weights = (b.sets || []).map(function (s) { return (s.cells || []).map(function (c) { return c.weight || ''; }); });
  var ids = (b.items || []).map(function (it) { return it.exerciseId; }).join(',');
  var name = (b.items || []).map(function (it) { return it.name; }).join(' + ');
  var groups = (b.items || []).map(function (it) { return it.group || it.muscleGroup || ''; }).join('|');
  return '<div class="editblk" data-b="' + esc(b.blockId || ('new-' + Math.random().toString(36).slice(2))) + '" data-day="' + esc(dayNo) + '" data-dt="' + esc(dayTitle) + '" data-ex="' + esc(ids) + '" data-groups="' + esc(groups) + '" data-w="' + encodeURIComponent(JSON.stringify(weights)) + '">' +
    '<h4>حرکت: ' + esc(name) + ' <span style="float:left"><button class="btn sec sm" data-ren="1">تغییر نام / حرکت</button> <button class="btn bad sm" data-del="1">حذف</button></span></h4><div class="row">' +
    '<div><label>روش تمرینی</label><select data-f="technique">' + tech + '</select></div>' +
    '<div><label>تعداد ست</label><input type="number" min="1" max="20" data-f="sets" value="' + esc((b.sets || []).length || 1) + '"></div>' +
    '<div><label>تکرارها</label><input data-f="reps" value="' + esc(repsText) + '" placeholder="8-12"></div>' +
    '<div><label>استراحت (ثانیه)</label><input type="number" min="0" max="600" data-f="rest" value="' + esc(b.restBetweenSec || 60) + '"></div>' +
    '<div class="wide"><label>یادداشت این بلوک</label><input data-f="notes" value="' + esc(b.notes || '') + '"></div></div></div>';
}

function techniqueRecipe(key) {
  var map = {
    normal: { sets: 4, reps: '8-12', rest: 90, note: '' }, superset: { sets: 3, reps: '10-12', rest: 60, note: 'حرکت‌ها را پشت سر هم اجرا کن؛ بعد از هر دور استراحت کن.' },
    triset: { sets: 3, reps: '10-15', rest: 60, note: 'سه حرکت را پشت سر هم اجرا کن؛ سپس استراحت.' }, giantset: { sets: 3, reps: '12-15', rest: 60, note: 'چهار تا شش حرکت را پشت سر هم اجرا کن؛ سپس استراحت.' },
    dropset: { sets: 3, reps: '8-12', rest: 90, note: 'در آخرین ست، وزنه را 20–30٪ کم کن و بدون استراحت ادامه بده.' }, pyramid: { sets: 4, reps: '15-12-10-8', rest: 120, note: 'هر ست وزنه را بیشتر و تکرار را کمتر کن.' },
    reverse_pyramid: { sets: 4, reps: '6-8-10-12', rest: 120, note: 'ست اول سنگین‌تر؛ سپس وزنه را کم و تکرار را زیاد کن.' }, restpause: { sets: 3, reps: '10-15', rest: 90, note: 'پس از ست، 15–20 ثانیه مکث و 2–3 تکرار کوتاه اضافه کن.' },
    myoreps: { sets: 4, reps: '15-20', rest: 30, note: 'یک ست فعال‌سازی، سپس مینی‌ست‌های کوتاه با مکث 20–30 ثانیه.' }, mechanical_drop: { sets: 3, reps: '8-12', rest: 60, note: 'دو یا سه فرم حرکت را از سخت به آسان پشت سر هم اجرا کن.' },
    tempo: { sets: 3, reps: '8-10', rest: 90, note: 'تمپو: 3 ثانیه پایین، 1 مکث، 1 ثانیه بالا.' }, fst7: { sets: 7, reps: '10-12', rest: 35, note: '7 ست پایانی همان عضله با 30–45 ثانیه استراحت.' }, cardio: { sets: 1, reps: '20', rest: 0, note: 'مدت به دقیقه؛ شدت متوسط و قابل حفظ.' }
  };
  return map[key] || map.normal;
}
function applyTechniqueRecipe(box, key) {
  var t = techniqueRecipe(key), sets = box.querySelector('[data-f="sets"]'), reps = box.querySelector('[data-f="reps"]'), rest = box.querySelector('[data-f="rest"]'), notes = box.querySelector('[data-f="notes"]');
  if (sets) sets.value = t.sets; if (reps) reps.value = t.reps; if (rest) rest.value = t.rest; if (notes) notes.value = t.note;
}
function livePlanReadout(root) {
  var el = $('cb_live') || $('edit_live'); if (!el || !root) return;
  var groups = {}, daySets = {}, total = 0, blocks = 0, methodCounts = {};
  root.querySelectorAll('.editblk').forEach(function (box) {
    var n = Math.max(1, Number((box.querySelector('[data-f="sets"]') || {}).value) || 1), key = (box.querySelector('[data-f="technique"]') || {}).value || 'normal';
    blocks++; total += n; methodCounts[key] = (methodCounts[key] || 0) + 1;
    var d = box.closest('[data-day]'), dayNo = d && d.getAttribute('data-day') || '?'; daySets[dayNo] = (daySets[dayNo] || 0) + n;
    String(box.getAttribute('data-groups') || '').split('|').filter(Boolean).forEach(function (g) { g = g.replace(/\s+/g, ' ').trim(); groups[g] = (groups[g] || 0) + n; });
  });
  var sorted = Object.keys(groups).sort(function (a, b) { return groups[b] - groups[a]; });
  var recommend = sorted.length ? (groups[sorted[0]] < 8 ? 'برای ' + sorted[0] + ' هنوز حجم کمی داری؛ از ست‌های معمولی یا هرمی استفاده کن و حجم را تدریجی بالا ببر.' : groups[sorted[0]] > 20 ? 'حجم ' + sorted[0] + ' بالاست؛ ست اضافه نکن و برای جلسه بعد گروهی کم‌کار را انتخاب کن.' : 'برای عضلهٔ پرحجم از ست معمولی استفاده کن؛ فقط در حرکت پایانی یک روش ویژه مثل دراپ‌ست یا رست‌پاز بگذار.') : 'حرکت‌ها را اضافه کن تا حجم عضلات و پیشنهاد روش تمرینی لحظه‌ای دیده شود.';
  var tech = (S.techniques || []).filter(function (x) { return methodCounts[x.key]; }).map(function (x) { return x.label + ': ' + fa(methodCounts[x.key]); }).join(' · ');
  el.innerHTML = '<div class="bar"><b>تحلیل زندهٔ برنامه</b><span class="pill">' + fa(blocks) + ' بلوک</span><span class="pill">' + fa(total) + ' ست</span><span class="pill">' + fa(Object.keys(daySets).length) + ' روز</span></div><div class="muscle-tags">' + (sorted.map(function (g) { var n = groups[g], tone = n > 20 ? ' bad' : n < 8 ? ' warn' : ' ok'; return '<span class="pill' + tone + '">' + esc(g) + ' · ' + fa(n) + ' ست</span>'; }).join('') || '<span class="sub">هنوز حرکتی اضافه نشده</span>') + '</div><div class="note">' + esc(recommend) + '</div>' + (tech ? '<small class="sub">روش‌ها در این برنامه: ' + esc(tech) + '</small>' : '');
}
function wireLivePlan(root) {
  if (!root) return;
  root.querySelectorAll('.editblk').forEach(function (box) {
    var s = box.querySelector('[data-f="technique"]');
    if (s && !s.getAttribute('data-live-bound')) { s.setAttribute('data-live-bound', '1'); s.onchange = function () { applyTechniqueRecipe(box, s.value); livePlanReadout(root); }; }
    box.querySelectorAll('[data-f="sets"],[data-f="reps"],[data-f="rest"]').forEach(function (x) { if (!x.getAttribute('data-live-bound')) { x.setAttribute('data-live-bound', '1'); x.oninput = function () { livePlanReadout(root); }; } });
  });
  livePlanReadout(root);
}
R['plans.edit'] = function () {
  var id = S.editPlan || '';
  if (!id) {
    call('sf3AdminAllPlans').then(function (rows) {
      var plans = rows.filter(function (p) { return p.username !== '__LIB__'; });
      view('<div class="card"><h3>کدام برنامه ویرایش شود؟</h3>' + plansTable(plans, [['برنامه', function (p) { return '<b>' + esc(p.planName) + '</b>'; }], ['شاگرد', function (p) { return '<span class="ltr">' + esc(p.username) + '</span>'; }], ['روز / بلوک', function (p) { return fa(p.days) + ' / ' + fa(p.blocks); }]],
        function (p) { return '<button class="btn sm" data-ed="' + esc(p.planId) + '">ویرایش</button>'; }) + '</div>');
      document.querySelectorAll('[data-ed]').forEach(function (b) { b.onclick = function () { S.editPlan = b.getAttribute('data-ed'); go('plans.edit'); }; });
    }).catch(fail);
    return;
  }
  call('sfPsPlanGet', id).then(function (r) {
    var p = r.plan || {}, tech = r.techniques || S.techniques || [];
    var techOpt = function (cur) { return tech.map(function (t) { return '<option value="' + esc(t.key) + '"' + (t.key === cur ? ' selected' : '') + '>' + esc(t.label) + '</option>'; }).join(''); };
    var h = '<div class="card"><h3>ویرایش برنامه</h3><div class="fg">' +
      '<div class="full"><label>نام برنامه</label><input id="e_name" value="' + esc(p.planName || '') + '"></div>' +
      '<div><label>هدف</label><input id="e_goal" value="' + esc(p.goal || '') + '" placeholder="مثل کاهش چربی"></div>' +
      '<div><label>سطح</label><input id="e_level" value="' + esc(p.level || '') + '"></div>' +
      '<div class="full"><label>یادداشت مربی</label><textarea id="e_notes" rows="2">' + esc(p.coachNotes || '') + '</textarea></div></div>' +
      '<p class="note">هر بلوک: روش تمرینی، تعداد ست، تکرارها (مثل 8-12 یا 12-10-8-6)، استراحت و یادداشت. با «افزودن حرکت» می‌توانی حرکت تازه از بانک اضافه کنی و با «حذف» بلوک را برداری. وزنه‌های ثبت‌شده حفظ می‌شوند.</p></div>' +
      '<div id="edit_live" class="card live-plan"></div>';
    (p.days || []).forEach(function (d) {
      var blocksHtml = (d.blocks || []).map(function (b) { return editBlockHtml(b, techOpt(b.technique), d.dayNo, d.title || ''); }).join('');
      h += '<div class="card" data-day="' + esc(d.dayNo) + '" data-dt="' + esc(d.title || '') + '"><h3>روز ' + fa(d.dayNo) + ' — ' + esc(d.title || '') + '</h3><div class="dayblocks">' + blocksHtml + '</div>' +
        '<button class="btn sec sm" data-add="' + esc(d.dayNo) + '">＋ افزودن حرکت به این روز</button></div>';
    });
    h += '<div class="card"><div class="bar"><button class="btn sec sm" id="e_addday">＋ افزودن روز تمرین</button></div>' +
      '<div class="bar"><button class="btn" id="e_save">ذخیرهٔ تغییرات</button>' +
      '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="e_bank" checked style="width:auto"> نسخهٔ بانکی هم به‌روز شود</label>' +
      '<a class="btn sec" href="#/plans.workout">بازگشت</a></div><div id="e_out"></div></div>';
    view(h);
    wireLivePlan($('view'));
    document.querySelectorAll('#view [data-go]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); go(a.getAttribute('data-go')); }; });
    document.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { var box = b.closest('.editblk'); if (box) box.remove(); livePlanReadout($('view')); }; });
    document.querySelectorAll('[data-ren]').forEach(function (b) {
      b.onclick = function () {
        var box = b.closest('.editblk');
        var blockId = box ? box.getAttribute('data-b') : '';
        openItemEditor(p.planId, blockId, function () { render(); });
      };
    });
    document.querySelectorAll('[data-add]').forEach(function (b) {
      b.onclick = function () {
        var dayNo = b.getAttribute('data-add');
        var card = b.closest('[data-day]');
        addMoveModal(dayNo, card, techOpt('normal'));
      };
    });
    if ($('e_addday')) $('e_addday').onclick = function () {
      var n = 0;
      document.querySelectorAll('#view .card[data-day]').forEach(function (d) { n = Math.max(n, Number(d.getAttribute('data-day')) || 0); });
      n += 1;
      var all = document.querySelectorAll('#view .card[data-day]');
      var anchor = all.length ? all[all.length - 1] : null;
      if (anchor) anchor.insertAdjacentHTML('afterend', newDayHtml(n)); else $('view').insertAdjacentHTML('afterbegin', newDayHtml(n));
      var cards = document.querySelectorAll('#view .card[data-day]');
      var card = cards[cards.length - 1];
      card.querySelector('[data-addmove]').onclick = function () { addMoveModal(n, card, techOpt('normal')); };
      card.querySelector('[data-dropday]').onclick = function () { card.remove(); livePlanReadout($('view')); };
    };
    $('e_save').onclick = function () {
      var col = collectPlanBlocks($('view'), tech);
      var blocks = col.blocks;
      if (col.bad) { toast(col.bad, true); return; }
      if (!blocks.length) { toast('برنامه هیچ بلوکی ندارد.', true); return; }
      this.disabled = true;
      call('sfPsPlanSave', { planId: p.planId, planName: $('e_name').value.trim() || p.planName, username: p.username,
        goal: $('e_goal').value.trim(), level: $('e_level').value.trim(), coachNotes: $('e_notes').value, blocks: blocks })
        .then(function () {
          var back = function () { S.editPlan = ''; go('plans.workout'); };
          if ($('e_bank') && $('e_bank').checked) {
            call('sfPsPlanToBank', p.planId, $('e_name').value.trim() || p.planName)
              .then(function (b) { toast('برنامه و نسخهٔ بانکی ذخیره شد ✅ (' + b.name + ')'); back(); })
              .catch(function (e) { toast('برنامه ذخیره شد، ولی نسخهٔ بانکی نه: ' + e.message, true); back(); });
          } else { toast('برنامه ذخیره شد ✅'); back(); }
        })
        .catch(function (e) { $('e_save').disabled = false; toast(e.message, true); });
    };
  }).catch(function (e) { S.editPlan = ''; fail(e); });
};

/* انتخاب حرکت از بانک و افزودن به یک روز */
function addMoveModal(dayNo, card, techOptionsHtml) {
  modal('<h3>افزودن حرکت به روز ' + fa(dayNo) + '</h3><p id="pk_help" class="note">برای سوپرست و تری‌ست، چند حرکت را انتخاب کن. روش تمرینی، ست، تکرار و استراحت با هم تنظیم می‌شوند.</p>' +
    '<div class="bar"><input class="q" id="pk_q" placeholder="جستجوی نام حرکت (فارسی/انگلیسی)…"><button class="btn sec sm" id="pk_go">جستجو</button></div>' +
    '<div id="pk_list" style="max-height:230px;overflow:auto"><div class="empty">نام حرکت را بنویس و «جستجو» بزن.</div></div>' +
    '<div class="fg" style="margin-top:10px"><div><label>روش تمرینی</label><select id="pk_tech">' + techOptionsHtml + '</select></div>' +
    '<div><label>تعداد ست (خودکار، قابل‌تغییر)</label><input id="pk_sets" type="number" min="1" max="20" value="4"></div>' +
    '<div><label>تکرارها</label><input id="pk_reps" value="8-12"></div>' +
    '<div><label>استراحت (ثانیه)</label><input id="pk_rest" type="number" min="0" max="600" value="90"></div></div>' +
    '<p><button class="btn" id="pk_add" disabled>افزودن به برنامه</button> <span id="pk_count" class="sub"></span></p>');
  var chosen = [];
  var recipe = function () { var x = techniqueRecipe($('pk_tech').value); $('pk_sets').value = x.sets; $('pk_reps').value = x.reps; $('pk_rest').value = x.rest; $('pk_help').textContent = x.note || 'روش انتخاب‌شده مشخصات پایهٔ تمرین را آماده کرد؛ در صورت نیاز تغییرش بده.'; refreshSelected(); };
  var refreshSelected = function () {
    var t = (S.techniques || []).filter(function (x) { return x.key === $('pk_tech').value; })[0] || { min: 1, max: 1 }, valid = chosen.length >= t.min && chosen.length <= t.max;
    $('pk_count').textContent = chosen.length + ' از ' + (t.min === t.max ? t.min : t.min + ' تا ' + t.max) + ' حرکت انتخاب شده'; $('pk_add').disabled = !valid;
  };
  $('pk_tech').onchange = recipe;
  var search = function () {
    var q = ($('pk_q').value || '').trim();
    $('pk_list').innerHTML = '<div class="empty">در حال جستجو…</div>';
    call('adm_bankList', 'exercises', { q: q, facets: {}, page: 1, size: 25, onlyMissingMedia: false }).then(function (r) {
      if (!r.items || !r.items.length) { $('pk_list').innerHTML = '<div class="empty">حرکتی پیدا نشد.</div>'; return; }
      $('pk_list').innerHTML = r.items.map(function (o) {
        return '<div style="display:flex;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--line)">' +
          '<b style="flex:1">' + esc(o.PersianName) + ' <small style="color:var(--mute)">' + esc(o.MuscleGroup || '') + '</small></b>' +
          '<button class="btn sec sm" data-pick="' + esc(o.ExerciseID) + '" data-nm="' + esc(o.PersianName) + '" data-group="' + esc(o.MuscleGroup || '') + '">انتخاب</button></div>';
      }).join('');
      $('pk_list').querySelectorAll('[data-pick]').forEach(function (b) {
        b.onclick = function () {
          var item = { id: b.getAttribute('data-pick'), name: b.getAttribute('data-nm'), group: b.getAttribute('data-group') || '' }, at = chosen.map(function (x) { return x.id; }).indexOf(item.id);
          if (at >= 0) chosen.splice(at, 1); else chosen.push(item);
          b.textContent = at >= 0 ? 'انتخاب' : '✔ انتخاب شد'; b.className = at >= 0 ? 'btn sec sm' : 'btn sm'; refreshSelected();
        };
      });
    }).catch(function (e) { $('pk_list').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; });
  };
  $('pk_go').onclick = search;
  $('pk_q').onkeydown = function (e) { if (e.key === 'Enter') search(); };
  $('pk_add').onclick = function () {
    if (!chosen.length) return;
    var host = card.querySelector('.dayblocks');
    if (!host) return;
    var b = { blockId: 'new-' + Date.now(), notes: '', restBetweenSec: Number($('pk_rest').value) || 60,
      technique: $('pk_tech').value, items: chosen.map(function (x) { return { exerciseId: x.id, name: x.name, group: x.group }; }), sets: [] };
    var n = Math.max(1, Math.min(20, Number($('pk_sets').value) || 4));
    for (var i = 1; i <= n; i++) b.sets.push({ setNo: i, cells: [{}] });
    var html = editBlockHtml(b, techOptionsHtml, card.getAttribute('data-day'), card.getAttribute('data-dt'));
    host.insertAdjacentHTML('beforeend', html);
    var box = host.lastElementChild;
    box.querySelector('[data-f="reps"]').value = $('pk_reps').value || '10-12';
    box.querySelector('[data-f="technique"]').value = $('pk_tech').value || 'normal';
    box.querySelector('[data-del]').onclick = function () { box.remove(); };
    wireLivePlan(document.getElementById('cb_days') || document.getElementById('view'));
    closeModal();
    toast('«' + chosen.map(function (x) { return x.name; }).join(' + ') + '» اضافه شد.');
  };
  recipe();
  search();
}

/* ---------- برنامه‌ساز: ساخت برنامهٔ تازه از صفر ---------- */
function plansToolbar() {
  return '<div class="bar"><a class="btn" href="#/plans.create">＋ برنامهٔ تازه (برنامه‌ساز)</a>' +
    '<a class="btn sec" href="#/plans.generate">تولید هوشمند</a>' +
    '<a class="btn sec" href="#/plans.bank">بانک برنامه‌ها</a></div>';
}
function techOptsHtml(cur) {
  return (S.techniques || []).map(function (t) {
    return '<option value="' + esc(t.key) + '"' + (t.key === cur ? ' selected' : '') + '>' + esc(t.label) + '</option>';
  }).join('');
}
function newDayHtml(n, title) {
  var t = title || ('روز ' + n);
  return '<div class="card" data-day="' + esc(n) + '" data-dt="' + esc(t) + '">' +
    '<div class="bar"><b>روز ' + fa(n) + '</b><input data-daytitle value="' + esc(t) + '" placeholder="عنوان روز (مثلاً سینه و پشت بازو)" style="max-width:260px"></div>' +
    '<div class="dayblocks"></div>' +
    '<div class="bar"><button class="btn sec sm" data-addmove="' + esc(n) + '">＋ افزودن حرکت</button>' +
    '<button class="btn bad sm" data-dropday="' + esc(n) + '">حذف این روز</button></div></div>';
}
/* خواندن بلوک‌ها از فرم: ست، تکرار، روش تمرینی، استراحت، یادداشت */
function collectPlanBlocks(root, tech) {
  var blocks = [], bad = '';
  (root || document).querySelectorAll('.card[data-day]').forEach(function (dc) {
    if (bad) return;
    var dayNo = Number(dc.getAttribute('data-day')) || 1;
    var ti = dc.querySelector('[data-daytitle]');
    var dayTitle = (ti && ti.value.trim()) || dc.getAttribute('data-dt') || ('روز ' + dayNo);
    dc.querySelectorAll('.editblk').forEach(function (box) {
      if (bad) return;
      var tKey = box.querySelector('[data-f="technique"]').value;
      var t = (tech || []).filter(function (x) { return x.key === tKey; })[0] || { min: 1, max: 6, label: tKey };
      var exIds = (box.getAttribute('data-ex') || '').split(',').filter(Boolean);
      if (!exIds.length) { bad = 'یک بلوک حرکت ندارد؛ حذفش کن یا حرکت اضافه کن.'; return; }
      if (exIds.length < t.min || exIds.length > t.max) { bad = '«' + (t.label || tKey) + '» برای ' + exIds.length + ' حرکت مناسب نیست (به ' + t.min + ' تا ' + t.max + ' حرکت نیاز دارد).'; return; }
      var nSets = Math.max(1, Math.min(20, Number(box.querySelector('[data-f="sets"]').value) || 1));
      var repsIn = (box.querySelector('[data-f="reps"]').value || '').trim() || '10';
      var seq = repsIn.split(/[-–—,،/\s]+/).filter(Boolean);
      if (!seq.length) seq = ['10'];
      var rest = Math.max(0, Math.min(600, Number(box.querySelector('[data-f="rest"]').value) || 60));
      var notes = box.querySelector('[data-f="notes"]').value || '';
      var oldW = [];
      try { oldW = JSON.parse(decodeURIComponent(box.getAttribute('data-w') || '[]')) || []; } catch (eW) { oldW = []; }
      var sets = [];
      for (var i = 1; i <= nSets; i++) {
        var reps = seq[Math.min(i - 1, seq.length - 1)];
        var ow = oldW[i - 1] || [];
        sets.push({ setNo: i, restAfterSec: rest, cells: exIds.map(function (x, pos) { return { reps: reps, weight: ow[pos] || '' }; }) });
      }
      blocks.push({ dayNo: dayNo, dayTitle: dayTitle, technique: tKey, notes: notes, restBetweenSec: rest,
        items: exIds.map(function (x) { return { exerciseId: x }; }), sets: sets });
    });
  });
  return { blocks: blocks, bad: bad };
}
R['plans.create'] = function () {
  call('adm_usersList').then(function (u) {
    var users = (u.users || []).filter(function (x) { return x.role === 'user'; });
    if (!users.length) { view('<div class="empty">اول یک شاگرد بساز؛ هر برنامه به یک شاگرد ثبت می‌شود.</div>'); return; }
    var opt = function (items, def) {
      return items.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === def ? ' selected' : '') + '>' + esc(x[1]) + '</option>'; }).join('');
    };
    view('<div class="card"><h3>برنامه‌ساز — برنامهٔ تازه</h3>' +
      '<p class="note">روز را اضافه کن، حرکت‌ها را جستجو و انتخاب کن؛ اگر سوپرست یا تری‌ست می‌خواهی چند حرکت را با هم انتخاب کن. ست، تکرار و استراحت با روش تمرینی خودکار تنظیم می‌شود و تحلیل عضلات هم‌زمان با نوشتن به‌روز می‌شود.</p>' +
    '<div class="fg"><div class="full"><label>نام برنامه</label><input id="cb_name" placeholder="مثل: حجم 4 روزه"></div>' +
      '<div><label>شاگرد</label><select id="cb_user">' + opt(users.map(function (x) { return [x.username, x.username]; }), '') + '</select></div>' +
      '<div><label>هدف</label><select id="cb_goal">' + opt([['', '—'], ['کاهش چربی', 'کاهش چربی'], ['افزایش حجم', 'افزایش حجم'], ['افزایش قدرت', 'افزایش قدرت'], ['تناسب اندام', 'تناسب اندام']], '') + '</select></div>' +
      '<div><label>سطح</label><select id="cb_level">' + opt([['', '—'], ['مبتدی', 'مبتدی'], ['متوسط', 'متوسط'], ['پیشرفته', 'پیشرفته']], '') + '</select></div>' +
      '<div class="full"><label>یادداشت مربی</label><textarea id="cb_notes" rows="2"></textarea></div></div>' +
      '<div id="cb_live" class="card live-plan" style="margin-top:12px"></div><div id="cb_days" style="margin-top:10px"></div>' +
      '<div class="bar"><button class="btn sec sm" id="cb_addday">＋ افزودن روز تمرین</button></div>' +
      '<div class="bar"><button class="btn" id="cb_save">ذخیرهٔ برنامه</button>' +
      '<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="cb_bank" checked style="width:auto"> هم در بانک برنامه‌ها ذخیره شود</label></div>' +
      '<div id="cb_out"></div></div>');
    var tech = S.techniques || [];
    var bindDays = function () {
      $('cb_days').querySelectorAll('[data-addmove]').forEach(function (b) {
        b.onclick = function () { addMoveModal(b.getAttribute('data-addmove'), b.closest('[data-day]'), techOptsHtml('normal')); };
      });
      $('cb_days').querySelectorAll('[data-dropday]').forEach(function (b) {
        b.onclick = function () { if (confirm('این روز با همهٔ حرکاتش حذف شود؟')) { b.closest('[data-day]').remove(); livePlanReadout($('cb_days')); } };
      });
      wireLivePlan($('cb_days'));
    };
    var addDay = function () {
      var n = 0;
      $('cb_days').querySelectorAll('.card[data-day]').forEach(function (d) { n = Math.max(n, Number(d.getAttribute('data-day')) || 0); });
      $('cb_days').insertAdjacentHTML('beforeend', newDayHtml(n + 1));
      bindDays();
      livePlanReadout($('cb_days'));
    };
    $('cb_addday').onclick = addDay;
    addDay();
    $('cb_save').onclick = function () {
      var col = collectPlanBlocks($('cb_days'), tech);
      if (col.bad) { toast(col.bad, true); return; }
      if (!col.blocks.length) { toast('حداقل یک حرکت به برنامه اضافه کن.', true); return; }
      var self = this, nm = $('cb_name').value.trim() || 'برنامه جدید';
      self.disabled = true;
      call('sfAdminSavePlan', { planName: nm, username: $('cb_user').value, goal: $('cb_goal').value,
        level: $('cb_level').value, coachNotes: $('cb_notes').value, blocks: col.blocks })
        .then(function (r) {
          var pid = (r && (r.planId || r.planID)) || '';
          var done = function (bankName) {
            self.disabled = false;
            toast('برنامه ساخته شد ✅' + (bankName ? ' · در بانک برنامه‌ها هم ذخیره شد' : ''));
            $('cb_out').innerHTML = '<div class="note">«' + esc(nm) + '» با ' + fa(col.blocks.length) + ' بلوک ذخیره شد' + (bankName ? ' و در بانک برنامه‌ها هم ثبت شد.' : '.') + '</div>' +
              '<div class="bar"><button class="btn sec" id="cb_edit">ویرایش همین برنامه</button><button class="btn sec" id="cb_an">تحلیل برنامه</button></div>';
            $('cb_edit').onclick = function () { S.editPlan = pid; go('plans.edit'); };
            $('cb_an').onclick = function () { S.analysisPlan = pid; go('plans.analysis'); };
          };
          if ($('cb_bank') && $('cb_bank').checked && pid) {
            call('sfPsPlanToBank', pid, nm)
              .then(function (b) { done((b && b.name) || nm); })
              .catch(function (e) { toast('برنامه ذخیره شد ولی در بانک ثبت نشد: ' + e.message, true); done(''); });
          } else done('');
        })
        .catch(function (e) { self.disabled = false; fail(e); });
    };
  }).catch(fail);
};

/* ---------- ویرایش محتوای برنامهٔ غذایی ---------- */
function dietRowHtml(it) {
  it = it || {};
  return '<tr data-dr><td><input data-df="title" value="' + esc(it.title || '') + '" placeholder="نام گزینه"></td>' +
    '<td><input data-df="description" value="' + esc(it.description || '') + '" placeholder="توضیح / مقدار"></td>' +
    '<td><input data-df="kcal" type="number" value="' + esc(it.kcal || '') + '" style="width:74px"></td>' +
    '<td><input data-df="protein" type="number" value="' + esc(it.protein || '') + '" style="width:62px" aria-label="پروتئین"></td>' +
    '<td><input data-df="carbs" type="number" value="' + esc(it.carbs || '') + '" style="width:62px" aria-label="کربوهیدرات"></td>' +
    '<td><input data-df="fat" type="number" value="' + esc(it.fat || '') + '" style="width:62px" aria-label="چربی"></td>' +
    '<td><input data-df="grams" type="number" value="' + esc(it.grams || '') + '" style="width:70px"></td>' +
    '<td><button class="btn bad sm" data-drd>✕</button></td></tr>';
}
function dietSecHtml(sec) {
  sec = sec || { title: '', items: [{}] };
  return '<div class="sec" data-dsec><div class="bar"><input data-dsf="title" value="' + esc(sec.title || '') + '" placeholder="نام وعده (مثلاً صبحانه)" style="max-width:240px">' +
    '<button class="btn sec sm" data-dadditem>＋ گزینه</button><button class="btn bad sm" data-ddlsec>حذف وعده</button></div>' +
    '<div class="wrap"><table><thead><tr><th>گزینه</th><th>توضیح</th><th>kcal</th><th>P</th><th>C</th><th>F</th><th>گرم</th><th></th></tr></thead><tbody>' +
    ((sec.items && sec.items.length ? sec.items : [{}]).map(function (it) { return dietRowHtml(it); }).join('')) +
    '</tbody></table></div></div>';
}
function dietEditor(doc) {
  doc = doc || { sections: [{ title: 'صبحانه', items: [{}] }] };
  modal('<h3>برنامهٔ غذایی <small style="color:var(--mute)">' + (doc.planId ? 'ویرایش' : 'جدید') + '</small></h3>' +
    '<div class="fg"><div class="full"><label>نام برنامه</label><input id="d_name" value="' + esc(doc.planName || '') + '"></div>' +
    '<div><label>شاگرد</label><input id="d_user" class="ltr" value="' + esc(doc.username || '') + '" placeholder="نام کاربری شاگرد"></div></div>' +
    '<div class="card" style="margin:14px 0;border-color:color-mix(in srgb,var(--acc) 36%,var(--line))"><div class="bar"><div style="flex:1"><b>محاسبه‌گر تغذیه</b><div class="sub" style="color:var(--mute)">BMI، متابولیسم و ماکروها از پروفایل شاگرد محاسبه می‌شوند؛ بعد می‌توانی پیش‌نویس وعده‌ها را بسازی و ویرایش کنی.</div></div><button class="btn sec sm" id="d_calc">محاسبه از پروفایل</button></div><div id="d_macro" class="grid g4" style="margin-top:10px"><div class="note">برای شروع، نام کاربری شاگرد را وارد و محاسبه را بزن.</div></div><div class="bar" style="margin:12px 0 0"><label>تعداد وعده <select id="d_meals" style="width:auto"><option value="3">3</option><option value="4">4</option><option value="5" selected>5</option><option value="6">6</option></select></label><label><input id="d_veg" type="checkbox" style="width:auto"> گیاه‌خواری</label><button class="btn" id="d_generate" disabled>ساخت پیش‌نویس وعده‌ها</button></div><div id="d_foodNote" class="sub" style="color:var(--mute)"></div></div>' +
    '<div id="d_secs">' + (doc.sections || []).map(dietSecHtml).join('') + '</div>' +
    '<div class="bar"><button class="btn sec sm" id="d_addsec">＋ افزودن وعده</button><button class="btn" id="d_save">ذخیره</button></div>');
  var macro = null;
  var wire = function () {
    document.querySelectorAll('[data-dsec]').forEach(function (sec) {
      sec.querySelector('[data-dadditem]').onclick = function () {
        sec.querySelector('tbody').insertAdjacentHTML('beforeend', dietRowHtml({}));
        wire();
      };
      sec.querySelector('[data-ddlsec]').onclick = function () { sec.remove(); };
    });
    document.querySelectorAll('[data-drd]').forEach(function (b) { b.onclick = function () { b.closest('tr').remove(); }; });
  };
  wire();
  $('d_calc').onclick = function(){
    var u=$('d_user').value.trim(); if(!u){toast('اول نام کاربری شاگرد را وارد کن.',true);return;}
    var b=this;b.disabled=true;b.textContent='در حال محاسبه…';
    call('sfAdminGetBody',u).then(function(x){
      macro=x; var r=x.res||{}, p=x.profile||{};
      if(!Number(p.height)||!Number(p.weight)||!Number(p.age)){macro=null;$('d_generate').disabled=true;$('d_macro').innerHTML='<div class="note">پروفایل این شاگرد قد، وزن یا سن کامل ندارد؛ اول اطلاعات بدن را در پروفایل تکمیل کن تا کالری پیش‌فرض به‌جای محاسبهٔ واقعی استفاده نشود.</div>';return;}
      $('d_macro').innerHTML='<div class="card kpi"><small>BMI · '+esc(r.bmiClass&&r.bmiClass.label||'')+'</small><b>'+fa(r.bmi)+'</b></div><div class="card kpi"><small>کالری هدف</small><b>'+fa(r.targetCalories)+'</b><small>نیاز روزانه '+fa(r.tdee)+' kcal</small></div><div class="card kpi"><small>پروتئین</small><b>'+fa(r.targetProtein)+' g</b></div><div class="card kpi"><small>کربوهیدرات · چربی</small><b style="font-size:21px">'+fa(r.targetCarbs)+' · '+fa(r.targetFat)+' g</b></div>'+(r.warnings&&r.warnings.length?'<div class="note full">'+r.warnings.map(esc).join('<br>')+'</div>':'');
      $('d_generate').disabled=false; $('d_foodNote').textContent='محاسبه بر پایهٔ قد '+fa(p.height)+' cm، وزن '+fa(p.weight)+' kg و سطح فعالیت ثبت‌شده در پروفایل است.';
    }).catch(fail).then(function(){b.disabled=false;b.textContent='محاسبه از پروفایل';});
  };
  $('d_generate').onclick=function(){
    if(!macro){toast('اول شاگرد را محاسبه کن.',true);return;}
    var b=this;b.disabled=true;b.textContent='در حال ساخت…';var r=macro.res;
    call('sfAutoDiet',$('d_user').value.trim(),{kcal:r.targetCalories,protein:r.targetProtein,carbs:r.targetCarbs,fat:r.targetFat,meals:Number($('d_meals').value),vegetarian:$('d_veg').checked,seed:Date.now()%100000}).then(function(out){
      $('d_secs').innerHTML=(out.sections||[]).map(dietSecHtml).join('');wire();
      if(!$('d_name').value.trim())$('d_name').value='تغذیه '+({lose:'کاهش چربی',gain:'افزایش عضله',maintain:'حفظ و ریکامپ'}[r.goal]||'هوشمند');
      $('d_foodNote').textContent='پیش‌نویس از '+fa(out.foodsCount)+' غذای فعال ساخته شد · جمع تخمینی: '+fa(out.totals.kcal)+' kcal · P '+fa(out.totals.protein)+' / C '+fa(out.totals.carbs)+' / F '+fa(out.totals.fat)+' g. مقادیر را بازبینی و سپس ذخیره کن.';
    }).catch(fail).then(function(){b.disabled=false;b.textContent='ساخت پیش‌نویس وعده‌ها';});
  };
  $('d_addsec').onclick = function () { $('d_secs').insertAdjacentHTML('beforeend', dietSecHtml({ title: '', items: [{}] })); wire(); };
  $('d_save').onclick = function () {
    var sections = [];
    document.querySelectorAll('#d_secs [data-dsec]').forEach(function (sec) {
      var items = [];
      sec.querySelectorAll('[data-dr]').forEach(function (tr) {
        var o = {};
        tr.querySelectorAll('[data-df]').forEach(function (inp) { o[inp.getAttribute('data-df')] = inp.value; });
        if ((o.title || '').trim() || (o.description || '').trim()) items.push(o);
      });
      if (items.length) sections.push({ title: sec.querySelector('[data-dsf="title"]').value, items: items });
    });
    if (!sections.length) { toast('حداقل یک وعده با یک گزینه اضافه کن.', true); return; }
    this.disabled = true;
    call('sfAdminSaveDiet', { planId: doc.planId || '', username: $('d_user').value.trim(), planName: $('d_name').value.trim(), sections: sections })
      .then(function () { toast('برنامهٔ غذایی ذخیره شد ✅'); closeModal(); render(); })
      .catch(function (e) { $('d_save').disabled = false; fail(e); });
  };
}

/* ---------- ویرایش محتوای برنامهٔ مکمل ---------- */
function suppSecHtml(sec) {
  sec = sec || { timing: '', items: [] };
  return '<div class="sec" data-ssec><div class="bar"><input data-ssf="timing" value="' + esc(sec.timing || '') + '" placeholder="زمان مصرف (مثلاً صبح ناشتا)" style="max-width:260px">' +
    '<button class="btn bad sm" data-sdsec>حذف</button></div>' +
    '<textarea rows="3" data-ssf="items" placeholder="هر مکمل در یک خط">' + esc((sec.items || []).join('\n')) + '</textarea></div>';
}
function suppRowHtml(it) {
  it = it || { timings: [] };
  return '<tr data-sgr><td><input data-sif="name" value="' + esc(it.name || '') + '"></td>' +
    '<td><input data-sif="timings" value="' + esc((it.timings || []).join('، ')) + '" placeholder="صبح، شب"></td>' +
    '<td><button class="btn bad sm" data-sdr>✕</button></td></tr>';
}
function suppGrpHtml(g) {
  g = g || { title: '', items: [{}] };
  return '<div class="sec" data-sgrp><div class="bar"><input data-sgf="title" value="' + esc(g.title || '') + '" placeholder="عنوان گروه (مثلاً ویتامین‌ها)" style="max-width:260px">' +
    '<button class="btn bad sm" data-sdgrp>حذف</button></div>' +
    '<div class="wrap"><table><thead><tr><th>نام</th><th>زمان‌ها</th><th></th></tr></thead><tbody>' +
    ((g.items && g.items.length ? g.items : [{}]).map(suppRowHtml).join('')) +
    '</tbody></table></div><button class="btn sec sm" data-saddrow>＋ مکمل</button></div>';
}
function suppEditor(doc) {
  doc = doc || { schedule: [{ timing: '', items: [] }], groups: [] };
  modal('<h3>برنامهٔ مکمل <small style="color:var(--mute)">' + (doc.planId ? 'ویرایش' : 'جدید') + '</small></h3>' +
    '<div class="fg"><div class="full"><label>نام برنامه</label><input id="s_name" value="' + esc(doc.planName || '') + '"></div>' +
    '<div><label>شاگرد</label><input id="s_user" class="ltr" value="' + esc(doc.username || '') + '"></div></div>' +
    '<h4>زمان‌بندی مصرف</h4><div id="s_secs">' + (doc.schedule || []).map(suppSecHtml).join('') + '</div>' +
    '<div class="bar"><button class="btn sec sm" id="s_addsec">＋ زمان مصرف</button></div>' +
    '<h4>گروه‌های مکمل</h4><div id="s_grps">' + (doc.groups || []).map(suppGrpHtml).join('') + '</div>' +
    '<div class="bar"><button class="btn sec sm" id="s_addgrp">＋ گروه</button><button class="btn" id="s_save">ذخیره</button></div>');
  var wire = function () {
    document.querySelectorAll('[data-ssec]').forEach(function (sec) {
      sec.querySelector('[data-sdsec]').onclick = function () { sec.remove(); };
    });
    document.querySelectorAll('[data-sgrp]').forEach(function (g) {
      g.querySelector('[data-sdgrp]').onclick = function () { g.remove(); };
      g.querySelector('[data-saddrow]').onclick = function () {
        g.querySelector('tbody').insertAdjacentHTML('beforeend', suppRowHtml({}));
        wire();
      };
    });
    document.querySelectorAll('[data-sdr]').forEach(function (b) { b.onclick = function () { b.closest('tr').remove(); }; });
  };
  wire();
  $('s_addsec').onclick = function () { $('s_secs').insertAdjacentHTML('beforeend', suppSecHtml({ timing: '', items: [] })); wire(); };
  $('s_addgrp').onclick = function () { $('s_grps').insertAdjacentHTML('beforeend', suppGrpHtml({ title: '', items: [{}] })); wire(); };
  $('s_save').onclick = function () {
    var schedule = [], groups = [];
    document.querySelectorAll('#s_secs [data-ssec]').forEach(function (sec) {
      var items = (sec.querySelector('[data-ssf="items"]').value || '').split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (items.length) schedule.push({ timing: sec.querySelector('[data-ssf="timing"]').value, items: items });
    });
    document.querySelectorAll('#s_grps [data-sgrp]').forEach(function (g) {
      var items = [];
      g.querySelectorAll('[data-sgr]').forEach(function (tr) {
        var name = (tr.querySelector('[data-sif="name"]').value || '').trim();
        if (!name) return;
        var timings = (tr.querySelector('[data-sif="timings"]').value || '').split(/[،,]/).map(function (x) { return x.trim(); }).filter(Boolean);
        items.push({ name: name, timings: timings });
      });
      if (items.length) groups.push({ title: g.querySelector('[data-sgf="title"]').value, items: items });
    });
    if (!schedule.length && !groups.length) { toast('حداقل یک مکمل اضافه کن.', true); return; }
    this.disabled = true;
    call('sfAdminSaveSupp', { planId: doc.planId || '', username: $('s_user').value.trim(), planName: $('s_name').value.trim(), schedule: schedule, groups: groups })
      .then(function () { toast('برنامهٔ مکمل ذخیره شد ✅'); closeModal(); render(); })
      .catch(function (e) { $('s_save').disabled = false; fail(e); });
  };
}

/* ---------- فهرست غذایی و مکمل با دکمهٔ ساخت/ویرایش ---------- */
R['plans.diet'] = function () {
  call('sfAdminListDiets', '').then(function (rows) {
    view('<div class="bar"><button class="btn" id="diet_new">＋ برنامهٔ غذایی جدید</button></div>' +
      '<div class="card"><h3>برنامه‌های غذایی</h3>' +
      plansTable(rows, [['برنامه', function (p) { return '<b>' + esc(p.planName) + '</b>'; }], ['شاگرد', function (p) { return '<span class="ltr">' + esc(p.username) + '</span>'; }], ['وعده / ردیف', function (p) { return fa(p.sections) + ' / ' + fa(p.rows); }], ['کالری کل', function (p) { return fa(p.kcal); }], ['وضعیت', function (p) { return pill(p.active); }]],
        function (p) {
          var k = esc(p.username + '||' + p.planName);
          return '<button class="btn sec sm" data-dedit="' + k + '">ویرایش</button>' +
            '<button class="btn sec sm" data-dact="' + k + '" data-on="' + (p.active ? 0 : 1) + '">' + (p.active ? 'غیرفعال' : 'فعال') + '</button>' +
            '<button class="btn bad sm" data-ddel="' + k + '">حذف</button>';
        }) + '</div>');
    $('diet_new').onclick = function () { dietEditor(null); };
    document.querySelectorAll('[data-dedit]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-dedit').split('||');
        call('sfAdminGetDiet', k[0], k[1]).then(dietEditor).catch(fail);
      };
    });
    document.querySelectorAll('[data-dact]').forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-dact').split('||'); call('sfAdminSetDietActive', k[0], k[1], b.getAttribute('data-on') === '1').then(function () { render(); }).catch(fail); };
    });
    document.querySelectorAll('[data-ddel]').forEach(function (b) {
      b.onclick = function () { if (!confirm('این برنامهٔ غذایی حذف شود؟')) return; var k = b.getAttribute('data-ddel').split('||'); call('sfAdminDeleteDiet', k[0], k[1]).then(function () { render(); }).catch(fail); };
    });
  }).catch(fail);
};
R['plans.supp'] = function () {
  call('sfAdminListSupps', '').then(function (rows) {
    view('<div class="bar"><button class="btn" id="supp_new">＋ برنامهٔ مکمل جدید</button></div>' +
      '<div class="card"><h3>برنامه‌های مکمل</h3>' +
      plansTable(rows, [['برنامه', function (p) { return '<b>' + esc(p.planName) + '</b>'; }], ['شاگرد', function (p) { return '<span class="ltr">' + esc(p.username) + '</span>'; }], ['آیتم', function (p) { return fa(p.items); }], ['وضعیت', function (p) { return pill(p.active); }]],
        function (p) {
          var k = esc(p.username + '||' + p.planName);
          return '<button class="btn sec sm" data-sedit="' + k + '">ویرایش</button>' +
            '<button class="btn sec sm" data-sact="' + k + '" data-on="' + (p.active ? 0 : 1) + '">' + (p.active ? 'غیرفعال' : 'فعال') + '</button>' +
            '<button class="btn bad sm" data-sdel="' + k + '">حذف</button>';
        }) + '</div>');
    $('supp_new').onclick = function () { suppEditor(null); };
    document.querySelectorAll('[data-sedit]').forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute('data-sedit').split('||');
        call('sfAdminGetSupp', k[0], k[1]).then(suppEditor).catch(fail);
      };
    });
    document.querySelectorAll('[data-sact]').forEach(function (b) {
      b.onclick = function () { var k = b.getAttribute('data-sact').split('||'); call('sfAdminSetSuppActive', k[0], k[1], b.getAttribute('data-on') === '1').then(function () { render(); }).catch(fail); };
    });
    document.querySelectorAll('[data-sdel]').forEach(function (b) {
      b.onclick = function () { if (!confirm('این برنامهٔ مکمل حذف شود؟')) return; var k = b.getAttribute('data-sdel').split('||'); call('sfAdminDeleteSupp', k[0], k[1]).then(function () { render(); }).catch(fail); };
    });
  }).catch(fail);
};

/* ---------- پیشرفت و رتبه‌بندی ---------- */
R['users.progress'] = function () {
  var jobs = [call('getLeaderboard')];
  if (S.user.role === 'admin') jobs.push(call('sfAdminProgress', ''));
  Promise.all(jobs).then(function (res) {
    var lb = res[0] || { list: [] }, prog = res[1] || [];
    var med = function (i) { return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + fa(i + 1); };
    var top = (lb.list || []).slice(0, 12);
    var h = '<div class="card"><h3>رتبه‌بندی روزهای پیاپی</h3>' +
      (top.length ? top.map(function (x, i) { return '<div style="display:flex;gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)"><b style="width:38px">' + med(i) + '</b><span style="flex:1" class="ltr">' + esc(x.name || x.username) + '</span><span class="pill">' + (x.streak > 0 ? '🔥 ' + fa(x.streak) + ' روز' : '—') + '</span></div>'; }).join('') : '<div class="empty">داده‌ای نیست.</div>') + '</div>';
    if (S.user.role === 'admin') {
      h += '<div class="card"><h3>آخرین ثبت ست‌ها توسط شاگردها</h3>' + plansTable(prog, [['تاریخ', function (x) { return esc(String(x.DateISO || x.UpdatedAt || '').slice(0, 10)); }], ['شاگرد', function (x) { return '<span class="ltr">' + esc(x.Username) + '</span>'; }], ['برنامه', function (x) { return esc(x.PlanName); }], ['حرکت', function (x) { return esc(x.ExerciseName); }], ['ست', function (x) { return fa(x.SetNo); }], ['ثبت', function (x) { return esc((x.ActualWeightKg || '—') + ' × ' + (x.ActualReps || '—')); }]], function () { return ''; }) + '</div>';
    }
    view(h);
  }).catch(fail);
};

/* ---------- عکس دستی غذا (MealImages) ---------- */
R['users.mealImages'] = function () {
  call('adminListMealImages').then(function (list) {
    view('<div class="card"><h3>عکس دستی غذا</h3><p class="note">اگر عکس خودکار یک وعده پیدا نشد، با همان عبارت دقیق (مثل «عدسی») یک لینک عکس بده.</p>' +
      '<div class="fg"><div class="full"><label>عبارت جستجو</label><input id="mi_q"></div><div class="full"><label>لینک عکس</label><input id="mi_u" class="ltr"></div></div>' +
      '<p><button class="btn" id="mi_s">ذخیره</button></p></div><div class="card"><h3>لیست (' + fa((list || []).length) + ')</h3>' +
      plansTable(list || [], [['عبارت', function (x) { return esc(x.query); }], ['لینک', function (x) { return '<a class="ltr" href="' + esc(x.url) + '" target="_blank">' + esc(String(x.url).slice(0, 60)) + '</a>'; }]], function () { return ''; }) + '</div>');
    $('mi_s').onclick = function () {
      var q = $('mi_q').value.trim(), u = $('mi_u').value.trim();
      if (!q || !u) { toast('عبارت و لینک هر دو لازم است.', true); return; }
      this.disabled = true;
      call('adminSaveMealImage', q, u).then(function () { toast('ذخیره شد ✅'); render(); }).catch(function (e) { $('mi_s').disabled = false; fail(e); });
    };
  }).catch(fail);
};

/* ---------- بانک‌ها: یک موتور برای چهار بانک ---------- */
function ytId(u) { var m = String(u || '').match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : ''; }
function mediaHtml(bk, o, big) {
  var sc = S.banks[bk], imgs = (sc.media.img || []).map(function (k) { return o[k]; }).filter(Boolean);
  var gif = o._gif || (sc.media.gif ? o[sc.media.gif] : '');
  var onerr = 'this.style.display=\'none\'';
  var mediaClass = (bk === 'foods' ? 'food' : (bk === 'supps' || bk === 'minerals' ? 'product' : ''));
  if (gif) return '<img loading="lazy" src="' + esc(gif) + '" onerror="' + onerr + '" alt="">';
  if (imgs.length > 1) return '<div class="anim" style="position:absolute;inset:0">' + imgs.map(function (u) { return '<img loading="lazy" src="' + esc(u) + '" onerror="' + onerr + '" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:' + (big ? 'contain' : 'cover') + '">'; }).join('') + '</div>';
  if (imgs.length) return '<img class="' + mediaClass + '" loading="lazy" src="' + esc(imgs[0]) + '" onerror="' + onerr + '" alt="">';
  return '<span>بدون تصویر</span>';
}
R.bank = function (bk) {
  var sc = S.banks[bk], st = S.bank[bk] = S.bank[bk] || { q: '', f: {}, page: 1, miss: false };
  var admin = S.user.role === 'admin';
  setActs((admin && bk !== 'exercises' ? '<button class="btn sec sm" id="bimg">پر کردن خودکار تصاویر</button> ' : '') + (admin ? '<button class="btn sm" id="badd">+ افزودن</button>' : ''));
  view((bk === 'exercises' ? gifCard() : '') + '<div class="bar"><input class="q" id="bq" placeholder="جستجو (نام فارسی/انگلیسی…)" value="' + esc(st.q) + '"><span id="bfs"></span><label><input type="checkbox" id="bm"' + (st.miss ? ' checked' : '') + ' style="width:auto"> فقط بدون تصویر</label><span class="pill" id="bcnt"></span></div><div id="bres"></div>');
  var fetchPage = function () {
    call('adm_bankList', bk, { q: st.q, facets: st.f, page: st.page, size: 30, onlyMissingMedia: st.miss }).then(function (r) {
      $('bcnt').textContent = fa(r.total) + ' از ' + fa(r.all);
      $('bfs').innerHTML = sc.facets.map(function (f) {
        var lab = (sc.fields.filter(function (x) { return x.k === f; })[0] || { label: f }).label;
        return '<select data-f="' + f + '"><option value="">' + esc(lab) + ': همه</option>' + Object.keys(r.facets[f] || {}).sort().map(function (v) { return '<option value="' + esc(v) + '"' + (st.f[f] === v ? ' selected' : '') + '>' + esc(v) + ' (' + fa(r.facets[f][v]) + ')</option>'; }).join('') + '</select>';
      }).join(' ');
      document.querySelectorAll('[data-f]').forEach(function (s) { s.onchange = function () { st.f[s.getAttribute('data-f')] = s.value; st.page = 1; fetchPage(); }; });
      var pages = Math.max(1, Math.ceil(r.total / r.size));
      $('bres').innerHTML = (!r.all ? '<div class="note">این بانک هنوز خالی است. فایل «' + esc(sc.sheetName || bk) + '.csv» از پوشهٔ bank-data را در همین تب شیت ایمپورت کنید (File ‹ Import ‹ Replace current sheet).</div>' : '') + (r.items.length ? '<div class="cards">' + r.items.map(function (o) { return card(bk, o); }).join('') + '</div>' : '<div class="empty">موردی پیدا نشد.</div>') +
        '<div class="pager"><button class="btn sec sm" id="pp"' + (st.page <= 1 ? ' disabled' : '') + '>قبلی</button><span>صفحه ' + fa(st.page) + ' از ' + fa(pages) + '</span><button class="btn sec sm" id="pn"' + (st.page >= pages ? ' disabled' : '') + '>بعدی</button></div>';
      $('pp').onclick = function () { st.page--; fetchPage(); window.scrollTo(0, 0); }; $('pn').onclick = function () { st.page++; fetchPage(); window.scrollTo(0, 0); };
      document.querySelectorAll('[data-id]').forEach(function (c) { c.onclick = function () { openItem(bk, c.getAttribute('data-id')); }; });
    }).catch(fail);
  };
  var t; $('bq').oninput = function () { var v = this.value; clearTimeout(t); t = setTimeout(function () { st.q = v; st.page = 1; fetchPage(); }, 300); };
  $('bm').onchange = function () { st.miss = this.checked; st.page = 1; fetchPage(); };
  if ($('badd')) $('badd').onclick = function () { editDlg(bk, {}); };
  if ($('bimg')) $('bimg').onclick = function () { var b = this; b.disabled = true; var loop = function () { b.textContent = 'در حال جستجوی عکس محصول…'; call('adm_mediaFill', bk, 30).then(function (r) { toast('عکس محصول: ' + fa(r.found) + ' · نتیجه‌ای پیدا نشد: ' + fa(r.unmatched) + ' · صف: ' + fa(r.remaining)); if (r.remaining > 0 && r.tried > 0) loop(); else { b.disabled = false; b.textContent = 'جستجوی عکس محصول'; fetchPage(); } }).catch(function (e) { b.disabled = false; b.textContent = 'جستجوی عکس محصول'; fail(e); }); }; loop(); };
  if (bk === 'exercises') wireGifCard();
  fetchPage();
};
/* ---------- گیف‌های جدید: تطبیق پوشهٔ درایو با بانک حرکات ---------- */
function gifCard() {
  return '<div class="card"><h3>گیف‌های جدید حرکات</h3>' +
    '<p class="sub" style="color:var(--mute)">لینک پوشهٔ Google Drive گیف‌های جدید را بده. هر فایل با «نام حرکت» تطبیق می‌شود؛ گیف جدید جای گیف قدیمی را می‌گیرد و اگر گیفی حرکتش در بانک نبود، خودِ حرکت ساخته می‌شود.</p>' +
    '<div class="bar"><input id="gifFolder" class="ltr" placeholder="https://drive.google.com/drive/folders/…  (یا نام پوشه)">' +
    '<button class="btn sec sm" id="gifStat">وضعیت گیف‌ها</button><button class="btn sec sm" id="gifDry">پیش‌نمایش تطبیق</button>' +
    '<button class="btn sm" id="gifRun">تطبیق گیف‌های جدید</button></div>' +
    '<div class="log" id="gifLog" style="display:none"></div></div>';
}
function wireGifCard() {
  var txt = function (m) { var el = $('gifLog'); if (!el) return; el.style.display = 'block'; el.textContent = m; };
  var folder = function () { return ($('gifFolder').value || '').trim(); };
  var busy = function (b, on) { if (b) b.disabled = on; };
  $('gifStat').onclick = function () {
    busy(this, true); txt('وضعیت…');
    call('sfAdminGifStatus').then(function (s) {
      txt('پوشهٔ گیف: ' + (s.folder || '—') + '\n' +
        'کل حرکات: ' + fa(s.total) + '\n' +
        'با گیف جدید: ' + fa(s.newGif) + '\n' +
        'فقط گیف قدیمی: ' + fa(s.oldOnly) + '\n' +
        'بدون گیف: ' + fa(s.noGif));
    }).catch(function (e) { txt(e.message); }).then(function () { busy($('gifStat'), false); });
  };
  var run = function (dry) {
    txt(dry ? 'در حال بررسی پوشه…' : 'در حال تطبیق… (ممکن است چند ثانیه طول بکشد)');
    call('sfAdminGifSync', folder(), !!dry).then(function (r) {
      var out = 'پوشه: ' + (r.folder || '—') + '\n' + 'فایل‌ها: ' + fa(r.files) + '\n' + 'تطبیق‌شده: ' + fa(r.matched) + '\n' + 'حرکت تازه: ' + fa(r.created) + '\n';
      if ((r.createdNames || []).length) out += 'حرکات تازه: ' + r.createdNames.join('، ') + '\n';
      if ((r.skipped || []).length) out += 'ردشده: ' + r.skipped.map(function (x) { return x.name + ' (' + x.reason + ')'; }).join('، ');
      txt(out);
      if (!dry) { toast('تطبیق انجام شد ✅'); render(); }
    }).catch(function (e) { txt(e.message); });
  };
  $('gifDry').onclick = function () { run(true); };
  $('gifRun').onclick = function () { if (!confirm('گیف‌های پوشه با بانک تطبیق داده شوند؟ گیف جدید جای گیف قدیمی می‌نشیند و حرکت‌های بی‌حرکت ساخته می‌شوند.')) return; run(false); };
};
function card(bk, o) {
  var sc = S.banks[bk], meta = '';
  var photoClass = bk === 'foods' ? 'food' : ((bk === 'supps' || bk === 'minerals') ? 'product' : '');
  if (bk === 'exercises') meta = '<small>' + esc(o.MuscleGroup) + ' · ' + esc(o.Equipment) + ' · ' + esc(o.Level) + '</small>';
  if (bk === 'foods') meta = '<div class="mac"><span>' + fa(o.Kcal100) + ' kcal</span><span>پ ' + fa(o.Protein100) + '</span><span>ک ' + fa(o.Carb100) + '</span><span>چ ' + fa(o.Fat100) + '</span><span>ف ' + fa(o.Fiber100) + '</span></div><small>در 100 گرم · ' + esc(o.Category) + '</small>';
  if (bk === 'supps') meta = '<small>' + esc(o.Category) + ' · ' + esc(o.Dose) + '</small>';
  if (bk === 'minerals') meta = '<small>' + esc(o.Type) + ' · نیاز: ' + esc(o.RdaMale) + '</small>';
  return '<div class="it' + (o.Active ? '' : ' off') + '" data-id="' + esc(o[sc.id]) + '"><div class="im ' + photoClass + '">' + mediaHtml(bk, o, false) + '</div><div class="bd"><b>' + esc(o[sc.name]) + '</b><small class="ltr" style="display:block">' + esc(o[sc.sub]) + '</small>' + meta + '</div></div>';
}
function openItem(bk, id) {
  call('adm_bankGet', bk, id).then(function (o) { detailDlg(bk, o); }).catch(fail);
}
function row(label, v) { return v ? '<dt>' + label + '</dt><dd class="pre">' + esc(v) + '</dd>' : ''; }
function ytBlock(o, key) {
  var u = o[key]; if (!u) return '';
  var id = ytId(u);
  return id ? '<div class="media" style="margin-top:8px"><iframe src="https://www.youtube.com/embed/' + id + '" allowfullscreen></iframe></div>' : '<p><a class="btn sec sm" href="' + esc(u) + '" target="_blank" rel="noopener">▶ جستجو/مشاهدهٔ ویدیو در یوتیوب</a></p>';
}
function detailDlg(bk, o) {
  var sc = S.banks[bk], admin = S.user.role === 'admin', h = '', side = '';
  var tone = bk === 'foods' ? 'food' : ((bk === 'supps' || bk === 'minerals') ? 'product' : '');
  var med = '<div class="media ' + tone + '">' + mediaHtml(bk, o, true) + '</div>';
  if (bk === 'exercises') {
    h = '<dl class="dl">' + row('گروه عضلانی', o.MuscleGroup + (o.SubGroup ? ' › ' + o.SubGroup : '')) + row('عضلات فرعی', o.SecondaryMuscle) + row('وسیله', o.Equipment) + row('سطح', o.Level) + row('نوع حرکت', o.MovementType) + row('پیشنهاد', [o.SuggestedSets && (o.SuggestedSets + ' ست'), o.SuggestedReps && (o.SuggestedReps + ' تکرار'), o.RestSec && ('استراحت ' + o.RestSec + ' ثانیه')].filter(Boolean).join(' · ')) + '</dl>' +
      '<div class="sec"><h4>روش اجرا</h4><div class="pre">' + esc(o.Instructions) + '</div><h4>نکات</h4><div class="pre">' + esc(o.Tips) + '</div>' + (o.InstructionsEN ? '<h4>Instructions (EN)</h4><div class="pre ltr">' + esc(o.InstructionsEN) + '</div>' : '') + '</div>';
    side = med + ytBlock(o, 'YouTubeURL');
  } else if (bk === 'foods') {
    h = '<div class="sec"><h4>ارزش غذایی</h4><div class="bar"><label>مقدار (گرم): <input type="number" id="fg" style="width:90px" value="' + esc(o.ServingGrams || 100) + '"></label><span class="pill">' + esc(o.ServingName) + ' = ' + esc(o.ServingGrams) + ' گرم</span></div><div class="grid g4" id="fm"></div>' +
      '<h4>روش‌های پخت و تأثیر روی کالری</h4><div class="wrap"><table id="mt"></table></div><h4>طرز تهیه</h4><div class="pre">' + esc(o.Recipe || '—') + '</div><p>' + String(o.Tags || '').split('،').map(function (t) { return t.trim() ? '<span class="tag">' + esc(t.trim()) + '</span>' : ''; }).join('') + '</p></div>';
    side = med + ytBlock(o, 'VideoURL');
  } else if (bk === 'supps') {
    h = '<dl class="dl">' + row('دسته', o.Category) + row('شکل مصرف', o.Forms) + row('هدف', o.Purpose) + row('دوز معمول', o.Dose) + row('زمان مصرف', o.Timing) + row('همراه غذا', o.WithFood) + row('سطح شواهد', o.Evidence) + '</dl><div class="sec"><h4>فواید</h4><div class="pre">' + esc(o.Benefits) + '</div><h4>احتیاط‌ها</h4><div class="pre">' + esc(o.Cautions) + '</div><h4>تداخل‌ها</h4><div class="pre">' + esc(o.Interactions) + '</div>' + (o.Notes ? '<h4>یادداشت</h4><div class="pre">' + esc(o.Notes) + '</div>' : '') + '</div><p style="color:var(--mute);font-size:12px">اطلاعات راهنما است و جایگزین نظر پزشک نیست.</p>';
    side = med + ytBlock(o, 'VideoURL');
  } else {
    h = '<dl class="dl">' + row('نوع', o.Type) + row('نیاز روزانه (مرد)', o.RdaMale) + row('نیاز روزانه (زن)', o.RdaFemale) + row('حد بالای مجاز', o.UpperLimit) + row('بهترین زمان', o.BestTime) + row('شکل‌های مکمل', o.SuppForms) + '</dl><div class="sec"><h4>نقش در بدن</h4><div class="pre">' + esc(o.Functions) + '</div><h4>علائم کمبود</h4><div class="pre">' + esc(o.Deficiency) + '</div><h4>عوارض زیاده‌روی</h4><div class="pre">' + esc(o.Excess) + '</div><h4>منابع غذایی (در ۱۰۰ گرم)</h4><div>' + String(o.FoodSources || '').split('؛').map(function (t) { return t.trim() ? '<span class="tag">' + esc(t.trim()) + '</span>' : ''; }).join('') + '</div><h4>جذب و تداخل</h4><div class="pre">' + esc([o.Absorption, o.Interactions].filter(function (x) { return x && x !== '—'; }).join('\n')) + '</div></div>';
    side = med + ytBlock(o, 'VideoURL');
  }
  modal('<h3>' + esc(o[sc.name]) + ' <small class="ltr" style="color:var(--mute)">' + esc(o[sc.sub]) + '</small></h3><div class="two"><div>' + h + '</div><div>' + side + '</div></div>' +
    (admin ? '<div class="bar" style="margin-top:14px"><button class="btn" id="ed">ویرایش</button><button class="btn sec" id="tg">' + (o.Active ? 'غیرفعال‌سازی' : 'فعال‌سازی') + '</button><button class="btn bad" id="dl">حذف</button></div>' : ''));
  if (bk === 'foods') {
    var methods = String(o.Methods || '').split(' || ').filter(Boolean).map(function (m) { var p = m.split(' | '); return { n: p[0], f: parseFloat(String(p[1] || '').replace('×', '')) || 1, d: p[2] || '' }; });
    var calc = function () {
      var g = Number($('fg').value) || 0, k = g / 100;
      var v = [['کالری', o.Kcal100 * k, 'kcal'], ['پروتئین', o.Protein100 * k, 'g'], ['کربوهیدرات', o.Carb100 * k, 'g'], ['چربی', o.Fat100 * k, 'g'], ['فیبر', o.Fiber100 * k, 'g']];
      $('fm').innerHTML = v.map(function (x) { return '<div class="card kpi" style="margin:0;padding:10px"><small>' + x[0] + '</small><b>' + (Math.round(x[1] * 10) / 10).toLocaleString('en-US') + '</b><small>' + x[2] + '</small></div>'; }).join('');
      $('mt').innerHTML = '<thead><tr><th>روش</th><th>کالری تقریبی</th><th>توضیح</th></tr></thead><tbody>' + (methods.length ? methods.map(function (m) { return '<tr><td>' + esc(m.n) + '</td><td>' + fa(Math.round(o.Kcal100 * k * m.f)) + ' <small style="color:var(--mute)">(×' + m.f + ')</small></td><td>' + esc(m.d) + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="empty">روشی ثبت نشده.</td></tr>') + '</tbody>';
    };
    $('fg').oninput = calc; calc();
  }
  if (admin) {
    $('ed').onclick = function () { editDlg(bk, o); };
    $('tg').onclick = function () { call('adm_bankSetActive', bk, o[sc.id], !o.Active).then(function () { toast('انجام شد.'); closeModal(); render(); }).catch(fail); };
    $('dl').onclick = function () { if (!confirm('برای همیشه حذف شود؟ (بهتر است غیرفعال کنید)')) return; call('adm_bankDelete', bk, o[sc.id]).then(function () { toast('حذف شد.'); closeModal(); render(); }).catch(fail); };
  }
}
function editDlg(bk, o) {
  var sc = S.banks[bk], groups = {}, order = [];
  sc.fields.forEach(function (f) { if (!groups[f.g]) { groups[f.g] = []; order.push(f.g); } groups[f.g].push(f); });
  var inp = function (f) {
    var v = o[f.k] == null ? '' : o[f.k], full = f.type === 'area' ? ' full' : '';
    var ctl = f.type === 'area' ? '<textarea rows="4" data-k="' + f.k + '">' + esc(v) + '</textarea>' :
      f.type === 'select' ? '<select data-k="' + f.k + '">' + f.options.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>' :
      '<input data-k="' + f.k + '" ' + (f.type === 'num' ? 'type="number" step="any"' : '') + ' class="' + (f.type === 'url' || f.type === 'img' ? 'ltr' : '') + '" value="' + esc(v) + '">';
    return '<div class="' + full + '"><label>' + esc(f.label) + '</label>' + ctl + (f.type === 'img' && v ? '<img class="pv" src="' + esc(v) + '" onerror="this.style.display=\'none\'" alt="">' : '') + '</div>';
  };
  modal('<h3>' + (o[sc.id] ? 'ویرایش: ' + esc(o[sc.name]) : 'افزودن به ' + esc(sc.title)) + '</h3>' + order.map(function (g) { return '<div class="sec"><h4>' + esc(g) + '</h4><div class="fg">' + groups[g].map(inp).join('') + '</div></div>'; }).join('') +
    '<div class="bar" style="margin-top:14px"><button class="btn" id="sv">ذخیره</button></div>');
  $('sv').onclick = function () {
    var item = {}; item[sc.id] = o[sc.id] || ''; item.Active = o.Active !== false;
    document.querySelectorAll('.dlg [data-k]').forEach(function (e) { item[e.getAttribute('data-k')] = e.value; });
    this.disabled = true;
    call('adm_bankSave', bk, item).then(function () { toast('ذخیره شد ✅'); closeModal(); render(); }).catch(function (e) { $('sv').disabled = false; fail(e); });
  };
}
function modal(h) { closeModal(); var d = document.createElement('div'); d.className = 'ov'; d.id = 'ov'; d.innerHTML = '<div class="dlg"><button class="btn sec sm x" id="mx">✕</button>' + h + '</div>'; document.body.appendChild(d); $('mx').onclick = closeModal; d.onclick = function (e) { if (e.target === d) closeModal(); }; }
function closeModal() { var d = $('ov'); if (d) d.remove(); }

/* ---------- مدل‌های رژیم و روش‌های تمرینی ---------- */
/* ---------------------------------------------------------------------------
 * کتابخانهٔ گیف‌ها (ExerciseGymGifsDB) — منبع اصلی گیف حرکات
 * ------------------------------------------------------------------------ */
/* ---------- جستجوی حرکت + افزودن به برنامهٔ شاگرد ---------- */
R['bank.moves'] = function () {
  var MV = { q: '', group: '', equip: '', level: '', page: 1, per: 48, items: [], total: 0, busy: false };

  var CSS = '<style>' +
    '.mvbar{display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:0 0 12px}' +
    '.mvbar>div{min-width:150px}.mvbar .wide{flex:1;min-width:240px}' +
    '.mvbar input,.mvbar select{width:100%}' +
    '.mvgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:12px;margin-top:10px}' +
    '.mvcard{border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;background:var(--s2)}' +
    '.mvthumb{aspect-ratio:1/1;background:#0b0e13;display:grid;place-items:center;overflow:hidden}' +
    '.mvthumb img{width:100%;height:100%;object-fit:cover;display:block}' +
    '.mvbody{padding:8px 10px 10px;display:flex;flex-direction:column;gap:6px;flex:1}' +
    '.mvbody b{font-size:13px;line-height:1.5}' +
    '.mvbody .en{font-size:11px;color:var(--mute);direction:ltr;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.mvchips{display:flex;gap:4px;flex-wrap:wrap}' +
    '.mvchips span{font-size:10px;padding:2px 6px;border:1px solid var(--line);border-radius:999px;color:var(--mute)}' +
    '.mvbtn{margin-top:auto}' +
    '.mvpick{display:grid;grid-template-columns:96px 1fr;gap:10px;align-items:start;margin:0 0 12px}' +
    '.mvpick img{width:96px;height:96px;object-fit:cover;border-radius:12px;background:#0b0e13}' +
    '</style>';

  view(CSS +
    '<div class="hero-band"><p class="hb-sec">MOVE FINDER · 1323 MOVES</p>' +
    '<h2>جستجوی حرکت و افزودن به برنامهٔ شاگرد</h2>' +
    '<p>روی 1323 حرکت جستجو کن (فارسی یا انگلیسی، عضله، وسیله)، پیش‌نمایش WebP را ببین و همان حرکت را با ست و تکرار دلخواه به یک روز از برنامهٔ شاگرد اضافه کن.</p></div>' +
    '<div class="card"><div class="mvbar">' +
    '<div class="wide"><label>جستجو</label><input id="mvq" placeholder="مثلاً: لت، سرشانه، lat pulldown، دمبل"></div>' +
    '<div><label>گروه عضلانی</label><select id="mvg"><option value="">همه</option></select></div>' +
    '<div><label>وسیله</label><select id="mve"><option value="">همه</option></select></div>' +
    '<div><label>سطح</label><select id="mvl"><option value="">همه</option></select></div>' +
    '</div>' +
    '<div class="bar" style="justify-content:space-between"><span id="mvcount" class="sub">در حال بارگذاری…</span>' +
    '<button class="btn sec sm" id="mvreset">پاک کردن فیلترها</button></div>' +
    '<div class="mvgrid" id="mvgrid"><div class="empty">در حال خواندن کتابخانه…</div></div>' +
    '<div class="bar" style="justify-content:center;margin-top:12px"><button class="btn sec" id="mvmore" style="display:none">نمایش بیشتر</button></div>' +
    '</div>');

  function card(it) {
    return '<div class="mvcard"><div class="mvthumb"><img loading="lazy" decoding="async" src="' + esc(it.gif) + '" alt="' + esc(it.fa) + '"></div>' +
      '<div class="mvbody"><b>' + esc(it.fa) + '</b><small class="en">' + esc(it.en) + '</small>' +
      '<div class="mvchips"><span>' + esc(it.group) + '</span><span>' + esc(it.equip) + '</span><span>' + esc(it.level) + '</span></div>' +
      '<button class="btn sm mvbtn" data-add="' + esc(it.id) + '">افزودن به برنامه</button></div></div>';
  }

  function bindAdd() {
    document.querySelectorAll('#mvgrid [data-add]').forEach(function (b) {
      if (b.getAttribute('data-bound')) return;
      b.setAttribute('data-bound', '1');
      b.onclick = function () { openAssign(b.getAttribute('data-add')); };
    });
  }

  function load(more) {
    if (MV.busy) return;
    MV.busy = true;
    if (!more) { MV.page = 1; MV.items = []; $('mvgrid').innerHTML = '<div class="empty">در جستجو…</div>'; }
    call('sfAdminLibSearch', { q: MV.q, group: MV.group, equip: MV.equip, level: MV.level, page: MV.page, per: MV.per })
      .then(function (r) {
        MV.busy = false;
        MV.total = r.total;
        var html = (r.items || []).map(card).join('');
        if (more) $('mvgrid').insertAdjacentHTML('beforeend', html);
        else $('mvgrid').innerHTML = html || '<div class="empty">چیزی پیدا نشد؛ عبارت دیگری امتحان کن.</div>';
        MV.items = MV.items.concat(r.items || []);
        $('mvcount').textContent = fa(r.total) + ' حرکت · نمایش ' + fa(MV.items.length);
        $('mvmore').style.display = r.hasMore ? '' : 'none';
        bindAdd();
      })
      .catch(function (e) { MV.busy = false; fail(e); });
  }

  function daysFor(planId) {
    var dsel = $('a_day');
    dsel.innerHTML = '<option value="">در حال خواندن روزها…</option>';
    call('sfAdminPlanDays', planId).then(function (r) {
      var opts = (r.days || []).map(function (d) {
        return '<option value="' + d.dayNo + '">' + esc(d.title) + ' · ' + fa(d.exercises) + ' حرکت</option>';
      }).join('');
      dsel.innerHTML = (opts || '<option value="1">روز 1 (خالی)</option>') + '<option value="new">+ روز جدید</option>';
      $('a_newday').value = r.nextDay || 1;
      dsel.onchange = function () { $('a_newday').disabled = dsel.value !== 'new'; };
      $('a_newday').disabled = dsel.value !== 'new';
    }).catch(function (e) { dsel.innerHTML = '<option value="1">روز 1</option>'; fail(e); });
  }

  function openAssign(id) {
    var it = MV.items.filter(function (x) { return x.id === id; })[0] || {};
    modal('<h3>افزودن حرکت به برنامه</h3>' +
      '<div class="mvpick"><img src="' + esc(it.gif || '') + '" alt=""><div><b>' + esc(it.fa || '') + '</b>' +
      '<div class="sub">' + esc(it.group || '') + ' · ' + esc(it.equip || '') + ' · ' + esc(it.level || '') + '</div></div></div>' +
      '<div class="fg">' +
      '<div class="full"><label>برنامهٔ شاگرد</label><select id="a_plan"><option value="">در حال خواندن…</option></select></div>' +
      '<div><label>روز</label><select id="a_day"><option value="1">روز 1</option></select></div>' +
      '<div><label>شمارهٔ روز جدید</label><input id="a_newday" type="number" min="1" max="14" value="1" disabled></div>' +
      '<div><label>ست</label><input id="a_sets" type="number" min="1" max="12" value="' + (Number(it.sets) || 3) + '"></div>' +
      '<div><label>تکرار</label><input id="a_reps" value="' + esc(it.reps || '8-12') + '"></div>' +
      '<div><label>استراحت (ثانیه)</label><input id="a_rest" type="number" min="0" max="900" value="' + (Number(it.rest) || 75) + '"></div>' +
      '<div><label>وزنه (اختیاری)</label><input id="a_w" placeholder="مثلاً 12"></div>' +
      '</div><p><button class="btn" id="a_go">افزودن به برنامه</button></p>');

    call('sfAdminListPlans').then(function (rows) {
      var plans = (rows || []).filter(function (p) { return !p.archived; });
      $('a_plan').innerHTML = plans.length ? plans.map(function (p) {
        return '<option value="' + esc(p.planId) + '">' + esc(p.username) + ' — ' + esc(p.planName) + (p.active ? '' : ' (غیرفعال)') + '</option>';
      }).join('') : '<option value="">هیچ برنامه‌ای ساخته نشده</option>';
      if (plans.length) daysFor(plans[0].planId);
      $('a_plan').onchange = function () { if (this.value) daysFor(this.value); };
    }).catch(fail);

    $('a_go').onclick = function () {
      var planId = $('a_plan').value;
      if (!planId) { toast('اول یک برنامه برای شاگرد بساز.', true); return; }
      var dv = $('a_day').value;
      var dayNo = dv === 'new' ? Number($('a_newday').value || 1) : Number(dv || 1);
      var btn = this;
      btn.disabled = true;
      call('sfAdminLibAddToPlan', {
        planId: planId, exerciseId: id, dayNo: dayNo,
        sets: Number($('a_sets').value || 3), reps: $('a_reps').value || '',
        restSec: Number($('a_rest').value || 0), weight: $('a_w').value || ''
      }).then(function (r) {
        closeModal();
        toast('«' + r.exerciseName + '» به «' + r.planName + '» روز ' + fa(r.dayNo) + ' اضافه شد ✅');
      }).catch(function (e) { btn.disabled = false; fail(e); });
    };
  }

  call('sfAdminLibFacets').then(function (f) {
    var fill = function (id, rows) {
      $(id).innerHTML = '<option value="">همه</option>' + (rows || []).map(function (x) {
        return '<option value="' + esc(x.key) + '">' + esc(x.key) + ' (' + fa(x.count) + ')</option>';
      }).join('');
    };
    fill('mvg', f.groups); fill('mve', f.equip); fill('mvl', f.levels);
  }).catch(function () {});

  var deb;
  $('mvq').oninput = function () { var v = this.value; clearTimeout(deb); deb = setTimeout(function () { MV.q = v; load(false); }, 320); };
  $('mvg').onchange = function () { MV.group = this.value; load(false); };
  $('mve').onchange = function () { MV.equip = this.value; load(false); };
  $('mvl').onchange = function () { MV.level = this.value; load(false); };
  $('mvreset').onclick = function () {
    MV.q = MV.group = MV.equip = MV.level = '';
    $('mvq').value = ''; $('mvg').value = ''; $('mve').value = ''; $('mvl').value = '';
    load(false);
  };
  $('mvmore').onclick = function () { MV.page++; load(true); };

  load(false);
};

R['bank.library'] = function () {
  var busy = false;
  view('<div class="hero-band"><p class="hb-sec">EXERCISE GIF LIBRARY · 1323 MOVES</p>' +
    '<h2>کتابخانهٔ 1323 حرکتی با گیف</h2>' +
    '<p>منبع اصلی گیف‌ها همین کتابخانه است و گیف‌های قبلی هر حرکت به‌عنوان پشتیبان می‌مانند؛ اگر گیف کتابخانه لود نشود، همان گیف قدیمی نمایش داده می‌شود. هر حرکت با نام فارسی/انگلیسی، گروه عضلانی، تجهیزات، ست و تکرار پیشنهادی، لینک یوتیوب و لینک گیف وارد شیت می‌شود.</p>' +
    '<div class="bar"><button class="btn" id="libImp">افزودن / به‌روزرسانی کتابخانه در شیت</button>' +
    '<button class="btn sec" id="libDl">دانلود گیف‌ها به درایو (دسته‌ای)</button>' +
    '<button class="btn sec" id="libShare">بازگرداندن دسترسی فایل‌ها</button>' +
    '<button class="btn sec" id="libRefresh">به‌روزرسانی وضعیت</button></div></div>' +
    '<div class="card" id="libStat"><div class="empty">در حال خواندن وضعیت…</div></div>' +
    '<div class="card"><div class="section-title"><h3>دیتابیس غذا / مکمل / ویتامین</h3><span class="pill">با تصویر</span></div>' +
    '<p class="sub" style="margin:0 0 10px">بانک‌های غذا، مکمل و ویتامین را بدون ردیف تکراری به‌روز می‌کند؛ بعد عکس جلوی بستهٔ محصول را جستجو می‌کند و منبع و مجوز هر عکس را در شیت نگه می‌دارد.</p>' +
    '<div class="bar"><button class="btn" id="catSeed">پر کردن بانک‌ها + تصویرها</button></div>' +
    '<pre id="catLog" style="white-space:pre-wrap;font-size:12px;font-family:inherit;margin-top:10px;color:var(--muted)"></pre></div>' +
    '<div class="card" id="libLogCard" style="display:none"><div class="section-title"><h3>گزارش</h3></div>' +
    '<pre id="libLogBody" style="white-space:pre-wrap;font-size:12px;font-family:inherit;max-height:320px;overflow:auto"></pre></div>');

  function log(m) {
    $('libLogCard').style.display = '';
    var b = $('libLogBody');
    b.textContent += m + '\n';
    b.scrollTop = b.scrollHeight;
  }
  function tile(label, val, hint) {
    return '<div style="border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:120px;flex:1">' +
      '<div style="font-size:22px;font-weight:800">' + fa(val) + '</div>' +
      '<div style="font-size:12px;color:var(--muted)">' + esc(label) + '</div>' +
      (hint ? '<div style="font-size:11px;color:var(--muted)">' + esc(hint) + '</div>' : '') + '</div>';
  }
  function paint(st) {
    $('libStat').innerHTML = '<div class="section-title"><h3>وضعیت کتابخانه ' + esc(st.version || '') + '</h3>' +
      '<span class="pill">' + fa(st.bankTotal) + ' حرکت در شیت</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      tile('حرکت در کتابخانه', st.total) +
      tile('وارد شیت شده', st.inBank + st.matched, 'شامل ' + fa(st.matched) + ' تطبیق با حرکات قبلی') +
      tile('گیف در درایو', st.inDrive, 'بدون وابستگی به اینترنت بیرونی') +
      tile('فقط لینک CDN', st.cdnOnly, 'با «دانلود به درایو» منتقل می‌شود') +
      tile('هنوز وارد نشده', st.missing) +
      '</div>' +
      '<p class="sub" style="margin:10px 0 0">پوشهٔ درایو: <span class="ltr">' + esc(st.folder || '') + '</span> — گیف‌ها فقط یک‌بار دانلود می‌شوند و دوباره دانلود نمی‌شوند.</p>';
  }
  function refresh() {
    return call('sfAdminLibStatus').then(paint).catch(fail);
  }

  $('libRefresh').onclick = function () { refresh(); };

  $('libImp').onclick = function () {
    if (busy) return;
    if (!confirm('کتابخانه در شیت اضافه و به‌روز شود؟ هیچ حرکت یا گیف قبلی‌ای پاک نمی‌شود.')) return;
    busy = true; this.disabled = true;
    log('— شروع افزودن کتابخانه به شیت…');
    call('sfAdminLibImport').then(function (r) {
      log('حرکت تازه: ' + fa(r.added) + ' | گیف جدید روی حرکات موجود: ' + fa(r.gifFilled) +
        ' | دست‌نخورده (گیف درایو داشتند): ' + fa(r.kept) + ' | یوتیوب پر شد: ' + fa(r.youtubeFilled));
      log('جمع کتابخانه: ' + fa(r.total) + ' | در شیت: ' + fa(r.total - r.missing) + ' | باقی‌مانده: ' + fa(r.missing) + ' | کل ردیف‌های بانک: ' + fa(r.bankTotal || 0));
      toast('کتابخانه وارد شیت شد');
      return refresh();
    }).catch(function (e) { fail(e); log('خطا: ' + ((e && e.message) || e)); })
      .then(function () { busy = false; $('libImp').disabled = false; });
  };

  $('libDl').onclick = function () {
    if (busy) return;
    busy = true; this.disabled = true;
    var rounds = 0;
    var step = function () {
      if (rounds++ >= 60) { log('برای ادامه دوباره دکمه را بزنید.'); busy = false; $('libDl').disabled = false; return; }
      log('— دستهٔ ' + fa(rounds) + ': در حال دانلود…');
      call('sfAdminLibDownload').then(function (r) {
        log('ذخیره‌شده در این دسته: ' + fa(r.saved) + ' | ناموفق: ' + fa(r.failed) + ' | باقی‌مانده: ' + fa(r.remaining));
        (r.errors || []).forEach(function (e) { log('  • ' + e); });
        if (r.remaining > 0 && r.processed > 0) { step(); return; }
        toast('دانلود گیف‌ها تمام شد');
        busy = false; $('libDl').disabled = false;
        return refresh();
      }).catch(function (e) { fail(e); log('خطا: ' + ((e && e.message) || e)); busy = false; $('libDl').disabled = false; });
    };
    step();
  };

  $('libShare').onclick = function () {
    if (busy) return;
    busy = true; this.disabled = true;
    var rounds = 0;
    var step = function () {
      if (rounds++ >= 6) { log('برای ادامه دوباره دکمه را بزنید.'); busy = false; $('libShare').disabled = false; return; }
      call('sfAdminLibReshare').then(function (r) {
        log('دسترسی: ' + fa(r.shared) + ' فایل باز شد | ناموفق: ' + fa(r.failed) + ' | باقی‌مانده: ' + fa(r.left) + ' | حالت: ' + r.mode);
        (r.errors || []).forEach(function (e) { log('  • ' + e); });
        if (r.left > 0) { step(); return; }
        toast('دسترسی فایل‌های گیف بررسی و بازگردانده شد');
        busy = false; $('libShare').disabled = false;
      }).catch(function (e) { fail(e); log('خطا: ' + ((e && e.message) || e)); busy = false; $('libShare').disabled = false; });
    };
    step();
  };

  $('catSeed').onclick = function () {
    var btn = this, log = $('catLog');
    if (btn.disabled) return;
    btn.disabled = true; log.textContent = 'در حال نوشتن در شیت…';
    call('sfAdminCatalogSeed').then(function (r) {
      log.innerHTML = 'غذا: +' + fa(r.foods) + ' | مکمل: +' + fa(r.supps) + ' | ویتامین: +' + fa(r.mins) +
        ' | مدل رژیم: +' + fa(r.models) + ' | تصویر پر شد: ' + fa(r.images) +
        (r.foodError || r.suppError || r.minError || r.modelError || r.imageError
          ? '\nخطا: ' + [r.foodError, r.suppError, r.minError, r.modelError, r.imageError].filter(Boolean).join(' / ') : '');
      var banks = ['foods', 'supps', 'minerals'], sums = { found: 0, unmatched: 0 };
      function nextBank(i) {
        if (i >= banks.length) {
          log.textContent += '\nعکس محصول ثبت شد: ' + fa(sums.found) + ' | تصویر مناسب پیدا نشد: ' + fa(sums.unmatched);
          toast('بانک و عکس‌های محصولات بررسی شد'); btn.disabled = false; return;
        }
        function batch() {
          call('adm_mediaFill', banks[i], 15).then(function (m) {
            sums.found += Number(m.found) || 0; sums.unmatched += Number(m.unmatched) || 0;
            log.textContent = log.textContent.split('\nعکس محصول ثبت شد:')[0] + '\nدر حال یافتن عکس محصول: ' + banks[i] + ' · ' + fa(sums.found) + ' پیدا شد';
            if (m.remaining > 0 && m.tried > 0) batch(); else nextBank(i + 1);
          }).catch(function (e) { log.textContent += '\nخطای جستجوی ' + banks[i] + ': ' + ((e && e.message) || e); nextBank(i + 1); });
        }
        batch();
      }
      nextBank(0);
    }).catch(function (e) {
      log.textContent = 'خطا: ' + ((e && e.message) || e);
      btn.disabled = false;
    });
  };

  refresh();
};

R['bank.models'] = function () {
  call('sfDietModels').then(function (rows) {
    view('<div class="cards">' + rows.map(function (m) { return '<div class="card"><b>' + esc(m.title) + '</b> <span class="pill">' + esc(m.kind) + '</span><div class="mac"><span>پ ' + fa(m.proteinPct) + '٪</span><span>ک ' + fa(m.carbPct) + '٪</span><span>چ ' + fa(m.fatPct) + '٪</span>' + (m.fastingWindow ? '<span>' + esc(m.fastingWindow) + '</span>' : '') + '</div><p class="pre">' + esc(m.description) + '</p><small class="pre">' + esc(m.rules) + '</small></div>'; }).join('') + '</div>');
  }).catch(fail);
};
R['bank.techniques'] = function () {
  view('<div class="cards">' + S.techniques.map(function (t) { return '<div class="card"><b>' + esc(t.label) + '</b><div class="mac"><span>حداقل ' + fa(t.min) + ' حرکت</span><span>حداکثر ' + fa(t.max) + ' حرکت</span></div><p>' + esc(t.desc) + '</p></div>'; }).join('') + '</div>');
};

/* ---------- اعتبار و اشتراک یکپارچه ---------- */
R['finance.membership'] = function () {
  call('sf3AdminOverview').then(function (o) {
    var status = { active: 'فعال', grace: 'مهلت تمدید', none: 'بدون اشتراک', expired: 'منقضی' };
    var roleName = { user: 'شاگرد', coach: 'مربی', admin: 'ادمین' };
    var pkgName = function (id) { var p = (o.packages || []).filter(function (x) { return x.id === id; })[0]; return p ? p.name : '—'; };
    var users = plansTable(o.subscriptionRows || [], [
      ['کاربر', function (r) { return '<span class="ltr">' + esc(r.username) + '</span>'; }],
      ['نقش', function (r) { return esc(roleName[r.role] || r.role); }],
      ['بستهٔ فعال', function (r) { return esc(pkgName(r.packageId)); }],
      ['وضعیت', function (r) { return '<span class="pill ' + (r.status === 'active' ? 'ok' : (r.status === 'none' ? '' : 'warn')) + '">' + esc(status[r.status] || r.status) + '</span>'; }],
      ['اعتبار باقی‌مانده', function (r) { return r.status === 'none' ? '—' : fa(r.daysLeft) + ' روز'; }],
      ['پایان اشتراک', function (r) { return esc(r.endDate || '—'); }]
    ], function (r) { return '<button class="btn sec sm" data-renew="' + esc(r.username) + '">تمدید</button>'; });
    var pending = plansTable(o.pending || [], [
      ['کاربر', function (r) { return '<span class="ltr">' + esc(r.username) + '</span>'; }],
      ['بسته', function (r) { return esc(pkgName(r.packageId)); }],
      ['مبلغ', function (r) { return fa(r.final || r.amount); }],
      ['تاریخ', function (r) { return esc(String(r.createdAt || '').slice(0, 10)); }],
      ['رسید', function (r) { return r.receipt ? '<a href="' + esc(r.receipt) + '" target="_blank" rel="noopener">مشاهده</a>' : '—'; }]
    ], function (r) { return '<button class="btn sm" data-pay-ok="' + esc(r.payId) + '">تأیید</button> <button class="btn bad sm" data-pay-no="' + esc(r.payId) + '">رد</button>'; });
    var packages = plansTable(o.packages || [], [
      ['بسته', function (p) { return '<b>' + esc(p.name) + '</b>'; }],
      ['مدت', function (p) { return fa(p.days) + ' روز'; }],
      ['قیمت', function (p) { return fa(p.price); }],
      ['وضعیت', function (p) { return pill(p.active); }]
    ], function (p) { return '<button class="btn sec sm" data-package-edit="' + esc(p.id) + '">ویرایش</button>'; });
    view('<div class="hero-band"><p class="hb-sec">MEMBERSHIP · CREDIT</p><h2>اعتبار و اشتراک</h2><p>وضعیت شاگردها، پرداخت‌ها و بسته‌ها در یک نمای یکپارچه؛ اقدام‌ها کنار همان ردیف انجام می‌شوند.</p></div>' +
      '<div class="cards"><div class="card kpi"><small>اشتراک فعال</small><b>' + fa(o.stats.active) + '</b></div><div class="card kpi"><small>نیازمند پیگیری</small><b>' + fa(o.stats.expiring) + '</b></div><div class="card kpi"><small>بدون اشتراک</small><b>' + fa(o.stats.none) + '</b></div><div class="card kpi"><small>پرداخت در انتظار</small><b>' + fa(o.stats.pending) + '</b></div></div>' +
      '<div class="card"><div class="bar"><h3>حساب شاگردها</h3><input id="memberSearch" placeholder="جستجوی کاربر یا بسته"></div><div id="memberRows">' + users + '</div></div>' +
      '<div class="card"><h3>پرداخت‌های نیازمند بررسی</h3>' + (o.pending && o.pending.length ? pending : '<div class="note ok">پرداخت در انتظاری وجود ندارد.</div>') + '</div>' +
      '<div class="card"><div class="bar"><h3>بسته‌های اشتراک</h3><button class="btn" id="memberAddPackage">+ بستهٔ جدید</button></div>' + packages + '</div>' +
      '<div class="card"><h3>روش پرداخت</h3><div class="fg"><div><label>شمارهٔ کارت</label><input id="memberCardNo" class="ltr" value="' + esc((o.card || {}).number || '') + '"></div><div><label>نام صاحب کارت</label><input id="memberCardHolder" value="' + esc((o.card || {}).holder || '') + '"></div></div><p><button class="btn sec" id="memberCardSave">ذخیرهٔ اطلاعات پرداخت</button></p></div>');
    document.querySelectorAll('[data-renew]').forEach(function (b) { b.onclick = function () { var days = Number(prompt('چند روز تمدید شود؟', '30') || 0); if (!days) return; call('sf3AdminGrantSub', b.getAttribute('data-renew'), days, 'MANUAL').then(function (r) { toast('تمدید شد تا ' + r.endDate); render(); }).catch(fail); }; });
    document.querySelectorAll('[data-pay-ok]').forEach(function (b) { b.onclick = function () { call('sf3AdminDecide', b.getAttribute('data-pay-ok'), true, '').then(function () { toast('پرداخت تأیید شد'); render(); }).catch(fail); }; });
    document.querySelectorAll('[data-pay-no]').forEach(function (b) { b.onclick = function () { var reason = prompt('دلیل رد (اختیاری):'); if (reason === null) return; call('sf3AdminDecide', b.getAttribute('data-pay-no'), false, reason).then(function () { render(); }).catch(fail); }; });
    var packageEdit = function (p) { p = p || {}; modal('<h3>بستهٔ اشتراک</h3><div class="fg"><div><label>نام</label><input id="p_n" value="' + esc(p.name || '') + '"></div><div><label>مدت (روز)</label><input id="p_d" type="number" value="' + esc(p.days || 30) + '"></div><div><label>قیمت</label><input id="p_p" type="number" value="' + esc(p.price || 0) + '"></div><div><label>نشان</label><input id="p_b" value="' + esc(p.badge || '') + '"></div><div class="full"><label>ویژگی‌ها</label><textarea id="p_f" rows="3">' + esc(p.features || '') + '</textarea></div></div><p><button class="btn" id="p_s">ذخیره</button></p>'); $('p_s').onclick = function () { call('sf3AdminSavePackage', { id: p.id || '', name: $('p_n').value, days: $('p_d').value, price: $('p_p').value, badge: $('p_b').value, features: $('p_f').value, active: p.active !== false }).then(function () { closeModal(); render(); }).catch(fail); }; };
    $('memberAddPackage').onclick = function () { packageEdit(); };
    document.querySelectorAll('[data-package-edit]').forEach(function (b) { b.onclick = function () { packageEdit((o.packages || []).filter(function (p) { return p.id === b.getAttribute('data-package-edit'); })[0]); }; });
    $('memberCardSave').onclick = function () { call('sf3AdminSetCard', $('memberCardNo').value, $('memberCardHolder').value).then(function () { toast('اطلاعات پرداخت ذخیره شد'); }).catch(fail); };
    $('memberSearch').oninput = function () { var q = this.value.toLowerCase(); document.querySelectorAll('#memberRows table tbody tr').forEach(function (tr) { tr.style.display = !q || tr.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none'; }); };
  }).catch(fail);
};
/* ---------- ارتباط ---------- */
R['comms.alerts'] = function () {
  call('sfCoachAlerts').then(function (rows) {
    view('<div class="card">' + plansTable(rows, [['زمان', function (a) { return esc(String(a.time).slice(0, 16)); }], ['شاگرد', function (a) { return '<span class="ltr">' + esc(a.username) + '</span>'; }], ['برنامه', function (a) { return esc(a.planName); }], ['پیام', function (a) { return esc(a.message); }]], function (a) { return '<button class="btn sec sm" data-x="' + esc(a.id) + '">دیدم</button>'; }) + '</div>');
    document.querySelectorAll('[data-x]').forEach(function (b) { b.onclick = function () { call('sfCoachAlertsDismiss', [b.getAttribute('data-x')]).then(function () { render(); }).catch(fail); }; });
  }).catch(fail);
};
R['comms.chat'] = function () {
  view('<div class="hero-band"><p class="hb-sec">ارتباط مستقیم</p><h2>گفت‌وگو با شاگردها</h2><p>پیام‌های شاگرد و پاسخ مربی را در یک رشته ببین و از همین‌جا جواب بده.</p></div><div class="grid" style="grid-template-columns:minmax(190px,.7fr) minmax(0,1.7fr);align-items:start"><div class="card"><label>شاگرد</label><select id="chat_user"><option>در حال بارگذاری…</option></select><div id="chat_roster" style="margin-top:12px"></div></div><div class="card"><div class="bar"><h3 style="margin:0">گفت‌وگو</h3><button class="btn sec sm" id="chat_reload">تازه‌سازی</button></div><div id="chat_thread" class="chat-thread"></div><label for="chat_text">پاسخ مربی</label><textarea id="chat_text" rows="3" placeholder="پیامت را بنویس…" style="min-height:78px"></textarea><div class="bar"><button class="btn" id="chat_send">ارسال پاسخ</button><small class="sub">پیام به صندوق شاگرد ارسال می‌شود.</small></div></div></div>');
  call('sfCoachBoard').then(function (b) {
    var athletes = b.athletes || [];
    athletes.sort(function (a, c) { return Number(!!c.unread) - Number(!!a.unread) || String(c.lastMsgAt || '').localeCompare(String(a.lastMsgAt || '')); });
    $('chat_user').innerHTML = athletes.map(function (a) { return '<option value="' + esc(a.username) + '">' + esc(a.name || a.username) + (a.unread ? ' · پیام تازه' : '') + '</option>'; }).join('') || '<option value="">شاگردی در دسترس نیست</option>';
    $('chat_roster').innerHTML = athletes.map(function (a) { return '<button class="btn sec sm" data-chat-pick="' + esc(a.username) + '" style="width:100%;margin:3px 0;justify-content:space-between">' + esc(a.name || a.username) + (a.unread ? ' <span class="pill warn">پاسخ‌نداده</span>' : '') + '</button>'; }).join('');
    if (!athletes.length) { $('chat_thread').innerHTML = '<div class="empty">شاگردی برای گفت‌وگو پیدا نشد.</div>'; return; }
    var draw = function () { var u = $('chat_user').value; if (!u) return; $('chat_thread').textContent = 'در حال دریافت…'; call('getMessages', u).then(function (rows) { $('chat_thread').innerHTML = (rows || []).map(function (m) { var mine = String(m.sender || '').toLowerCase() === String(S.user.username).toLowerCase(); return '<div class="chat-bubble ' + (mine ? 'mine' : '') + '"><b>' + esc(m.sender || '') + '</b><div>' + esc(m.text || '') + '</div><small>' + esc(String(m.createdAt || '').replace('T', ' ').slice(0, 16)) + '</small></div>'; }).join('') || '<div class="empty">هنوز گفت‌وگویی نیست.</div>'; $('chat_thread').scrollTop = $('chat_thread').scrollHeight; }).catch(function (e) { $('chat_thread').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; }); };
    $('chat_user').onchange = draw; $('chat_reload').onclick = draw;
    document.querySelectorAll('[data-chat-pick]').forEach(function (x) { x.onclick = function () { $('chat_user').value = x.getAttribute('data-chat-pick'); draw(); }; });
    $('chat_send').onclick = function () { var text = $('chat_text').value.trim(), user = $('chat_user').value; if (!text) { toast('پاسخت را بنویس.', true); return; } var btn = this; btn.disabled = true; call('sendMessage', user, text).then(function () { $('chat_text').value = ''; toast('پاسخ ثبت شد ✅'); draw(); }).catch(fail).then(function () { btn.disabled = false; }); };
    draw();
  }).catch(fail);
};

R['smart.coach'] = function () {
  view('<div class="hero-band"><p class="hb-sec">SAEEDI FIT · مربی هوشمند</p><h2>دستیار تحلیل و برنامه‌ریزی مربی</h2><p>برای طراحی جلسه، انتخاب روش، تفسیر حجم تمرین یا ایدهٔ تغذیه سؤال بپرس. خروجی را پیش از اعمال روی شاگرد بازبینی کن.</p></div><div class="grid" style="grid-template-columns:minmax(0,1.3fr) minmax(240px,.7fr);align-items:start"><div class="card"><label for="coach_ai_q">سؤال مربی</label><textarea id="coach_ai_q" rows="5" placeholder="مثلاً برای عضله‌ای که در ۳ جلسهٔ هفتگی فقط ۶ ست می‌گیرد چه تغییری پیشنهاد می‌کنی؟"></textarea><div class="bar"><button class="btn" id="coach_ai_send">پرسیدن از دستیار</button><button class="btn sec" data-go="plans.generate">ساخت برنامهٔ تمرین</button><button class="btn sec" data-go="plans.diet">ساخت برنامهٔ تغذیه</button></div><div id="coach_ai_answer" class="note">پاسخ در همین‌جا نمایش داده می‌شود.</div></div><div class="card"><h3>ابزارهای هوشمند</h3><div class="dash-quick"><button class="btn sec" data-go="plans.analysis">تحلیل برنامه</button><button class="btn sec" data-go="plans.anatomy">آناتومی بدن</button><button class="btn sec" data-go="smart.ai">تنظیمات AI</button><button class="btn sec" data-go="smart.logs">گزارش‌های AI</button></div><div id="coach_ai_state" class="note" style="margin-top:12px">در حال بررسی سرویس…</div></div></div>');
  document.querySelectorAll('#view [data-go]').forEach(function (a) { a.onclick = function () { go(a.getAttribute('data-go')); }; });
  call('sfAiStatus').then(function (s) { $('coach_ai_state').innerHTML = s.enabled ? '<span class="pill ok">دستیار آماده · ' + fa(s.remaining) + ' از ' + fa(s.limit) + ' پرسش امروز</span>' : '<span class="pill warn">دستیار فعال نیست؛ اتصال Gemini را در تنظیمات AI بررسی کن.</span>'; }).catch(function (e) { $('coach_ai_state').textContent = e.message; });
  $('coach_ai_send').onclick = function () { var q = $('coach_ai_q').value.trim(); if (!q) { toast('سؤالت را بنویس.', true); return; } var b = this; b.disabled = true; $('coach_ai_answer').textContent = 'در حال تحلیل…'; call('sfAiAsk', q).then(function (r) { $('coach_ai_answer').innerHTML = '<b>پاسخ دستیار</b><div style="white-space:pre-wrap;margin-top:7px">' + esc(r.answer || '') + '</div><small>پرسش باقی‌ماندهٔ امروز: ' + fa(r.remaining) + '</small>'; }).catch(function (e) { $('coach_ai_answer').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; }).then(function () { b.disabled = false; }); };
};

R['smart.ai'] = function () {
  view('<div class="hero-band"><p class="hb-sec">مدیریت هوش مصنوعی</p><h2>اتصال و رفتار مربی هوشمند</h2><p>کلید API فقط در تنظیمات امن Apps Script نگهداری می‌شود و در پنل دوباره نمایش داده نمی‌شود. پس از ذخیره، اتصال واقعی آزمایش می‌شود.</p></div><div class="card"><div id="ai_status" class="note">در حال خواندن تنظیمات…</div><div class="fg"><div class="full"><label>کلید Gemini API (برای تعویض؛ خالی = نگه‌داشتن کلید فعلی)</label><input id="ai_key" type="password" autocomplete="new-password" placeholder="کلید را وارد کن؛ برای امنیت بعد از ذخیره پاک می‌شود"></div><div><label>نام مدل (خالی = انتخاب خودکار)</label><input id="ai_model" placeholder="مثل gemini-2.5-flash"></div><div><label>سقف پرسش روزانه</label><input id="ai_limit" type="number" min="1" max="200" value="15"></div><div><label>وضعیت دستیار</label><select id="ai_enabled"><option value="1">فعال</option><option value="0">خاموش</option></select></div><div><label>شخصی‌سازی با هدف و کالری شاگرد</label><select id="ai_context"><option value="0">خاموش (پیشنهادی)</option><option value="1">روشن</option></select></div></div><div class="bar"><button class="btn" id="ai_save">ذخیره و آزمایش اتصال</button><button class="btn sec" data-go="smart.logs">دیدن گزارش‌های AI</button></div><div id="ai_result"></div></div>');
  document.querySelector('[data-go="smart.logs"]').onclick = function () { go('smart.logs'); };
  call('sfAiStatus').then(function (s) { $('ai_status').innerHTML = '<b>' + (s.configured ? 'کلید ثبت شده است' : 'کلید API ثبت نشده') + '</b> · مدل: ' + esc(s.model || 'انتخاب خودکار') + ' · کلید: ' + esc(s.keyTail || '—'); $('ai_model').value = s.model || ''; $('ai_limit').value = s.limit || 15; $('ai_enabled').value = s.on ? '1' : '0'; $('ai_context').value = s.sendContext ? '1' : '0'; }).catch(function (e) { $('ai_status').textContent = e.message; });
  $('ai_save').onclick = function () { var b = this; b.disabled = true; $('ai_result').textContent = 'در حال ذخیره و آزمایش اتصال…'; call('sfAiSaveConfig', { key: $('ai_key').value.trim(), model: $('ai_model').value.trim(), dailyLimit: Number($('ai_limit').value), enabled: $('ai_enabled').value === '1', sendContext: $('ai_context').value === '1' }).then(function (r) { $('ai_key').value = ''; $('ai_result').innerHTML = '<div class="note ok">اتصال آزمایش شد و پاسخ گرفتیم · مدل ' + esc(r.model) + '</div>'; $('ai_status').innerHTML = '<b>دستیار متصل</b> · مدل: ' + esc(r.model) + ' · کلید: ' + esc(r.status.keyTail || '—'); }).catch(function (e) { $('ai_result').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; }).then(function () { b.disabled = false; }); };
};
R['smart.logs'] = function () {
  view('<div class="hero-band"><p class="hb-sec">مدیریت هوش مصنوعی</p><h2>گزارش استفاده و خطاهای دستیار</h2><p>سؤال‌ها و وضعیت درخواست‌های اخیر برای عیب‌یابی اتصال و کیفیت پاسخ.</p></div><div class="card"><button class="btn sec" id="ai_log_reload">به‌روزرسانی</button><div id="ai_log_rows" class="note">در حال بارگیری…</div></div>');
  var load = function () { call('sfAiLogs', 60).then(function (r) { var rows = r.rows || []; $('ai_log_rows').innerHTML = rows.length ? '<div class="wrap"><table><thead><tr><th>زمان</th><th>شاگرد/کاربر</th><th>سؤال</th><th>پاسخ یا خطا</th><th>وضعیت</th></tr></thead><tbody>' + rows.map(function (x) { return '<tr><td>' + esc(String(x.time || '').slice(0, 16)) + '</td><td class="ltr">' + esc(x.user || '') + '</td><td>' + esc(x.q || '') + '</td><td><details><summary>نمایش</summary><div style="white-space:pre-wrap">' + esc(x.a || '') + '</div></details></td><td>' + esc(x.status || '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="note">هنوز استفاده‌ای ثبت نشده است.</div>'; }).catch(function (e) { $('ai_log_rows').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; }); };
  $('ai_log_reload').onclick = load; load();
};
R['comms.telegram'] = function () {
  view('<div class="hero-band"><p class="hb-sec">اتصال و پایش</p><h2>سلامت ربات تلگرام</h2><p>توکن و وب‌هوک به‌صورت فقط‌خواندنی بررسی می‌شوند؛ هیچ پیامی هنگام بازکردن این صفحه ارسال نمی‌شود.</p></div><div id="tgHealth" class="card"><div class="empty">در حال بررسی اتصال امن ربات…</div></div>');
  var draw=function(){call('sfAdminTelegramHealth').then(function(t){
    var status=t.ok?'<span class="pill ok">پاسخ‌گو</span>':(t.configured?'<span class="pill bad">خطای اتصال</span>':'<span class="pill warn">تنظیم نشده</span>');
    var webhook=t.webhookActive?'<span class="pill ok">فعال</span>':'<span class="pill warn">تنظیم نشده</span>';
    var issue=t.error?'<div class="note"><b>خطای بررسی:</b> '+esc(t.error)+'</div>':(t.lastWebhookError?'<div class="note"><b>آخرین خطای وب‌هوک:</b> '+esc(t.lastWebhookError)+'</div>':'<div class="note ok">'+(t.ok?'API تلگرام پاسخ‌گو است.':'توکن سرور برای بررسی سلامت آماده است.')+'</div>');
    var html='<div class="grid g4"><div class="card kpi"><small>اعتبار دسترسی ربات</small><b style="font-size:19px">'+status+'</b></div>'+
      '<div class="card kpi"><small>ربات</small><b style="font-size:19px">'+esc(t.botUsername?'@'+t.botUsername:(t.botName||'—'))+'</b><small>'+esc(t.botName||'نام از تلگرام دریافت نشد')+'</small></div>'+
      '<div class="card kpi"><small>وب‌هوک</small><b style="font-size:19px">'+webhook+'</b></div><div class="card kpi"><small>پیام‌های منتظر پردازش</small><b>'+fa(t.pendingUpdates==null?'—':t.pendingUpdates)+'</b></div></div>'+
      issue+'<div class="health-row"><span>چت ادمین در تنظیمات</span><span class="pill '+(t.adminChat?'ok':'warn')+'">'+(t.adminChat?'ثبت شده':'شناسه ثبت نشده')+'</span></div>'+
      '<div class="bar" style="margin-top:14px"><button class="btn sec" id="tgRefresh">بررسی دوباره</button><button class="btn" id="tt">ارسال پیام آزمایشی</button></div><small class="sub" style="color:var(--mute)">پیام آزمایشی فقط پس از فشردن دکمه ارسال می‌شود.</small>';
    $('tgHealth').innerHTML=html;
    $('tgRefresh').onclick=draw;
    $('tt').onclick=function(){var b=this;b.disabled=true;call('sf3AdminTgTest').then(function(){toast('پیام آزمایشی به چت‌های ثبت‌شده ارسال شد ✅');}).catch(fail).then(function(){b.disabled=false;});};
  }).catch(fail);}; draw();
};

/* ---------- سیستم ---------- */
function logBox(id, v) { $(id).textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
R['system.errors'] = function () {
  view('<div class="hero-band"><p class="hb-sec">SYSTEM · ERROR CENTER</p><h2>گزارش خطاها</h2><p>خطاهای صفحه، سرور و قطع‌ووصلی که برای بررسی ذخیره شده‌اند.</p></div><div class="card"><div class="bar"><input id="errSearch" placeholder="جستجو در خطاها"><button class="btn sec" id="errReload">به‌روزرسانی</button></div><div id="errRows" class="note">در حال خواندن گزارش‌ها…</div></div>');
  var target = $('errRows');
  call('adm_errorsList', 100).then(function (r) {
    var rows = r.rows || [];
    if (!rows.length) { target.innerHTML = '<div class="note ok">هنوز خطایی ثبت نشده است.</div>'; return; }
    target.innerHTML = '<div class="tbl-wrap"><table class="wrap"><thead><tr><th>زمان</th><th>بخش</th><th>کاربر</th><th>عملیات</th><th>پیام</th></tr></thead><tbody>' + rows.map(function (e, i) {
      return '<tr data-error-row="' + i + '"><td class="ltr">' + esc(e.time) + '</td><td>' + esc(e.app) + '</td><td class="ltr">' + esc(e.username) + '</td><td>' + esc(e.action || e.fn) + '</td><td><details><summary>' + esc(e.message) + '</summary><div class="pre">' + esc([e.fn, e.extra, e.url, e.stack].filter(Boolean).join('\n')) + '</div></details></td></tr>';
    }).join('') + '</tbody></table></div><small class="sub">' + fa(rows.length) + ' گزارش اخیر</small>';
    $('errSearch').oninput = function () { var q = this.value.toLowerCase(); document.querySelectorAll('[data-error-row]').forEach(function (tr) { tr.style.display = !q || tr.textContent.toLowerCase().indexOf(q) >= 0 ? '' : 'none'; }); };
  }).catch(function (e) { target.innerHTML = '<div class="note">خواندن گزارش خطا ناموفق بود: ' + esc(e.message) + '</div>'; });
  $('errReload').onclick = function () { render(); };
};

R['system.media'] = function () {
  view('<div class="card"><h3>ابزار رسانهٔ حرکات (دانلود به Google Drive)</h3><div class="bar"><button class="btn sec" id="m1">وضعیت</button><button class="btn sec" id="m2">دانلود تصاویر/گیف</button><button class="btn sec" id="m3">تلاش مجدد خطاها</button><button class="btn sec" id="m4">پر کردن لینک یوتیوب</button></div><div class="log" id="lg">—</div></div>');
  [['m1', 'sfAdminMediaStatus', []], ['m2', 'sfAdminMediaDownload', []], ['m3', 'sfAdminMediaRetry', []], ['m4', 'sfAdminYoutubeFill', [30]]].forEach(function (x) {
    $(x[0]).onclick = function () { var b = this; b.disabled = true; logBox('lg', 'در حال اجرا…'); call.apply(null, [x[1]].concat(x[2])).then(function (r) { logBox('lg', r); }).catch(function (e) { logBox('lg', e.message); }).then(function () { b.disabled = false; }); };
  });
};
R['system.sheets'] = function () {
  view('<div class="card"><button class="btn sec" id="sr">گزارش شیت‌ها</button><div class="log" id="lg" style="margin-top:10px">—</div></div>');
  $('sr').onclick = function () { logBox('lg', 'در حال اجرا…'); call('adminSheetReport').then(function (r) { logBox('lg', r); }).catch(function (e) { logBox('lg', e.message); }); };
};

if (typeof window !== 'undefined') window.onhashchange = function () { var h = location.hash.replace('#/', ''); if (S.token && h && h !== S.route) { S.route = h; shell(); } };
/* گارد محیط: در سرور document وجود ندارد */
if (typeof document !== 'undefined') (function init() {
  var t = load('adm_theme'); document.documentElement.setAttribute('data-theme', t || 'dark');
  /* ورود یک‌بار در اپ شاگردان کافی است: توکن همان نشست (fc_session) این‌جا هم پذیرفته می‌شود */
  S.token = load('adm_token') || load('fc_session');
  if (S.token) boot(); else loginView();
})();

/* ---------- آناتومی برنامه: نقشهٔ بدن + تعادل عضلانی ---------- */
var AN_REGIONS = [
  ['chest', 'سینه'], ['shoulders', 'سرشانه'], ['traps', 'کول'], ['lats', 'زیربغل'], ['back', 'پشت'],
  ['lowerback', 'کمر'], ['biceps', 'جلوبازو'], ['triceps', 'پشتبازو'], ['forearms', 'ساعد'],
  ['abs', 'شکم'], ['obliques', 'پهلو'], ['glutes', 'سرینی'], ['quads', 'چهارسر'], ['hamstrings', 'همسترینگ'], ['calves', 'ساق']
];
function anName(k) { for (var i = 0; i < AN_REGIONS.length; i++) if (AN_REGIONS[i][0] === k) return AN_REGIONS[i][1]; return k; }
function anBodySvg() {
  var P = function (r, d, extra) { return '<path data-r="' + r + '" d="' + d + '" ' + (extra || '') + '></path>'; };
  var front =
    '<circle cx="60" cy="17" r="11" class="an-head"/>' +
    '<rect x="55" y="27" width="10" height="7" rx="3"/>' +
    P('traps', 'M50 36 q10 -5 20 0 l0 6 q-10 -4 -20 0 z') +
    P('shoulders', 'M38 44 q8 -5 14 -2 l-3 12 q-7 -1 -11 -6 z') +
    P('shoulders', 'M82 44 q-8 -5 -14 -2 l3 12 q7 -1 11 -6 z') +
    P('chest', 'M44 46 q16 -6 16 0 l0 18 q-9 3 -16 -2 z') +
    P('chest', 'M76 46 q-16 -6 -16 0 l0 18 q9 3 16 -2 z') +
    P('biceps', 'M34 56 q6 -2 6 3 l-2 16 q-5 1 -6 -3 z') +
    P('biceps', 'M86 56 q-6 -2 -6 3 l2 16 q5 1 6 -3 z') +
    P('forearms', 'M32 78 q5 -2 5 3 l-1 18 q-4 1 -5 -3 z') +
    P('forearms', 'M88 78 q-5 -2 -5 3 l1 18 q4 1 5 -3 z') +
    P('abs', 'M50 66 h20 v30 h-20 z') +
    P('obliques', 'M44 68 q4 -2 5 2 l0 26 q-5 0 -6 -4 z') +
    P('obliques', 'M76 68 q-4 -2 -5 2 l0 26 q5 0 6 -4 z') +
    P('quads', 'M46 100 q6 -3 12 0 l-1 40 q-6 3 -11 0 z') +
    P('quads', 'M74 100 q-6 -3 -12 0 l1 40 q6 3 11 0 z') +
    P('calves', 'M48 145 q5 -3 9 0 l0 26 q-4 4 -9 1 z') +
    P('calves', 'M72 145 q-5 -3 -9 0 l0 26 q4 4 9 1 z');
  var back =
    '<circle cx="60" cy="17" r="11" class="an-head"/>' +
    '<rect x="55" y="27" width="10" height="7" rx="3"/>' +
    P('traps', 'M52 34 q8 -3 16 0 l-2 14 q-6 -3 -12 0 z') +
    P('shoulders', 'M38 44 q8 -5 14 -2 l-4 13 q-7 -1 -10 -6 z') +
    P('shoulders', 'M82 44 q-8 -5 -14 -2 l4 13 q7 -1 10 -6 z') +
    P('lats', 'M44 48 q7 -3 10 2 l-2 24 q-6 -3 -9 -9 z') +
    P('lats', 'M76 48 q-7 -3 -10 2 l2 24 q6 -3 9 -9 z') +
    P('back', 'M54 48 h12 v26 h-12 z') +
    P('triceps', 'M34 56 q6 -2 6 4 l-2 15 q-5 1 -6 -3 z') +
    P('triceps', 'M86 56 q-6 -2 -6 4 l2 15 q5 1 6 -3 z') +
    P('forearms', 'M32 78 q5 -2 5 3 l-1 18 q-4 1 -5 -3 z') +
    P('forearms', 'M88 78 q-5 -2 -5 3 l1 18 q4 1 5 -3 z') +
    P('lowerback', 'M50 76 h20 v18 h-20 z') +
    P('glutes', 'M46 96 q13 -4 13 1 l0 14 q-8 4 -13 -2 z') +
    P('glutes', 'M74 96 q-13 -4 -13 1 l0 14 q8 4 13 -2 z') +
    P('hamstrings', 'M46 114 q6 -3 12 0 l-1 34 q-6 3 -11 0 z') +
    P('hamstrings', 'M74 114 q-6 -3 -12 0 l1 34 q6 3 11 0 z') +
    P('calves', 'M48 152 q5 -3 9 0 l0 24 q-4 4 -9 1 z') +
    P('calves', 'M72 152 q-5 -3 -9 0 l0 24 q4 4 9 1 z');
  return '<div class="an-wrap">' +
    '<div><svg class="an" viewBox="0 0 120 180" role="img" aria-label="نمای جلو">' + front + '</svg><small class="sub">نمای جلو</small></div>' +
    '<div><svg class="an" viewBox="0 0 120 180" role="img" aria-label="نمای پشت">' + back + '</svg><small class="sub">نمای پشت</small></div>' +
    '</div>';
}
function anPaint(host, regions) {
  if (!host) return;
  var max = 1;
  Object.keys(regions || {}).forEach(function (k) { if (regions[k] > max) max = regions[k]; });
  host.querySelectorAll('[data-r]').forEach(function (p) {
    var n = (regions || {})[p.getAttribute('data-r')] || 0;
    p.classList.toggle('on', n > 0);
    p.style.opacity = n ? (0.35 + 0.65 * Math.min(1, n / max)).toFixed(2) : '';
    p.setAttribute('data-n', n || '');
  });
}

R['plans.anatomy'] = function () {
  var st = S.anatomy = S.anatomy || { planId: '', day: 0, data: null };
  view('<div class="hero-band"><p class="hb-sec">ADMIN PANEL · ANATOMY</p><h2>آناتومی برنامه</h2><p>شاگرد را انتخاب کن تا ببینی هر برنامه کدام بخش‌های بدن را درگیر می‌کند و نقطهٔ ضعف کجاست.</p></div>' +
    '<div class="card"><div class="fg">' +
    '<div><label>شاگرد</label><select id="anUser"><option value="">— همه —</option></select></div>' +
    '<div><label>ماه / برنامه</label><select id="anPlan"><option value="">— انتخاب برنامه —</option></select></div>' +
    '</div><div id="anOut"></div></div>');

  var userSel = $('anUser'), planSel = $('anPlan');
  call('adm_usersList').then(function (r) {
    (r.users || []).filter(function (u) { return u.role !== 'admin'; }).forEach(function (u) {
      var o = document.createElement('option'); o.value = u.username; o.textContent = u.username + (u.name ? ' — ' + u.name : ''); userSel.appendChild(o);
    });
    if (st.username) { userSel.value = st.username; }
    loadPlans(st.username || '');
  }).catch(function () { loadPlans(''); });

  function loadPlans(u) {
    st.username = u || '';
    planSel.innerHTML = '<option value="">— انتخاب برنامه —</option>';
    call('sfAdminAnatomyPlans', u || '').then(function (r) {
      (r.plans || []).forEach(function (p) {
        var o = document.createElement('option');
        o.value = p.planId;
        o.textContent = p.planName + (p.month ? ' · ' + p.month : '') + ' · ' + p.username + (p.days ? ' · ' + fa(p.days) + ' روز' : '');
        planSel.appendChild(o);
      });
      if (st.planId) { planSel.value = st.planId; draw(st.planId); }
    }).catch(fail);
  }
  userSel.onchange = function () { st.planId = ''; st.data = null; $('anOut').innerHTML = ''; loadPlans(userSel.value); };
  planSel.onchange = function () { st.planId = planSel.value; draw(planSel.value); };

  function draw(pid) {
    if (!pid) { $('anOut').innerHTML = ''; return; }
    $('anOut').innerHTML = '<div class="note">در حال محاسبه…</div>';
    call('sfAdminPlanAnatomy', pid).then(function (d) {
      st.data = d; st.day = st.day || 0;
      render();
    }).catch(function (e) { $('anOut').innerHTML = '<div class="note">' + esc(e.message) + '</div>'; });
  }

  function render() {
    var d = st.data; if (!d) return;
    var day = Number(st.day) || 0;
    var regions = {}, items = d.items || [];
    var src = day ? ((d.days || []).filter(function (x) { return x.dayNo === day; })[0] || { items: [] }).items : items;
    src.forEach(function (it) { if (it.region) regions[it.region] = (regions[it.region] || 0) + 1; });
    var bal = d.balance || { warnings: [], score: 0 };
    var dayChips = '<button class="btn sec sm' + (day === 0 ? ' on' : '') + '" data-day="0">همه روزها</button>' +
      (d.days || []).map(function (x) { return '<button class="btn sec sm' + (day === x.dayNo ? ' on' : '') + '" data-day="' + x.dayNo + '">' + esc(x.title) + '</button>'; }).join('');

    var rows = AN_REGIONS.map(function (r) {
      var n = regions[r[0]] || 0;
      if (!n) return '';
      return '<tr><td>' + r[1] + '</td><td>' + fa(n) + '</td><td><span class="an-bar"><i style="width:' + Math.min(100, n * 22) + '%"></i></span></td></tr>';
    }).join('');

    $('anOut').innerHTML = '<div class="bar" style="margin:10px 0 4px">' + dayChips + '</div>' +
      '<div class="grid an-grid">' +
      '<div class="card an-body">' + anBodySvg() + '</div>' +
      '<div><div class="card"><h3>تعادل عضلانی</h3>' +
      '<div class="an-score"><b>' + fa(bal.score || 0) + '</b><small>از 100</small></div>' +
      '<table class="wrap"><tbody><tr><td>بالاتنه</td><td>' + fa(bal.upper || 0) + '</td></tr><tr><td>پایین‌تنه</td><td>' + fa(bal.lower || 0) + '</td></tr></tbody></table>' +
      ((bal.warnings || []).length ? '<div class="note">' + bal.warnings.map(function (w) { return '• ' + esc(w); }).join('<br>') + '</div>' : '<div class="note ok">ترکیب برنامه متعادل است ✅</div>') +
      '</div>' +
      (rows ? '<div class="card"><h3>حجم هر ناحیه</h3><table class="wrap"><thead><tr><th>ناحیه</th><th>حرکت</th><th>سهم</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '') +
      '</div></div>';

    anPaint($('anOut').querySelector('.an-body'), regions);
    $('anOut').querySelectorAll('[data-day]').forEach(function (b) {
      b.onclick = function () { st.day = Number(b.getAttribute('data-day')) || 0; render(); };
    });
    $('anOut').querySelectorAll('.an [data-r]').forEach(function (p) {
      p.onmousemove = function () {
        var n = p.getAttribute('data-n');
        if (n) toast(anName(p.getAttribute('data-r')) + ': ' + n + ' حرکت', false);
      };
    });
  }
};
